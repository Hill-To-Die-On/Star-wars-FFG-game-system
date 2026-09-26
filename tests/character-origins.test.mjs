import test from "node:test";
import assert from "node:assert/strict";
import {
  availableOriginOptions,
  fuzzyOriginOptions,
  originChoiceLocked,
  originSelectionUpdate,
  referenceRuleLine,
} from "../src/character-origins.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";

const source = (book = "") => ({ book, page: "10", table: "test", id: "1" });
const species = ({
  id = "species-human",
  name = "Human",
  book = "Edge of The Empire - Core Book",
  playable = "TRUE",
  xp = "110",
} = {}) => ({
  _id: id,
  id,
  type: "species",
  name,
  system: {
    source: source(book),
    metadata: {
      Playable: playable,
      Brawn: "2",
      Agility: "2",
      Intellect: "2",
      Cunning: "2",
      Willpower: "2",
      Presence: "2",
      Wound_Base: "10",
      Strain_Base: "10",
      XP: xp,
    },
  },
});
const career = ({
  id = "career-explorer",
  name = "Explorer",
  book = "Edge of The Empire - Core Book",
  skills = ["astrogation", "cool", "perception", "survival"],
} = {}) => ({
  _id: id,
  id,
  type: "career",
  name,
  system: { source: source(book), career: name, careerSkills: skills },
});

test("origin choices use enabled campaign lines and omit database placeholders", () => {
  const campaign = { ...DEFAULT_CAMPAIGN, lines: ["edge"] };
  const choices = availableOriginOptions(
    [
      species(),
      species({ id: "species-togruta", name: "Togruta", book: "Force & Destiny - Core Book" }),
      species({ id: "species-npc", name: "NPC species", playable: "FALSE" }),
      species({ id: "species-empty", name: "Incomplete", xp: "" }),
      career(),
      career({ id: "career-consular", name: "Consular", book: "Force & Destiny - Core Book" }),
      career({ id: "career-any", name: "Any Edge of The Empire", book: "", skills: [] }),
    ],
    campaign,
  );
  assert.deepEqual(choices.species.map((entry) => entry.name), ["Human"]);
  assert.deepEqual(choices.career.map((entry) => entry.name), ["Explorer"]);
});

test("source books and era careers resolve to their creation rules", () => {
  assert.equal(referenceRuleLine(career()), "edge");
  assert.equal(
    referenceRuleLine(career({ name: "Commander", book: "Age of Rebellion - Core Book" })),
    "age",
  );
  assert.equal(
    referenceRuleLine(career({ name: "Consular", book: "Force & Destiny - Core Book" })),
    "force",
  );
  assert.equal(
    referenceRuleLine(career({ name: "Jedi", book: "Collapse of the Republic" })),
    "force",
  );
  assert.equal(
    referenceRuleLine(career({ name: "Clone Soldier", book: "Collapse of the Republic" })),
    "age",
  );
});

test("fuzzy origin search tolerates punctuation and missing characters", () => {
  const options = [
    { id: "1", name: "Twi'lek", source: { book: "Edge" } },
    { id: "2", name: "Bounty Hunter", source: { book: "Edge" } },
    { id: "3", name: "Commander", source: { book: "Age" } },
  ];
  assert.equal(fuzzyOriginOptions(options, "twi lek")[0].id, "1");
  assert.equal(fuzzyOriginOptions(options, "bhuntr")[0].id, "2");
  assert.deepEqual(fuzzyOriginOptions(options, "zzzz"), []);
});

test("species and career choices populate structured creation data", () => {
  const current = {
    line: "age",
    phase: "creation",
    creation: {},
    incomplete: [],
    skills: {
      astrogation: { rank: 1, career: false, group: false, characteristic: "intellect" },
      brawl: { rank: 0, career: true, group: false, characteristic: "brawn" },
      cool: { rank: 0, career: false, group: false, characteristic: "presence" },
      perception: { rank: 0, career: false, group: false, characteristic: "cunning" },
      survival: { rank: 0, career: false, group: false, characteristic: "cunning" },
    },
  };
  const speciesUpdate = originSelectionUpdate("species", species(), current, DEFAULT_CAMPAIGN);
  assert.equal(speciesUpdate.species, "Human");
  assert.deepEqual(speciesUpdate.characteristics, {
    brawn: 2,
    agility: 2,
    intellect: 2,
    cunning: 2,
    willpower: 2,
    presence: 2,
  });
  assert.deepEqual(speciesUpdate.xp, { total: 110, available: 110 });
  assert.deepEqual(speciesUpdate.wounds, { value: 0, max: 12 });
  assert.deepEqual(speciesUpdate.strain, { value: 0, max: 12 });
  assert.equal(speciesUpdate.creation.speciesId, "species-human");
  assert.ok(speciesUpdate.creation.speciesAbilitiesPending);

  const careerUpdate = originSelectionUpdate("career", career(), current, DEFAULT_CAMPAIGN);
  assert.equal(careerUpdate.career, "Explorer");
  assert.equal(careerUpdate.line, "edge");
  assert.equal(careerUpdate.skills.astrogation.rank, 1, "staged selection keeps existing ranks");
  assert.equal(careerUpdate.skills.astrogation.career, true);
  assert.equal(careerUpdate.skills.brawl.career, false);
  assert.equal(careerUpdate.creation.careerId, "career-explorer");
});

test("origin choices lock after final creation or campaign play", () => {
  assert.equal(originChoiceLocked({ phase: "creation", creation: {} }), false);
  assert.equal(
    originChoiceLocked({ phase: "creation", creation: { applied: true } }),
    true,
  );
  assert.equal(originChoiceLocked({ phase: "play", creation: {} }), true);
});
