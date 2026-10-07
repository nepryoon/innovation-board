import test from "node:test";
import assert from "node:assert/strict";
import { computeEstimate, rangeError, cashFlows, computeFinance, classify, decideTier, computeMetrics, nextExperiment, breakEven, scenarioInputs, Z80 } from "../config/board/scoring.js";
import { COMPANY, IDEAS } from "../config/board/data.js";

const EST = { w1: { o: 10, m: 20, p: 40 }, w2: { o: 10, m: 10, p: 10 }, w3: { o: 6, m: 12, p: 30 }, w4: { o: 5, m: 8, p: 11 }, w5: { o: 4, m: 6, p: 14 } };

test("estimate ranges are validated", () => {
  assert.equal(rangeError({ o: 10, m: 20, p: 40 }), null);
  assert.match(rangeError({ o: 30, m: 20, p: 40 }), /optimistic ≤ likely ≤ pessimistic/);
  assert.match(rangeError({ o: 5, m: 20, p: 40 }), /six times/);
  assert.match(rangeError({ o: 0, m: 2, p: 3 }), /whole person-days/);
  assert.match(rangeError({ o: 1.5, m: 2, p: 3 }), /whole person-days/);
});

test("PERT estimate, duration and cost from the rate card", () => {
  const e = computeEstimate("inspection-planner", EST);
  const w1 = e.packages.find((p) => p.id === "w1");
  assert.equal(w1.expected, 21.7, "(10 + 4·20 + 40) ÷ 6 = 21.67");
  assert.equal(w1.sd, 5, "(40 − 10) ÷ 6");
  assert.equal(w1.cost, Math.round(130 / 6 * 600));
  // Totals by hand: E = 21.667 + 10 + 14 + 8 + 7 = 60.667; σ = √(25 + 0 + 16 + 1 + 2.778) = 6.6916.
  assert.equal(e.effort.expected, 60.7);
  assert.equal(e.effort.sd, 6.7);
  assert.equal(e.effort.low, Math.round((60.6667 - Z80 * 6.69162) * 10) / 10);
  assert.equal(e.effort.high, Math.round((60.6667 + Z80 * 6.69162) * 10) / 10);
  const capacity = COMPANY.teamSize * COMPANY.daysPerWeek;
  assert.equal(e.weeks.expected, Math.round((60.6667 / capacity) * 10) / 10);
  // Cost: engineer 31.667 d × 600, data 14 d × 640, designer 8 d × 550, QA 7 d × 480.
  assert.equal(e.cost.expected, Math.round(31.6667 * 600 + 14 * 640 + 8 * 550 + 7 * 480));
  assert.ok(e.cost.low < e.cost.expected && e.cost.expected < e.cost.high, "a range, not a single number");
});

test("cash-flow model: NPV, ROI and payback checked by hand", () => {
  // C = 100, 190, 271; revenue = 1000 × (0+100)/2, (100+190)/2, (190+271)/2 = 50,000, 145,000, 230,500.
  // Net = 0, 95,000, 180,500. NPV = −100,000 + 95,000/1.1² + 180,500/1.1³ = 114,124.7.
  const r = cashFlows({ price: 1000, adoption: 100, churn: 10, running: 50000, devCost: 100000 }, 0.1, 3);
  assert.deepEqual(r.rows.map((x) => x.customers), [100, 190, 271]);
  assert.deepEqual(r.rows.map((x) => x.revenue), [50000, 145000, 230500]);
  assert.deepEqual(r.rows.map((x) => x.net), [0, 95000, 180500]);
  assert.equal(r.npv, 114125);
  assert.ok(Math.abs(r.roi - 1.755) < 1e-9, "(275,500 − 100,000) ÷ 100,000");
  assert.equal(r.paybackMonths, 24.3, "24 + 12 × 5,000 ÷ 180,500");
  const never = cashFlows({ price: 100, adoption: 10, churn: 30, running: 50000, devCost: 100000 }, 0.1, 3);
  assert.equal(never.paybackMonths, null);
  assert.ok(never.npv < 0 && never.roi < 0);
});

