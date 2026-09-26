import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function expandRanges(ranges) {
  const pages = new Set();
  for (const value of ranges) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(value);
    assert.ok(match, `Invalid printed-page range ${value}`);
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1]);
    assert.ok(first > 0 && last >= first);
    for (let page = first; page <= last; page += 1) pages.add(page);
  }
  return pages;
}

test("source requests preserve exact private-scan gaps without publishing private content", async () => {
  const requests = JSON.parse(
      await readFile("data/source-requests.json", "utf8"),
    ),
    database = JSON.parse(
      await readFile("data/reference-database.json", "utf8"),
    ),
    coverage = await readFile("docs/source-coverage.md", "utf8");

  assert.equal(requests.format, "star-wars-ffg-source-requests");
  assert.equal(requests.version, 1);
  assert.ok(requests.captureGuidance.length >= 3);
  assert.equal(requests.partialSources.length, 1);

  const source = requests.partialSources[0],
    held = expandRanges(source.heldPrintedPageRanges),
    requested = expandRanges(source.requestedPrintedPageRanges);
  assert.equal(source.book, "Age of Rebellion - Cyphers & Masks");
  assert.equal(source.status, "partial-scan");
  assert.deepEqual(source.heldPrintedPageRanges, ["7-9", "12-35", "70-95"]);
  assert.deepEqual(source.requestedPrintedPageRanges, ["10-11", "36-69"]);
  const evidencePages = new Set(
    source.evidenceSets.flatMap((entry) => [
      ...expandRanges(entry.printedPageRanges),
    ]),
  );
  assert.deepEqual([...evidencePages].sort((a, b) => a - b), [...held]);
  assert.equal(
    source.evidenceSets.reduce((total, entry) => total + entry.assetPages, 0),
    56,
  );
  assert.equal(
    [...held].some((page) => requested.has(page)),
    false,
    "held and requested page ranges must not overlap",
  );

  const expectedDatabasePages = {};
  for (const [collection, rows] of Object.entries(database.tables)) {
    const pages = [
      ...new Set(
        rows
          .filter((row) =>
            Object.entries(row).some(
              ([key, value]) => /book/i.test(key) && value === source.book,
            ),
          )
          .map((row) => Number(row.Page ?? row.page))
          .filter(
            (page) =>
              Number.isInteger(page) && requested.has(page) && !held.has(page),
          ),
      ),
    ].sort((a, b) => a - b);
    if (pages.length) expectedDatabasePages[collection] = pages;
  }
  assert.deepEqual(source.databasePages, expectedDatabasePages);

  const publicText = JSON.stringify(requests);
  assert.doesNotMatch(publicText, /[A-Z]:[\\/]|\.pdf\b/i);
  assert.doesNotMatch(publicText, /"(?:text|prose|content|path|privatePath)"\s*:/i);
  assert.match(coverage, /Cyphers & Masks partial-scan request/);
  assert.match(coverage, /printed pages 10-11 and 36-69/);
});
