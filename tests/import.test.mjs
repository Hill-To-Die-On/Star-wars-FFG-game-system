import test from "node:test";
import assert from "node:assert/strict";
import { parseSqlDump } from "../scripts/sql-parser.mjs";
import { convertDatabase } from "../scripts/import-database.mjs";
import { validateBundle } from "../src/library.mjs";
import { creationPlan } from "../src/creation.mjs";
test("SQL is parsed as values, with quoted delimiters and escape sequences", () => {
  const sql =
    "INSERT INTO `equipment` (`ID`, `Name`, `Description`) VALUES (1, 'Pilot\\'s kit; (A,B)', 'Do not publish'), (2, 'x''y', NULL);";
  const result = parseSqlDump(sql);
  assert.equal(result.equipment[0].Name, "Pilot's kit; (A,B)");
  assert.equal(result.equipment[1].Name, "x'y");
  assert.equal(result.equipment[1].Description, null);
  assert.throws(() =>
    parseSqlDump("INSERT INTO `x` (`ID`) VALUES (SLEEP(1));"),
  );
});
test("reference importer omits prose, preserves books, escapes journal HTML and marks missing stats", () => {
  const bundle = convertDatabase({
    weapons: [
      {
        ID: 1,
        Weapon: "Test",
        Damage: "+2",
        Skill: "Melee",
        Book: "Test book",
        Page: 10,
        Description: "Private copyrighted prose",
      },
    ],
    planets: [
      { ID: 1, Planet_Name: "<img onerror=alert(1)>", Description: "omit" },
    ],
    vehicles: [{ ID: 1, Name: "Freighter" }],
  });
  assert.equal(bundle.documents.Item[0].system.source.page, "10");
  assert.equal(bundle.documents.Item[0].system.damage, "+2");
  assert.doesNotMatch(JSON.stringify(bundle), /Private copyrighted prose/);
  assert.match(
    bundle.documents.JournalEntry[0].pages[0].text.content,
    /&lt;img/,
  );
  assert.ok(bundle.documents.Actor[0].system.incomplete.length);
  validateBundle(bundle);
  assert.deepEqual(
    bundle,
    convertDatabase({
      weapons: [
        {
          ID: 1,
          Weapon: "Test",
          Damage: "+2",
          Skill: "Melee",
          Book: "Test book",
          Page: 10,
          Description: "Private copyrighted prose",
        },
      ],
      planets: [
        { ID: 1, Planet_Name: "<img onerror=alert(1)>", Description: "omit" },
      ],
      vehicles: [{ ID: 1, Name: "Freighter" }],
    }),
  );
});
test("signature ability references are native attachable tree placeholders", () => {
  const bundle = convertDatabase({
      signature_abilities: [
        {
          ID: 1,
          signature_abilities: "Example ability",
          career: "Explorer",
          career_type: "Discovery",
          book: "Held book",
          page: 42,
        },
      ],
    }),
    ability = bundle.documents.Item[0];
  assert.equal(ability.type, "signatureAbility");
  assert.deepEqual(ability.system.eligibleCareers, ["Explorer"]);
  assert.equal(ability.system.abilityCategory, "Discovery");
  assert.deepEqual(ability.system.incomplete, ["tree"]);
  validateBundle(bundle);
});
test("creation follows the chosen line and prevents mismatched free specializations", () => {
  const species = {
    id: "species-example",
    type: "species",
    name: "Example",
    system: {
      metadata: {
        Brawn: 2,
        Agility: 2,
        Intellect: 2,
        Cunning: 2,
        Willpower: 2,
        Presence: 2,
        XP: 100,
        Wound_Base: 10,
        Strain_Base: 10,
      },
      source: { book: "Example" },
    },
  };
  const career = {
    id: "career-explorer",
    type: "career",
    name: "Explorer",
    system: {
      careerSkills: ["athletics", "cool", "survival", "perception"],
      source: {},
    },
  };
  const specialization = {
    id: "specialization-example",
    type: "specialization",
    system: {
      career: "Explorer",
      careerSkills: ["athletics", "cool"],
      source: {},
    },
  };
  const plan = creationPlan({
    species,
    career,
    specialization,
    line: "edge",
    careerRanks: career.system.careerSkills,
    specializationRanks: ["athletics", "cool"],
    partySize: 4,
    resourceChoices: ["xp-5", "credits-1000"],
    startingEquipment: [
      {
        id: "starting-kit",
        name: "Starting kit",
        price: 700,
        quantity: 1,
        restricted: false,
      },
    ],
  });
  assert.equal(plan.skills.athletics.rank, 2);
  assert.equal(plan.creation.speciesId, "species-example");
  assert.equal(plan.creation.careerId, "career-explorer");
  assert.equal(plan.creation.specializationId, "specialization-example");
  assert.equal(plan.wounds.max, 12);
  assert.equal(plan.forceRating, 0);
  assert.deepEqual(plan.xp, { total: 105, available: 105 });
  assert.equal(plan.credits, 800);
  assert.equal(plan.obligation.value, 20);
  assert.equal(plan.creation.startingResources.cost, 700);
  assert.equal(plan.creation.pocketMoneyPending, true);
  assert.equal(
    Object.hasOwn(plan, "theme"),
    false,
    "character creation must preserve the sheet's automatic or manual theme choice",
  );
  const force = creationPlan({
    species,
    career,
    specialization,
    line: "force",
    careerRanks: ["athletics", "cool", "survival"],
    specializationRanks: ["athletics", "cool"],
    resourceChoices: ["morality-light"],
  });
  assert.equal(force.forceRating, 1);
  assert.equal(force.morality.value, 71);
  assert.throws(() =>
    creationPlan({
      species,
      career,
      specialization: {
        ...specialization,
        system: { ...specialization.system, career: "Other" },
      },
      line: "edge",
    }),
  );
});
