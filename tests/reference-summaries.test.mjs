import test from "node:test";
import assert from "node:assert/strict";
import { referenceSummary } from "../src/reference-summaries.mjs";
import {
  careerStoryPrompts, appendCareerStoryPrompts,
  speciesStoryPrompts, appendSpeciesStoryPrompts,
} from "../src/career-story.mjs";

test("ship summaries use recorded facts and expose missing profile data", () => {
  const summary = referenceSummary("vehicles", {
    Hull: "Landspeeder", Manufacturer: "Ubrikkian Industries", Crew: "3",
    Silhouette: 3, Armor: 3, Speed: 2, Handling: 1,
    Weapons_Status: "source review required",
  });
  assert.match(summary, /Landspeeder/);
  assert.match(summary, /Ubrikkian Industries/);
  assert.match(summary, /crew of 3/);
  assert.match(summary, /silhouette 3/);
  assert.match(summary, /armament.*source review/i);
  assert.doesNotMatch(summary, /weapons?: [^.]*(?:cannon|blaster)/i);
  assert.match(referenceSummary("vehicles", { Hull: "Freighter" }), /profile statistics are not recorded/i);
});

test("item summaries use only recorded category and mechanics", () => {
  assert.match(referenceSummary("equipment", {
    Equipment_Type: "Tools & Electronics", Career: "Engineer", Price: "250",
    Encumbrance: "3", Rarity: "2",
  }), /Tools & Electronics.*Engineer.*250 cr.*encumbrance 3.*rarity 2/i);
  assert.match(referenceSummary("weapons", {
    Skill: "Ranged - Light", Damage: "6", Critical: "3",
    Range: "Short", Qualities: "Stun Setting",
  }), /damage 6.*critical 3.*Short range.*Stun Setting/i);
  assert.equal(referenceSummary("equipment", { Equipment_Type: "Tools" }), "Tools equipment. Other properties are not recorded.");
  assert.equal(referenceSummary("talents", { Talent: "Something" }), "");
});

test("career story prompts are original, optional and preserve existing biography", () => {
  const ace = careerStoryPrompts("Ace");
  const spy = careerStoryPrompts("Spy");
  assert.equal(ace.length, 3);
  assert.equal(spy.length, 3);
  assert.notDeepEqual(ace, spy);
  assert.deepEqual(careerStoryPrompts(""), []);
  const existing = "My own biography.";
  const added = appendCareerStoryPrompts(existing, "Ace");
  assert.ok(added.startsWith(existing));
  assert.match(added, /Career background · Ace/);
  assert.equal(appendCareerStoryPrompts(added, "Ace"), added);
});

test("species summaries show starting values while leaving unreviewed abilities open", () => {
  const summary = referenceSummary("species", {
    Species: "Aleena", Brawn: "1", Agility: "3", Intellect: "2",
    Cunning: "2", Willpower: "2", Presence: "2",
    Wound_Base: "8", Strain_Base: "10", XP: "95",
    Special: "Coordination +1, Silhouette 0",
  });
  assert.match(summary, /Brawn 1.*Agility 3/);
  assert.match(summary, /wound base 8.*strain base 10.*starting XP 95/i);
  assert.match(summary, /abilities and exceptions.*source review/i);
  assert.doesNotMatch(summary, /Coordination|Silhouette/);
  assert.equal(referenceSummary("species", { Species: "Unknown" }), "Species starting values are not recorded. Abilities and exceptions need source review.");
});

test("species prompts avoid invented cultural or mechanical claims", () => {
  const questions = speciesStoryPrompts("Aleena");
  assert.equal(questions.length, 3);
  assert.ok(questions.some((question) => question.includes("Aleena")));
  const draft = appendSpeciesStoryPrompts("My own biography.", "Aleena");
  assert.match(draft, /Species background · Aleena/);
  assert.equal(appendSpeciesStoryPrompts(draft, "Aleena"), draft);
});
