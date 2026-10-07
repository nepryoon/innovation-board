// Turn engine: asks one agent for one turn (live LLM or recorded transcript), validates the reply,
// applies the guardrails and recomputes every number. Live and recorded turns run through the same code.

import { COMPANY, POLICY, IDEAS, DIMENSIONS, ASSUMPTION_KEYS, dimensionsFor, sourceIds, experimentCost } from "./data.js";
import { checkCitation, screenSources, screenStatement, checkFigures, extractFigures, figureMatches, splitSentences } from "./guardrails.js";
import { computeMetrics, auditCounters, computeEstimate, computeFinance, decideTier, nextExperiment, findDissent, rangeError } from "./scoring.js";
import { TURN_ORDER, MAX_TURNS, MAX_CLAIMS, ISSUES, TIER_IDS, turnAt, initialState, signState } from "./protocol.js";
import { callLlm, systemPrompt, userPrompt, resolveModel, parseJson, MAX_TOKENS } from "./llm.js";

const LIMITS = { openingClaims: 4, newClaims: 1, revisions: 4, challenges: 5, dissent: 3, mindChangers: 3 };

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const asNumber = (v) => {
  const n = typeof v === "string" ? Number(v.replace(/[£,%\s]/g, "")) : v;
  return Number.isFinite(n) ? n : null;
};
const asScore = (v) => {
  const n = asNumber(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

const screens = new Map();
export function sourceScreen(ideaId) {
  if (!screens.has(ideaId)) screens.set(ideaId, screenSources(IDEAS[ideaId].sources));
  return screens.get(ideaId);
}

// --- Structural validation of one agent reply -------------------------------------------------

function validateClaims(list, turn, state, max, errors) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) { errors.push("claims must be an array"); return []; }
  const dims = dimensionsFor(turn.agent);
  const ids = sourceIds(state.ideaId);
  return list.slice(0, max).flatMap((c, i) => {
    if (!isObj(c)) { errors.push(`claim ${i + 1} is not an object`); return []; }
    const score = asScore(c.score);
    if (!dims.includes(c.dimension)) { errors.push(`claim ${i + 1}: dimension must be one of ${dims.join(", ")}`); return []; }
    if (score === null) { errors.push(`claim ${i + 1}: score must be an integer from 1 to 5`); return []; }
    if (!ids.includes(c.source)) { errors.push(`claim ${i + 1}: source must be one of ${ids.join(", ")}`); return []; }
    if (!text(c.quote, 400)) { errors.push(`claim ${i + 1}: quote is required`); return []; }
    return [{ dimension: c.dimension, score, source: c.source, quote: text(c.quote, 300), reason: text(c.reason, 300) }];
  });
}

function validateEstimates(list, state, requireAll, errors) {
  if (list === undefined && !requireAll) return [];
  if (!Array.isArray(list)) { errors.push("estimates must be an array"); return []; }
  const packages = IDEAS[state.ideaId].workPackages.map((w) => w.id);
  const seen = new Set();
  const out = [];
  for (const [i, e] of list.slice(0, packages.length).entries()) {
    if (!isObj(e) || !packages.includes(e.wp) || seen.has(e.wp)) { errors.push(`estimate ${i + 1}: wp must be one of ${packages.join(", ")}, once each`); continue; }
    const value = { o: asNumber(e.o), m: asNumber(e.m), p: asNumber(e.p) };
    const problem = rangeError(value);
    if (problem) { errors.push(`estimate ${e.wp}: ${problem}`); continue; }
    seen.add(e.wp);
    out.push({ wp: e.wp, ...value });
  }
  if (requireAll && seen.size !== packages.length) errors.push(`estimates must cover every work package: ${packages.join(", ")}`);
  return out;
}

