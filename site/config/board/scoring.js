// Everything numeric in the brief is computed here: the six metrics, the three-point development
// estimate, the three-year cash-flow model, sensitivity, break-even, the next experiment and the tier.
// Agents propose scores, estimates and assumptions; this code validates them and does the arithmetic.

import { COMPANY, POLICY, TIERS, IDEAS, DIMENSIONS, AGENTS, ASSUMPTION_KEYS, SOURCE_TYPES, GRADE_WEIGHTS, sourceMap, experimentCost } from "./data.js";

export const Z80 = 1.28;

export const FORMULA = [
  "Dimension score (strategic fit, market pull, feasibility, risk) = 20 × mean of the accepted 1-to-5 scores for that dimension, or 0 if none",
  "Evidence strength = 100 × (accepted ÷ claims made) × Σ q · score ÷ (5 · Σ q), over accepted claims, with source quality q = 1 primary, 0.6 secondary, 0.2 promotional",
  "Financial return = clamp(40 + 30 × base-case ROI, 0, 100)",
  "PERT per work package: E = (o + 4m + p) ÷ 6, σ = (p − o) ÷ 6; total σ = √Σσ²; range = E ± 1.28σ (about 80% confidence)",
  "Duration in weeks = person-days ÷ (squad size × productive days per week); cost = Σ person-days × role day rate",
  "Customers: C₀ = 0, Cₜ = Cₜ₋₁ × (1 − churn) + adoption; revenue or saving in year t = price × (Cₜ₋₁ + Cₜ) ÷ 2; net cash flow = revenue − running cost",
  "NPV = −development cost + Σ net cash flowₜ ÷ (1 + discount rate)ᵗ, t = 1 to 3; ROI = (Σ net cash flow − development cost) ÷ development cost",
  "Payback = the month in which cumulative cash flow, starting at −development cost, reaches zero (linear within the year)"
];

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const round1 = (v) => Math.round(v * 10) / 10;

// --- Metrics --------------------------------------------------------------------------------

export function computeMetrics(ideaId, claims, finance = null) {
  const sources = sourceMap(ideaId);
  const accepted = claims.filter((c) => c.status === "accepted");
  const dim = (d) => Math.round(20 * mean(accepted.filter((c) => c.dimension === d).map((c) => c.score)));
  let weighted = 0;
  let weights = 0;
  for (const c of accepted) {
    const q = GRADE_WEIGHTS[SOURCE_TYPES[sources[c.source]?.type]?.grade] ?? 0;
    weighted += q * c.score;
    weights += q;
  }
  const evidence = claims.length && weights ? 100 * (accepted.length / claims.length) * (weighted / (5 * weights)) : 0;
  return {
    strategicFit: dim("fit"),
    marketPull: dim("market"),
    feasibility: dim("feasibility"),
    evidenceStrength: Math.round(evidence),
    financialReturn: finance ? Math.min(100, Math.max(0, Math.round(40 + 30 * finance.scenarios.base.roi))) : null,
    risk: dim("risk")
  };
}

export function auditCounters(claims, figureStrikes, screenedPassages) {
  return {
    claimsMade: claims.length,
    claimsAccepted: claims.filter((c) => c.status === "accepted").length,
    unsupported: claims.filter((c) => c.status === "unsupported").length,
    struckFigures: claims.filter((c) => c.status === "struck").length + figureStrikes,
    screenedPassages
  };
}

// --- Development estimate ---------------------------------------------------------------------

// Ranges must be whole person-days, 1 to 400, optimistic ≤ likely ≤ pessimistic, and the pessimistic
// value no more than six times the optimistic one. Returns an error string or null.
export function rangeError(e) {
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 400;
  if (!e || !ok(e.o) || !ok(e.m) || !ok(e.p)) return "o, m and p must be whole person-days from 1 to 400";
  if (!(e.o <= e.m && e.m <= e.p)) return "estimates must satisfy optimistic ≤ likely ≤ pessimistic";
  if (e.p > 6 * e.o) return "pessimistic must be at most six times optimistic";
  return null;
}

