import test from "node:test";
import assert from "node:assert/strict";
import { activeCombatForActor, readTurnBudget } from "../src/turn-economy-foundry.mjs";

test("a started combat on another scene cannot exhaust this scene's actor", () => {
  const previous = { game: globalThis.game, canvas: globalThis.canvas };
  const actor = {
    id: "tala", uuid: "Actor.tala", type: "character", items: [],
    system: { strain: { value: 0, max: 10 }, wounds: { value: 0, max: 10 } },
    flags: { "star-wars-ffg": { turnEconomy: { rounds: [{
      key: "hangar-combat:7", entries: [{ kind: "action", actions: 1 }],
    }] } } },
    canUserModify: () => true,
  };
  const hangar = { id: "hangar-combat", started: true, round: 7,
    scene: { id: "hangar" }, combatants: [{ actor }] };
  globalThis.game = { user: { isGM: true }, combats: [hangar], combat: hangar };
  globalThis.canvas = { scene: { id: "perimeter" } };
  try {
    assert.equal(activeCombatForActor(actor), null);
    const budget = readTurnBudget(actor);
    assert.equal(budget.roundLabel, "Outside combat");
    assert.equal(budget.actionsRemaining, 1);
    assert.equal(budget.key, "freeplay:perimeter");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
