import test from "node:test";
import assert from "node:assert/strict";
import {
  SPECIES_ABILITY_REGISTRY, speciesAbilityEntry, speciesCheckBonuses,
  speciesStartingSkills, validateSpeciesAbilityRegistry,
  speciesTurnBonuses,
} from "../src/species-abilities.mjs";
import { creationPlan } from "../src/creation.mjs";
import { correctSourceRows } from "../scripts/publish-database.mjs";
import referenceDatabase from "../data/reference-database.json" with { type: "json" };
import referenceLibrary from "../data/reference-library.json" with { type: "json" };

test("verified species ability entries have distinct book and printed-page evidence", () => {
  assert.equal(validateSpeciesAbilityRegistry(), SPECIES_ABILITY_REGISTRY);
  assert.equal(speciesAbilityEntry("Clone", { book: "Rise of the Seperatists", page: "11" }).source.page, "12");
  assert.equal(speciesAbilityEntry("Clone", { book: "Collapse of the Republic", page: "11" }), null);
  assert.equal(speciesAbilityEntry("Clone", { book: "Rise of the Separatists", page: "99" }), null);
  assert.equal(speciesAbilityEntry("Human", { book: "Rise of the Separatists", page: "11" }), null);
  assert.deepEqual(speciesStartingSkills(speciesAbilityEntry("Clone", { book: "Rise of the Separatists", page: "11" })), ["warfare", "resilience"]);
  assert.throws(() => speciesStartingSkills(speciesAbilityEntry("Geonosian", { book: "Rise of the Separatists", page: "12" })), /Choose one valid/);
  assert.deepEqual(speciesStartingSkills(speciesAbilityEntry("Geonosian", { book: "Rise of the Separatists", page: "12" }), "mechanics"), ["mechanics"]);
});

test("only matching verified species and skill receive an automatic check die", () => {
  const source = { book: "Rise of the Seperatists", page: "15" };
  assert.equal(speciesCheckBonuses("Umbaran", source, "charm").boost, 1);
  assert.match(speciesCheckBonuses("Umbaran", source, "deception").reasons[0], /p\. 16/);
  assert.equal(speciesCheckBonuses("Umbaran", source, "athletics").boost, 0);
  assert.equal(speciesCheckBonuses("Umbaran", { book: "Homebrew", page: "15" }, "charm").boost, 0);
  assert.equal(speciesCheckBonuses("Harch", { book: "Collapse of the Republic", page: "14" }, "brawl").boost, 0);
  assert.equal(speciesCheckBonuses("Balosar", { book: "Age of Rebellion - Cyphers & Masks", page: "18" }, "vigilance").advantage, 2);
  assert.equal(speciesCheckBonuses("Arcona", { book: "Edge of the Empire - Far Horizons", page: "19" }, "charm").advantage, 1);
  assert.equal(speciesCheckBonuses("Arcona", { book: "Edge of the Empire - Far Horizons", page: "19" }, "athletics").advantage, 0);
  assert.equal(speciesTurnBonuses("Quermian", { book: "Force & Destiny - Savage Spirits", page: "21" }).freeManeuvers, 1);
});

test("Nexus of Power species keep their checked starting ranks and manual traits", () => {
  const aleena = speciesAbilityEntry("Aleena", { book: "Force & Destiny - Nexus of Power", page: "98" });
  const bardotan = speciesAbilityEntry("Bardotan", { book: "Force & Destiny - Nexus of Power", page: "98" });
  assert.equal(aleena.source.page, "98");
  assert.deepEqual(speciesStartingSkills(aleena), ["coordination"]);
  assert.deepEqual(aleena.abilities.map((ability) => ability.name), ["Small Stature", "Sturdy Frame"]);
  assert.equal(aleena.abilities.every((ability) => ability.application === "manual"), true);
  assert.equal(bardotan.source.page, "100");
  assert.deepEqual(speciesStartingSkills(bardotan), ["lore"]);
  assert.deepEqual(bardotan.abilities, []);
  assert.equal(speciesAbilityEntry("Bardotan", { book: "Force & Destiny - Nexus of Power", page: "99" }), null);
});