export function computeEstimate(ideaId, estimates) {
  const idea = IDEAS[ideaId];
  const rows = idea.workPackages.map((wp) => {
    const { o, m, p } = estimates[wp.id];
    const expected = (o + 4 * m + p) / 6;
    const sd = (p - o) / 6;
    const rate = COMPANY.rateCard[wp.role].rate;
    return { id: wp.id, label: wp.label, role: COMPANY.rateCard[wp.role].label, rate, o, m, p, expected: round1(expected), sd: round1(sd), cost: Math.round(expected * rate), _e: expected, _sd: sd };
  });
  const effort = rows.reduce((s, r) => s + r._e, 0);
  const effortSd = Math.sqrt(rows.reduce((s, r) => s + r._sd ** 2, 0));
  const cost = rows.reduce((s, r) => s + r._e * r.rate, 0);
  const costSd = Math.sqrt(rows.reduce((s, r) => s + (r._sd * r.rate) ** 2, 0));
  const minEffort = rows.reduce((s, r) => s + r.o, 0);
  const minCost = rows.reduce((s, r) => s + r.o * r.rate, 0);
  const capacity = COMPANY.teamSize * COMPANY.daysPerWeek;
  const effortLow = Math.max(minEffort, effort - Z80 * effortSd);
  const effortHigh = effort + Z80 * effortSd;
  return {
    packages: rows.map(({ _e, _sd, ...r }) => r),
    effort: { low: round1(effortLow), expected: round1(effort), high: round1(effortHigh), sd: round1(effortSd) },
    weeks: { low: round1(effortLow / capacity), expected: round1(effort / capacity), high: round1(effortHigh / capacity) },
    cost: { low: Math.round(Math.max(minCost, cost - Z80 * costSd)), expected: Math.round(cost), high: Math.round(cost + Z80 * costSd), sd: Math.round(costSd) },
    teamSize: COMPANY.teamSize,
    daysPerWeek: COMPANY.daysPerWeek
  };
}

// --- Financial case ---------------------------------------------------------------------------

export function cashFlows({ price, adoption, churn, running, devCost }, rate = COMPANY.discountRate, years = COMPANY.horizonYears) {
  const rows = [];
  let customers = 0;
  let cumulative = -devCost;
  let npv = -devCost;
  let total = 0;
  let payback = null;
  for (let t = 1; t <= years; t++) {
    const start = customers;
    customers = customers * (1 - churn / 100) + adoption;
    const revenue = price * (start + customers) / 2;
    const net = revenue - running;
    if (payback === null && cumulative < 0 && cumulative + net >= 0) payback = 12 * (t - 1) + 12 * (-cumulative / net);
    cumulative += net;
    npv += net / (1 + rate) ** t;
    total += net;
    rows.push({ year: t, customers: round1(customers), revenue: Math.round(revenue), running: Math.round(running), net: Math.round(net), cumulative: Math.round(cumulative) });
  }
  if (devCost <= 0 && payback === null) payback = 0;
  return { rows, npv: Math.round(npv), roi: devCost > 0 ? (total - devCost) / devCost : 0, roiPercent: devCost > 0 ? Math.round(((total - devCost) / devCost) * 100) : 0, paybackMonths: payback === null ? null : round1(payback) };
}

const WORST = { price: "low", adoption: "low", churn: "high", running: "high" };
const BEST = { price: "high", adoption: "high", churn: "low", running: "low" };

export function scenarioInputs(ideaId, base, estimate) {
  const a = IDEAS[ideaId].assumptions;
  const pick = (side) => Object.fromEntries(ASSUMPTION_KEYS.map((k) => [k, a[k][side[k]]]));
  return {
    pessimistic: { ...pick(WORST), devCost: estimate.cost.high },
    base: { ...base, devCost: estimate.cost.expected },
    optimistic: { ...pick(BEST), devCost: estimate.cost.low }
  };
}

const INPUT_LABEL = (ideaId, key) => (key === "devCost" ? "Development cost" : IDEAS[ideaId].assumptions[key].label);

export function sensitivity(ideaId, inputs) {
  const rows = [...ASSUMPTION_KEYS, "devCost"].map((key) => {
    const worst = inputs.pessimistic[key];
    const best = inputs.optimistic[key];
    const npvWorst = cashFlows({ ...inputs.base, [key]: worst }).npv;
    const npvBest = cashFlows({ ...inputs.base, [key]: best }).npv;
    return { key, label: INPUT_LABEL(ideaId, key), worst, best, npvWorst, npvBest, swing: Math.abs(npvBest - npvWorst) };
  });
  rows.sort((x, y) => y.swing - x.swing);
  return rows;
}

