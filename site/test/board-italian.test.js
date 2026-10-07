import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { runAll, postTurn, loadRecording } from "./board-helpers.js";
import { checkCitation, extractFigures, figureMatches, screenSources, screenStatement } from "../config/board/guardrails.js";
import { IDEAS, TIERS } from "../config/board/data.js";
import { localeData, ideaFor, LOCALES } from "../config/board/locale.js";
import { MESSAGES } from "../config/board/messages.js";
import { allowedFigures, derive, sourceScreen } from "../config/board/engine.js";
import { initialState, signState, verifyState, validateState, TURN_ORDER } from "../config/board/protocol.js";
import { FORMULA_IT, TIER_ORDER } from "../config/board/scoring.js";
import { systemPrompt, userPrompt } from "../config/board/llm.js";
import { onRequestGet } from "../functions/api/board/turn.js";

const env = { BOARD_STATE_SECRET: "test-secret" };
const strongIt = ideaFor("inspection-planner", "it").sources;
const trapIt = ideaFor("field-copilot", "it").sources;
const getConfig = async (query = "") => (await onRequestGet({ env: {}, request: new Request(`http://localhost/api/board/turn${query}`) })).json();

// Same estimates and assumptions in both locales: every computed number must be identical.
const EST = { w1: { o: 40, m: 60, p: 100 }, w2: { o: 20, m: 30, p: 50 }, w3: { o: 30, m: 50, p: 110 }, w4: { o: 15, m: 20, p: 35 }, w5: { o: 15, m: 25, p: 40 } };
const assumptionsFor = (ideaId) => Object.fromEntries(Object.entries(IDEAS[ideaId].assumptions).map(([k, b]) => {
  const v = k === "adoption" ? Math.round((b.low + b.high) / 2) : (b.low + b.high) / 2;
  return [k, { value: v, proposed: v, source: null, quote: "", rationale: "", status: "accepted", note: "" }];
}));
const runState = (ideaId, locale) => ({ ...initialState(ideaId, "recorded", locale), turn: 8, estimates: EST, assumptions: assumptionsFor(ideaId),
  claims: [
    { id: "c1", agent: "strategy", dimension: "fit", score: 4, source: "s1", quote: "q", reason: "", status: "accepted", note: "", round: 1 },
    { id: "c2", agent: "market", dimension: "market", score: 3, source: "s5", quote: "q", reason: "", status: "accepted", note: "", round: 1 },
    { id: "c3", agent: "delivery", dimension: "feasibility", score: 4, source: "s9", quote: "q", reason: "", status: "accepted", note: "", round: 1 },
    { id: "c4", agent: "delivery", dimension: "risk", score: 3, source: "s2", quote: "q", reason: "", status: "unsupported", note: "", round: 1 }
  ] });

// --- Citation check ---------------------------------------------------------------------

test("Italian citation check: quotes are checked against the Italian sources", () => {
  assert.equal(checkCitation("in 61 di queste il potenziale cliente ha indicato   LA GESTIONE delle verifiche", strongIt, "s1", null, "it").ok, true, "case and whitespace normalised");
  assert.equal(checkCitation("“Ricorrenze e scadenze dei certificati hanno funzionato bene.”", strongIt, "s9", null, "it").ok, true, "quotation marks and full stop ignored");
  assert.equal(checkCitation("l’elenco dei siti che abbiamo già", strongIt, "s3", null, "it").ok, true, "typographic apostrophe normalised");
  assert.match(checkCitation("in 61 di queste il potenziale cliente ha indicato", strongIt, "s2", null, "it").reason, /^La citazione è tratta da s1, non dalla fonte citata s2\.$/);
  assert.match(checkCitation("i clienti chiedono a gran voce uno scadenzario", strongIt, "s1", null, "it").reason, /^Citazione non trovata in s1\.$/);
  assert.match(checkCitation("lacuna", strongIt, "s1", null, "it").reason, /troppo breve/);
  assert.equal(checkCitation("Recurrence and certificate expiry worked well", strongIt, "s9", null, "it").ok, false, "an English quote does not match the Italian pack");
  const screen = screenSources(trapIt, "it");
  const hype = "il mercato dell'AI per l'assistenza sul campo raggiungerà 48 miliardi di euro entro il 2030";
  assert.equal(checkCitation(hype, trapIt, "s1", null, "it").ok, true);
  assert.match(checkCitation(hype, trapIt, "s1", screen, "it").reason, /escluso dal filtro delle fonti/);
});

