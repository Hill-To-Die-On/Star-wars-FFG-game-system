import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCustomSkill,
  customSkillDefinition,
  customSkillId,
  customSkillKey,
  discardCustomSkill,
  normalizeCustomSkill,
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

test("an actor's first custom skill defaults to an unranked general task", () => {
  const skills = appendCustomSkill(
    undefined,
    { label: "Tradecraft", characteristic: "cunning" },
    { id: "one" },
  );
  assert.deepEqual(skills, [
    {
      id: "one",
      label: "Tradecraft",
      characteristic: "cunning",
      type: "general",
      rank: 0,
      career: false,
      group: false,
    },
  ]);
  assert.deepEqual(customSkillDefinition(skills[0]), {
    label: "Tradecraft",
    characteristic: "cunning",
    group: "General",
    melee: false,
    custom: true,
  });
});

test("custom skill validation names the missing or invalid field", () => {
  assert.throws(
    () => appendCustomSkill([], skill("Tradecraft")),
    /Custom skill needs a stable identifier/,
  );
  assert.throws(
    () => appendCustomSkill([], skill("Tradecraft"), { id: "x".repeat(65) }),
    /Custom skill needs a stable identifier/,
  );
  assert.equal(
    appendCustomSkill([], skill("x".repeat(60)), { id: "one" })[0].label.length,
    60,
  );
  for (const label of [undefined, "   ", "x".repeat(61)])
    assert.throws(
      () => appendCustomSkill([], skill(label), { id: "one" }),
      /Enter a custom skill name of 60 characters or fewer/,
    );
  assert.throws(
    () => appendCustomSkill([], { label: "Tradecraft" }, { id: "one" }),
    /Choose a valid characteristic for the custom skill/,
  );
  assert.throws(
    () => appendCustomSkill([], skill("Tradecraft", { type: "knowledge" }), { id: "one" }),
    /Choose how the custom skill is used/,
  );
  for (const rank of [-1, 1.5])
    assert.throws(
      () => appendCustomSkill([], skill("Tradecraft", { rank }), { id: "one" }),
      /Custom skill rank must be from 0 to 5\./,
    );
});

test("editing or removing a custom skill the actor does not have is refused", () => {
  const skills = appendCustomSkill([], skill("Tradecraft"), { id: "one" });
  for (const current of [skills, undefined]) {
    assert.throws(
      () => replaceCustomSkill(current, "two", skill("Slicing")),
      /Custom skill was not found/,
    );
    assert.throws(
      () => discardCustomSkill(current, "two"),
      /Custom skill was not found/,
    );
  }
});

test("custom skill references that match nothing resolve to no definition", () => {
  const skills = appendCustomSkill([], skill("Tradecraft"), { id: "one" });
  assert.equal(customSkillId(customSkillKey("one")), "one");
  assert.equal(customSkillId("athletics"), "");
  assert.equal(customSkillId(undefined), "");
  assert.equal(resolveCustomSkill(skills, customSkillKey("two")), null);
  assert.equal(resolveCustomSkill(skills, undefined), null);
  assert.equal(resolveCustomSkill(undefined, "Tradecraft"), null);
  assert.equal(customSkillDefinition(resolveCustomSkill(skills, "Slicing")), null);
});

test("custom skills keep their own id and respect the character or adversary rank cap", () => {
  assert.deepEqual(
    normalizeCustomSkill(skill(" Tradecraft ", { id: "one", rank: 5 })),
    {
      id: "one",
      label: "Tradecraft",
      characteristic: "cunning",
      type: "general",
      rank: 5,
      career: false,
      group: false,
    },
  );
  assert.throws(
    () => normalizeCustomSkill(skill("Tradecraft", { id: "one", rank: 6 })),
    /Custom skill rank must be from 0 to 5\./,
  );
  const adversary = appendCustomSkill(
    [],
    skill("Tradecraft", { id: "one", rank: 8 }),
    { rankCap: 10 },
  );
  assert.deepEqual(
    adversary.map((entry) => [entry.id, entry.rank]),
    [["one", 8]],
  );
  assert.throws(
    () =>
      appendCustomSkill(adversary, skill("Slicing", { rank: 11 }), {
        id: "two",
        rankCap: 10,
      }),
    /Custom skill rank must be from 0 to 10\./,
  );
});

test("custom skills refuse built-in object names as a characteristic or use", () => {
  for (const name of ["constructor", "hasOwnProperty", "toString", "__proto__"]) {
    assert.throws(
      () => normalizeCustomSkill(skill("Tradecraft", { id: "one", characteristic: name })),
      /Choose a valid characteristic for the custom skill/,
    );
    assert.throws(
      () => normalizeCustomSkill(skill("Tradecraft", { id: "one", type: name })),
      /Choose how the custom skill is used/,
    );
  }
});