// Value of one input at which the base-case NPV is zero, by bisection (NPV is monotonic in each input).
export function breakEven(inputs, key) {
  const f = (x) => cashFlows({ ...inputs.base, [key]: x }).npv;
  let lo = 0;
  let hi = key === "churn" ? 100 : Math.max(1, inputs.base[key], inputs.optimistic[key], inputs.pessimistic[key]) * 50;
  let flo = f(lo);
  const fhi = f(hi);
  if (Math.sign(flo) === Math.sign(fhi)) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

export function computeFinance(ideaId, base, estimate) {
  const inputs = scenarioInputs(ideaId, base, estimate);
  const scenarios = Object.fromEntries(Object.entries(inputs).map(([name, i]) => [name, { inputs: i, ...cashFlows(i) }]));
  const sens = sensitivity(ideaId, inputs);
  const top = sens[0];
  const be = breakEven(inputs, top.key);
  return {
    scenarios,
    sensitivity: sens,
    top: { key: top.key, label: top.label, breakEven: be === null ? null : roundInput(top.key, be) },
    discountRate: COMPANY.discountRate,
    horizonYears: COMPANY.horizonYears
  };
}

function roundInput(key, value) {
  if (key === "churn") return round1(value);
  if (key === "adoption") return Math.round(value);
  if (value >= 10000) return Math.round(value / 100) * 100;
  return Math.round(value);
}

// --- Classification, next experiment, dissent --------------------------------------------------

export function classify(metrics, finance) {
  const base = finance.scenarios.base;
  const opt = finance.scenarios.optimistic;
  const p = POLICY;
  const rules = {
    invest: `Invest now: strategic fit ≥ ${p.investNow.strategicFit}, evidence strength ≥ ${p.investNow.evidenceStrength}, base-case NPV > 0 and base-case payback ≤ ${p.investNow.paybackMonths} months`,
    pilot: `Run a pilot: strategic fit ≥ ${p.pilot.strategicFit}, evidence strength ≥ ${p.pilot.evidenceStrength} and base-case NPV > 0`,
    explore: "Explore further: the optimistic-case NPV is above zero, so there is upside, but the stronger rules are not met",
    park: "Park: none of the rules above is met; even the optimistic case does not return the investment"
  };
  let id = "park";
  if (metrics.strategicFit >= p.investNow.strategicFit && metrics.evidenceStrength >= p.investNow.evidenceStrength && base.npv > 0 && base.paybackMonths !== null && base.paybackMonths <= p.investNow.paybackMonths) id = "invest";
  else if (metrics.strategicFit >= p.pilot.strategicFit && metrics.evidenceStrength >= p.pilot.evidenceStrength && base.npv > 0) id = "pilot";
  else if (opt.npv > 0) id = "explore";
  return { id, label: TIERS[id], rule: rules[id], rules: Object.values(rules) };
}

export const TIER_ORDER = ["park", "explore", "pilot", "invest"];

export function decideTier(metrics, finance, chairSuggestion) {
  const tier = classify(metrics, finance);
  const overridden = Boolean(chairSuggestion) && chairSuggestion !== tier.id;
  return { ...tier, chairSuggestion: chairSuggestion ? TIERS[chairSuggestion] : null, overridden };
}

export function nextExperiment(ideaId, topKey) {
  const all = IDEAS[ideaId].experiments.map((x) => ({ ...x, cost: experimentCost(x) }));
  const targeted = all.filter((x) => x.targets === topKey);
  const pool = targeted.length ? targeted : all;
  const pick = pool.reduce((a, b) => (b.cost < a.cost ? b : a));
  const breakdown = Object.entries(pick.days).map(([role, days]) => ({ role: COMPANY.rateCard[role].label, days, rate: COMPANY.rateCard[role].rate }));
  return {
    id: pick.id,
    label: pick.label,
    targets: INPUT_LABEL(ideaId, pick.targets),
    weeks: pick.weeks,
    cost: pick.cost,
    breakdown,
    reason: targeted.length
      ? `Cheapest listed experiment that tests the assumption that moves the result most (${INPUT_LABEL(ideaId, topKey).toLowerCase()}).`
      : "No listed experiment tests the most sensitive input directly, so this is the cheapest listed experiment."
  };
}

export function findDissent(claims, challenges, chairNotes, metrics) {
  const entries = [];
  for (const ch of challenges) {
    if (ch.target === "estimate") {
      entries.push({ agents: ["auditor", "delivery"], topic: "Development estimate", note: `${AGENTS.auditor.name} challenged the estimate: ${ch.note || ch.issue}` });
      continue;
    }
    const claim = claims.find((c) => c.id === ch.target);
    if (claim && claim.status === "accepted" && claim.from === undefined) {
      entries.push({ agents: ["auditor", claim.agent], topic: DIMENSIONS[claim.dimension].label, note: `${AGENTS.auditor.name}'s challenge to ${claim.id} was not answered with a revision; the score stands at ${claim.score} of 5.` });
    }
  }
  if (metrics && Math.abs(metrics.strategicFit - metrics.marketPull) >= 30) {
    entries.push({ agents: ["strategy", "market"], topic: "Fit against demand", note: `Strategic fit is ${metrics.strategicFit} but market pull is ${metrics.marketPull}: the idea suits the strategy better than the evidence of demand supports, or the reverse.` });
  }
  for (const note of chairNotes) entries.push({ agents: ["chair"], topic: "Chair's note", note });
  return entries.slice(0, 8);
}
