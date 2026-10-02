import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSheetLibrary } from "../src/sheet-catalogue.mjs";
import { availableOriginOptions, fuzzyOriginOptions } from "../src/character-origins.mjs";
import { availableVehicleOptions, vehicleSelectionUpdate } from "../src/vehicle-origins.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
import { actorIconDescriptor } from "../src/actor-icons.mjs";
import { generatedActorUpdate, tokenArtworkUpdate } from "../src/actor-artwork-foundry.mjs";

const campaign = structuredClone(DEFAULT_CAMPAIGN);
const source = { book: "Edge of the Empire Core Rulebook", page: "264" };
const craft = (id, model, manufacturer = "Corellian Engineering Corporation") => ({
  _id: id, type: "vehicle", name: `${model} Light Freighter`,
  system: { model, manufacturer, source, silhouette: 4, armor: 3,
    hullTrauma: { value: 0, max: 22 }, systemStrain: { value: 0, max: 15 },
    speed: { value: 0, max: 3 }, handling: -1, shields: { fore: 1, aft: 1, port: 0, starboard: 0 },
    crew: "2", passengers: "6", cargo: "165", hyperdrive: "2", metadata: { Hull: "Light Freighter" }, incomplete: [] },
});
const ships = [craft("ship-one", "YT-1300"), craft("ship-two", "Lambda", "Sienar Fleet Systems")];

test("sheet choices and document lookup work before a GM imports compendiums", async () => {
  const bundle = JSON.parse(await readFile(new URL("../data/reference-library.json", import.meta.url)));
  const library = await createSheetLibrary(bundle.documents.Item);
  const options = availableOriginOptions(library.index, campaign);
  assert.ok(options.species.length > 100);
  assert.ok(options.career.length >= 18);
  const human = options.species.find(entry => entry.name === "Human");
  assert.ok(human);
  const entry = await library.getDocument(human.id);
  entry.name = "edited copy";
  assert.equal((await library.getDocument(human.id)).name, "Human");
  assert.equal(await library.getDocument("absent"), null);
});

test("visible world library overrides matching identities and retains bundled choices", async () => {
  const override = craft("ship-one", "World override");
  const pack = { visible: true, index: [override], getIndex: async () => {}, getDocument: async () => override };
  const library = await createSheetLibrary(ships, pack);
  assert.equal(library.index.length, 2);
  assert.equal((await library.getDocument("ship-one")).system.model, "World override");
  const hidden = await createSheetLibrary(ships, { ...pack, visible: false });
  assert.equal((await hidden.getDocument("ship-one")).system.model, "YT-1300");
});

test("model and manufacturer choices use fuzzy database search and owned-book filtering", () => {
  const options = availableVehicleOptions(ships, campaign);
  assert.equal(fuzzyOriginOptions(options.model, "yt130")[0].id, "ship-one");
  assert.equal(fuzzyOriginOptions(options.manufacturer, "corelian")[0].name, "Corellian Engineering Corporation");
  assert.deepEqual(availableVehicleOptions(ships, campaign, "Sienar Fleet Systems").model.map(x => x.id), ["ship-two"]);
  assert.equal(availableVehicleOptions(ships, { ...campaign, bookMode: "owned", books: [] }).model.length, 0);
});

test("selecting a vehicle populates its profile and preserves custom identity and current resources", () => {
  const actor = { name: "Krayt Fang", img: "custom.webp", system: {
    registration: "SW-AB12-CD34", hullTrauma: { value: 4, max: 10 }, systemStrain: { value: 2, max: 10 },
    speed: { value: 1, max: 2 }, notes: "Our ship", footprint: { mode: "manual", length: 40, width: 20 },
  } };
  const update = vehicleSelectionUpdate(ships[0], actor, campaign);
  assert.equal(update.name, undefined);
  assert.equal(update.img, undefined);
  assert.equal(update.system.model, "YT-1300");
  assert.equal(update.system.manufacturer, "Corellian Engineering Corporation");
  assert.deepEqual(update.system.hullTrauma, { value: 4, max: 22 });
  assert.deepEqual(update.system.speed, { value: 1, max: 3 });
  assert.equal(update.system.notes, undefined);
  assert.deepEqual(update.system.footprint, { hull: "auto" }, "Model controls the default hull while preserving footprint dimensions");
  assert.equal(update.system.registration, "SW-AB12-CD34");
  assert.equal(update.system.metadata.vehicleSelection.id, "ship-one");
  assert.throws(() => vehicleSelectionUpdate(ships[0], actor, campaign, { manufacturer: "Invented" }), /manufacturer/i);
  assert.throws(() => vehicleSelectionUpdate({ ...ships[0], type: "character" }, actor, campaign), /valid vehicle/i);
});

test("unnamed ships receive a model and registration name only while it remains automatic", () => {
  const first = vehicleSelectionUpdate(ships[0], { name: "Vehicle", system: {} }, campaign, { registration: "SW-0123-ABCD" });
  assert.equal(first.name, "YT-1300 · SW-0123-ABCD");
  const next = vehicleSelectionUpdate(ships[1], { name: first.name, system: first.system }, campaign);
  assert.equal(next.name, "Lambda · SW-0123-ABCD");
  const named = vehicleSelectionUpdate(ships[0], { name: "Wayward Star", system: next.system }, campaign);
  assert.equal(named.name, undefined);
  assert.match(vehicleSelectionUpdate(ships[0], { name: "", system: {} }, campaign).system.registration, /^SW-[A-F0-9]{4}-[A-F0-9]{4}$/);
});

test("incomplete vehicle profiles stay explicitly incomplete when selected", () => {
  const entry = craft("incomplete", "Unverified hull");
  entry.system.armor = 0;
  entry.system.incomplete = ["armor"];
  const update = vehicleSelectionUpdate(entry, { name: "Test", system: {} }, campaign);
  assert.deepEqual(update.system.incomplete, ["armor"]);
  assert.equal(update.system.armor, 0);
});

test("model selection drives matching procedural portrait and rectangular token art", () => {
  const actor = { type: "vehicle", name: "Our ship", system: { footprint: { hull: "tank" } } };
  const previous = actorIconDescriptor(actor);
  const update = vehicleSelectionUpdate(ships[0], actor, campaign);
  const changed = { ...actor, system: { ...actor.system, ...update.system } };
  const portrait = generatedActorUpdate(changed, {}, true);
  assert.equal(previous.archetype, "tank");
  assert.equal(portrait.flags["star-wars-ffg"].proceduralIcon.archetype, "freighter");
  const token = tokenArtworkUpdate({ ...changed, img: portrait.img }, { width: 4, height: 8 }, { persist: true });
  const svg = Buffer.from(token.texture.src.split(",")[1], "base64").toString();
  assert.match(svg, /viewBox="0 0 50 100"/);
  assert.match(svg, /data-archetype="freighter"/);
});
