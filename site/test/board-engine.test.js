import test from "node:test";
import assert from "node:assert/strict";
import { runAll, postTurn, fakeLlm, loadRecording } from "./board-helpers.js";
import { applyTurn, validateOutput } from "../config/board/engine.js";
import { initialState, turnAt } from "../config/board/protocol.js";
import { systemPrompt, userPrompt } from "../config/board/llm.js";

const env = { DEEPSEEK_API_KEY: "sk-test-key", BOARD_STATE_SECRET: "s" };

test("a live run calls the LLM once per turn, counts tokens and never forwards reasoning or the key", async () => {
  const recording = await loadRecording("inspection-planner");
  const llm = fakeLlm(recording.turns.map((t) => t.output));
  const { responses, last } = await runAll("inspection-planner", env, { fetchImpl: llm.fetchImpl });
  assert.equal(llm.calls.length, 10);
  assert.ok(llm.calls.every((c) => c.thinking.type === "disabled" && c.model === "deepseek-flash" && c.response_format.type === "json_object"));
  assert.ok(responses.every((r) => r.mode === "live"));
  assert.equal(last.brief.usage.llmTurns, 10);
  assert.equal(last.brief.usage.promptTokens, 15000);
  const body = JSON.stringify(responses);
  assert.doesNotMatch(body, /SECRET-REASONING|reasoning_content|sk-test-key/);
});

test("prompts are short and built from allow-listed data only", () => {
  const state = initialState("field-copilot", "live");
  for (let i = 0; i < 3; i++) {
    const turn = turnAt(i);
    const prompt = systemPrompt(turn) + userPrompt(turn, state);
    assert.ok(prompt.length < 9000, `turn ${i} prompt is ${prompt.length} characters`);
    assert.match(prompt, /synthetic/i);
  }
});

test("an invalid turn is retried once, then the run falls back to the recording", async () => {
  const llm = fakeLlm([{ message: "Hello" }, "not json at all"]);
  const res = await (await postTurn({ start: { ideaId: "inspection-planner", mode: "live" } }, env, { fetchImpl: llm.fetchImpl })).json();
  assert.equal(res.fallback, true);
  assert.match(res.reason, /invalid turn twice/);
  assert.equal(llm.calls.length, 2);
  assert.match(llm.calls[1].messages.at(-1).content, /rejected/);
});

test("provider errors and a missing key fall back to the recording", async () => {
  const llm = fakeLlm([503, 503]);
  const res = await (await postTurn({ start: { ideaId: "payment-matching", mode: "live" } }, env, { fetchImpl: llm.fetchImpl })).json();
  assert.equal(res.fallback, true);
  assert.match(res.reason, /HTTP 503/);
  const nokey = await (await postTurn({ start: { ideaId: "payment-matching", mode: "live" } }, {})).json();
  assert.equal(nokey.fallback, true);
  assert.match(nokey.reason, /No LLM key/);
});

test("the Delivery Lead's estimate ranges are validated before they count", () => {
  const state = { ...initialState("inspection-planner", "live"), turn: 2 };
  const turn = turnAt(2);
  const claims = [{ dimension: "feasibility", score: 4, source: "s9", quote: "Recurrence and certificate expiry worked well", reason: "ok" }];
  const est = ["w1", "w2", "w3", "w4", "w5"].map((wp) => ({ wp, o: 10, m: 15, p: 25 }));
  assert.equal(validateOutput(turn, { message: "Fine.", claims, estimates: est }, state).ok, true);
  const backwards = validateOutput(turn, { message: "Fine.", claims, estimates: [{ ...est[0], o: 30 }, ...est.slice(1)] }, state);
  assert.match(backwards.errors.join(), /optimistic ≤ likely ≤ pessimistic/);
  assert.match(validateOutput(turn, { message: "Fine.", claims, estimates: est.slice(1) }, state).errors.join(), /every work package/);
});

test("assumptions: in-range values stand, out-of-range ones are clamped, unsupported ones use the cautious end", () => {
  const state = { ...initialState("inspection-planner", "live"), turn: 7, estimates: { w1: { o: 10, m: 15, p: 25 }, w2: { o: 10, m: 15, p: 25 }, w3: { o: 10, m: 15, p: 25 }, w4: { o: 10, m: 15, p: 25 }, w5: { o: 10, m: 15, p: 25 } } };
  const turn = turnAt(7);
  const output = { message: "Base case set from the evidence. Price at £2,000 per firm.", assumptions: [
    { key: "price", value: 2000, source: "s1", quote: "would accept an add-on priced between £1,500 and £2,400 per year", rationale: "Middle of the range." },
    { key: "adoption", value: 400, source: "s6", quote: "They expect 80 to 160 customer firms to adopt", rationale: "Hopeful." },
    { key: "churn", value: 7, source: "s6", quote: "a quote that does not exist anywhere", rationale: "" },
    { key: "running", value: 60000, source: "s9", quote: "Running cost is estimated at £50,000 to £80,000 a year", rationale: "Could be as low as £31,415." }
  ] };
  const check = validateOutput(turn, output, state);
  assert.equal(check.ok, true);
  const { state: next, event } = applyTurn(state, turn, check.value);
  const a = next.assumptions;
  assert.equal(a.price.status, "accepted");
  assert.equal(a.price.value, 2000);
  assert.equal(a.adoption.status, "clamped");
  assert.equal(a.adoption.value, 160);
  assert.equal(a.churn.status, "unsupported");
  assert.equal(a.churn.value, 10, "cautious end of the churn range");
  assert.match(a.running.note, /Rationale struck: unverified figure/);
  assert.equal(next.figureStrikes, 1);
  assert.equal(event.sentences.filter((s) => s.struck).length, 0, "£2,000 is the validated assumption, so it may be stated");
});

test("an agent's invented figure is struck from the record and excluded from later prompts", () => {
  const state = initialState("field-copilot", "live");
  const turn = turnAt(0);
  const value = validateOutput(turn, { message: "Report writing is the real need. This could reach 10,000 technicians in a year.", claims: [
    { dimension: "fit", score: 2, source: "s9", quote: "No lost deal in the first half of 2026 named AI as the reason", reason: "No demand signal." },
    { dimension: "fit", score: 5, source: "s3", quote: "customers will pay a premium for anything labelled AI", reason: "Hype." },
    { dimension: "fit", score: 4, source: "s9", quote: "Prospects ask about AI in roughly one demo in four", reason: "A £5m opportunity." }
  ] }, state).value;
  const { state: next, event } = applyTurn(state, turn, value);
  assert.deepEqual(event.claims.map((c) => c.status), ["accepted", "accepted", "struck"]);
  assert.match(event.claims[2].note, /Unverified figure: “£5m”/);
  assert.match(event.sentences[1].struck, /“10,000 technicians”/);
  assert.equal(event.counters.struckFigures, 2);
  assert.doesNotMatch(next.said[0].text, /10,000/);
  assert.ok(event.sourceScreen.length >= 1, "the source screen is reported on the first turn");
});
