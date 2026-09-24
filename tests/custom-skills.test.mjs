import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCustomSkill,
  customSkillDefinition,
  customSkillKey,
  discardCustomSkill,
  replaceCustomSkill,
  resolveCustomSkill,
} from "../src/custom-skills.mjs";

const skill = (label, overrides = {}) => ({
  label,
  characteristic: "cunning",
  type: "general",
  rank: 0,
  career: false,
  group: false,
  ...overrides,
});

test("custom skills add, resolve, edit and remove stable records", () => {
  let skills = appendCustomSkill([], skill("Tradecraft"), { id: "one" });
  assert.equal(resolveCustomSkill(skills, customSkillKey("one")).label, "Tradecraft");
  assert.equal(resolveCustomSkill(skills, "tradecraft").id, "one");
  skills = replaceCustomSkill(
    skills,
    "one",
    skill("  Trade   Secrets  ", { rank: 2, career: true }),
  );
  assert.deepEqual(skills[0], {
    id: "one",
    label: "Trade Secrets",
    characteristic: "cunning",
    type: "general",
    rank: 2,
    career: true,
    group: false,
  });
  skills = discardCustomSkill(skills, "one");
  assert.deepEqual(skills, []);

  for (let index = 0; index < 12; index++)
    skills = appendCustomSkill(skills, skill(`Custom ${index + 1}`), {
      id: `id${index}`,
    });
  assert.equal(skills.length, 12);
});

test("custom skill validation prevents ambiguous or invalid records", () => {
  const existing = appendCustomSkill([], skill("Tradecraft"), { id: "one" });
  assert.throws(
    () => appendCustomSkill(existing, skill("tradecraft"), { id: "two" }),
    /already uses/i,
  );
  assert.throws(
    () => appendCustomSkill([], skill("Athletics"), { id: "standard" }),
    /standard skill/i,
  );
  assert.throws(
    () => appendCustomSkill([], skill("Invalid", { characteristic: "luck" }), { id: "bad" }),
    /valid characteristic/i,
  );
  assert.throws(
    () => appendCustomSkill([], skill("Invalid", { rank: 6 }), { id: "bad" }),
    /rank must be/i,
  );
});

test("custom combat definitions preserve automatic melee and ranged semantics", () => {
  assert.deepEqual(
    customSkillDefinition(skill("Dueling", { type: "melee" })),
    {
      label: "Dueling",
      characteristic: "cunning",
      group: "Combat",
      melee: true,
      custom: true,
    },
  );
  assert.equal(
    customSkillDefinition(skill("Siegecraft", { type: "ranged" })).melee,
    false,
  );
});
