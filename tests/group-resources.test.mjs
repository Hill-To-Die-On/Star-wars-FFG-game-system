import test from "node:test";
import assert from "node:assert/strict";
import { startingAssetOptions, planStartingAsset, planResourceEntry, sharedGearBalance } from "../src/group-resources.mjs";

const campaign = { lines: ["edge", "age", "force"], ageStartingResource: "base" };

test("starting group choices respect enabled lines and the campaign's Age resource", () => {
  const options = startingAssetOptions(campaign).map(option => option.id);
  assert.deepEqual(options, ["edge-ship", "age-base", "force-ship", "force-holocron", "force-mentor"]);
  assert.deepEqual(startingAssetOptions({ lines: ["age"], ageStartingResource: "y-wings" }).map(option => option.id), ["age-y-wings"]);
});

test("choosing a starting ship records one asset and links only a vehicle", () => {
  const system = { startingAsset: {}, resourceLedger: {} };
  const input = { choice: "edge-ship", name: "Tala's courier", actorId: "ship", status: "Available", description: "A patched light freighter." };
  const changes = planStartingAsset(system, input, { campaign, vehicles: [{ id: "ship", type: "vehicle" }], id: "entry1", at: "now" });
  assert.deepEqual(changes["system.startingAsset"], input);
  assert.equal(changes["system.resourceLedger.entry1"].kind, "starting-asset");
  assert.match(changes["system.resourceLedger.entry1"].note, /courier/);
  assert.throws(() => planStartingAsset(system, { ...input, actorId: "person" }, { campaign, vehicles: [{ id: "person", type: "character" }], id: "e", at: "now" }), /vehicle/i);
  assert.throws(() => planStartingAsset(system, { ...input, choice: "age-lambda" }, { campaign, vehicles: [], id: "e", at: "now" }), /campaign/i);
  assert.throws(() => planStartingAsset(system, { ...input, choice: "force-mentor", actorId: "ship" }, { campaign, vehicles: [], id: "e", at: "now" }), /vehicle link/i);
});

test("linking an existing starting ship updates it without recording a second acquisition", () => {
  const system = { startingAsset: { choice: "edge-ship", name: "Wayfarer courier", actorId: "", status: "Impounded" },
    resourceLedger: { first: { kind: "starting-asset", name: "Wayfarer courier" } } };
  const input = { choice: "edge-ship", name: "Wayfarer courier", actorId: "ship", status: "Available", description: "Ready to launch." };
  const changes = planStartingAsset(system, input, { campaign, vehicles: [{ id: "ship", type: "vehicle" }], id: "second", at: "later" });
  assert.deepEqual(changes, { "system.startingAsset": input });
});

test("shared resource ledger updates credits and gear without allowing overspending", () => {
  const system = { credits: 60, resourceLedger: {} };
  const spend = planResourceEntry(system, { kind: "credits", name: "Skiff parts", change: -25, note: "Paid mechanic" }, { id: "e1", at: "now", scene: "Perimeter" });
  assert.equal(spend["system.credits"], 35);
  assert.deepEqual(spend["system.resourceLedger.e1"], { kind: "credits", name: "Skiff parts", change: -25, note: "Paid mechanic", at: "now", scene: "Perimeter" });
  assert.throws(() => planResourceEntry(system, { kind: "credits", name: "Too much", change: -61 }, { id: "e2", at: "now" }), /insufficient/i);
  const acquired = planResourceEntry(system, { kind: "gear", name: "Emergency repair patch", change: 2, note: "Recovered" }, { id: "e3", at: "now" });
  assert.equal(acquired["system.credits"], undefined);
  assert.deepEqual(sharedGearBalance({ e3: acquired["system.resourceLedger.e3"] }), [{ name: "Emergency repair patch", quantity: 2 }]);
  assert.throws(() => planResourceEntry({ resourceLedger: { e3: acquired["system.resourceLedger.e3"] } }, { kind: "gear", name: "Emergency repair patch", change: -3 }, { id: "e4", at: "now" }), /only 2/i);
});
