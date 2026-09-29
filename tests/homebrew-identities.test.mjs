import test from "node:test";
import assert from "node:assert/strict";
import {
  HOME_BREW_REVIEW, homebrewIdentityUpdate, homebrewIdentityState,
  reviewHomebrewIdentityUpdate, registerHomebrewIdentities, sourceReviewIncomplete,
} from "../src/homebrew-identities.mjs";
import { originSelectionUpdate } from "../src/character-origins.mjs";
import { vehicleSelectionUpdate } from "../src/vehicle-origins.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";

const permission = { allowed: true, editable: true };
const actor = (type = "character") => ({ type, name: "Test actor", system: {
  phase: "creation", species: "Human", career: "Pilot", creation: { speciesId: "published", careerId: "published-career" },
  characteristics: { brawn: 3 }, xp: { available: 90 }, wounds: { value: 2, max: 15 },
  skills: { pilotingSpace: { rank: 2, career: true } }, metadata: {}, incomplete: [],
} });

test("homebrew identity setting is GM-controlled, world-wide, off by default and refreshes sheets", () => {
  const saved = [];
  globalThis.game = { settings: { register: (...args) => saved.push(args) } };
  const refresh = () => {};
  try {
    registerHomebrewIdentities(refresh);
    assert.equal(saved.length, 1);
    const [namespace, key, config] = saved[0];
    assert.equal(namespace, "star-wars-ffg");
    assert.equal(key, "allowHomebrewIdentities");
    assert.equal(config.scope, "world");
    assert.equal(config.restricted, true);
    assert.equal(config.default, false);
    assert.equal(config.onChange, refresh);
  } finally { delete globalThis.game; }
});

test("custom identities require the live setting, editing rights, a valid field and non-empty bounded text", () => {
  for (const options of [{}, { allowed: true }, { editable: true }])
    assert.throws(() => homebrewIdentityUpdate(actor(), "species", "Nebulan", options));
  for (const value of ["", "  ", "x".repeat(121), { name: "Nebulan" }])
    assert.throws(() => homebrewIdentityUpdate(actor(), "species", value, permission));
  assert.throws(() => homebrewIdentityUpdate(actor(), "model", "Nebulan", permission));
  assert.throws(() => homebrewIdentityUpdate(actor("group"), "career", "Explorer", permission));
});

test("homebrew species and careers preserve explicit stats, drop database identity and retain creation locks", () => {
  for (const kind of ["species", "career"]) {
    const original = actor(), before = structuredClone(original);
    const update = homebrewIdentityUpdate(original, kind, "  Void   Nomad  ", permission);
    assert.equal(update.system[kind], "Void Nomad");
    assert.equal(update.system.creation[`${kind}Id`], "");
    assert.equal(update.system.creation[kind].book, "Homebrew");
    assert.equal(update.system.characteristics, undefined);
    assert.equal(update.system.skills, undefined);
    assert.equal(update.system.xp, undefined);
    assert.equal(update.system.metadata.homebrewIdentities[kind].reviewed, false);
    assert.ok(update.system.incomplete.includes(HOME_BREW_REVIEW));
    assert.deepEqual(original, before);
    for (const locked of [{ phase: "play" }, { creation: { applied: true } }])
      assert.throws(() => homebrewIdentityUpdate({ ...original, system: { ...original.system, ...locked } }, kind, "Changed", permission), /locked/i);
  }
});

test("homebrew vehicle entries retain names, registrations and stats but cannot retain published evidence", () => {
  for (const kind of ["model", "manufacturer"]) {
    const original = actor("vehicle");
    Object.assign(original.system, { registration: "SW-ABCD-1234", model: "Old", manufacturer: "Old Yard",
      silhouette: 4, hullTrauma: { value: 3, max: 22 }, metadata: { Hull: "Tank", vehicleStatEvidence: { verified: true }, vehicleSelection: { id: "published" } } });
    const update = homebrewIdentityUpdate(original, kind, "New Custom", permission);
    assert.equal(update.system[kind], "New Custom");
    assert.equal(update.name, undefined);
    assert.equal(update.system.hullTrauma, undefined);
    assert.equal(update.system.silhouette, undefined);
    assert.equal(update.img, undefined);
    assert.equal(update.system.source.book, "Homebrew");
    assert.equal(update.system.metadata.vehicleSelection.id, "");
    assert.equal(update.system.metadata.vehicleStatEvidence, null);
    assert.equal(update.system.metadata.homebrewIdentities[kind].reviewed, false);
  }
});