// --- Unverified-figure filter -------------------------------------------------------------

test("Italian figures: thousands dot, decimal comma, mila, milioni, miliardi, mln, mld, per cento, euro sign either side, time units", () => {
  const f = extractFigures("Ricavi di 1,2 milioni di euro, 438 mila €, € 66.968, 21 mln €, 48 mld €, 3 miliardi; churn al 12,5%, 9 per cento, 4 punti; 1.240 ticket, 300 aziende clienti; 26,8 mesi, 6 settimane, 3 anni, 10 giorni, 2 giornate, 22 minuti; nel 2026 c'erano 12 tipi di verifica.", "it");
  assert.deepEqual(f.map((x) => [x.kind, x.value]), [
    ["money", 1.2e6], ["money", 438000], ["money", 66968], ["money", 21e6], ["money", 48e9], ["money", 3e9],
    ["percent", 12.5], ["percent", 9], ["percent", 4], ["count", 1240], ["count", 300],
    ["time", 26.8 * 30.4], ["time", 42], ["time", 1095], ["time", 10], ["time", 2], ["time", 22 / 480]
  ]);
  // The rounding rules are those of English: the written precision, otherwise 1%.
  const [k, m, exact] = extractFigures("438 mila €, 0,4 mln €, 10.000 tecnici", "it");
  assert.ok(figureMatches(k, [{ kind: "money", value: 437912 }]) && figureMatches(m, [{ kind: "money", value: 437912 }]));
  assert.ok(!figureMatches(exact, [{ kind: "count", value: 9800 }]));
  const [en] = extractFigures("£438k", "en");
  assert.equal(en.tolerance, k.tolerance, "same tolerance as the English figure");
});

test("Italian figure filter: a figure from an Italian source passes", () => {
  const state = initialState("inspection-planner", "recorded", "it");
  const allowed = allowedFigures(state, derive(state));
  assert.equal(screenStatement("L'area commerciale ha registrato 214 trattative perse e 1.240 ticket sulle verifiche.", allowed, "it")[0].struck, null);
  assert.equal(screenStatement("Il sondaggio ha coinvolto 212 aziende clienti.", allowed, "it")[0].struck, null, "figures in source titles count");
  assert.equal(screenStatement("Il costo di esercizio va da 50.000 € a 80.000 € all'anno.", allowed, "it")[0].struck, null);
});

test("Italian figure filter: a figure computed by code passes in Italian format", () => {
  const state = runState("inspection-planner", "it");
  const derived = derive(state);
  const allowed = allowedFigures(state, derived);
  const base = derived.finance.scenarios.base;
  const it = (n) => n.toLocaleString("it-IT", { useGrouping: "always" });
  const text = `Il VAN dello scenario base è di ${Math.round(base.npv / 1000)} mila €, con payback in ${String(base.paybackMonths).replace(".", ",")} mesi e un costo atteso di ${it(derived.estimate.cost.expected)} €.`;
  assert.equal(screenStatement(text, allowed, "it")[0].struck, null, text);
  assert.equal(screenStatement(`Il ROI è del ${base.roiPercent}%.`, allowed, "it")[0].struck, null);
});

test("Italian figure filter: an invented figure is struck, and so is one from a screened passage", () => {
  const state = initialState("field-copilot", "recorded", "it");
  const allowed = allowedFigures(state, derive(state));
  const out = screenStatement("La stesura dei rapporti è il vero problema. Il mercato vale 48 miliardi di euro. L'adozione potrebbe arrivare a 5.000 utenti.", allowed, "it");
  assert.equal(out[0].struck, null);
  assert.match(out[1].struck, /^Dato non verificato: “48 miliardi di euro”/);
  assert.match(out[2].struck, /“5\.000 utenti”/);
  assert.equal(screenStatement("Due aziende su 14 pagherebbero e sette temono diagnosi sbagliate.", allowed, "it")[0].struck, null, "numbers without a unit are not figures");
});

