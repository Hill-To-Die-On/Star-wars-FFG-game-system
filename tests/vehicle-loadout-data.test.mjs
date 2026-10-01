import test from "node:test";
import assert from "node:assert/strict";
import { enrichReferenceDatabase } from "../src/catalogue-enrichment.mjs";
import { convertDatabase } from "../scripts/import-database.mjs";
import { validateVehicleLoadouts } from "../src/vehicle-loadout-data.mjs";
import { readFile } from "node:fs/promises";
import { mergeVehicleLoadoutReference } from "../src/library.mjs";

const database = () => ({ format: "star-wars-reference-database", version: 1,
  provenance: { sourceSha256: "a".repeat(64) }, tables: { vehicles: [
    { ID: 7, Name: "Test transport", Class: "TT", Book: "Test book", Page: "42", Crew: "2" },
    { ID: 8, Name: "Unarmed transport", Book: "Test book", Page: "43" },
    { ID: 9, Name: "Unknown transport", Book: "Test book", Page: "44" },
  ] } });
const source = { book: "Test book", page: "42" };
const weapon = () => ({ key: "laser", name: "Light laser cannon", count: 2, location: "dorsal",
  arcs: ["fore", "aft", "port", "starboard"], damage: 5, critical: 3, range: "close",
  scale: "vehicle", skill: "gunnery", qualities: [{ name: "Linked", rank: 1 }] });
const loadouts = () => ({ format: "star-wars-ffg-vehicle-loadouts", version: 1, records: [
  { vehicleId: "7", name: "Test transport", source: { ...source }, method: "printed-page", weapons: [weapon()],
    systems: { sensorRange: "short", backupHyperdrive: 12, navigation: "navcomputer", consumables: "2 months" } },
  { vehicleId: "8", name: "Unarmed transport", source: { book: "Test book", page: "43" },
    method: "printed-page", weapons: [], systems: {} },
] });

test("source-checked mounts populate native vehicle weapons without multiplying Linked fire", () => {
  const original = database();
  const result = enrichReferenceDatabase(original, { loadouts: loadouts() });
  assert.equal(original.tables.vehicle_loadouts, undefined);
  assert.equal(result.tables.vehicle_loadouts.length, 1);
  const row = result.tables.vehicle_loadouts[0];
  assert.equal(row.Vehicle_ID, "7"); assert.equal(row.Count, 2);
  assert.equal(row.Qualities, "Linked 1"); assert.equal(row.Fire_Arcs, "fore, aft, port, starboard");
  const actors = convertDatabase(result.tables).documents.Actor;
  assert.equal(actors[0].items.length, 1);
  assert.equal(actors[0].items[0].system.quantity, 2);
  assert.equal(actors[0].items[0].system.qualities, "Linked 1");
  assert.equal(actors[0].items[0].system.metadata.fireArcs.length, 4);
  assert.equal(actors[0].system.metadata.Sensor_Range, "short");
  assert.ok(!actors[0].system.incomplete.includes("installed weapons"));
  assert.deepEqual(actors[1].items, []);
  assert.equal(actors[1].system.metadata.Weapons_Status, "source-checked unarmed");
  assert.ok(actors[2].system.incomplete.includes("installed weapons"));
  assert.equal(actors[0]._id, convertDatabase(original.tables).documents.Actor[0]._id);
});

test("unreviewed structured candidates are searchable but cannot silently arm vehicles", () => {
  const data = loadouts(); data.records[0].method = "structured-source";
  const enriched = enrichReferenceDatabase(database(), { loadouts: data });
  const actor = convertDatabase(enriched.tables).documents.Actor[0];
  assert.equal(enriched.tables.vehicle_loadouts[0].Review_Status, "source review required");
  assert.deepEqual(actor.items, []);
  assert.ok(actor.system.incomplete.includes("installed weapons"));
  assert.equal(actor.system.metadata.Sensor_Range, undefined);
  assert.equal(enriched.tables.vehicles[0].Candidate_Sensor_Range, "short");
});

test("loadout enrichment rejects mismatched books, identities, duplicate rows and private/prose fields", () => {
  const badSource = loadouts(); badSource.records[0].source.book = "Other edition";
  assert.throws(() => enrichReferenceDatabase(database(), { loadouts: badSource }), /identity/);
  const duplicate = loadouts(); duplicate.records.push(structuredClone(duplicate.records[0]));
  assert.throws(() => validateVehicleLoadouts(duplicate), /unique/);
  const prose = loadouts(); prose.records[0].description = "Book prose";
  assert.throws(() => validateVehicleLoadouts(prose), /unsupported/);
  const local = loadouts(); local.records[0].source.book = "C:\\private\\book.pdf";
  assert.throws(() => validateVehicleLoadouts(local), /public/);
  const unknown = loadouts(); unknown.records[0].weapons[0].damage = null;
  assert.throws(() => validateVehicleLoadouts(unknown), /damage/);
});

test("public database, Foundry bundle and overlays agree on all mechanical fields and readiness", async () => {
  const [db, library, stats, mounts] = await Promise.all(["reference-database", "reference-library", "vehicle-stats", "vehicle-loadouts"].map(async name => JSON.parse(await readFile(`data/${name}.json`, "utf8"))));
  assert.equal(validateVehicleLoadouts(mounts), mounts);
  assert.equal(mounts.records.filter(r => r.method === "printed-page").length, 11);
  assert.equal(mounts.records.filter(r => r.method === "structured-source").length, 141);
  const actors = new Map(library.documents.Actor.map(actor => [actor._id, actor]));
  for (const profile of stats.records) {
    const actor = actors.get(profile._id);
    const row = db.tables.vehicles.find(row => String(row.ID) === actor.system.source.id);
    assert.equal(row.Hull_Trauma, profile.stats.hullTrauma);
    assert.equal(actor.system.hullTrauma.max, row.Hull_Trauma);
    assert.equal(row.Handling, actor.system.handling);
    for (const side of ["fore", "aft", "port", "starboard"]) assert.equal(actor.system.shields[side], row[`Defense_${side}`]);
  }
  for (const record of mounts.records) {
    const actor = library.documents.Actor.find(actor => actor.system.source.id === record.vehicleId);
    assert.equal(actor.items.length, record.method === "printed-page" ? record.weapons.length : 0);
    if (record.method === "structured-source") assert.ok(actor.system.incomplete.includes("installed weapons"));
  }
  assert.doesNotMatch(JSON.stringify(mounts), /[A-Z]:[\\/]|\.(?:pdf|xml)\b|"(?:description|prose|path)"\s*:/i);
});

test("old compendium references receive checked loadouts without replacing custom weapons or play actors", () => {
  const incoming = convertDatabase(enrichReferenceDatabase(database(), { loadouts: loadouts() }).tables).documents.Actor[0];
  const existing = convertDatabase(database().tables).documents.Actor[0];
  const update = mergeVehicleLoadoutReference(existing, incoming);
  assert.equal(update.items.length, 1);
  assert.equal(update["system.metadata.Sensor_Range"], "short");
  assert.ok(!update["system.incomplete"].includes("installed weapons"));
  existing.items = [{ type: "weapon", name: "Custom gun" }];
  assert.equal(mergeVehicleLoadoutReference(existing, incoming), null);
});