export function validateOutput(turn, output, state) {
  const errors = [];
  if (!isObj(output)) return { ok: false, errors: ["reply must be a JSON object"] };
  const message = text(output.message, 900);
  if (!message) errors.push("message is required");
  const value = { message };

  if (turn.kind === "opening") {
    value.claims = validateClaims(output.claims, turn, state, LIMITS.openingClaims, errors);
    if (!value.claims.length && !errors.length) errors.push("make at least one claim");
    if (turn.agent === "delivery") value.estimates = validateEstimates(output.estimates, state, true, errors);
  } else if (turn.kind === "review") {
    const targets = new Set([...state.claims.map((c) => c.id), ...IDEAS[state.ideaId].workPackages.map((w) => w.id)]);
    const list = Array.isArray(output.challenges) ? output.challenges : output.challenges === undefined ? [] : null;
    if (!list) errors.push("challenges must be an array");
    value.challenges = (list || []).slice(0, LIMITS.challenges).flatMap((ch, i) => {
      if (!isObj(ch) || !targets.has(ch.target)) { errors.push(`challenge ${i + 1}: target must be an existing claim ID or work package ID`); return []; }
      return [{ target: ch.target, issue: ISSUES.includes(ch.issue) ? ch.issue : "weak", note: text(ch.note, 240) }];
    });
  } else if (turn.kind === "response") {
    const own = new Set(state.claims.filter((c) => c.agent === turn.agent).map((c) => c.id));
    const list = Array.isArray(output.revisions) ? output.revisions : output.revisions === undefined ? [] : null;
    if (!list) errors.push("revisions must be an array");
    value.revisions = (list || []).slice(0, LIMITS.revisions).flatMap((rv, i) => {
      const score = isObj(rv) ? asScore(rv.score) : null;
      if (!isObj(rv) || !own.has(rv.claim)) { errors.push(`revision ${i + 1}: claim must be one of your own claim IDs`); return []; }
      if (score === null) { errors.push(`revision ${i + 1}: score must be an integer from 1 to 5`); return []; }
      return [{ claim: rv.claim, score, reason: text(rv.reason, 300) }];
    });
    if (turn.agent === "delivery") value.estimates = validateEstimates(output.estimates, state, false, errors);
    else value.claims = validateClaims(output.claims, turn, state, LIMITS.newClaims, errors);
  } else if (turn.kind === "assumptions") {
    const list = Array.isArray(output.assumptions) ? output.assumptions : [];
    value.assumptions = {};
    for (const a of list) {
      if (!isObj(a) || !ASSUMPTION_KEYS.includes(a.key) || value.assumptions[a.key]) continue;
      const v = asNumber(a.value);
      if (v === null) { errors.push(`assumption ${a.key}: value must be a number`); continue; }
      value.assumptions[a.key] = { value: v, source: typeof a.source === "string" ? a.source.slice(0, 8) : null, quote: text(a.quote, 300), rationale: text(a.rationale, 300) };
    }
    const missing = ASSUMPTION_KEYS.filter((k) => !value.assumptions[k]);
    if (missing.length) errors.push(`assumptions must include ${missing.join(", ")}`);
  } else if (turn.kind === "brief") {
    if (!TIER_IDS.includes(output.tier)) errors.push(`tier must be one of ${TIER_IDS.join(", ")}`);
    value.tier = output.tier;
    const list = (v, n) => (Array.isArray(v) ? v.map((d) => text(d, 240)).filter(Boolean).slice(0, n) : []);
    value.dissent = list(output.dissent, LIMITS.dissent);
    value.mindChangers = list(output.mindChangers, LIMITS.mindChangers);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

// --- Derived values: everything code computes from the state ----------------------------------

export function derive(state) {
  const estimate = state.estimates ? computeEstimate(state.ideaId, state.estimates) : null;
  const base = state.assumptions ? Object.fromEntries(ASSUMPTION_KEYS.map((k) => [k, state.assumptions[k].value])) : null;
  const finance = estimate && base ? computeFinance(state.ideaId, base, estimate) : null;
  const metrics = computeMetrics(state.ideaId, state.claims, finance);
  const tier = finance ? decideTier(metrics, finance, state.chairSuggestion) : null;
  const experiment = finance ? nextExperiment(state.ideaId, finance.top.key) : null;
  return { metrics, estimate, finance, tier, experiment };
}

// Figures an agent may state: those in source passages that passed the screen, the company profile and
// policy, the evidence ranges, and every value code computed in this run.
export function allowedFigures(state, derived) {
  const idea = IDEAS[state.ideaId];
  const screen = sourceScreen(state.ideaId);
  const sourceText = [...Object.values(screen.clean), ...idea.sources.map((s) => s.title), ...idea.experiments.map((x) => x.label)].join(" ");
  const list = extractFigures(sourceText);
  const add = (kind, ...values) => values.forEach((value) => Number.isFinite(value) && list.push({ kind, value }));
  // A source often states the unit once ("Of 9,800 tickets, 1,240 asked…"), so its bare numbers back counts.
  add("count", ...[...sourceText.matchAll(/\d{1,3}(?:,\d{3})+|\d+/g)].map((m) => Number(m[0].replace(/,/g, ""))));
  const c = COMPANY;
  list.push(...extractFigures(`${c.size}. ${c.capacity}`));
  add("money", ...Object.values(c.rateCard).map((r) => r.rate));
  add("percent", c.discountRate * 100);
  add("time", c.horizonYears * 365, POLICY.investNow.paybackMonths * 30.4);
  for (const key of ASSUMPTION_KEYS) {
    const a = idea.assumptions[key];
    add(a.unit === "percent" ? "percent" : a.unit === "gbp" ? "money" : "count", a.low, a.high);
  }
  for (const x of idea.experiments) { add("money", experimentCost(x)); add("time", x.weeks * 7, ...Object.values(x.days)); }
  const { estimate, finance } = derived;
  if (estimate) {
    for (const p of estimate.packages) { add("time", p.o, p.m, p.p, p.expected); add("money", p.cost, p.rate); }
    add("time", ...Object.values(estimate.effort), ...Object.values(estimate.weeks).map((w) => w * 7));
    add("money", ...Object.values(estimate.cost));
  }
  if (state.assumptions) {
    for (const key of ASSUMPTION_KEYS) {
      const a = state.assumptions[key];
      const kind = idea.assumptions[key].unit === "percent" ? "percent" : idea.assumptions[key].unit === "gbp" ? "money" : "count";
      add(kind, a.value);
    }
  }
  if (finance) {
    for (const s of Object.values(finance.scenarios)) {
      add("money", s.npv, s.inputs.devCost, s.inputs.price, s.inputs.running, ...s.rows.flatMap((r) => [r.revenue, r.net, r.cumulative]));
      add("percent", s.roiPercent, s.roi * 100, s.inputs.churn);
      add("count", s.inputs.adoption, ...s.rows.map((r) => r.customers));
      if (s.paybackMonths !== null) add("time", s.paybackMonths * 30.4);
    }
    for (const r of finance.sensitivity) add("money", r.npvWorst, r.npvBest, r.swing);
    const t = finance.top;
    if (t.breakEven !== null) add(t.key === "churn" ? "percent" : t.key === "adoption" ? "count" : "money", t.breakEven);
  }
  if (derived.experiment) { add("money", derived.experiment.cost); add("time", derived.experiment.weeks * 7); }
  return list;
}

// --- Applying a validated turn ------------------------------------------------------------------

function classifyClaim(claim, state, allowed) {
  const cite = checkCitation(claim.quote, IDEAS[state.ideaId].sources, claim.source, sourceScreen(state.ideaId));
  if (!cite.ok) return { status: "unsupported", note: cite.reason };
  const wrong = extractFigures(claim.reason).find((f) => !figureMatches(f, allowed));
  if (wrong) return { status: "struck", note: `Unverified figure: “${wrong.text}” is not in a cited source or computed by code` };
  return { status: "accepted", note: `Verified in ${claim.source}` };
}

function displayClaim(c) {
  return { id: c.id, agent: c.agent, dimension: c.dimension, label: DIMENSIONS[c.dimension].label, score: c.score, from: c.from, source: c.source, quote: c.quote, reason: c.reason, status: c.status, note: c.note };
}

function fmtAssumption(ideaId, key, v) {
  const unit = IDEAS[ideaId].assumptions[key].unit;
  if (unit === "gbp") return `£${Math.round(v).toLocaleString("en-GB")}`;
  if (unit === "percent") return `${v}%`;
  return String(Math.round(v));
}

function applyAssumptions(state, proposed) {
  const idea = IDEAS[state.ideaId];
  const screen = sourceScreen(state.ideaId);
  const out = {};
  for (const key of ASSUMPTION_KEYS) {
    const b = idea.assumptions[key];
    const p = proposed[key];
    const cautious = key === "churn" || key === "running" ? b.high : b.low;
    const cite = p.source ? checkCitation(p.quote, idea.sources, p.source, screen) : { ok: false, reason: "No source cited." };
    const source = idea.sources.some((s) => s.id === p.source) ? p.source : null;
    if (!cite.ok) {
      out[key] = { value: cautious, proposed: p.value, source, quote: p.quote, rationale: p.rationale, status: "unsupported", note: `${cite.reason} Code used the cautious end of the range (${fmtAssumption(state.ideaId, key, cautious)}).` };
      continue;
    }
    const clamped = Math.min(b.high, Math.max(b.low, p.value));
    out[key] = clamped === p.value
      ? { value: p.value, proposed: p.value, source, quote: p.quote, rationale: p.rationale, status: "accepted", note: `Within the evidence range; quote verified in ${source}.` }
      : { value: clamped, proposed: p.value, source, quote: p.quote, rationale: p.rationale, status: "clamped", note: `Proposed ${fmtAssumption(state.ideaId, key, p.value)} lies outside the evidence range ${fmtAssumption(state.ideaId, key, b.low)} to ${fmtAssumption(state.ideaId, key, b.high)}; code clamped it.` };
  }
  return out;
}

export function applyTurn(prev, turn, value) {
  const state = structuredClone(prev);
  const idea = IDEAS[state.ideaId];
  const event = { index: state.turn, agent: turn.agent, round: turn.round, kind: turn.kind, claims: [], revisions: [], challenges: [], estimateChanges: [], notes: [] };

  if (state.turn === 0) event.sourceScreen = sourceScreen(state.ideaId).passages;

  // 1. Structured proposals that code turns into numbers.
  if (value.estimates?.length) {
    const before = state.estimates;
    state.estimates = { ...(before || {}) };
    for (const e of value.estimates) {
      const old = before?.[e.wp];
      if (old && old.o === e.o && old.m === e.m && old.p === e.p) continue;
      state.estimates[e.wp] = { o: e.o, m: e.m, p: e.p };
      if (old) {
        if (!state.revisedPackages.includes(e.wp)) state.revisedPackages.push(e.wp);
        event.estimateChanges.push({ wp: e.wp, label: idea.workPackages.find((w) => w.id === e.wp).label, from: old, to: state.estimates[e.wp] });
      }
    }
  }
  if (value.assumptions) state.assumptions = applyAssumptions(state, value.assumptions);
  if (turn.kind === "brief") state.chairSuggestion = value.tier;

  // 2. Claims and revisions, checked against the sources and the figures code knows about.
  let derived = derive(state);
  let allowed = allowedFigures(state, derived);
  for (const claim of value.claims || []) {
    if (state.claims.length >= MAX_CLAIMS) break;
    const c = { id: `c${state.claims.length + 1}`, agent: turn.agent, ...claim, ...classifyClaim(claim, state, allowed), round: turn.round };
    state.claims.push(c);
    event.claims.push(displayClaim(c));
  }
  for (const rv of value.revisions || []) {
    const c = state.claims.find((x) => x.id === rv.claim);
    const wrong = extractFigures(rv.reason).find((f) => !figureMatches(f, allowed));
    if (wrong) {
      state.figureStrikes += 1;
      event.revisions.push({ claim: c.id, label: DIMENSIONS[c.dimension].label, from: c.score, to: rv.score, reason: rv.reason, status: "struck", note: `Revision struck: unverified figure “${wrong.text}”` });
      continue;
    }
    if (rv.score === c.score) continue;
    event.revisions.push({ claim: c.id, label: DIMENSIONS[c.dimension].label, from: c.score, to: rv.score, reason: rv.reason, status: c.status, note: c.status === "accepted" ? "Score revised" : `Revised, but still excluded (${c.status})` });
    if (c.from === undefined) c.from = c.score;
    c.score = rv.score;
  }
  if (turn.kind === "review") {
    state.challenges = value.challenges;
    event.challenges = value.challenges.map((ch) => {
      const c = state.claims.find((x) => x.id === ch.target);
      const wp = idea.workPackages.find((w) => w.id === ch.target);
      return { ...ch, targetAgent: c ? c.agent : "delivery", label: c ? DIMENSIONS[c.dimension].label : `Estimate: ${wp.label}` };
    });
  }

  // 3. Recompute everything, then screen the agent's own words for unverified figures.
  derived = derive(state);
  allowed = allowedFigures(state, derived);
  const sentences = screenStatement(value.message, allowed);
  let struck = sentences.filter((s) => s.struck).length;

  if (state.assumptions && value.assumptions) {
    for (const a of Object.values(state.assumptions)) {
      const check = checkFigures([{ text: a.rationale, struck: null }], allowed)[0];
      if (check.struck) { struck += 1; a.note = `${a.note} Rationale struck: ${check.struck.toLowerCase()}.`.slice(0, 200); a.rationale = ""; }
    }
  }
  if (turn.kind === "brief") {
    for (const [list, target] of [[value.dissent, state.chairNotes], [value.mindChangers, state.mindNotes]]) {
      for (const note of list) {
        const check = checkFigures([{ text: note, struck: null }], allowed)[0];
        if (check.struck) { struck += 1; event.notes.push(`A Chair's note was struck: ${check.struck.toLowerCase()}.`); }
        else target.push(note);
      }
    }
  }
  state.figureStrikes += struck;
  const kept = sentences.filter((s) => !s.struck).map((s) => s.text).join(" ").slice(0, 500);
  state.said.push({ agent: turn.agent, text: kept });
  state.turn += 1;

  event.sentences = sentences;
  event.metrics = derived.metrics;
  if (derived.estimate && turn.agent === "delivery") event.estimate = derived.estimate;
  if (turn.kind === "assumptions") event.assumptions = assumptionRows(state);
  if (turn.kind === "case" && derived.finance) event.finance = financeSummary(derived.finance);
  if (turn.kind === "brief") event.tier = derived.tier;
  event.counters = auditCounters(state.claims, state.figureStrikes, sourceScreen(state.ideaId).passages.length);
  return { state, event };
}

function financeSummary(f) {
  return {
    scenarios: Object.fromEntries(Object.entries(f.scenarios).map(([k, s]) => [k, { npv: s.npv, roiPercent: s.roiPercent, paybackMonths: s.paybackMonths }])),
    top: f.top
  };
}

export function assumptionRows(state) {
  const idea = IDEAS[state.ideaId];
  return ASSUMPTION_KEYS.map((key) => {
    const a = state.assumptions[key];
    const b = idea.assumptions[key];
    return { key, label: b.label, unit: b.unit, low: b.low, high: b.high, rangeSources: b.sources, ...a };
  });
}

// "What would change the board's mind": code-computed lines first, then the Chair's verified notes.
function mindChangers(state, derived) {
  const { finance, metrics, tier } = derived;
  const lines = [];
  const t = finance.top;
  const fmt = (key, v) => (key === "devCost" ? `£${Math.round(v).toLocaleString("en-GB")}` : fmtAssumption(state.ideaId, key, v));
  const baseValue = finance.scenarios.base.inputs[t.key];
  if (t.breakEven === null) lines.push(`No reachable value of ${t.label.toLowerCase()} alone brings the base-case NPV to zero; several inputs would have to change together.`);
  else if (finance.scenarios.base.npv > 0) lines.push(`If ${t.label.toLowerCase()} came in at ${fmt(t.key, t.breakEven)} instead of ${fmt(t.key, baseValue)}, the base-case NPV would fall to zero.`);
  else lines.push(`${t.label} would need to reach ${fmt(t.key, t.breakEven)} instead of ${fmt(t.key, baseValue)} for the base-case NPV to break even.`);
  if (tier.id !== "invest") {
    const p = POLICY.investNow;
    const gaps = [];
    if (metrics.strategicFit < p.strategicFit) gaps.push(`strategic fit ${metrics.strategicFit} → ${p.strategicFit}`);
    if (metrics.evidenceStrength < p.evidenceStrength) gaps.push(`evidence strength ${metrics.evidenceStrength} → ${p.evidenceStrength}`);
    if (finance.scenarios.base.npv <= 0) gaps.push("base-case NPV above zero");
    const pb = finance.scenarios.base.paybackMonths;
    if (pb === null || pb > p.paybackMonths) gaps.push(`payback within ${p.paybackMonths} months (now ${pb === null ? "beyond 3 years" : `${pb} months`})`);
    if (gaps.length) lines.push(`To reach “Invest now” under the policy: ${gaps.join("; ")}.`);
  }
  return [...lines.map((text) => ({ by: "code", text })), ...state.mindNotes.map((text) => ({ by: "chair", text }))];
}

export function buildBrief(state) {
  const derived = derive(state);
  const counters = auditCounters(state.claims, state.figureStrikes, sourceScreen(state.ideaId).passages.length);
  const challenges = state.challenges.filter((ch) => !(IDEAS[state.ideaId].workPackages.some((w) => w.id === ch.target) && state.revisedPackages.includes(ch.target)))
    .map((ch) => (IDEAS[state.ideaId].workPackages.some((w) => w.id === ch.target) ? { ...ch, target: "estimate" } : ch));
  return {
    ideaId: state.ideaId,
    mode: state.mode,
    metrics: derived.metrics,
    estimate: derived.estimate,
    finance: derived.finance,
    tier: derived.tier,
    experiment: derived.experiment,
    assumptions: assumptionRows(state),
    mindChangers: mindChangers(state, derived),
    dissent: findDissent(state.claims, challenges, state.chairNotes, derived.metrics),
    counters,
    claims: state.claims.map(displayClaim),
    usage: state.usage
  };
}

// --- One turn per request -------------------------------------------------------------------------

async function liveOutput(turn, state, env, deps) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return { fallback: "No LLM key is configured." };
  const derived = derive(state);
  const extra = {};
  if (turn.kind === "assumptions" || turn.kind === "case" || turn.kind === "brief") extra.estimate = derived.estimate;
  if (turn.kind === "case" || turn.kind === "brief") extra.finance = derived.finance;
  if (turn.kind === "brief") { extra.metrics = derived.metrics; extra.tier = derived.tier; extra.experiment = derived.experiment; }
  const messages = [
    { role: "system", content: systemPrompt(turn) },
    { role: "user", content: userPrompt(turn, state, extra) }
  ];
  const usage = { promptTokens: 0, completionTokens: 0, calls: 0 };
  const invalid = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await callLlm({ apiKey, model: resolveModel(env), messages, maxTokens: MAX_TOKENS[turn.kind], fetchImpl: deps.fetchImpl, sleep: deps.sleep });
    if (!reply.ok) return { fallback: `The LLM provider was unavailable (${reply.error}).`, usage };
    usage.promptTokens += reply.usage.promptTokens;
    usage.completionTokens += reply.usage.completionTokens;
    usage.calls += 1;
    const parsed = parseJson(reply.content);
    const check = parsed ? validateOutput(turn, parsed, state) : { ok: false, errors: ["reply was not valid JSON"] };
    if (check.ok) return { output: parsed, value: check.value, usage, invalid };
    invalid.push(check.errors.slice(0, 4).join("; "));
    messages.push({ role: "assistant", content: reply.content.slice(0, 1500) });
    messages.push({ role: "user", content: `Your reply was rejected: ${check.errors.slice(0, 4).join("; ")}. Reply again with one valid JSON object.` });
  }
  return { fallback: "The agent returned an invalid turn twice.", usage };
}