test("Stay on Target species use distinct ability pages and Xexto turn allowance", () => {
  const book = "Age of Rebellion - Stay On Target";
  const chadra = speciesAbilityEntry("Chadra-Fan", { book, page: "20" });
  const dressellian = speciesAbilityEntry("Dressellian", { book, page: "22" });
  const xexto = speciesAbilityEntry("Xexto", { book, page: "24" });
  assert.equal(chadra.source.page, "22");
  assert.deepEqual(speciesStartingSkills(chadra), ["mechanics"]);
  assert.equal(chadra.abilities.some((ability) => ability.name === "Acute Senses" && ability.application === "manual"), true);
  assert.equal(dressellian.source.page, "23");
  assert.deepEqual(speciesStartingSkills(dressellian), ["survival"]);
  assert.equal(dressellian.abilities[0].name, "Primitive");
  assert.equal(xexto.source.page, "25");
  assert.deepEqual(speciesStartingSkills(xexto), []);
  assert.equal(speciesTurnBonuses("Xexto", { book, page: "24" }).freeManeuvers, 1);
  assert.equal(speciesTurnBonuses("Xexto", { book, page: "20" }).freeManeuvers, 0);
});

test("Lead by Example species preserve environmental abilities for GM application", () => {
  const book = "Age of Rebellion - Lead By Example";
  const chagrian = speciesAbilityEntry("Chagrian", { book, page: "19" });
  const ishiTib = speciesAbilityEntry("Ishi Tib", { book, page: "21" });
  assert.equal(chagrian.source.page, "20");
  assert.deepEqual(speciesStartingSkills(chagrian), ["resilience"]);
  assert.deepEqual(chagrian.abilities.map((ability) => ability.name), ["Amphibious", "Knowledge Specialization"]);
  assert.equal(ishiTib.source.page, "22");
  assert.deepEqual(speciesStartingSkills(ishiTib), ["discipline"]);
  assert.deepEqual(ishiTib.abilities.map((ability) => ability.name), ["Amphibious", "Water Dependence"]);
  assert.equal(ishiTib.abilities.every((ability) => ability.application === "manual"), true);
});

test("Endless Vigil species retain source-specific skills and choices", () => {
  const book = "Force & Destiny - Endless Vigil";
  const muun = speciesAbilityEntry("Muun", { book, page: "20" });
  const pantoran = speciesAbilityEntry("Pantoran", { book, page: "22" });
  assert.equal(muun.source.page, "21");
  assert.deepEqual(speciesStartingSkills(muun), ["education", "coreWorlds"]);
  assert.equal(muun.abilities[0].name, "Deep Pockets");
  assert.equal(muun.abilities[0].application, "manual");
  assert.equal(pantoran.source.page, "23");
  assert.deepEqual(speciesStartingSkills(pantoran, "cool"), ["cool"]);
  assert.deepEqual(speciesStartingSkills(pantoran, "negotiation"), ["negotiation"]);
  assert.throws(() => speciesStartingSkills(pantoran, "discipline"), /allowed starting skill/);
  assert.equal(pantoran.abilities[0].name, "Tundra Dwellers");
});

