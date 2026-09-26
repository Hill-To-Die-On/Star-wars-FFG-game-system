import test from "node:test";
import assert from "node:assert/strict";
import {
  ARTWORK_CREDITS_ID,
  INTERFACE_ARTWORK,
  artworkCreditsData,
  ensureArtworkCreditsJournal,
} from "../src/artwork-credits.mjs";

test("artwork credit journal is player-visible and carries the exact attribution", () => {
  const data = artworkCreditsData(2);
  assert.equal(ARTWORK_CREDITS_ID.length, 16);
  assert.equal(data._id, ARTWORK_CREDITS_ID);
  assert.equal(data.ownership.default, 2);
  assert.equal(data.flags["star-wars-ffg"].artworkCredits, 1);
  assert.match(data.pages[0].text.content, /Dan Gallagher \(eMITS\)/);
  assert.match(data.pages[0].text.content, /NASA's Goddard Space Flight Center/);
  assert.match(data.pages[0].text.content, /saturn-enceladus-concept\.webp/);
  assert.match(data.pages[0].text.content, new RegExp(INTERFACE_ARTWORK.source));
});

test("only a GM creates the credit journal and an existing journal is preserved", async () => {
  let created = 0;
  const journalClass = {
    async create(data, options) {
      created++;
      return { data, options };
    },
  };
  assert.equal(
    await ensureArtworkCreditsJournal({
      currentGame: { user: { isGM: false } },
      journalClass,
    }),
    null,
  );
  assert.equal(created, 0);

  const existing = { id: ARTWORK_CREDITS_ID, userText: "Keep this" };
  assert.equal(
    await ensureArtworkCreditsJournal({
      currentGame: {
        user: { isGM: true },
        journal: new Map([[ARTWORK_CREDITS_ID, existing]]),
      },
      journalClass,
    }),
    existing,
  );
  assert.equal(created, 0);

  const result = await ensureArtworkCreditsJournal({
    currentGame: { user: { isGM: true }, journal: new Map() },
    journalClass,
    ownership: 2,
  });
  assert.equal(created, 1);
  assert.equal(result.data.name, "Star Wars FFG · Artwork credits");
  assert.deepEqual(result.options, { keepId: true });
});
