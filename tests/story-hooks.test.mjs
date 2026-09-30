import test from "node:test";
import assert from "node:assert/strict";
import referenceLibrary from "../data/reference-library.json" with { type: "json" };
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
import { storyRollOptions, resolveStoryRoll, applyStoryHooks, missingStoryMechanics } from "../src/story-hooks.mjs";

const entries = referenceLibrary.documents.Item;
const campaign = { ...DEFAULT_CAMPAIGN, obligation: true, duty: true, morality: true };

test("story rolls use a career table when present and return short category values", () => {
  const edge = storyRollOptions(entries, "obligation", "Smuggler", campaign);
  assert.ok(edge.length > 0);
  const result = resolveStoryRoll(edge, 1, "obligation");
  assert.ok(result.label);
  assert.equal(result.roll, 1);
  assert.equal(result.source.table, "obligation");
  const morality = resolveStoryRoll(storyRollOptions(entries, "morality", "Smuggler", campaign), 1, "morality");
  assert.ok(morality.strength);
  assert.ok(morality.weakness);
});

test("rolled obligation and morality populate editable story fields and preserve existing writing", () => {
  const original = { biography: "Tala chose the outer routes.", obligation: { value: 15, label: "" }, morality: { value: 50, strength: "", weakness: "" }, duty: { value: 0, label: "" }, creation: {} };
  assert.deepEqual(missingStoryMechanics(original, campaign), ["obligation", "morality"]);
  const hooks = [
    { mechanic: "obligation", roll: 25, label: "Bounty", source: { table: "obligation", book: "Edge of The Empire - Core Book", page: "39" } },
    { mechanic: "morality", roll: 33, strength: "Compassion", weakness: "Hatred", source: { table: "morality", book: "Force & Destiny - Core Book", page: "50" } },
  ];
  const updated = applyStoryHooks(original, hooks);
  assert.equal(updated.obligation.label, "Bounty");
  assert.equal(updated.morality.strength, "Compassion");
  assert.equal(updated.morality.weakness, "Hatred");
  assert.match(updated.biography, /^Tala chose the outer routes\./);
  assert.match(updated.biography, /Bounty/);
  assert.deepEqual(updated.creation.storyRolls.map(({ roll }) => roll), [25, 33]);
  assert.deepEqual(missingStoryMechanics(updated, campaign), []);
  assert.equal(applyStoryHooks(updated, hooks).biography, updated.biography);
});
