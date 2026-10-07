import test from "node:test";
import assert from "node:assert/strict";
import { runAll, loadRecording } from "./board-helpers.js";
import { IDEAS, TIERS } from "../config/board/data.js";
import { TURN_ORDER } from "../config/board/protocol.js";
import { TIER_ORDER } from "../config/board/scoring.js";

for (const ideaId of Object.keys(IDEAS)) {
  test(`recorded fallback produces a complete brief: ${ideaId}`, async () => {
    const recording = await loadRecording(ideaId);
    assert.equal(recording.synthetic, true);
    assert.deepEqual(recording.turns.map((t) => `${t.agent}/${t.kind}`), TURN_ORDER.map((t) => `${t.agent}/${t.kind}`));

    const { responses, last } = await runAll(ideaId, {});
    assert.equal(responses.length, TURN_ORDER.length, "one request per turn, ten turns");
    assert.ok(responses.every((r) => r.mode === "recorded" && !r.error && !r.fallback));
    assert.equal(last.done, true);
    const b = last.brief;
    for (const key of ["strategicFit", "marketPull", "feasibility", "evidenceStrength", "financialReturn", "risk"]) {
      assert.ok(Number.isInteger(b.metrics[key]) && b.metrics[key] >= 0 && b.metrics[key] <= 100, key);
    }
    assert.equal(b.estimate.packages.length, IDEAS[ideaId].workPackages.length);
    assert.ok(b.estimate.cost.low < b.estimate.cost.expected && b.estimate.cost.expected < b.estimate.cost.high);
    assert.ok(b.estimate.weeks.low < b.estimate.weeks.high);
    for (const name of ["pessimistic", "base", "optimistic"]) {
      const s = b.finance.scenarios[name];
      assert.ok(Number.isFinite(s.npv) && Number.isFinite(s.roi) && s.rows.length === 3, name);
    }
    assert.ok(b.finance.scenarios.pessimistic.npv <= b.finance.scenarios.base.npv && b.finance.scenarios.base.npv <= b.finance.scenarios.optimistic.npv);
    assert.ok(Object.values(TIERS).includes(b.tier.label) && b.tier.rule);
    assert.equal(b.assumptions.length, 4);
    assert.ok(b.assumptions.every((a) => a.value >= a.low && a.value <= a.high));
    assert.ok(b.mindChangers.length >= 1 && b.mindChangers[0].by === "code");
    assert.ok(b.experiment.cost > 0 && b.experiment.weeks > 0);
    const c = b.counters;
    assert.equal(c.claimsMade, b.claims.length);
    assert.equal(c.claimsMade, c.claimsAccepted + c.unsupported + b.claims.filter((x) => x.status === "struck").length);
  });
}

test("the trap idea shows unverified-figure strikes and a lower tier than the strong idea", async () => {
  const trap = (await runAll("field-copilot", {})).last.brief;
  const strong = (await runAll("inspection-planner", {})).last.brief;
  assert.ok(trap.counters.screenedPassages >= 1, "documents-side screen");
  assert.ok(trap.counters.struckFigures >= 1, `expected an agent statement struck as an unverified figure, got ${trap.counters.struckFigures}`);
  assert.ok(TIER_ORDER.indexOf(trap.tier.id) < TIER_ORDER.indexOf(strong.tier.id), `${trap.tier.label} should be below ${strong.tier.label}`);
  assert.ok(trap.metrics.evidenceStrength < strong.metrics.evidenceStrength);
});
