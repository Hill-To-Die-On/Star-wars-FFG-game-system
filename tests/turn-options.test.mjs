import test from "node:test";
import assert from "node:assert/strict";
import { turnBudget } from "../src/turn-economy.mjs";
import { turnOptionTooltips } from "../src/turn-options.mjs";
import { turnIndicatorHTML } from "../src/turn-economy-foundry.mjs";

function actor() {
  return {
    type: "character", name: "Test pilot",
    system: {
      career: "Smuggler", species: "Harch",
      creation: { species: { book: "Collapse of the Republic", page: "14" } },
      wounds: { value: 0, max: 12 }, strain: { value: 0, max: 10 },
      advancement: [{ itemId: "spec", nodeId: "full", name: "Full Throttle" }],
    },
    items: [
      { id: "spec", type: "specialization", system: { tree: { nodes: [{ id: "full", name: "Full Throttle", activation: "Action" }] } } },
      { id: "blaster", type: "weapon", name: "Blaster Pistol", system: { quantity: 1 } },
      { id: "stim", type: "gear", name: "Stimpack", system: { quantity: 1 } },
      { id: "pivot", type: "talent", name: "Practice Pivot", system: { activation: "Maneuver" } },
      { id: "career", type: "career", name: "Smuggler", system: { abilities: [{ name: "Career feint", activation: "Action" }] } },
      { id: "sense", type: "forcePower", name: "Sense", system: {} },
      { id: "scanner", type: "gear", name: "Tactical scanner", system: { equipped: true, quantity: 1, abilities: [
        { name: "Scan weakness", activation: "Action", summary: "Find an opening.", effects: [{ type: "pool", operation: "add", target: "boost", count: 1, skills: ["vigilance"] }] },
        { name: "Quiet readout", activation: "Passive", summary: "The scanner stays ready.", effects: [{ type: "pool", operation: "add", target: "boost", count: 1, skills: ["vigilance"] }] },
      ] } },
      { id: "rifle", type: "weapon", name: "Shock rifle", system: { quantity: 1, equipped: false, qualities: "Stun 3" } },
    ],
  };
}

test("live Action and Manoeuvre help includes actor sources and current allowance", () => {
  const a = actor(), budget = turnBudget(a), help = turnOptionTooltips(a, budget);
  assert.match(help.action, /1 of 1 ready/);
  assert.match(help.action, /Blaster Pistol/);
  assert.match(help.action, /Full Throttle/);
  assert.match(help.action, /Career feint/);
  assert.match(help.maneuver, /Practice Pivot/);
  assert.match(help.maneuver, /Stimpack/);
  assert.match(help.maneuver, /Harch/);
  assert.match(help.action, /Sense.*timing.*GM/i);
  assert.match(help.maneuver, /Sense.*timing.*GM/i);
  assert.match(help.action, /Scan weakness/);
  assert.match(help.action, /Passive rules currently in force/);
  assert.match(help.action, /Weapon qualities on Shock rifle/);
  assert.match(help.action, /Shock rifle.*ready it first/i);
  assert.doesNotMatch(help.action, /Practice Pivot/);
  assert.doesNotMatch(help.maneuver, /Full Throttle/);
});

test("spent Action and token compact indicator show the same updated options", () => {
  const a = actor();
  a.flags = { "star-wars-ffg": { turnEconomy: { rounds: [{ key: "freeplay", entries: [{ kind: "action", actions: 1 }] }] } } };
  const budget = turnBudget(a), help = turnOptionTooltips(a, budget);
  assert.match(help.action, /0 of 1 ready/);
  assert.match(help.action, /spent this turn/i);
  const sheet = turnIndicatorHTML(budget, { actor: a, compact: false });
  const token = turnIndicatorHTML(budget, { actor: a, compact: true });
  for (const html of [sheet, token]) {
    assert.match(html, /data-turn-help="action"[^>]*title="[^"]*Blaster Pistol/);
    assert.match(html, /data-turn-help="maneuver"[^>]*title="[^"]*Stimpack/);
  }
});
