import test from "node:test";
import assert from "node:assert/strict";
import { turnBudget, turnUpdate, turnKey, validateTurnConfig } from "../src/turn-economy.mjs";
import { validateTalentNodeRules } from "../src/talent-rules.mjs";

const actor = (type = "character", system = {}) => ({
  type, id: "pilot", name: "Pilot", flags: {}, items: [],
  system: { strain: { value: 0, max: 12 }, wounds: { value: 0, max: 12 },
    systemStrain: { value: 0, max: 12 }, silhouette: 3, skills: {}, ...system },
});
const apply = (a, command, options) => {
  const update = turnUpdate(a, command, options);
  for (const [path, value] of Object.entries(update)) {
    const keys = path.split("."); let parent = a;
    for (const key of keys.slice(0, -1)) parent = parent[key] ??= {};
    parent[keys.at(-1)] = value;
  }
  return turnBudget(a, options);
};
const effect = (target, count = 1, requirements) => ({ type: "turn", target, operation: "add", count,
  ...(requirements ? { requirements } : {}) });

test("characters have one action, one free manoeuvre and a two-manoeuvre cap", () => {
  const a = actor(), b = turnBudget(a);
  assert.equal(b.actionsRemaining, 1);
  assert.equal(b.freeRemaining, 1);
  assert.equal(b.maneuversRemaining, 2);
  assert.equal(b.canPayStrain, false, "Use the free manoeuvre first");
  assert.equal(apply(a, "action").actionsRemaining, 0);
  assert.throws(() => apply(a, "action"), /action.*remaining/i);
  assert.equal(apply(a, "maneuver").freeRemaining, 0);
  assert.equal(apply(a, "maneuver", { payment: "strain" }).maneuversRemaining, 0);
  assert.equal(a.system.strain.value, 2);
  assert.throws(() => apply(a, "maneuver", { payment: "strain" }), /limit/i);
});

test("book-verified additional limbs grant a second free manoeuvre without increasing the cap", () => {
  const harch = actor("character", {
    species: "Harch",
    creation: { species: { book: "Collapse of the Republic", page: "14" } },
  });
  const budget = turnBudget(harch);
  assert.equal(budget.limits.freeManeuvers, 2);
  assert.equal(budget.limits.maneuverLimit, 2);
  assert.match(budget.reasons.join(" "), /Harch.*p\. 15/);
  assert.equal(apply(harch, "maneuver").freeRemaining, 1);
  assert.equal(apply(harch, "maneuver").freeRemaining, 0);
  assert.throws(() => apply(harch, "maneuver"), /limit/i);
  const unverified = actor("character", {
    species: "Harch",
    creation: { species: { book: "Homebrew", page: "14" } },
  });
  assert.equal(turnBudget(unverified).limits.freeManeuvers, 1);
});

test("trading an action supplies the second manoeuvre without strain", () => {
  const a = actor(); apply(a, "maneuver");
  const b = apply(a, "maneuver", { payment: "action" });
  assert.equal(b.actionsRemaining, 0);
  assert.equal(b.maneuversRemaining, 0);
  assert.equal(a.system.strain.value, 0);
  assert.throws(() => apply(a, "action"), /action.*remaining/i);
});

test("buying or trading prepares a temporary light, which the later move consumes exactly once", () => {
  for(const command of ["buyManeuver","tradeManeuver"]) {
    const a=actor(); apply(a,"maneuver");
    const ready=apply(a,command);
    assert.equal(ready.freeRemaining,1);
    assert.deepEqual(ready.maneuvers,[{available:false,temporary:false},{available:true,temporary:true}]);
    assert.equal(a.system.strain.value,command === "buyManeuver" ? 2 : 0);
    assert.equal(apply(a,"maneuver",{operationId:"move:one"}).freeRemaining,0);
    assert.deepEqual(turnUpdate(a,"maneuver",{operationId:"move:one"}),{});
    assert.equal(turnBudget(a).spent.maneuvers,2);
  }
});

test("player management permits owned manual grants and resets without enabling GM-only talent rulings", () => {
  const a=actor(), options={key:"combat:1",allowPlayerManagement:true};
  apply(a,"maneuver",options);
  assert.equal(apply(a,"grant",options).freeRemaining,1);
  assert.equal(apply(a,"reset",options).spent.maneuvers,0);
  assert.throws(()=>apply(a,"activate",options),/GM/);
});

test("undo refunds only the recorded extra-manoeuvre cost, new turn never heals", () => {
  const a = actor(); apply(a, "maneuver"); apply(a, "maneuver", { payment: "strain" });
  a.system.strain.value += 3;
  assert.equal(apply(a, "undo").maneuversRemaining, 1);
  assert.equal(a.system.strain.value, 3);
  apply(a, "maneuver", { payment: "strain" });
  assert.equal(apply(a, "reset").actionsRemaining, 1);
  assert.equal(a.system.strain.value, 5);
});

test("round changes refresh allowances and revisiting an earlier round preserves its spending", () => {
  const a = actor();
  assert.equal(turnKey({ id: "combat", started: true, round: 2 }), "combat:2");
  apply(a, "action", { key: "combat:1" });
  assert.equal(turnBudget(a, { key: "combat:2" }).actionsRemaining, 1);
  apply(a, "action", { key: "combat:2" });
  assert.equal(turnBudget(a, { key: "combat:1" }).actionsRemaining, 0);
  assert.throws(() => apply(a, "reset", { key: "combat:2" }), /GM/);
});

