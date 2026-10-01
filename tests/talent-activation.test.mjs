import test from "node:test";
import assert from "node:assert/strict";
import database from "../data/reference-database.json" with { type: "json" };
import published from "../data/talent-activations.json" with { type: "json" };
import { publishTalentActivations } from "../scripts/publish-talent-activations.mjs";
import { talentActivation, talentActivationBadge } from "../src/talent-activation.mjs";

test("public activation metadata is complete and corrects stale Full Throttle labels", () => {
  assert.deepEqual(published, publishTalentActivations(database.tables.talents));
  assert.equal(talentActivation("Full Throttle", "Passive"), "Action");
  const badge = talentActivationBadge({ name: "Full Throttle", activation: "Passive", summary: "Take an action.", effects: [] });
  assert.equal(badge.label, "Action");
  assert.match(badge.hint, /one action/);
  assert.equal(badge.automatic, false);
});