async function recordedOutput(turn, state, deps) {
  const recording = await deps.loadRecording(state.ideaId);
  const entry = recording?.turns?.[state.turn];
  if (!entry?.output || entry.agent !== turn.agent || entry.kind !== turn.kind) return { error: "The recorded transcript is missing this turn." };
  const check = validateOutput(turn, entry.output, state);
  if (!check.ok) return { error: "The recorded transcript failed validation." };
  return { output: entry.output, value: check.value, usage: null, invalid: entry.invalidReplies || [], model: recording.model };
}

// state must already be verified (or freshly created). Returns the JSON body for the page.
export async function runTurn({ state, env = {}, deps = {} }) {
  const turn = turnAt(state.turn);
  if (!turn) return { error: "The board has already used all its turns." };
  const result = state.mode === "live" ? await liveOutput(turn, state, env, deps) : await recordedOutput(turn, state, deps);
  if (result.error) return { error: result.error };
  if (result.fallback) return { fallback: true, reason: result.fallback };

  const { state: next, event } = applyTurn(state, turn, result.value);
  if (result.usage) {
    next.usage.promptTokens += result.usage.promptTokens;
    next.usage.completionTokens += result.usage.completionTokens;
    next.usage.llmTurns += 1;
  }
  event.invalidReplies = result.invalid;
  event.usage = result.usage ? { promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens } : null;
  const done = next.turn >= MAX_TURNS;
  return {
    mode: state.mode,
    model: state.mode === "live" ? resolveModel(env) : result.model || null,
    event,
    done,
    nextAgent: done ? null : TURN_ORDER[next.turn].agent,
    brief: done ? buildBrief(next) : null,
    state: await signState(next, env),
    output: result.output
  };
}

export function startState(ideaId, mode) {
  return initialState(ideaId, mode);
}

export { splitSentences };
