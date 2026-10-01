import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustCompactPool,
  chatModeToRollMode,
  emptyCompactPool,
  getCompactPoolState,
  loadCompactPool,
} from "../src/dice/compact-tray.mjs";

test("compact tray builds and trims a seven-die pool", () => {
  const empty = emptyCompactPool();
  assert.deepEqual(Object.keys(empty), [
    "boost",
    "ability",
    "proficiency",
    "setback",
    "difficulty",
    "challenge",
    "force",
  ]);
  const added = adjustCompactPool(
    adjustCompactPool(empty, "ability", 1),
    "force",
    2,
  );
  assert.equal(added.ability, 1);
  assert.equal(added.force, 2);
  assert.equal(adjustCompactPool(added, "ability", -4).ability, 0);
  assert.throws(() => adjustCompactPool(empty, "unknown", 1));
});

test("compact tray follows Foundry chat visibility modes", () => {
  assert.equal(chatModeToRollMode("public"), "publicroll");
  assert.equal(chatModeToRollMode("gm"), "gmroll");
  assert.equal(chatModeToRollMode("blind"), "blindroll");
  assert.equal(chatModeToRollMode("self"), "selfroll");
  assert.equal(chatModeToRollMode("ic"), "publicroll");
  assert.equal(chatModeToRollMode("unknown"), "publicroll");
});

test("an attack replaces the compact pool and preserves its roll context", () => {
  const actor = { id: "hero", name: "Hero" };
  loadCompactPool(
    { ability: 1, proficiency: 2, challenge: 1, setback: 1 },
    {
      label: "Hero → Rival · Service blaster",
      actor,
      turnCost: "action",
      automaticResults: { advantage: 1 },
      ruleNotes: ["Target defence: 1 setback"],
    },
  );

  const first = getCompactPoolState();
  assert.deepEqual(first.pool, {
    boost: 0,
    ability: 1,
    proficiency: 2,
    setback: 1,
    difficulty: 0,
    challenge: 1,
    force: 0,
  });
  assert.equal(first.context.label, "Hero → Rival · Service blaster");
  assert.equal(first.context.actor, actor);
  assert.equal(first.context.turnCost,"action");
  assert.deepEqual(first.context.automaticResults, { advantage: 1 });
  assert.deepEqual(first.context.ruleNotes, ["Target defence: 1 setback"]);

  loadCompactPool({ difficulty: 2 }, { label: "Second attack" });
  const second = getCompactPoolState();
  assert.equal(second.pool.ability, 0);
  assert.equal(second.pool.difficulty, 2);
  assert.equal(second.context.label, "Second attack");
  assert.equal(second.context.turnCost,"none");
  assert.deepEqual(second.context.automaticResults, {});
  assert.deepEqual(second.context.ruleNotes, []);
});