// --- Source screen ------------------------------------------------------------------------

test("Italian source screen strikes the same five hype passages in the trap sources", () => {
  const it = sourceScreen("field-copilot", "it").passages;
  const en = sourceScreen("field-copilot", "en").passages;
  assert.equal(it.length, 5);
  assert.deepEqual(it.map((p) => p.source), en.map((p) => p.source));
  assert.deepEqual(it.map((p) => extractFigures(p.text, "it")[0].value), en.map((p) => extractFigures(p.text, "en")[0].value), "the same figure starts each struck passage");
  assert.ok(it.every((p) => p.struck.startsWith("Dato non verificato:")));
  assert.equal(sourceScreen("inspection-planner", "it").passages.length, 0);
  assert.equal(sourceScreen("payment-matching", "it").passages.length, 0);
  assert.ok(sourceScreen("field-copilot", "it").clean.s3.includes("Per le previsioni non è stata indicata alcuna fonte di dati."));
});

// --- Locale in the signed state -------------------------------------------------------------

test("the locale is allow-listed, part of the signed state, and cannot change during a run", async () => {
  assert.deepEqual(LOCALES, ["en", "it"]);
  assert.equal(initialState("inspection-planner", "recorded").locale, "en", "English by default");
  const signed = await signState(initialState("inspection-planner", "recorded", "it"), env);
  assert.equal((await verifyState(signed, env)).ok, true);
  assert.match((await verifyState({ ...signed, locale: "en" }, env)).error, /altered/, "switching the locale mid-run is refused");
  assert.equal(validateState({ ...initialState("inspection-planner", "recorded"), locale: "fr" }).ok, false);
  const { locale, ...noLocale } = initialState("inspection-planner", "recorded");
  assert.equal(validateState(noLocale).ok, false);

  const tampered = await postTurn({ state: { ...signed, locale: "en" } }, env);
  assert.equal(tampered.status, 400);
  assert.match((await tampered.json()).error, /altered/);
  const altered = await postTurn({ state: { ...signed, turn: 3 } }, env);
  assert.match((await altered.json()).error, /^La firma dello stato non corrisponde/, "errors in the run's language");
  const bad = await postTurn({ start: { ideaId: "inspection-planner", locale: "fr" } }, env);
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /Unknown locale/);
  const first = await (await postTurn({ start: { ideaId: "inspection-planner", mode: "recorded", locale: "it" } }, env)).json();
  assert.equal(first.state.locale, "it");
  assert.equal(first.event.sentences[0].text.includes("Brindle") || /[àèéìòù]|\b(il|la|di|che)\b/.test(first.event.sentences.map((s) => s.text).join(" ")), true, "the Italian recording is replayed");
});

test("GET ?locale=it returns the Italian configuration; unknown locales are refused", async () => {
  const en = await getConfig();
  const it = await getConfig("?locale=it");
  assert.equal(en.locale, "en");
  assert.equal(it.locale, "it");
  assert.equal(it.company.name, "Brindlecote Systems (fittizia)");
  assert.deepEqual(it.tiers, { invest: "Investire ora", pilot: "Avviare un progetto pilota", explore: "Approfondire", park: "Accantonare" });
  assert.deepEqual(it.formula, FORMULA_IT);
  assert.deepEqual(it.agents.map((a) => a.name), en.agents.map((a) => a.name), "agent names stay the same");
  assert.notDeepEqual(it.agents.map((a) => a.role), en.agents.map((a) => a.role), "roles are translated");
  assert.equal(it.ideas.find((i) => i.id === "field-copilot").screen.length, 5);
  assert.equal(it.ideas.reduce((n, i) => n + i.sources.length, 0), 27);
  assert.deepEqual(it.ideas.map((i) => i.assumptions.price.low), en.ideas.map((i) => i.assumptions.price.low), "same numbers");
  const res = await onRequestGet({ env: {}, request: new Request("http://localhost/api/board/turn?locale=xx") });
  assert.equal(res.status, 400);
});

// --- Recorded fallback in Italian ---------------------------------------------------------

