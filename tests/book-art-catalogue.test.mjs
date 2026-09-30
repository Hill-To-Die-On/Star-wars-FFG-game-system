import test from "node:test";
import assert from "node:assert/strict";
import { selectOwnedBookArt } from "../src/book-art-catalogue.mjs";
import { directorAdapter } from "../src/director-adapter.mjs";

const catalogue = {
  $schema: "star-wars-book-art-catalogue-v1",
  assets: [
    { id: "a", book: "Age of Rebellion - Stay On Target", kind: "scene", label: "Pilots in a hangar",
      review: "vision-triage-unverified", tags: ["pilot", "hangar"], privateSource: "C:\\private\\book.pdf",
      importedAssetId: "imported:123456abcdef:img-abcdef123456",
      occurrences: [{ pdfPage: 93, printedPage: 92 }] },
    { id: "b", book: "Edge of The Empire - Dangerous Covenants", kind: "map", label: "Base map",
      review: "vision-triage-unverified", tags: ["base"], occurrences: [{ pdfPage: 14, printedPage: null }] },
    { id: "c", book: "Age of Rebellion - Stay On Target", kind: "other", label: "Publisher logo",
      isStoryArt: false, tags: ["logo"], occurrences: [{ pdfPage: 2, printedPage: null }] },
  ],
};

test("book art requires an explicit owned-book selection and keeps other books out", () => {
  const owned = { bookMode: "owned", books: ["Age of Rebellion - Stay on Target"] };
  const result = selectOwnedBookArt(catalogue, owned, { query: "hangar" });
  assert.equal(result.total, 1);
  assert.deepEqual(result.assets.map((asset) => asset.id), ["a"]);
  assert.equal(result.assets[0].gmOnly, true);
  assert.equal(result.assets[0].playerSafe, false);
  assert.equal(result.assets[0].importedAssetId, "imported:123456abcdef:img-abcdef123456");
  assert.equal(JSON.stringify(result).includes("C:\\private"), false);
  assert.equal(selectOwnedBookArt(catalogue, owned, { kind: "map" }).total, 0);
  assert.equal(selectOwnedBookArt(catalogue, owned, { query: "logo" }).total, 0);
  assert.equal(selectOwnedBookArt(catalogue, owned, { query: "logo", includeRejected: true }).total, 1);
  assert.equal(selectOwnedBookArt(catalogue, { bookMode: "owned", books: [] }).total, 0);
  assert.equal(selectOwnedBookArt(catalogue, { bookMode: "all", books: [owned.books[0]] }).total, 0);
});

test("DoR book-art lookup is GM-only and uses the campaign's exact source filter", () => {
  const prior = globalThis.game;
  try {
    globalThis.game = {
      user: { isGM: true },
      settings: { get: () => ({ bookMode: "owned", books: ["Edge of The Empire - Dangerous Covenants"] }) },
    };
    assert.deepEqual(directorAdapter.getOwnedBookSelection().books, ["Edge of The Empire - Dangerous Covenants"]);
    assert.deepEqual(directorAdapter.getBookArtCandidates(catalogue).assets.map((asset) => asset.id), ["b"]);
    globalThis.game.user.isGM = false;
    assert.throws(() => directorAdapter.getOwnedBookSelection(), /Only the GM/);
    assert.throws(() => directorAdapter.getBookArtCandidates(catalogue), /Only the GM/);
  } finally {
    globalThis.game = prior;
  }
});

test("a recorded source-title typo still follows the owned Strongholds book", () => {
  const source = { $schema: "star-wars-book-art-catalogue-v1", assets: [
    { id: "strongholds", book: "Age of Rebellion - Stongholds of Resistance", kind: "scene", label: "Rebel base" },
    { id: "other", book: "Age of Rebellion - Stay On Target", kind: "scene", label: "Rebel base" },
  ] };
  const result = selectOwnedBookArt(source,
    { bookMode: "owned", books: ["Age of Rebellion - Strongholds of Resistance"] },
    { query: "Rebel base" });
  assert.deepEqual(result.assets.map((asset) => asset.id), ["strongholds"]);
});

test("an adventure entered as an additional owned book can supply private art", () => {
  const source = { $schema: "star-wars-book-art-catalogue-v1", assets: [
    { id: "adventure", book: "1 Traitor s Gambit", kind: "character", label: "Protocol droid" },
    { id: "other-adventure", book: "2 A Wretched Hive", kind: "character", label: "Protocol droid" },
  ] };
  const result = selectOwnedBookArt(source,
    { bookMode: "owned", books: ["1 Traitor s Gambit"] },
    { query: "Protocol droid" });
  assert.deepEqual(result.assets.map((asset) => asset.id), ["adventure"]);
});
