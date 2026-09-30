import test from "node:test";
import assert from "node:assert/strict";
import database from "../data/reference-database.json" with { type: "json" };
import guidance from "../data/book-play-guidance.json" with { type: "json" };
import { directorAdapter } from "../src/director-adapter.mjs";
import {
  selectBookPlayGuidance,
  validateBookPlayGuidance,
} from "../src/book-play-guidance.mjs";
import { findReferences, indexReferenceDatabase } from "../src/reference-data.mjs";
import { normalizeBookTitle } from "../src/rules.mjs";

const index = indexReferenceDatabase(database);
const cyphers = "Age of Rebellion - Cyphers & Masks";
const mystic = "Force & Destiny - Unlimited Power";

test("the source catalogue retains all adventure seeds with book and page", () => {
  assert.ok(database.tables.adventure_seeds.length >= 421);
  assert.ok(database.tables.adventure_seeds.every((row) => row.Book && Number(row.Page) > 0));
});

test("reviewed play guidance keeps exact book and printed page and cannot award rewards automatically", () => {
  const books = new Set(database.tables.books.map((row) => normalizeBookTitle(row.books)));
  assert.equal(validateBookPlayGuidance(guidance), guidance);
  assert.ok(guidance.entries.length >= 6);
  for (const entry of guidance.entries) {
    assert.ok(books.has(normalizeBookTitle(entry.source.book)));
    assert.ok(entry.source.pages.every((page) => Number.isInteger(page) && page > 0));
    assert.equal(entry.automatic, false);
    if (entry.kind === "reward-guidance") assert.equal(entry.reward.amount, null);
  }
  assert.throws(() => validateBookPlayGuidance({
    ...guidance,
    entries: [{ ...guidance.entries[2], automatic: true }],
  }), /Invalid book play guidance/);
  const covenants = selectBookPlayGuidance({ bookMode: "owned", books: ["Edge of The Empire - Dangerous Covenants"] });
  assert.deepEqual(covenants.map((entry) => entry.id), ["eote-dangerous-hired-gun-rewards"]);
  assert.deepEqual(covenants[0].source.pages, [89, 90, 91]);
  const ace = selectBookPlayGuidance({ bookMode: "owned", books: ["Age of Rebellion - Stay On Target"] });
  assert.deepEqual(ace.map((entry) => entry.id), ["aor-stay-on-target-ace-rewards"]);
  assert.deepEqual(ace[0].source.pages, [92, 93]);
});

test("DoR sees only selected book guidance and catalogue seeds, preserving separate source entries", async () => {
  const prior = globalThis.game;
  const campaign = { bookMode: "owned", books: [cyphers], includeUnreferenced: false };
  try {
    globalThis.game = {
      user: { isGM: true },
      settings: { get: () => campaign },
      system: { api: { searchReferences: (options) => findReferences(index, campaign, options) } },
    };
    const play = directorAdapter.getBookPlayGuidance();
    assert.equal(play.status, "reviewed-guidance");
    assert.equal(play.automatic, false);
    assert.equal(play.entries.length, 3);
    assert.ok(play.entries.every((entry) => entry.source.book === cyphers));
    assert.equal(directorAdapter.getBookPlayGuidance({ book: mystic }).entries.length, 0);
    play.entries[0].beats[0].prompt = "changed";
    assert.notEqual(directorAdapter.getBookPlayGuidance().entries[0].beats[0].prompt, "changed");

    const seeds = await directorAdapter.getAdventureSeeds({ pageSize: 100 });
    assert.equal(seeds.status, "catalogue-seeds");
    assert.equal(seeds.automatic, false);
    assert.equal(seeds.total, 4);
    assert.equal(seeds.seeds.length, 4);
    assert.ok(seeds.seeds.every((seed) => seed.source.book === cyphers && Number(seed.source.page) > 0));
    assert.equal(seeds.seeds.filter((seed) => /deep.?cover depot/i.test(seed.title)).length, 2);
    assert.ok(seeds.seeds.some((seed) => seed.hook === null));

    globalThis.game.user.isGM = false;
    assert.throws(() => directorAdapter.getBookPlayGuidance(), /Only the GM/);
    await assert.rejects(() => directorAdapter.getAdventureSeeds(), /Only the GM/);
  } finally {
    globalThis.game = prior;
  }
});

test("book guidance respects an empty owned-book selection", () => {
  const campaign = { bookMode: "owned", books: [], includeUnreferenced: false };
  assert.deepEqual(selectBookPlayGuidance(campaign), []);
  assert.equal(findReferences(index, campaign, { category: "adventure_seeds" }).total, 0);
});

test("Savage Spirits supplies separate checked companion and reward preparation", () => {
  const entries = selectBookPlayGuidance({ bookMode: "owned", books: ["Force & Destiny - Savage Spirits"] });
  assert.deepEqual(entries.map((entry) => entry.id), [
    "fnd-savage-seeker-companion-guidance", "fnd-savage-seeker-rewards",
  ]);
  assert.deepEqual(entries[0].source.pages, [80, 81]);
  assert.deepEqual(entries[1].source.pages, [92, 93, 94]);
  assert.equal(entries[1].reward.amount, null);
  assert.equal(entries.every((entry) => entry.automatic === false), true);
});