test("custom vehicle models also receive a stable default registration name", () => {
  const original = { type: "vehicle", name: "Vehicle", system: {} };
  const first = homebrewIdentityUpdate(original, "model", "VR-9 Courier", permission);
  assert.match(first.system.registration, /^SW-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.equal(first.name, `VR-9 Courier · ${first.system.registration}`);
  const second = homebrewIdentityUpdate({ ...original, ...first }, "model", "VR-10 Courier", permission);
  assert.equal(second.system.registration, first.system.registration);
  assert.equal(second.name, `VR-10 Courier · ${first.system.registration}`);
});

test("manual homebrew completion is GM-only, preserves unrelated gaps and never grants XP or resources", () => {
  const original = actor();
  const custom = homebrewIdentityUpdate(original, "species", "Nebulan", permission);
  const changed = { ...original, system: { ...original.system, ...custom.system, incomplete: [...custom.system.incomplete, "Unverified equipment"] } };
  assert.throws(() => reviewHomebrewIdentityUpdate(changed, { allowed: true, isGM: false }), /GM/);
  assert.throws(() => reviewHomebrewIdentityUpdate(changed, { allowed: false, isGM: true }), /enable/i);
  const update = reviewHomebrewIdentityUpdate(changed, { allowed: true, isGM: true, adventureStarted: true });
  assert.equal(update.system.phase, "play");
  assert.equal(update.system.creation.applied, true);
  assert.equal(update.system.creation.homebrew, true);
  assert.equal(update.system.metadata.homebrewIdentities.species.reviewed, true);
  assert.deepEqual(update.system.incomplete, ["Unverified equipment"]);
  assert.equal(update.system.xp, undefined);
  assert.equal(update.system.credits, undefined);
  assert.equal(update.items, undefined);
  assert.equal(homebrewIdentityState({ ...changed.system, ...update.system }).pending, false);
});

test("returning to database entries clears only the matching homebrew markers", () => {
  const current = { ...actor().system, metadata: { homebrewIdentities: { species: { name: "Nebulan", reviewed: false }, career: { name: "Pilot", reviewed: false } } }, incomplete: [HOME_BREW_REVIEW] };
  const species = { _id: "human", type: "species", name: "Human", system: { source: { book: "Edge of the Empire Core Rulebook", page: "48" }, metadata: {
    Playable: true, Brawn: 2, Agility: 2, Intellect: 2, Cunning: 2, Willpower: 2, Presence: 2, Wound_Base: 10, Strain_Base: 10, XP: 110,
  } } };
  const reset = originSelectionUpdate("species", species, current, DEFAULT_CAMPAIGN);
  assert.equal(reset.metadata.homebrewIdentities.species, null);
  assert.equal(reset.metadata.homebrewIdentities.career.name, "Pilot");
  assert.ok(reset.incomplete.includes(HOME_BREW_REVIEW));
  const vehicle = { _id: "ship", type: "vehicle", name: "Shuttle", system: { model: "Lambda", manufacturer: "Sienar", source: { book: "", page: "" }, incomplete: [] } };
  const system = { registration: "SW-1234-5678", metadata: { homebrewIdentities: { model: { name: "Custom" }, manufacturer: { name: "Custom" } } } };
  const normal = vehicleSelectionUpdate(vehicle, { name: "Ship", system }, DEFAULT_CAMPAIGN);
  assert.equal(normal.system.metadata.homebrewIdentities.model, null);
  assert.equal(normal.system.metadata.homebrewIdentities.manufacturer, null);
  assert.equal(homebrewIdentityState(normal.system).active, false);
});

test("ordinary source acknowledgement cannot bypass pending GM homebrew review", () => {
  const custom = homebrewIdentityUpdate(actor(), "species", "Nebulan", permission);
  assert.deepEqual(sourceReviewIncomplete(custom.system), [HOME_BREW_REVIEW]);
  const reviewed = reviewHomebrewIdentityUpdate({ ...actor(), system: { ...actor().system, ...custom.system } }, { allowed: true, isGM: true });
  assert.deepEqual(sourceReviewIncomplete(reviewed.system), []);
  assert.deepEqual(sourceReviewIncomplete({ incomplete: ["missing stats"] }), []);
});
