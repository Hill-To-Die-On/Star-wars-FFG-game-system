import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  indexReferenceDatabase,
  findReferences,
  findReference,
  filterLibraryByBooks,
} from "../src/reference-data.mjs";
import {
  DEFAULT_CAMPAIGN,
  validateCampaign,
  bookAllowed,
} from "../src/rules.mjs";
import { publishDatabase } from "../scripts/publish-database.mjs";
import { validateBundle } from "../src/library.mjs";
import { convertDatabase } from "../scripts/import-database.mjs";

const database = JSON.parse(
  await readFile(new URL("../data/reference-database.json", import.meta.url)),
);
const library = JSON.parse(
  await readFile(new URL("../data/reference-library.json", import.meta.url)),
);
const index = indexReferenceDatabase(database);
test("native prices retain formatted whole-credit amounts and flag unknown prices", () => {
  const { documents } = convertDatabase({
    equipment: [
      { ID: 1, Equipment: "Costly equipment", Price: "125,750.00" },
      { ID: 2, Equipment: "Unknown price", Price: "" },
      { ID: 3, Equipment: "Free equipment", Price: "0" },
    ],
  });
  assert.equal(documents.Item[0].system.price, 125750);
  assert.deepEqual(documents.Item[1].system.incomplete, ["price not recorded"]);
  assert.deepEqual(documents.Item[2].system.incomplete, []);
});

test("published creator database retains every table and row with usable reference identities", () => {
  assert.equal(Object.keys(database.tables).length, 44);
  assert.equal(index.records.length, 6662);
  assert.equal(index.byKey.size, 6662);
  assert.equal(index.books.length, 45);
  assert.equal(validateBundle(library), library);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(library.documents).map(([type, docs]) => [
        type,
        docs.length,
      ]),
    ),
    { Item: 4495, Actor: 399, JournalEntry: 1701 },
  );
  assert.equal(library.report.omittedProse, false);
  for (const row of index.records) {
    assert.ok(row.name.trim());
    assert.deepEqual(
      findReference(index, DEFAULT_CAMPAIGN, row.key).fields,
      row.fields,
    );
  }
});

test("owned books distinguishes an empty selection from all books and migrates old settings", () => {
  const none = { ...DEFAULT_CAMPAIGN, bookMode: "owned", books: [] };
  assert.equal(findReferences(index, none).total, 0);
  assert.equal(findReferences(index, DEFAULT_CAMPAIGN).total, 6662);
  assert.equal(bookAllowed("Unlisted", none), false);
  assert.equal(bookAllowed("", none), false);
  assert.equal(bookAllowed("", { ...none, includeUnreferenced: true }), true);
  const { bookMode, ...legacy } = DEFAULT_CAMPAIGN;
  assert.equal(
    validateCampaign({ ...legacy, books: ["Owned"] }).bookMode,
    "owned",
  );
  assert.equal(validateCampaign(legacy).bookMode, "all");
  assert.ok(
    bookAllowed("Age of Rebellion - Stongholds of Resistance", {
      ...none,
      books: ["Age of Rebellion: Strongholds of Resistance"],
    }),
  );
});

test("search, direct details and native imports all enforce the same selected book", () => {
  const chosen = index.records.find(
    (row) => row.category === "weapons" && row.source.book,
  );
  const c = {
    ...DEFAULT_CAMPAIGN,
    bookMode: "owned",
    books: [chosen.source.book],
  };
  const found = findReferences(index, c, { query: chosen.name });
  assert.ok(found.records.some((row) => row.key === chosen.key));
  assert.ok(found.records.every((row) => bookAllowed(row.source.book, c)));
  const excluded = index.records.find(
    (row) => row.source.book && !bookAllowed(row.source.book, c),
  );
  assert.equal(findReference(index, c, excluded.key), null);
  const native = filterLibraryByBooks(library, c);
  assert.ok(native.documents.Item.length > 0);
  for (const [type, docs] of Object.entries(native.documents))
    for (const doc of docs)
      assert.ok(
        bookAllowed(
          type === "JournalEntry"
            ? doc.pages[0].flags["star-wars-ffg"].source.book
            : doc.system.source.book,
          c,
        ),
      );
  const first = findReferences(index, c, { page: 0, pageSize: 2 });
  const next = findReferences(index, c, { page: 1, pageSize: 2 });
  assert.equal(first.records.length, 2);
  assert.ok(
    next.records.every(
      (row) => !first.records.some((previous) => previous.key === row.key),
    ),
  );
});

test("publisher preserves creator notes, nulls, lowercase book/page and duplicate source rows", () => {
  const sql =
    "INSERT INTO `signature_abilities` (`ID`,`signature_abilities`,`book`,`page`,`Notes`) VALUES (1,'Test path','Test book','42','Creator clue'),(2,'Test path','Other book',NULL,NULL);";
  const result = publishDatabase(sql),
    idx = indexReferenceDatabase(result.database);
  assert.equal(result.database.tables.signature_abilities[1].page, null);
  assert.equal(
    findReferences(idx, DEFAULT_CAMPAIGN, { query: "creator clue" }).total,
    1,
  );
  assert.equal(idx.records[0].source.page, "42");
  assert.equal(idx.records[0].source.book, "Test book");
  assert.equal(
    result.library.documents.Item[0].system.metadata.Notes,
    "Creator clue",
  );
  assert.equal(result.library.documents.Item[0].name, "Test path");
  assert.notEqual(idx.records[0].key, idx.records[1].key);
});