for (const ideaId of Object.keys(IDEAS)) {
  test(`Italian recorded fallback produces a complete Italian brief: ${ideaId}`, async () => {
    const recording = await loadRecording(ideaId, "it");
    assert.equal(recording.synthetic, true);
    assert.equal(recording.locale, "it");
    assert.deepEqual(recording.turns.map((t) => `${t.agent}/${t.kind}`), TURN_ORDER.map((t) => `${t.agent}/${t.kind}`));
    const { responses, last } = await runAll(ideaId, {}, {}, "it");
    assert.equal(responses.length, TURN_ORDER.length);
    assert.ok(responses.every((r) => r.mode === "recorded" && !r.error && !r.fallback));
    const b = last.brief;
    assert.ok(Object.values(localeData("it").TIERS).includes(b.tier.label), b.tier.label);
    assert.match(b.tier.rule, /^(Investire ora|Avviare un progetto pilota|Approfondire|Accantonare):/);
    assert.equal(b.assumptions.length, 4);
    assert.ok(b.assumptions.every((a) => a.value >= a.low && a.value <= a.high && a.label === ideaFor(ideaId, "it").assumptions[a.key].label));
    assert.ok(b.estimate.packages.every((p) => p.label === ideaFor(ideaId, "it").workPackages.find((w) => w.id === p.id).label));
    assert.ok(b.mindChangers.length >= 1 && b.mindChangers[0].by === "code");
    assert.match(b.experiment.reason, /esperimento/);
    assert.ok(b.claims.filter((c) => c.status === "accepted").every((c) => c.note === `Verificata in ${c.source}`));
    assert.equal(b.counters.unsupported, b.claims.filter((c) => c.status === "unsupported").length);
    for (const name of ["pessimistic", "base", "optimistic"]) assert.ok(Number.isFinite(b.finance.scenarios[name].npv));
  });
}

test("Italian runs: the trap idea shows strikes and a lower tier than the strong idea", async () => {
  const trap = (await runAll("field-copilot", {}, {}, "it")).last.brief;
  const strong = (await runAll("inspection-planner", {}, {}, "it")).last.brief;
  assert.equal(trap.counters.screenedPassages, 5);
  assert.ok(trap.counters.struckFigures >= 1, `expected an unverified-figure strike, got ${trap.counters.struckFigures}`);
  assert.ok(TIER_ORDER.indexOf(trap.tier.id) < TIER_ORDER.indexOf(strong.tier.id), `${trap.tier.label} should be below ${strong.tier.label}`);
});

// --- One engine, identical numbers ------------------------------------------------------------

test("identical assumptions and estimates give identical cost, NPV, ROI, payback and tier in both locales", () => {
  for (const ideaId of Object.keys(IDEAS)) {
    const en = derive(runState(ideaId, "en"));
    const it = derive(runState(ideaId, "it"));
    assert.deepEqual(it.estimate.cost, en.estimate.cost, `${ideaId}: development cost`);
    assert.deepEqual(it.estimate.effort, en.estimate.effort);
    assert.deepEqual(it.estimate.weeks, en.estimate.weeks);
    for (const name of ["pessimistic", "base", "optimistic"]) {
      const [a, b] = [en.finance.scenarios[name], it.finance.scenarios[name]];
      assert.deepEqual([b.npv, b.roi, b.roiPercent, b.paybackMonths, b.rows], [a.npv, a.roi, a.roiPercent, a.paybackMonths, a.rows], `${ideaId} ${name}`);
    }
    assert.deepEqual(it.finance.sensitivity.map((r) => [r.key, r.npvWorst, r.npvBest]), en.finance.sensitivity.map((r) => [r.key, r.npvWorst, r.npvBest]));
    assert.equal(it.finance.top.breakEven, en.finance.top.breakEven);
    assert.deepEqual(it.metrics, en.metrics);
    assert.equal(it.tier.id, en.tier.id, `${ideaId}: tier`);
    assert.equal(it.tier.label, localeData("it").TIERS[en.tier.id]);
    assert.equal(en.tier.label, TIERS[en.tier.id]);
    assert.deepEqual([it.experiment.id, it.experiment.cost], [en.experiment.id, en.experiment.cost]);
  }
});

// --- Prompts --------------------------------------------------------------------------------