test("three scenarios use the evidence bounds and the estimate range; sensitivity names the biggest mover", () => {
  const est = computeEstimate("inspection-planner", EST);
  const base = { price: 1950, adoption: 120, churn: 7, running: 65000 };
  const f = computeFinance("inspection-planner", base, est);
  const b = IDEAS["inspection-planner"].assumptions;
  assert.deepEqual(f.scenarios.pessimistic.inputs, { price: b.price.low, adoption: b.adoption.low, churn: b.churn.high, running: b.running.high, devCost: est.cost.high });
  assert.deepEqual(f.scenarios.optimistic.inputs, { price: b.price.high, adoption: b.adoption.high, churn: b.churn.low, running: b.running.low, devCost: est.cost.low });
  assert.equal(f.scenarios.base.inputs.devCost, est.cost.expected);
  for (const s of Object.values(f.scenarios)) {
    assert.equal(s.npv, cashFlows(s.inputs).npv);
    assert.ok(Number.isFinite(s.roi));
  }
  assert.ok(f.scenarios.pessimistic.npv < f.scenarios.base.npv && f.scenarios.base.npv < f.scenarios.optimistic.npv);
  assert.equal(f.sensitivity[0].key, f.top.key);
  assert.ok(f.sensitivity.every((r, i) => i === 0 || r.swing <= f.sensitivity[i - 1].swing));
  const inputs = scenarioInputs("inspection-planner", base, est);
  const x = breakEven(inputs, f.top.key);
  assert.ok(Math.abs(cashFlows({ ...inputs.base, [f.top.key]: x }).npv) <= 1, "NPV is zero at the break-even value");
});

test("classification follows the investment policy thresholds", () => {
  const fin = (base, opt) => ({ scenarios: { base: { npv: base[0], paybackMonths: base[1] }, optimistic: { npv: opt } } });
  const m = (fit, ev) => ({ strategicFit: fit, evidenceStrength: ev });
  assert.equal(classify(m(60, 60), fin([1, 24], 1)).id, "invest");
  assert.equal(classify(m(60, 60), fin([1, 24.1], 1)).id, "pilot", "payback over 24 months");
  assert.equal(classify(m(59, 70), fin([1, 12], 1)).id, "pilot", "fit below 60");
  assert.equal(classify(m(50, 45), fin([1, null], 1)).id, "pilot");
  assert.equal(classify(m(49, 90), fin([1, 12], 1)).id, "explore", "fit below 50");
  assert.equal(classify(m(90, 44), fin([1, 12], 1)).id, "explore", "evidence below 45");
  assert.equal(classify(m(90, 90), fin([-1, null], 5)).id, "explore", "negative base NPV with upside");
  assert.equal(classify(m(90, 90), fin([-1, null], -5)).id, "park");
  const t = decideTier(m(90, 90), fin([-1, null], -5), "invest");
  assert.equal(t.overridden, true);
  assert.equal(t.chairSuggestion, "Invest now");
  assert.equal(decideTier(m(90, 90), fin([-1, null], -5), "park").overridden, false);
});

test("metrics: dimension means, quality-weighted evidence strength, financial return", () => {
  const claims = [
    { dimension: "fit", score: 4, status: "accepted", source: "s1" },
    { dimension: "fit", score: 2, status: "accepted", source: "s7" },
    { dimension: "market", score: 5, status: "unsupported", source: "s3" },
    { dimension: "risk", score: 3, status: "struck", source: "s9" }
  ];
  const m = computeMetrics("inspection-planner", claims, { scenarios: { base: { roi: 1 } } });
  assert.equal(m.strategicFit, 60);
  assert.equal(m.marketPull, 0, "unsupported claims are excluded");
  assert.equal(m.risk, 0, "struck claims are excluded");
  // accepted 2 of 4; quality: s1 primary (1 × 4), s7 secondary (0.6 × 2) → 5.2 ÷ (5 × 1.6) = 0.65.
  assert.equal(m.evidenceStrength, Math.round(100 * 0.5 * 0.65));
  assert.equal(m.financialReturn, 70);
  assert.equal(computeMetrics("inspection-planner", []).financialReturn, null);
});

test("next experiment is the cheapest one that tests the most sensitive input, costed from the rate card", () => {
  const x = nextExperiment("inspection-planner", "adoption");
  assert.equal(x.id, "x1");
  assert.equal(x.cost, 4 * 650 + 3 * 550 + 3 * 600);
  assert.equal(x.weeks, 4);
  const fallback = nextExperiment("payment-matching", "devCost");
  assert.match(fallback.reason, /cheapest listed experiment/);
});
