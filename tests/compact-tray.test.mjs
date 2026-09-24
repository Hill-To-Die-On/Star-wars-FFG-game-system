import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustCompactPool,
  chatModeToRollMode,
  emptyCompactPool,
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