test("Italian prompts ask for Italian statements and quotes copied from the Italian sources", () => {
  const state = initialState("field-copilot", "live", "it");
  const turn = TURN_ORDER[0];
  const system = systemPrompt(turn, "it");
  const user = userPrompt(turn, state);
  assert.match(system, /in natural, professional Italian/);
  assert.match(system, /copied verbatim from the Italian evidence pack/);
  assert.match(system, /JSON keys, ids .* stay in English/);
  assert.doesNotMatch(system, /British English/);
  assert.ok(user.includes(trapIt[3].text), "the Italian sources are in the prompt");
  assert.match(user, /Sviluppatore software 600 €/);
  assert.doesNotMatch(user, /£/);
  assert.ok((system + user).length < 10000);
  assert.match(systemPrompt(turn, "en"), /Plain British English/);
  assert.doesNotMatch(systemPrompt(turn, "en"), /Italian/);
});

// --- Nothing left in English ----------------------------------------------------------------

// Words both languages use, and site-wide labels that this demo does not own.
const SHARED = new Set(["Ada", "Milo", "Dara", "Vera", "Fen", "Sol", "ROI", "PERT E", "Scenario", "Payback", "Base", "Home", "Product manager", "Data engineer", "Designer",
  "Innovation Board", "Neuromorphic Inference Lab", "© 2025 Neuromorphic Inference Lab", "branch: …", "commit: …", "built: …", "github.com/nepryoon/innovation-board", "English", "Italiano", "·", "Idea", "Spike tecnico"]);
const SHARED_KEYS = new Set(["baseMarker", "briefIdea", "versus"]);

const pageText = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").split(/<[^>]+>/)
  .map((t) => t.replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim()).filter((t) => t && /[A-Za-z]/.test(t));

async function interfaceStrings() {
  const js = await readFile(new URL("../demos/innovation-board/app.js", import.meta.url), "utf8");
  const block = js.slice(js.indexOf("// --- Interface strings (begin)"), js.indexOf("// --- Interface strings (end)"));
  return vm.runInNewContext(`${block}\nUI`);
}

function flatten(value, path = "", out = []) {
  if (typeof value === "string") out.push([path, value]);
  else if (typeof value === "function") {
    // Templates are called with placeholders; the message templates also take a list or the policy.
    const tries = [["A", "B", "C", "D", "E", "F", "G"], ["A", ["B"]], [{ investNow: {}, pilot: {} }]];
    for (const args of tries) {
      try { flatten(value(...args), path, out); break; } catch { /* try the next shape */ }
    }
  }
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) flatten(v, path ? `${path}.${k}` : k, out);
  return out;
}

test("the Italian interface dictionary has every English key and no English value left", async () => {
  const UI = await interfaceStrings();
  const en = Object.fromEntries(flatten(UI.en));
  const it = Object.fromEntries(flatten(UI.it));
  assert.deepEqual(Object.keys(it).sort(), Object.keys(en).sort(), "same keys");
  const left = Object.keys(en).filter((k) => it[k] === en[k] && !SHARED.has(en[k]) && !SHARED_KEYS.has(k.split(".")[0]));
  assert.deepEqual(left, [], `untranslated: ${left.join(", ")}`);
  assert.equal(UI.it.live, "Board LLM dal vivo");
  assert.equal(UI.it.recorded, "Esecuzione registrata");
});

test("the Italian page contains no English interface text", async () => {
  const UI = await interfaceStrings();
  const enHtml = await readFile(new URL("../demos/innovation-board/index.html", import.meta.url), "utf8");
  const itHtml = await readFile(new URL("../demos/innovation-board/it/index.html", import.meta.url), "utf8");
  const enChunks = pageText(enHtml).flatMap((t) => [t, ...t.split(/(?<=[.:;])\s+/).filter((s) => s !== t && (s.match(/[A-Za-z]{3,}/g) || []).length >= 3)]);
  const itChunks = new Set(pageText(itHtml));
  const itFull = [...itChunks].join(" \n ");
  const left = enChunks.filter((t) => !SHARED.has(t) && (itChunks.has(t) || (t.split(" ").length >= 4 && itFull.includes(t))));
  const dictionary = flatten(UI.en).map(([, v]) => v).filter((v) => !SHARED.has(v) && v.split(" ").length >= 2 && !/^[A-G](\W+[A-G])*\W*$/.test(v));
  left.push(...dictionary.filter((v) => itFull.includes(v)));
  for (const attr of itHtml.matchAll(/\s(?:aria-label|alt|content)="([^"]+)"/g)) {
    if (!SHARED.has(attr[1]) && enHtml.includes(`="${attr[1]}"`) && !/^(width=|Neuromorphic)/.test(attr[1])) left.push(attr[1]);
  }
  assert.deepEqual(left, [], `English left on the Italian page: ${left.join(" | ")}`);
});

