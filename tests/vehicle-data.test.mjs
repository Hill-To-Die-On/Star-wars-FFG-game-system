import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  mergeVehicleStats,
  validateVehicleData,
} from "../src/vehicle-data.mjs";
import { mergeVehicleEnrichment } from "../src/library.mjs";

const source = { book: "Test book", page: "42" };
const stats = {
  hullTrauma: 18,
  systemStrain: 12,
  armor: 3,
  silhouette: 4,
  speed: 3,
  handling: -1,
  shields: { fore: 1, aft: 1, port: 0, starboard: 0 },
};
const evidence = {
  method: "exact-name",
  datasetNames: ["Test transport"],
  datasetKeys: ["TESTTRANSPORT"],
  structuredSources: [source],
  matchedFields: ["name", "book", "page"],
};
const data = {
  format: "star-wars-ffg-vehicle-stats",
  version: 1,
  boundary:
    "Numeric vehicle mechanics and source references only; descriptions, artwork and private paths are excluded.",
  records: [
    {
      _id: "abcdefghijklmnop",
      name: "Test transport",
      source,
      stats,
      evidence,
    },
  ],
  unresolved: [
    {
      _id: "ponmlkjihgfedcba",
      name: "Missing transport",
      source: { book: "Other book", page: "9" },
      reason: "no complete structured record",
    },
  ],
  report: {
    databaseVehicles: 2,
    matched: 1,
    unresolved: 1,
    conflicts: 0,
  },
};

const placeholder = (name = "Test transport") => ({
  _id: "abcdefghijklmnop",
  name,
  type: "vehicle",
  system: {
    source: { ...source, table: "vehicles", id: "1" },
    metadata: {},
    incomplete: [
      "hullTrauma.max",
      "systemStrain.max",
      "armor",
      "silhouette",
      "speed.max",
      "handling",
      "shields",
    ],
    hullTrauma: { value: 0, max: 0 },
    systemStrain: { value: 0, max: 0 },
    armor: 0,
    silhouette: 0,
    speed: { value: 0, max: 0 },
    handling: 0,
    shields: { fore: 0, aft: 0, port: 0, starboard: 0 },
  },
});

test("vehicle stat overlays validate and merge only exact public identities", () => {
  assert.equal(validateVehicleData(data), data);
  const bundle = {
      format: "star-wars-ffg-library",
      version: 1,
      documents: { Actor: [placeholder()] },
    },
    merged = mergeVehicleStats(bundle, data),
    vehicle = merged.documents.Actor[0];
  assert.equal(vehicle.system.hullTrauma.max, 18);
  assert.equal(vehicle.system.handling, -1);
  assert.deepEqual(vehicle.system.shields, stats.shields);
  assert.deepEqual(vehicle.system.incomplete, []);
  assert.equal(vehicle.system.metadata.vehicleStatEvidence.method, "exact-name");
  assert.throws(
    () =>
      mergeVehicleStats(bundle, {
        ...data,
        records: [{ ...data.records[0], name: "Wrong identity" }],
      }),
    /identity does not match/i,
  );
});

test("printed-page evidence can publish reviewed mechanics without private source material", () => {
  const printed = structuredClone(data);
  printed.records[0].evidence = {
    method: "printed-page",
    sourceReferences: [source],
    matchedFields: [
      "armor",
      "handling",
      "hullTrauma",
      "shields",
      "silhouette",
      "speed",
      "systemStrain",
    ],
  };
  assert.equal(validateVehicleData(printed), printed);
  assert.doesNotMatch(JSON.stringify(printed), /[A-Z]:[\\/]|\.pdf\b/i);
  printed.records[0].evidence.matchedFields = [
    "field-1",
    "field-2",
    "field-3",
    "field-4",
    "field-5",
    "field-6",
    "field-7",
  ];
  assert.throws(
    () => validateVehicleData(printed),
    /all reviewed vehicle fields/i,
  );
});

test("existing placeholder vehicles upgrade while edited vehicles remain untouched", () => {
  const incoming = mergeVehicleStats(
      {
        format: "star-wars-ffg-library",
        version: 1,
        documents: { Actor: [placeholder()] },
      },
      data,
    ).documents.Actor[0],
    update = mergeVehicleEnrichment(placeholder(), incoming);
  assert.equal(update["system.hullTrauma.max"], 18);
  assert.equal(update["system.handling"], -1);
  assert.deepEqual(update["system.incomplete"], []);

  const edited = placeholder();
  edited.system.armor = 9;
  assert.equal(mergeVehicleEnrichment(edited, incoming), null);
});

test("published vehicle data is complete, bounded and free of private material", async () => {
  const published = JSON.parse(
    await readFile("data/vehicle-stats.json", "utf8"),
  );
  validateVehicleData(published);
  assert.equal(
    published.report.databaseVehicles,
    published.report.matched + published.report.unresolved,
  );
  assert.deepEqual(published.report, {
    databaseVehicles: 399,
    matched: 312,
    unresolved: 87,
    conflicts: 2,
  });
  assert.equal(
    published.records.filter(
      (record) => record.evidence.method === "printed-page",
    ).length,
    36,
  );
  assert.equal(
    published.unresolved.filter(
      (record) => record.reason === "printed source has partial profile",
    ).length,
    1,
  );
  assert.equal(published.records.length, published.report.matched);
  assert.equal(published.unresolved.length, published.report.unresolved);
  const text = JSON.stringify(published);
  assert.doesNotMatch(text, /[A-Z]:[\\/]|\.xml\b|\.pdf\b/i);
  assert.doesNotMatch(text, /"(?:description|prose|artwork|path)"\s*:/i);
});
