import test from "node:test";
import assert from "node:assert/strict";
import { planVehicleLoadout, stampVehicleMount, applyVehicleLoadout } from "../src/vehicle-loadouts.mjs";

const ID = "star-wars-ffg";
const mount = (vehicle = "v1", name = "Laser") => stampVehicleMount({
  name, type: "weapon", flags: { [ID]: { vehicleMount: { vehicleId: vehicle, mountId: `${vehicle}-laser` } } },
  system: { skill: "gunnery", damage: "6", critical: 3, range: "close", scale: "vehicle", quantity: 1, qualities: "Linked 1", equipped: true },
});
test("model loadouts are idempotent and preserve hand-added and modified equipment", () => {
  const old = { ...mount(), _id: "old" }, edited = { ...mount("v2"), _id: "edited" };
  edited.system.damage = "8";
  const actor = { items: [old, edited, { _id: "custom", name: "Custom gun", type: "weapon", system: {} }] };
  let plan = planVehicleLoadout({ items: [mount()] }, actor);
  assert.equal(plan.create.length, 0); assert.deepEqual(plan.remove, []);
  plan = planVehicleLoadout({ items: [mount("v2")] }, actor);
  assert.equal(plan.create.length, 0); assert.deepEqual(plan.remove, ["old"]);
  plan = planVehicleLoadout({ items: [mount("v3")] }, actor);
  assert.equal(plan.create.length, 1); assert.deepEqual(plan.remove, ["old"]);
  assert.ok(!Object.hasOwn(plan.create[0], "_id"));
});
test("loadout creation failure leaves previous equipment intact and a retry finishes once", async () => {
  const original = { ...mount(), _id: "old" }, actor = { items: [original] };
  actor.createEmbeddedDocuments = async () => { throw new Error("save failed"); };
  actor.deleteEmbeddedDocuments = async () => { throw new Error("old equipment should not be removed"); };
  await assert.rejects(applyVehicleLoadout(actor, { items: [mount("v2")] }), /save failed/);
  assert.equal(actor.items[0], original);
  actor.createEmbeddedDocuments = async (_type, data) => { const docs = data.map((d, i) => ({ ...d, _id: `new${i}` })); actor.items.push(...docs); return docs; };
  actor.deleteEmbeddedDocuments = async (_type, ids) => { actor.items = actor.items.filter(i => !ids.includes(i._id)); };
  await applyVehicleLoadout(actor, { items: [mount("v2")] });
  await applyVehicleLoadout(actor, { items: [mount("v2")] });
  assert.equal(actor.items.length, 1); assert.equal(actor.items[0].flags[ID].vehicleMount.vehicleId, "v2");
});