test("the Italian configuration and recorded briefs contain no English strings", async () => {
  const strings = (obj) => flatten(obj).filter(([p, v]) => !/(^|\.)(id|type|grade|agent|colour|glyph|date|role|unit|source|sources\.\d+|rangeSources\.\d+|key|mode|locale|model|kind|status|issue|dimension|target|targetAgent|by|by)$/.test(p) && !/^[a-z]\d+$|^[a-z-]+$/.test(v));
  const enValues = new Set(strings(await getConfig()).map(([, v]) => v));
  const left = strings(await getConfig("?locale=it")).filter(([, v]) => enValues.has(v) && !SHARED.has(v));
  assert.deepEqual(left, [], `English left in the Italian configuration: ${left.map(([p]) => p).join(", ")}`);

  const englishMessages = flatten(MESSAGES.en).map(([, v]) => v.replace(/[A-G]/g, "").trim()).filter((v) => v.split(" ").length >= 3);
  for (const ideaId of Object.keys(IDEAS)) {
    const { responses } = await runAll(ideaId, {}, {}, "it");
    const text = JSON.stringify(responses.map((r) => ({ event: r.event, brief: r.brief })));
    for (const phrase of ["Verified in", "Unverified figure", "Development cost", "base-case NPV", "Score revised", "Estimate:", "Chair's note", "Invest now", "Run a pilot", "Explore further", "Park:"]) {
      assert.ok(!text.includes(phrase), `${ideaId}: “${phrase}” in an Italian run`);
    }
    for (const fragment of englishMessages.flatMap((m) => m.split(/[“”()]/)).map((f) => f.trim()).filter((f) => f.split(" ").length >= 4)) {
      assert.ok(!text.includes(fragment), `${ideaId}: “${fragment}” in an Italian run`);
    }
  }
});

test("the Italian page shares the script and styles, links both languages and keeps the page contract", async () => {
  const en = await readFile(new URL("../demos/innovation-board/index.html", import.meta.url), "utf8");
  const it = await readFile(new URL("../demos/innovation-board/it/index.html", import.meta.url), "utf8");
  assert.match(it, /<html lang="it">/);
  for (const html of [en, it]) {
    assert.match(html, /<script type="module" src="\/demos\/innovation-board\/app\.js"><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="\/demos\/innovation-board\/board\.css" \/>/);
    assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/www\.neuromorphicinference\.com\/demos\/innovation-board\/" \/>/);
    assert.match(html, /<link rel="alternate" hreflang="it" href="https:\/\/www\.neuromorphicinference\.com\/demos\/innovation-board\/it\/" \/>/);
    assert.match(html, /class="lang-switch"/);
    assert.doesNotMatch(html, /<style>/);
  }
  assert.match(en, /href="\/demos\/innovation-board\/it\/" hreflang="it" lang="it">Italiano<\/a>/);
  assert.match(it, /href="\/demos\/innovation-board\/" hreflang="en" lang="en">English<\/a>/);
  const ids = (html) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids(it), ids(en), "same element IDs, so app.js drives both pages");
  for (const line of FORMULA_IT) assert.ok(it.includes(line), `formula missing: ${line}`);
  for (const tier of ["Investire ora", "Avviare un progetto pilota", "Approfondire", "Accantonare"]) assert.ok(it.includes(`>${tier}</button>`), tier);
  assert.ok(it.includes("Azienda, idee e fonti fittizie (dati sintetici). Ricerca simulata."));
  assert.match(it, /<h3 class="mt-12">Limiti<\/h3>/);
  assert.match(it, /<h2 id="how-title">Come funziona<\/h2>/);
  assert.doesNotMatch(it, /<textarea|type="text"|type="file"/);
});
