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

const assertEachRefused = (cases) => {
  for (const [change, message] of cases) {
    const copy = structuredClone(data);
    change(copy);
    assert.throws(() => validateVehicleData(copy), message);
  }
};

test("vehicle data outside the public format or copyright boundary is refused", () => {
  assert.throws(
    () => validateVehicleData(null),
    /Unsupported public vehicle data format/,
  );
  assertEachRefused([
    [
      (copy) => (copy.format = "star-wars-ffg-library"),
      /Unsupported public vehicle data format/,
    ],
    [(copy) => (copy.version = 2), /Unsupported public vehicle data format/],
    [
      (copy) => delete copy.unresolved,
      /Unsupported public vehicle data format/,
    ],
    [
      (copy) => (copy.boundary = "Complete vehicle entries."),
      /Vehicle data needs the public copyright boundary/,
    ],
    [
      (copy) => (copy.sourcePath = "C:/books/vehicles.xml"),
      /Vehicle data contains unsupported sourcePath/,
    ],
    [
      (copy) => (copy.records[0].description = "Printed vehicle prose"),
      /Vehicle record contains unsupported description/,
    ],
    [
      (copy) => (copy.unresolved[0].artwork = "transport.webp"),
      /Vehicle record contains unsupported artwork/,
    ],
    [
      (copy) => (copy.records[0].source = { ...source, path: "books/core" }),
      /Test transport source contains unsupported path/,
    ],
  ]);
});

test("vehicle records need unique identities, safe names and printed page references", () => {
  assertEachRefused([
    [
      (copy) => delete copy.records[0]._id,
      /Vehicle records need unique native identities/,
    ],
    [
      (copy) => (copy.records[0]._id = "transport-1"),
      /Vehicle records need unique native identities/,
    ],
    [
      (copy) => (copy.unresolved[0]._id = copy.records[0]._id),
      /Vehicle records need unique native identities/,
    ],
    [
      (copy) => (copy.records[0].name = " "),
      /Vehicle name is not a safe public value/,
    ],
    [
      (copy) => (copy.records[0].name = "C:\\Vehicles\\Test transport"),
      /Vehicle name is not a safe public value/,
    ],
    [
      (copy) =>
        (copy.records[0].source = { book: "Core Rulebook.pdf", page: "42" }),
      /Test transport source book is not a safe public value/,
    ],
    [
      (copy) =>
        (copy.unresolved[0].source = { book: "../private/Other book", page: "9" }),
      /Missing transport source book is not a safe public value/,
    ],
    [
      (copy) => delete copy.unresolved[0].source,
      /Missing transport source book is not a safe public value/,
    ],
    [
      (copy) => (copy.records[0].source = { book: "Test book", page: 42 }),
      /Test transport source needs a safe printed page reference/,
    ],
    [
      (copy) => (copy.records[0].source = { book: "Test book", page: "p. 42" }),
      /Test transport source needs a safe printed page reference/,
    ],
  ]);
});

test("vehicle stats outside their supported ranges are refused", () => {
  const withStats = (changes) => (copy) =>
    (copy.records[0].stats = { ...stats, ...changes });
  assertEachRefused([
    [withStats({ crew: 4 }), /Test transport stats contains unsupported crew/],
    [
      withStats({ hullTrauma: "18" }),
      /Test transport stats hull trauma is outside the supported range/,
    ],
    [
      withStats({ systemStrain: 1.5 }),
      /Test transport stats system strain is outside the supported range/,
    ],
    [
      withStats({ silhouette: 21 }),
      /Test transport stats silhouette is outside the supported range/,
    ],
    [
      withStats({ handling: -11 }),
      /Test transport stats handling is outside the supported range/,
    ],
    [
      withStats({ shields: { ...stats.shields, fore: 5 } }),
      /Test transport stats fore shields is outside the supported range/,
    ],
    [
      withStats({ shields: { ...stats.shields, dorsal: 1 } }),
      /Test transport stats shields contains unsupported dorsal/,
    ],
    [
      withStats({ shields: undefined }),
      /Test transport stats fore shields is outside the supported range/,
    ],
  ]);
});

