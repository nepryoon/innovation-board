import test from "node:test";
import assert from "node:assert/strict";
import { normalise, checkCitation, extractFigures, figureMatches, checkFigures, screenSources, screenStatement } from "../config/board/guardrails.js";
import { IDEAS } from "../config/board/data.js";
import { allowedFigures, derive, sourceScreen } from "../config/board/engine.js";
import { initialState } from "../config/board/protocol.js";

const strong = IDEAS["inspection-planner"].sources;
const trap = IDEAS["field-copilot"].sources;

test("normalise folds case, whitespace, typographic quotes and dashes", () => {
  assert.equal(normalise("  Rival   “A”\n— it’s  "), 'rival "a" - it\'s');
});

test("citation check: the quote must be a real substring of the cited source", () => {
  assert.equal(checkCitation("in 61 of them the prospect named   INSPECTION tracking as a gap", strong, "s1").ok, true, "case and whitespace normalised");
  assert.equal(checkCitation("“Recurrence and certificate expiry worked well.”", strong, "s9").ok, true, "surrounding quotation marks and a full stop are ignored");
  assert.match(checkCitation("in 61 of them the prospect named inspection tracking", strong, "s2").reason, /from s1, not the cited s2/);
  assert.match(checkCitation("customers are desperate for an inspection planner", strong, "s1").reason, /not found in s1/);
  assert.match(checkCitation("gap", strong, "s1").reason, /too short/);
  assert.match(checkCitation("Recurrence and certificate expiry worked well", strong, "s99").reason, /Unknown source/);
});

test("citation check rejects quotes from passages struck by the source screen", () => {
  const screen = screenSources(trap);
  const quote = "the AI field-service market will reach £48bn by 2030";
  assert.equal(checkCitation(quote, trap, "s1").ok, true, "the words are in the source");
  assert.match(checkCitation(quote, trap, "s1", screen).reason, /struck by the source screen/);
  assert.equal(checkCitation("my technicians won't talk to a phone in a customer's kitchen", trap, "s4", screen).ok, true);
});

test("source screen strikes figures in promotional sources only", () => {
  const trapScreen = screenSources(trap);
  assert.ok(trapScreen.passages.length >= 3);
  assert.ok(trapScreen.passages.every((p) => ["s1", "s2", "s3"].includes(p.source)));
  assert.ok(trapScreen.passages.some((p) => p.text.includes("£48bn")));
  assert.equal(screenSources(strong).passages.length, 0, "market reports, surveys and internal data are not screened");
  assert.ok(trapScreen.clean.s3.includes("No data sources were given"), "sentences without figures are kept");
});

test("figures are extracted with their unit and compared after normalisation", () => {
  const f = extractFigures("A £1.2m market, growing 18 per cent, 1,200 users, a 3-year horizon, £48bn, 6 weeks and 22 minutes; in 2026 there were 12 inspection types.");
  assert.deepEqual(f.map((x) => [x.kind, x.value]), [["money", 1200000], ["percent", 18], ["count", 1200], ["time", 1095], ["money", 48e9], ["time", 42], ["time", 22 / 480]]);
  assert.ok(figureMatches({ kind: "money", value: 438000 }, [{ kind: "money", value: 437912 }]), "rounding allowed");
  assert.ok(!figureMatches({ kind: "money", value: 600000 }, [{ kind: "money", value: 437912 }]));
  const [k, m, plain, months] = extractFigures("£438k, £0.4m, 10,000 technicians, 15 months");
  assert.ok(figureMatches(k, [{ kind: "money", value: 437912 }]) && figureMatches(m, [{ kind: "money", value: 437912 }]), "written precision");
  assert.ok(!figureMatches(plain, [{ kind: "count", value: 9800 }]), "an unrounded figure must be within 1%");
  assert.ok(figureMatches(months, [{ kind: "time", value: 15.2 * 30.4 }]));
  assert.ok(!figureMatches({ kind: "percent", value: 12 }, [{ kind: "money", value: 12 }]), "units must agree");
});

test("unverified-figure filter: a figure from a source passes", () => {
  const state = initialState("inspection-planner", "recorded");
  const allowed = allowedFigures(state, derive(state));
  const [s] = screenStatement("Sales saw 214 lost or stalled deals and 1,240 tickets about inspections.", allowed);
  assert.equal(s.struck, null);
  assert.equal(screenStatement("The survey covered 212 customer firms.", allowed)[0].struck, null, "figures in source titles count");
});

test("unverified-figure filter: a figure computed by code in this run passes", () => {
  const state = { ...initialState("inspection-planner", "recorded"), turn: 8,
    estimates: { w1: { o: 40, m: 60, p: 100 }, w2: { o: 20, m: 30, p: 50 }, w3: { o: 30, m: 50, p: 110 }, w4: { o: 15, m: 20, p: 35 }, w5: { o: 15, m: 25, p: 40 } },
    assumptions: Object.fromEntries([["price", 1950], ["adoption", 120], ["churn", 7], ["running", 65000]].map(([k, v]) => [k, { value: v, proposed: v, source: null, quote: "", rationale: "", status: "accepted", note: "" }])) };
  const derived = derive(state);
  const allowed = allowedFigures(state, derived);
  const npv = derived.finance.scenarios.base.npv;
  const text = `The base-case NPV is £${Math.round(npv / 1000)}k with payback in ${derived.finance.scenarios.base.paybackMonths} months and expected cost £${derived.estimate.cost.expected.toLocaleString("en-GB")}.`;
  assert.equal(screenStatement(text, allowed)[0].struck, null, text);
});

test("unverified-figure filter: an invented figure is struck, and so is a figure from a screened passage", () => {
  const state = initialState("field-copilot", "recorded");
  const allowed = allowedFigures(state, derive(state));
  const out = screenStatement("Report writing is a real pain point. The market is worth £48bn and growing 37% a year. Adoption could hit 5,000 users.", allowed);
  assert.equal(out[0].struck, null);
  assert.match(out[1].struck, /^Unverified figure: “£48bn”/);
  assert.match(out[2].struck, /“5,000 users”/);
  const kept = checkFigures([{ text: "Two of 14 firms would pay, and seven worried about wrong diagnoses.", struck: null }], allowed);
  assert.equal(kept[0].struck, null, "numbers without a unit are not figures");
  assert.equal(sourceScreen("field-copilot").passages.length, 5);
});