test("Forged in Battle species have checked page citations and distinct creation grants", () => {
  const book = "Age of Rebellion - Forged In Battle";
  const elom = speciesAbilityEntry("Elom", { book, page: "18" });
  const elomin = speciesAbilityEntry("Elomin", { book, page: "18" });
  const kyuzo = speciesAbilityEntry("Kyuzo", { book, page: "22" });
  const shistavanen = speciesAbilityEntry("Shistavanen", { book, page: "24" });
  assert.equal(elom.source.page, "21");
  assert.deepEqual(speciesStartingSkills(elom), ["resilience"]);
  assert.equal(elom.abilities[0].name, "Digging Claws");
  assert.equal(elomin.source.page, "21");
  assert.deepEqual(speciesStartingSkills(elomin), ["charm", "education"]);
  assert.deepEqual(elomin.abilities, []);
  assert.equal(kyuzo.source.page, "24");
  assert.deepEqual(speciesStartingSkills(kyuzo), ["coordination"]);
  assert.equal(kyuzo.abilities[0].name, "Dense Musculature");
  assert.equal(shistavanen.source.page, "26");
  assert.deepEqual(speciesStartingSkills(shistavanen, "brawl"), ["brawl"]);
  assert.deepEqual(speciesStartingSkills(shistavanen, "survival"), ["survival"]);
  assert.throws(() => speciesStartingSkills(shistavanen, "charm"), /allowed starting skill/);
  assert.equal(shistavanen.abilities[0].name, "Hunter's Instincts");
});

test("Enter the Unknown species distinguish low-light vision from hovering", () => {
  const book = "Edge of The Empire - Enter The Unknown";
  const chiss = speciesAbilityEntry("Chiss", { book, page: "20" });
  const toydarian = speciesAbilityEntry("Toydarian", { book, page: "22" });
  assert.equal(chiss.source.page, "21");
  assert.deepEqual(speciesStartingSkills(chiss), ["cool"]);
  assert.equal(chiss.abilities[0].name, "Infravision");
  assert.equal(toydarian.source.page, "23");
  assert.deepEqual(speciesStartingSkills(toydarian), []);
  assert.deepEqual(toydarian.abilities.map((ability) => ability.name), ["Small Stature", "Hover"]);
  assert.equal(toydarian.abilities.every((ability) => ability.application === "manual"), true);
});

test("Dangerous Covenants species preserve subtype and training choices", () => {
  const book = "Edge of The Empire - Dangerous Covenants";
  const source = (species, page) => speciesAbilityEntry(species, { book, page });
  const aquala = source("Aqualish - Aquala", "19");
  const quara = source("Aqualish - Quara", "19");
  const ualaq = source("Aqualish - Ualaq", "19");
  assert.equal(aquala.source.page, "20");
  assert.deepEqual(speciesStartingSkills(aquala), ["brawl", "resilience"]);
  assert.deepEqual(speciesStartingSkills(quara, "coercion"), ["brawl", "coercion"]);
  assert.deepEqual(speciesStartingSkills(ualaq, "perception"), ["brawl", "perception"]);
  assert.throws(() => speciesStartingSkills(ualaq, "coercion"), /allowed starting skill/);
  const klatooinian = source("Klatooinian", "21");
  assert.equal(klatooinian.source.page, "22");
  assert.deepEqual(speciesStartingSkills(klatooinian, "rangedHeavy"), ["rangedHeavy"]);
  assert.equal(klatooinian.abilities[0].name, "Additional Training");
  const weequay = source("Weequay", "22");
  assert.equal(weequay.source.page, "23");
  assert.deepEqual(speciesStartingSkills(weequay, "athletics"), ["athletics"]);
  assert.equal(weequay.abilities[0].name, "Pheromone Communication");
});

test("the checked Ualaq skill choice is accurate in the public catalogue and import", () => {
  const original = "Breathe underwater, Brawl +1, Survival +1 OR Perception -1, Darkness +1, Perception -1";
  const tables = { species: [{ ID: 17, Species: "Aqualish - Ualaq", Book: "Edge of The Empire - Dangerous Covenants", Page: 19, Special: original }] };
  correctSourceRows(tables);
  assert.match(tables.species[0].Special, /Survival or Perception \+1/);
  const row = referenceDatabase.tables.species.find((entry) => entry.ID === 17);
  const item = referenceLibrary.documents.Item.find((entry) => entry.type === "species" && entry.name === "Aqualish - Ualaq");
  assert.equal(row.Special, tables.species[0].Special);
  assert.equal(item.system.metadata.Special, row.Special);
});

