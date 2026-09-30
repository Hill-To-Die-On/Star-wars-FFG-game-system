import test from "node:test";
import assert from "node:assert/strict";
import { creationPlan } from "../src/creation.mjs";

const species = (metadata = {}) => ({
  _id: "Species000000001",
  type: "species",
  name: "Example",
  system: {
    metadata: {
      Brawn: 2,
      Agility: 2,
      Intellect: 2,
      Cunning: 2,
      Willpower: 3,
      Presence: 2,
      XP: 100,
      Wound_Base: 10,
      Strain_Base: 10,
      ...metadata,
    },
    source: { book: "Example" },
  },
});

const career = {
  _id: "Career0000000001",
  type: "career",
  name: "Soldier",
  system: {
    careerSkills: ["athletics", "brawl", "discipline", "medicine", "melee", "resilience"],
    source: {},
  },
};

const specialization = {
  _id: "Special000000001",
  type: "specialization",
  system: { career: "Soldier", careerSkills: ["athletics", "medicine", "vigilance"], source: {} },
};

const choice = (changes = {}) => ({
  species: species(),
  career,
  specialization,
  line: "age",
  careerRanks: ["athletics", "brawl", "discipline", "medicine"],
  specializationRanks: ["medicine", "vigilance"],
  ...changes,
});

test("an Age of Rebellion character starts with Duty, and legacy _id fields are recorded", () => {
  const plan = creationPlan(choice({ resourceChoices: ["xp-5"] }));
  assert.deepEqual(plan.duty, { value: 5, label: "", contribution: 0 });
  assert.equal(plan.obligation, undefined);
  assert.equal(plan.morality, undefined);
  assert.deepEqual(plan.xp, { total: 105, available: 105 });
  assert.equal(plan.skills.medicine.rank, 2);
  assert.equal(plan.skills.vigilance.career, true);
  assert.equal(plan.strain.max, 13);
  assert.deepEqual(
    [plan.creation.speciesId, plan.creation.careerId, plan.creation.specializationId],
    ["Species000000001", "Career0000000001", "Special000000001"],
  );
  const unsaved = creationPlan(
    choice({
      species: { ...species(), _id: undefined },
      career: { ...career, _id: undefined },
      specialization: { ...specialization, _id: undefined },
    }),
  );
  assert.deepEqual(
    [unsaved.creation.speciesId, unsaved.creation.careerId, unsaved.creation.specializationId],
    ["", "", ""],
  );
});

test("creation refuses an incomplete choice of species, career, specialization or line", () => {
  for (const changes of [
    { line: "clone-wars" },
    { line: "toString" },
    { species: undefined },
    { species: { ...species(), type: "career" } },
    { career: undefined },
    { specialization: { ...specialization, type: "talent" } },
  ])
    assert.throws(
      () => creationPlan(choice(changes)),
      /Choose a species, career, specialization and creation line/,
    );
});

test("free skill ranks must be the right number of different eligible skills", () => {
  for (const careerRanks of [
    ["athletics", "brawl", "discipline"],
    ["athletics", "athletics", "brawl", "discipline"],
    ["athletics", "brawl", "discipline", "piloting"],
  ])
    assert.throws(
      () => creationPlan(choice({ careerRanks })),
      /Choose 4 different eligible free skills/,
    );
  assert.throws(
    () => creationPlan(choice({ specializationRanks: ["vigilance"] })),
    /Choose 2 different eligible free skills/,
  );
  const narrow = { ...specialization, system: { ...specialization.system, careerSkills: ["vigilance"] } };
  const plan = creationPlan(choice({ specialization: narrow, specializationRanks: ["vigilance"] }));
  assert.equal(plan.skills.vigilance.rank, 1);
});

test("species statistics must be recorded whole numbers before creation", () => {
  for (const [metadata, key] of [
    [{ Brawn: "" }, "Brawn"],
    [{ Agility: null }, "Agility"],
    [{ Presence: 1001 }, "Presence"],
    [{ Strain_Base: "ten" }, "Strain_Base"],
    [{ Wound_Base: 2.5 }, "Wound_Base"],
    [{ XP: -5 }, "XP"],
  ])
    assert.throws(
      () => creationPlan(choice({ species: species(metadata) })),
      new RegExp(`Species ${key} is missing; verify the source first`),
    );
});
