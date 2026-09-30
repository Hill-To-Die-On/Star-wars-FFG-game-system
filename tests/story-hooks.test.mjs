import test from "node:test";
import assert from "node:assert/strict";
import referenceLibrary from "../data/reference-library.json" with { type: "json" };
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
import { storyRollOptions, resolveStoryRoll, applyStoryHooks, missingStoryMechanics, storyHookCards, storyBackgroundParagraph, separateLegacyBiography } from "../src/story-hooks.mjs";

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

test("rolled obligation and morality populate story cards while preserving freeform Bio Notes", () => {
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
  assert.equal(updated.biography, original.biography);
  assert.deepEqual(updated.creation.storyRolls.map(({ roll }) => roll), [25, 33]);
  assert.deepEqual(missingStoryMechanics(updated, campaign), []);
  assert.equal(applyStoryHooks(updated, hooks).biography, updated.biography);
  const cards = storyHookCards(updated);
  assert.deepEqual(cards.map(({ type }) => type), ["Obligation", "Duty", "Morality"]);
  assert.match(cards[0].prose, /bounty/i);
  assert.match(cards[2].prose, /compassion/i);
  assert.match(storyBackgroundParagraph({ ...updated, species: "Human", career: "Smuggler" }), /Human.*smuggler.*bounty.*compassion/is);
});

test("private database prose is used when present and legacy generated notes can be separated", () => {
  const system = {
    species: "Human", career: "Smuggler",
    obligation: { label: "Family", value: 15 }, duty: { label: "", value: 0 },
    morality: { strength: "Enthusiasm", weakness: "Recklessness", value: 50 },
    creation: { storyRolls: [{ mechanic: "obligation", roll: 64, description: "Source family prose.", source: { book: "Owned book", page: "39" } }] },
    biography: "Species origin · Human\nThis Human grew up among many ways of life and learned to adapt, choosing which people and places feel like home.\n\nCareer origin · Smuggler\nThis smuggler survives by reading routes, people and risk; an unfinished delivery or promise makes the next journey personal.\n\nStory hook · Obligation\nFamily can enter a future session as a person, pressure or promise the character must address.\n\nMy own personality note.",
  };
  const cards = storyHookCards(system);
  assert.equal(cards[0].prose, "Source family prose.");
  assert.equal(cards[0].roll, 64);
  const separated = separateLegacyBiography(system);
  assert.equal(separated.biography, "My own personality note.");
  assert.ok(separated.changed);
  assert.equal(separateLegacyBiography({ ...system, biography: separated.biography }).changed, false);
});