test("Strongholds species retain communication limits and their printed ability pages", () => {
  const book = "Age of Rebellion - Strongholds of Resistance";
  const polis = speciesAbilityEntry("Polis Massan", { book, page: "98" });
  const verpine = speciesAbilityEntry("Verpine", { book, page: "102" });
  assert.equal(polis.source.page, "99");
  assert.deepEqual(speciesStartingSkills(polis), ["medicine"]);
  assert.deepEqual(polis.abilities.map((ability) => ability.name), ["No Vocal Chords", "Telepathy"]);
  assert.equal(verpine.source.page, "103");
  assert.deepEqual(speciesStartingSkills(verpine), ["mechanics"]);
  assert.deepEqual(verpine.abilities.map((ability) => ability.name), ["Microvision", "Radio-wave Communication"]);
});

const startingSpecies = (name, book, page) => ({
  id: `species-${name}`,
  type: "species",
  name,
  system: {
    source: { book, page },
    metadata: {
      Brawn: 2, Agility: 2, Intellect: 2, Cunning: 2, Willpower: 2,
      Presence: 2, XP: 100, Wound_Base: 10, Strain_Base: 10,
    },
  },
});
const career = {
  id: "career-test", type: "career", name: "Test Career",
  system: { careerSkills: ["warfare", "cool", "perception", "survival"], source: { book: "Test" } },
};
const specialization = {
  id: "specialization-test", type: "specialization", name: "Test Specialization",
  system: { career: "Test Career", careerSkills: ["cool", "athletics"], source: { book: "Test" } },
};
const plan = (species, extra = {}) => creationPlan({
  species, career, specialization, line: "edge",
  careerRanks: career.system.careerSkills,
  specializationRanks: specialization.system.careerSkills,
  ...extra,
});

test("creation grants only verified species ranks and records their exact source", () => {
  const clone = plan(startingSpecies("Clone", "Rise of the Seperatists", "11"));
  assert.equal(clone.skills.warfare.rank, 2);
  assert.equal(clone.skills.resilience.rank, 1);
  assert.deepEqual(clone.creation.speciesSkillGrants, ["warfare", "resilience"]);
  assert.equal(clone.creation.speciesAbilitySource.page, "12");
  assert.equal(clone.creation.speciesAbilitiesPending, true, "talent still needs application");
  const unverified = plan(startingSpecies("Clone", "Homebrew", "11"));
  assert.equal(unverified.skills.resilience.rank, 0);
  assert.deepEqual(unverified.creation.speciesSkillGrants, []);
  const balosar = plan(startingSpecies("Balosar", "Age of Rebellion - Cyphers & Masks", "18"));
  assert.equal(balosar.skills.streetwise.rank, 1);
  assert.equal(balosar.creation.speciesAbilitiesPending, false, "all checked Balosar effects have native implementations");
  assert.deepEqual(balosar.incomplete, []);
});

test("species skill choice is required and creation rank cap includes the grant", () => {
  const geonosian = startingSpecies("Geonosian", "Rise of the Seperatists", "12");
  assert.throws(() => plan(geonosian), /Choose one valid/);
  assert.equal(plan(geonosian, { speciesSkillChoice: "mechanics" }).skills.mechanics.rank, 1);
  assert.throws(() => plan(geonosian, { speciesSkillChoice: "cool" }), /exceed rank 2/);
  const kubaz = speciesAbilityEntry("Kubaz", { book: "Age of Rebellion - Cyphers & Masks", page: "20" });
  assert.deepEqual(speciesStartingSkills(kubaz, "survival"), ["survival"]);
  assert.throws(() => speciesStartingSkills(kubaz, "mechanics"), /allowed starting skill/);
  const klatooinian = plan(startingSpecies("Klatooinian", "Edge of The Empire - Dangerous Covenants", "21"),
    { speciesSkillChoice: "brawl" });
  assert.deepEqual(klatooinian.creation.speciesSkillGrants, ["brawl"]);
  assert.equal(klatooinian.creation.speciesAbilitiesPending, true,
    "the additional non-career skill rank still needs a reviewed manual choice");
});