test("GM-awarded manoeuvres respect the cap and cannot be self-awarded by players", () => {
  const a = actor(); apply(a, "maneuver");
  assert.throws(() => apply(a, "grant"), /GM/);
  assert.equal(apply(a, "grant", { isGM: true }).freeRemaining, 1);
  apply(a, "maneuver");
  assert.throws(() => apply(a, "grant", { isGM: true }), /limit/i);
});

test("minions cannot buy manoeuvres with strain; rivals pay wounds; nemeses pay strain", () => {
  for (const type of ["minion", "rival", "nemesis"]) {
    const a = actor(type); apply(a, "maneuver");
    if (type === "minion") {
      assert.equal(turnBudget(a).canPayStrain, false);
      assert.throws(() => apply(a, "maneuver", { payment: "strain" }), /Minions/);
      apply(a, "maneuver", { payment: "action" });
    } else {
      apply(a, "maneuver", { payment: "strain" });
      assert.equal(a.system[type === "rival" ? "wounds" : "strain"].value, 2);
    }
  }
});

test("vehicles track pilot-only manoeuvres separately from crew actions", () => {
  const small = actor("vehicle");
  assert.equal(turnBudget(small).actionsRemaining, 0);
  assert.throws(() => apply(small, "action"), /crew/i);
  apply(small, "maneuver"); apply(small, "maneuver", { payment: "strain" });
  assert.equal(small.system.systemStrain.value, 2);
  const large = actor("vehicle", { silhouette: 5 });
  apply(large, "maneuver");
  assert.throws(() => apply(large, "maneuver", { payment: "strain" }), /limit/i);
});

test("learned passive turn effects stack by rank but repeated unranked talents count once", () => {
  const a = actor();
  a.items = [{ id: "spec", type: "specialization", system: { tree: { nodes: [
    { id: "one", name: "Extra preparation", key: "PREP", activation: "Passive", effects: [effect("freeManeuvers")] },
    { id: "two", name: "Extra preparation", key: "PREP", activation: "Passive", effects: [effect("freeManeuvers")] },
  ] } } }];
  a.system.advancement = [{itemId:"spec",nodeId:"one"}, {itemId:"spec",nodeId:"two"}];
  assert.equal(turnBudget(a).limits.freeManeuvers, 2);
  a.items[0].system.tree.nodes.forEach(n => { n.ranked = true; n.effects = [effect("actions")]; });
  assert.equal(turnBudget(a).limits.actions, 3);
  a.system.advancement.pop();
  assert.equal(turnBudget(a).limits.actions, 2, "Refunded talents disappear immediately");
});

test("conditional effects read actual skill ranks, and active rules need GM confirmation", () => {
  const a = actor("character", { skills: { athletics: { rank: 1 } } });
  a.items = [{ id:"conditional", type:"talent", name:"Reviewed conditioning", system:{
    activation:"Passive", effects:[effect("freeManeuvers", 1, { skill:"athletics", minimumRank:2 })],
  } }, { id:"active",type:"talent",name:"Reviewed burst",system:{activation:"Incidental",effects:[effect("actions")]} }];
  assert.equal(turnBudget(a).limits.freeManeuvers, 1);
  a.system.skills.athletics.rank = 2;
  assert.equal(turnBudget(a).limits.freeManeuvers, 2);
  assert.equal(turnBudget(a).limits.actions, 1);
  const id = turnBudget(a).decisions[0].id;
  assert.throws(() => apply(a, "activate", { ruleId:id }), /GM/);
  assert.equal(apply(a,"activate",{ruleId:id,isGM:true}).limits.actions, 2);
  assert.throws(() => apply(a,"activate",{ruleId:id,isGM:true}), /already/i);
  assert.equal(turnBudget(a,{key:"combat:2"}).limits.actions,1);
});

test("prepared actor allowances reflect Active Effects; status restrictions remain visible", () => {
  const a = actor("character", { turnEconomy: { actions:2,freeManeuvers:2,maneuverLimit:3,strainCost:1 } });
  const b = turnBudget(a);
  assert.equal(b.actionsRemaining, 2); assert.equal(b.maneuversRemaining, 3);
  a.statuses = new Set(["staggered", "immobilized"]);
  assert.equal(turnBudget(a).actionsRemaining, 0);
  assert.equal(turnBudget(a).maneuversRemaining, 0);
  assert.equal(turnBudget(actor("group")).supported, false);
});

test("turn effect validation rejects invalid counts, selectors and invented targets", () => {
  validateTalentNodeRules({ activation:"Passive",effects:[effect("actions",1,{skill:"athletics",minimumRank:2})] });
  for (const invalid of [effect("teleport"), effect("actions",99), effect("actions",1,{minimumRank:2})])
    assert.throws(() => validateTalentNodeRules({ activation:"Passive",effects:[invalid] }));
  assert.throws(() => validateTurnConfig({actions:-1}), /actions/);
  assert.throws(() => validateTurnConfig({actions:100}), /actions/);
});
