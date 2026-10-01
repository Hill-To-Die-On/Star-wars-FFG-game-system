import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  filterRollTables,
  resolveRollTable,
  validateRollTables,
} from "../src/roll-tables.mjs";
import { correctSourceRows } from "../scripts/publish-database.mjs";

const load = async () => JSON.parse(await readFile("data/roll-tables.json", "utf8"));

test("reviewed roll tables have separate book citations and complete ranges", async () => {
  const data = await load();
  const books = JSON.parse(await readFile("data/reference-database.json", "utf8")).tables.books;
  assert.equal(validateRollTables(data, books), true);
  assert.equal(data.tables.length, 3);
  assert.deepEqual(data.tables.map((table) => table.page), ["17", "32", "32"]);
  assert.ok(data.tables.every((table) => table.book === "Age of Rebellion - Cyphers & Masks"));
  assert.ok(data.tables.every((table) => table.reviewedFields.join() === "die,ranges,result labels"));
  assert.doesNotMatch(JSON.stringify(data), /[A-Z]:[\\/]|\.pdf\b|"(?:prose|privatePath|image)"\s*:/i);
});

test("Spy tables resolve boundary rolls without merging supplement and core rows", async () => {
  const { tables } = await load();
  const [duties, motivation, secrets] = tables;
  assert.equal(resolveRollTable(duties, 1).label, "Communications");
  assert.equal(resolveRollTable(duties, 100).label, "Roll Twice");
  assert.equal(resolveRollTable(motivation, 7).label, "Secrets");
  assert.equal(resolveRollTable(motivation, 10).label, "Two Categories");
  assert.equal(resolveRollTable(secrets, 1).label, "Falsification");
  assert.equal(resolveRollTable(secrets, 91).label, "Retrieval");
  assert.equal(resolveRollTable(secrets, 100).label, "Retrieval");
  assert.throws(() => resolveRollTable(secrets, 101), /range/);
});

test("the public Duty catalogue matches the checked Spy Duty table", async () => {
  const { tables } = await load();
  const database = JSON.parse(await readFile("data/reference-database.json", "utf8"));
  const rows = database.tables.duty
    .filter((row) => row.Book === tables[0].book && row.Career === "Spy")
    .sort((a, b) => a.d100_Low - b.d100_Low);
  assert.equal(rows.length, tables[0].rows.length);
  assert.deepEqual(rows.map((row) => [row.d100_Low, row.d100_High, row.Duty_Type]),
    tables[0].rows.map((row) => [row.low, row.high, row.label]));
});

test("owned-book filtering hides unselected roll tables", async () => {
  const { tables } = await load();
  assert.equal(filterRollTables(tables, { bookMode: "all" }).length, 3);
  assert.equal(filterRollTables(tables, { bookMode: "owned", books: ["Age of Rebellion - Cyphers & Masks"] }).length, 3);
  assert.equal(filterRollTables(tables, { bookMode: "owned", books: ["Age of Rebellion - Core Book"] }).length, 0);
});

test("validation rejects overlapping, missing and invented roll outcomes", async () => {
  const data = await load();
  const books = JSON.parse(await readFile("data/reference-database.json", "utf8")).tables.books;
  const overlap = structuredClone(data);
  overlap.tables[0].rows[1].low = 8;
  assert.throws(() => validateRollTables(overlap, books), /overlap/);
  const gap = structuredClone(data);
  gap.tables[0].rows[1].low = 10;
  assert.throws(() => validateRollTables(gap, books), /gap/);
  const unknown = structuredClone(data);
  unknown.tables[0].book = "Unknown Book";
  assert.throws(() => validateRollTables(unknown, books), /book/);
});

test("future database imports retain checked Duty label corrections", () => {
  const tables = { duty: [
    { ID: 52, Book: "Age of Rebellion - Cyphers & Masks", Page: 17, Duty_Type: "Communication" },
    { ID: 60, Book: "Age of Rebellion - Cyphers & Masks", Page: 17, Duty_Type: "Psycological Warfare" },
    { ID: 52, Book: "Age of Rebellion - Core Book", Page: 47, Duty_Type: "Communication" },
  ] };
  correctSourceRows(tables);
  assert.deepEqual(tables.duty.map((row) => row.Duty_Type),
    ["Communications", "Psychological Warfare", "Communication"]);
});
