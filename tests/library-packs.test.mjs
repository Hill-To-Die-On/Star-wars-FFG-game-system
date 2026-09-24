import test from "node:test";
import assert from "node:assert/strict";
import {
  getLibraryPack,
  libraryPackName,
  refreshLibraryLabels,
} from "../src/library-packs.mjs";
import {
  mergeSpecializationEnrichment,
  validateBundle,
} from "../src/library.mjs";

const pack = (collection, documentName, label) => ({
  collection,
  documentName,
  metadata: { label },
});
const collection = (...packs) => new Map(packs.map((p) => [p.collection, p]));

test("renamed libraries reuse existing packs and preserve their document UUID namespace", () => {
  const items = pack(
    "world.previous-item",
    "Item",
    "Previous · Equipment & advancement",
  );
  const notes = pack(
    "world.previous-gm-notes",
    "JournalEntry",
    "Previous · Private GM source notes",
  );
  const unrelated = pack("another.previous-item", "Item", items.metadata.label);
  const vehicles = pack("world.previous-actor", "Actor", "Previous · Vehicles");
  const packs = collection(items, notes, unrelated, vehicles);
  refreshLibraryLabels(packs);
  assert.equal(getLibraryPack("Item", packs), items);
  assert.equal(getLibraryPack("GMNotes", packs), notes);
  assert.equal(getLibraryPack("Actor", packs), vehicles);
  assert.equal(vehicles.metadata.label, "Star Wars FFG · Actors & vehicles");
  assert.equal(items.collection, "world.previous-item");
  assert.equal(items.metadata.label, "Star Wars FFG · Equipment & advancement");
  assert.equal(notes.metadata.label, "Star Wars FFG · Private GM source notes");
  assert.equal(unrelated.metadata.label, "Previous · Equipment & advancement");
  assert.equal(libraryPackName("Item"), "star-wars-item");
  assert.equal(libraryPackName("GMNotes"), "star-wars-gm-notes");
});

test("ambiguous legacy libraries are rejected and fresh worlds use canonical pack names", () => {
  const a = pack("world.first-item", "Item", "First · Equipment & advancement");
  const b = pack(
    "world.second-item",
    "Item",
    "Second · Equipment & advancement",
  );
  assert.throws(() => getLibraryPack("Item", collection(a, b)), /Multiple/);
  const current = pack(
    "world.star-wars-item",
    "Item",
    "Star Wars FFG · Equipment & advancement",
  );
  assert.equal(getLibraryPack("Item", collection(a, b, current)), current);
  assert.equal(getLibraryPack("Item", collection()), undefined);
});

test("existing version-one library exports still import with full schema validation", () => {
  const bundle = {
    format: "previous-library",
    version: 1,
    documents: {
      Item: [
        { _id: "abcdefghijklmnop", name: "Existing reference", type: "gear" },
      ],
    },
  };
  assert.equal(validateBundle(bundle), bundle);
  assert.throws(() => validateBundle({ ...bundle, version: 2 }), /Choose/);
  assert.throws(
    () => validateBundle({ ...bundle, format: "unrelated" }),
    /Choose/,
  );
  assert.throws(
    () =>
      validateBundle({
        ...bundle,
        documents: { Item: [{ _id: "invalid", name: "Reference" }] },
      }),
    /unique valid IDs/,
  );
});

test("private talent guidance fills missing tree fields without replacing user data", () => {
  const existing = {
      type: "specialization",
      system: {
        tree: {
          verified: true,
          edges: [["a", "b"]],
          nodes: [
            {
              id: "a",
              name: "First",
              summary: "User-authored guidance",
              row: 0,
              col: 0,
              cost: 5,
            },
            { id: "b", name: "Second", row: 1, col: 0, cost: 10 },
          ],
        },
      },
    },
    incoming = {
      type: "specialization",
      system: {
        tree: {
          verified: true,
          edges: [["a", "b"]],
          nodes: [
            { id: "a", summary: "Imported first", effects: [] },
            {
              id: "b",
              summary: "Imported second",
              activation: "Passive",
              effects: [
                {
                  type: "pool",
                  operation: "add",
                  target: "boost",
                  count: 1,
                  skills: ["leadership"],
                },
              ],
            },
          ],
        },
      },
    },
    merged = mergeSpecializationEnrichment(existing, incoming);
  assert.equal(merged.nodes[0].summary, "User-authored guidance");
  assert.equal(merged.nodes[1].summary, "Imported second");
  assert.equal(merged.nodes[1].effects[0].target, "boost");
  assert.deepEqual(merged.edges, [["a", "b"]]);
});

test("private signature trees use the same additive enrichment boundary", () => {
  const existing = {
      type: "signatureAbility",
      system: { tree: { verified: false, nodes: [], edges: [] } },
    },
    incoming = {
      type: "signatureAbility",
      system: {
        tree: {
          verified: true,
          edges: [],
          nodes: [
            {
              id: "base",
              name: "Base ability",
              row: 0,
              col: 0,
              span: 4,
              cost: 30,
              entry: true,
            },
          ],
        },
      },
    };
  assert.deepEqual(
    mergeSpecializationEnrichment(existing, incoming),
    incoming.system.tree,
  );
});
