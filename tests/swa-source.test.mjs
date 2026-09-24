import test from "node:test";
import assert from "node:assert/strict";
import { convertSwaSource } from "../src/swa-source.mjs";
import { validateBundle } from "../src/library.mjs";
import {
  refreshGMNotes,
  getGMSourceNotes,
  searchGMSourceNotes,
} from "../src/gm-notes.mjs";
const adversary = {
  id: "synthetic",
  name: "Synthetic adversary",
  type: "Nemesis",
  characteristics: {
    Brawn: 2,
    Agility: 3,
    Intellect: 4,
    Cunning: 2,
    Willpower: 2,
    Presence: 2,
  },
  derived: { wounds: 12, strain: 10, soak: 3 },
  skills: { "Lightsaber (Intellect)": 2, Resilience: 8 },
  description: "PRIVATE_GM_MOTIVE <script>never execute</script>",
  talents: ["Test Talent 2"],
  weapons: ["Synthetic blade"],
};
const source = () => ({
  format: "swa-source",
  version: 1,
  siteVersion: "test",
  collections: {
    adversaries: [adversary],
    talents: [{ name: "Test Talent", description: "PRIVATE_GM_RULE" }],
    weapons: [
      {
        name: "Synthetic blade",
        skill: "Lightsaber",
        damage: 6,
        critical: 2,
        range: "Engaged",
        qualities: ["Test Quality 1", ""],
      },
    ],
    qualities: [{ name: "Test Quality", description: "PRIVATE_QUALITY_RULE" }],
    skills: [],
    vehicles: [],
  },
});

test("full source resolves separate weapons and related prose into private GM documents", async () => {
  const bundle = await convertSwaSource(source());
  assert.equal(validateBundle(bundle), bundle);
  assert.equal(bundle.report.resolvedWeapons, 1);
  assert.equal(bundle.report.rejected.length, 0);
  const actor = bundle.documents.Actor[0];
  assert.equal(actor.items[0].type, "weapon");
  assert.equal(actor.system.skills.lightsaber.characteristic, "intellect");
  assert.equal(actor.system.skills.resilience.rank, 8);
  assert.ok(!JSON.stringify(actor).includes("PRIVATE_"));
  const note = bundle.documents.JournalEntry.find(
    (doc) => doc._id === actor.flags["star-wars-ffg"].swa.notesId,
  );
  assert.equal(note.ownership.default, 0);
  assert.equal(note.flags["star-wars-ffg"].gmOnly, true);
  const html = note.pages[0].text.content;
  assert.match(html, /PRIVATE_GM_MOTIVE/);
  assert.match(html, /PRIVATE_GM_RULE/);
  assert.match(html, /PRIVATE_QUALITY_RULE/);
  assert.ok(!html.includes("<script>"));
});

test("unsupported adversaries retain source knowledge and incomplete weapons do not discard NPCs", async () => {
  const input = source();
  input.collections.adversaries.push({
    ...adversary,
    id: "unknown",
    name: "Unknown type",
    type: "",
  });
  input.collections.weapons[0].critical = "-";
  const bundle = await convertSwaSource(input);
  assert.equal(bundle.documents.Actor.length, 1);
  assert.equal(bundle.report.rejected.length, 1);
  assert.equal(bundle.documents.Actor[0].items[0].type, "reference");
  assert.ok(
    bundle.documents.JournalEntry.some(
      (doc) => doc.name === "Unknown type · adversary",
    ),
  );
  const statsOnly = await convertSwaSource(source(), {
    includePrivateNotes: false,
  });
  assert.equal(statsOnly.documents.JournalEntry.length, 0);
  assert.equal(
    statsOnly.documents.Actor[0].flags["star-wars-ffg"].swa.notesId,
    undefined,
  );
  assert.ok(!JSON.stringify(statsOnly).includes("PRIVATE_"));
});

test("GM note entry points fail closed for player users", async () => {
  const prior = globalThis.game;
  try {
    globalThis.game = { user: { isGM: false }, packs: new Map() };
    await refreshGMNotes();
    assert.equal(
      getGMSourceNotes({ getFlag: () => ({ notesId: "note" }) }),
      undefined,
    );
    assert.throws(() => searchGMSourceNotes("private"), /Only the GM/);
  } finally {
    globalThis.game = prior;
  }
});
