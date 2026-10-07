// Runs the live board for every idea and saves each validated transcript as JSON.
// Usage: DEEPSEEK_API_KEY=... node scripts/record-board.mjs [ideaId ...]
// The key is read from the environment only and is never printed or written anywhere.

import { writeFile } from "node:fs/promises";
import { IDEAS } from "../site/config/board/data.js";
import { runTurn, startState, buildBrief } from "../site/config/board/engine.js";
import { resolveModel } from "../site/config/board/llm.js";
import { TURN_ORDER } from "../site/config/board/protocol.js";

const env = { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, BOARD_LLM_MODEL: process.env.BOARD_LLM_MODEL };
if (!env.DEEPSEEK_API_KEY) {
  console.error("DEEPSEEK_API_KEY is not set.");
  process.exit(1);
}
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("--"));
const OUT = new URL("../site/demos/innovation-board/recordings/", import.meta.url);

async function recordIdea(ideaId) {
  let state = startState(ideaId, "live");
  const turns = [];
  let invalidReplies = 0;
  while (turns.length < TURN_ORDER.length) {
    const result = await runTurn({ state, env });
    if (result.fallback || result.error) return { ok: false, reason: result.reason || result.error, at: turns.length };
    invalidReplies += result.event.invalidReplies.length;
    for (const sentence of result.event.sentences) if (sentence.struck) console.log(`  struck (${result.event.agent}): ${sentence.text} → ${sentence.struck}`);
    turns.push({ agent: result.event.agent, round: result.event.round, kind: result.event.kind, output: result.output, usage: result.event.usage, invalidReplies: result.event.invalidReplies });
    state = result.state;
  }
  const brief = buildBrief(state);
  return { ok: true, invalidReplies, brief, recording: {
    synthetic: true,
    note: "Recorded live board run on synthetic data. Replayed through the same citation check, figure filter and computations.",
    ideaId,
    model: resolveModel(env),
    recordedAt: new Date().toISOString().slice(0, 10),
    turns,
    summary: { tier: brief.tier.label, counters: brief.counters, metrics: brief.metrics, usage: brief.usage }
  } };
}

for (const ideaId of Object.keys(IDEAS)) {
  if (only.length && !only.includes(ideaId)) continue;
  let result;
  for (let attempt = 1; attempt <= 3; attempt++) {
    result = await recordIdea(ideaId);
    if (result.ok) break;
    console.log(`${ideaId}: attempt ${attempt} fell back at turn ${result.at} (${result.reason})`);
  }
  if (!result.ok) { console.log(`${ideaId}: FAILED`); continue; }
  if (!dryRun) await writeFile(new URL(`${ideaId}.json`, OUT), JSON.stringify(result.recording, null, 2) + "\n");
  const s = result.recording.summary;
  for (const t of result.recording.turns) {
    if (t.invalidReplies.length) console.log(`  invalid ${t.agent}/${t.kind}: ${t.invalidReplies.join(" || ")}`);
    console.log(`  turn ${t.agent}/${t.kind}: ${t.usage.promptTokens}+${t.usage.completionTokens} tokens`);
  }
  console.log(`${ideaId}: ${s.tier} | ${JSON.stringify(s.counters)} | ${JSON.stringify(s.metrics)} | tokens ${s.usage.promptTokens}+${s.usage.completionTokens} | invalid replies ${result.invalidReplies}`);
  const b = result.brief;
  console.log(`  finance: ${JSON.stringify(Object.fromEntries(Object.entries(b.finance.scenarios).map(([k, v]) => [k, [v.npv, v.roiPercent, v.paybackMonths]])))} | assumptions ${b.assumptions.map((a) => `${a.key}=${a.value}(${a.status})`).join(" ")} | cost ${JSON.stringify(b.estimate.cost)}`);
  for (const c of b.claims) if (c.status !== "accepted") console.log(`  ${c.id} ${c.status}: ${c.note}`);
}