test("match evidence needs a supported method and reviewed public sources", () => {
  const printed = {
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
  const withEvidence = (changes, base = evidence) => (copy) =>
    (copy.records[0].evidence = { ...base, ...changes });
  assertEachRefused([
    [
      (copy) => delete copy.records[0].evidence,
      /Test transport evidence has an unsupported match method/,
    ],
    [
      withEvidence({ method: "fuzzy-name" }),
      /Test transport evidence has an unsupported match method/,
    ],
    [
      withEvidence({ notes: "Matched by hand" }),
      /Test transport evidence contains unsupported notes/,
    ],
    [
      withEvidence({ datasetNames: [] }),
      /Test transport evidence has invalid datasetNames/,
    ],
    [
      withEvidence({ datasetKeys: ["C:/data/vehicles.xml"] }),
      /Test transport evidence has invalid datasetKeys/,
    ],
    [
      withEvidence({ matchedFields: "name" }),
      /Test transport evidence has invalid matchedFields/,
    ],
    [
      withEvidence({ structuredSources: [] }),
      /Test transport evidence needs a structured source reference/,
    ],
    [
      withEvidence({ structuredSources: [{ book: "Test book", page: "p. 42" }] }),
      /Test transport evidence structured source needs a safe printed page reference/,
    ],
    [
      withEvidence({ sourceReferences: [] }, printed),
      /Test transport evidence needs reviewed printed source references/,
    ],
    [
      withEvidence(
        { sourceReferences: [{ book: "Core Rulebook.pdf", page: "42" }] },
        printed,
      ),
      /Test transport evidence printed source book is not a safe public value/,
    ],
    [
      withEvidence({ datasetNames: ["Test transport"] }, printed),
      /Test transport evidence contains unsupported datasetNames/,
    ],
  ]);
});

test("unresolved vehicles need a supported reason and the report must count them", () => {
  const contested = structuredClone(data);
  contested.unresolved.push({
    _id: "qrstuvwxyzabcdef",
    name: "Contested transport",
    source: { book: "Other book", page: "10" },
    reason: "conflicting structured records",
  });
  assert.throws(
    () => validateVehicleData(contested),
    /Vehicle data report does not match its records/,
  );
  contested.report = {
    databaseVehicles: 3,
    matched: 1,
    unresolved: 2,
    conflicts: 1,
  };
  assert.equal(validateVehicleData(contested), contested);
  contested.unresolved[1].reason = "awaiting review";
  assert.throws(
    () => validateVehicleData(contested),
    /Contested transport has an unsupported unresolved reason/,
  );
});

const bundleOf = (...actors) => ({
  format: "star-wars-ffg-library",
  version: 1,
  documents: { Actor: actors },
});

test("vehicle stats skip records the bundle lacks and never touch unresolved vehicles", () => {
  const itemsOnly = {
    format: "star-wars-ffg-library",
    version: 1,
    documents: { Item: [] },
  };
  assert.deepEqual(mergeVehicleStats(itemsOnly, data), itemsOnly);
  const unowned = structuredClone(data);
  unowned.records.unshift({
    ...structuredClone(data.records[0]),
    _id: "zyxwvutsrqponmlk",
    name: "Unowned transport",
  });
  unowned.report = {
    databaseVehicles: 3,
    matched: 2,
    unresolved: 1,
    conflicts: 0,
  };
  const missing = placeholder("Missing transport");
  missing._id = "ponmlkjihgfedcba";
  missing.system.source = { book: "Other book", page: "9" };
  const [merged, unresolved] = mergeVehicleStats(
    bundleOf(placeholder(), missing),
    unowned,
  ).documents.Actor;
  assert.equal(merged.system.hullTrauma.max, 18);
  assert.deepEqual(unresolved, missing);
});

test("vehicle identity treats a missing actor source or page as blank", () => {
  const unsourced = placeholder(),
    unpaged = placeholder();
  delete unsourced.system.source;
  delete unpaged.system.source.page;
  for (const actor of [unsourced, unpaged])
    assert.throws(
      () => mergeVehicleStats(bundleOf(actor), data),
      /Test transport vehicle identity does not match/,
    );
  const pageless = structuredClone(data);
  pageless.records[0].source = { book: "Test book", page: "" };
  const merged = mergeVehicleStats(bundleOf(unpaged), pageless);
  assert.equal(merged.documents.Actor[0].system.hullTrauma.max, 18);
});

test("merged vehicle stats keep other review flags and metadata, or start them afresh", () => {
  const noted = placeholder(),
    bare = placeholder();
  noted.system.incomplete.push("crew");
  noted.system.metadata = { cost: 25000 };
  delete bare.system.incomplete;
  delete bare.system.metadata;
  const [kept] = mergeVehicleStats(bundleOf(noted), data).documents.Actor,
    [started] = mergeVehicleStats(bundleOf(bare), data).documents.Actor;
  assert.deepEqual(kept.system.incomplete, ["crew"]);
  assert.deepEqual(kept.system.metadata, {
    cost: 25000,
    vehicleStatEvidence: evidence,
  });
  assert.deepEqual(started.system.incomplete, []);
  assert.deepEqual(started.system.metadata, { vehicleStatEvidence: evidence });
});

test("vehicle records are checked against the list they are in, and malformed entries are refused clearly", () => {
  const counted = (copy, field) => {
    copy.report[field] += 1;
    copy.report.databaseVehicles += 1;
  };
  assertEachRefused([
    [
      (copy) => {
        copy.records.push({
          _id: "NoStats000000001",
          name: "Stat-less transport",
          source,
          reason: "no complete structured record",
        });
        counted(copy, "matched");
      },
      /Vehicle record contains unsupported reason/,
    ],
    [
      (copy) => {
        const { reason, ...entry } = copy.unresolved[0];
        copy.records.push({ ...entry, _id: "NoStats000000002" });
        counted(copy, "matched");
      },
      /stats are missing/,
    ],
    [
      (copy) => {
        copy.unresolved.push({ ...copy.records[0], _id: "Unresolved000001" });
        counted(copy, "unresolved");
      },
      /Vehicle record contains unsupported stats/,
    ],
    [(copy) => (copy.records = [null]), /Vehicle records need unique native identities/],
  ]);
});
