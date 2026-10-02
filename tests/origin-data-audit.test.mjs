import test from "node:test";
import assert from "node:assert/strict";
import database from "../data/reference-database.json" with { type: "json" };
import advancement from "../data/advancement-trees.json" with { type: "json" };
import speciesAbilities from "../data/species-abilities.json" with { type: "json" };
import sourceVerification from "../data/source-verification.json" with { type: "json" };
import { auditOriginData } from "../src/origin-data-audit.mjs";

const audit = () =>
  auditOriginData({ database, advancement, speciesAbilities, sourceVerification });

test("public origin data has consistent identities and source coverage", () => {
  const result = audit();
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(result.counts, {
    species: 174,
    playableSpecies: 104,
    playableSpeciesWithSource: 99,
    speciesAbilityReviewed: 39,
    speciesAbilityPending: 65,
    speciesAbilityEntries: 39,
    speciesWithoutSource: 5,
    careers: 24,
    sourcedCareers: 20,
    abstractCareers: 4,
    specializations: 135,
    specializationsSourceChecked: 132,
    specializationsPending: 3,
    signatureAbilities: 38,
    signatureAbilitiesSourceChecked: 36,
    signatureAbilitiesPending: 2,
    advancementNodes: 3042,
    advancementStructuralGraphs: 173,
    sourceVerificationChecks: 168,
  });
  assert.deepEqual(result.pending.speciesWithoutSource, [
    "Arkanian",
    "Drall",
    "Gungan",
    "Human - Corellian",
    "Sathari",
  ]);
  assert.deepEqual(result.pending.specializations, [
    "Droid Specialist",
    "Sapper",
    "Shipwright",
  ]);
  assert.deepEqual(result.pending.signatureAbilities, [
    "The Harder They Fall",
    "Unmatched Ingenuity",
  ]);
  assert.deepEqual(result.duplicateSpeciesNames, ["Gand"]);
});

test("the audit catches a career skill regression against the advancement overlay", () => {
  const edited = structuredClone(database);
  edited.tables.career_specialisations.find(
    (row) => row.Career_Specialisation === "Clone Trooper",
  ).Bonus_Career_Skills = "Gunnery, Perception, Ranged - Light, Resilience";
  const result = auditOriginData({
    database: edited,
    advancement,
    speciesAbilities,
    sourceVerification,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors.some(
      (error) =>
        error.code === "specialization-skill-mismatch" &&
        error.specialization === "Clone Trooper",
    ),
    true,
  );
});
