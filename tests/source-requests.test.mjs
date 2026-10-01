import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("source requests close the supplied Cyphers page gaps without publishing private content", async () => {
  const requests = JSON.parse(
      await readFile("data/source-requests.json", "utf8"),
    ),
    coverage = await readFile("docs/source-coverage.md", "utf8");

  assert.equal(requests.format, "star-wars-ffg-source-requests");
  assert.equal(requests.version, 1);
  assert.ok(requests.captureGuidance.length >= 3);
  assert.equal(requests.partialSources.length, 0);
  assert.equal(requests.resolvedSources.length, 1);

  const source = requests.resolvedSources[0];
  assert.equal(source.book, "Age of Rebellion - Cyphers & Masks");
  assert.equal(source.status, "complete-pdf-held");
  assert.equal(source.assetPages, 100);
  assert.equal(source.textLayerPages, 94);
  assert.deepEqual(source.previouslyRequestedPrintedPageRanges, ["10-11", "36-69"]);
  assert.ok(source.spotCheckedPrintedPages.includes(17));
  assert.ok(source.spotCheckedPrintedPages.includes(32));
  assert.equal(source.mechanicsReview, "pending-per-instruction");

  const publicText = JSON.stringify(requests);
  assert.doesNotMatch(publicText, /[A-Z]:[\\/]|\.pdf\b/i);
  assert.doesNotMatch(publicText, /"(?:text|prose|content|path|privatePath)"\s*:/i);
  assert.match(coverage, /Cyphers & Masks/);
  assert.match(coverage, /printed-page gaps 10-11 and 36-69 are present/);
});
