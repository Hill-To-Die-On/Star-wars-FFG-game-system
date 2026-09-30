import test from "node:test";
import assert from "node:assert/strict";
import { convertSwaSource, sourceId } from "../src/swa-source.mjs";
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

const vehicle = (changes = {}) => ({
  name: "YT-1300",
  fullName: "YT-1300 light freighter",
  description: "PRIVATE_VEHICLE_PROSE",
  characteristics: { Silhouette: 4, Speed: 3, Handling: -1 },
  derived: { armour: 3, hull: 22, system: 15, defence: { fore: 1, aft: 1 } },
  info: {
    manufacturer: "Corellian Engineering Corporation",
    complement: "Two",
    passengers: 6,
    hyperdrive: "Primary: Class 2",
    cost: 100000,
  },
  weapons: [
    {
      name: "Medium laser cannon",
      damage: 6,
      critical: 3,
      range: "Close",
      arc: "Turret",
      qualities: ["Linked 1", { name: "Accurate" }],
    },
  ],
  ...changes,
});

const notesOfKind = (bundle, kind) =>
  bundle.documents.JournalEntry.filter((doc) => doc.name.endsWith(` · ${kind}`));

test("vehicles become review-flagged native actors, and their prose stays in a GM note", async () => {
  const input = source();
  input.collections.vehicles.push(vehicle());
  const bundle = await convertSwaSource(input);
  assert.equal(validateBundle(bundle), bundle);
  assert.equal(bundle.report.vehicles, 1);
  assert.equal(bundle.report.gmNotes, bundle.documents.JournalEntry.length);

  const ship = bundle.documents.Actor.find((actor) => actor.type === "vehicle"),
    noteId = sourceId("swa:source:vehicles:YT-1300:0");
  assert.equal(ship._id, sourceId("swa:vehicle:YT-1300"));
  assert.equal(ship.name, "YT-1300 light freighter");
  assert.deepEqual(ship.flags["star-wars-ffg"], {
    importKey: "swa:vehicle:YT-1300",
    swa: { notesId: noteId, reviewRequired: true, omittedProse: false },
  });
  const { system } = ship;
  assert.deepEqual(
    [system.silhouette, system.speed, system.handling, system.armor],
    [4, { value: 0, max: 3 }, -1, 3],
  );
  assert.deepEqual(system.hullTrauma, { value: 0, max: 22 });
  assert.deepEqual(system.systemStrain, { value: 0, max: 15 });
  assert.deepEqual(system.shields, { fore: 1, aft: 1, port: 0, starboard: 0 });
  assert.equal(system.crew, "Two");
  assert.equal(system.passengers, "6");
  assert.deepEqual(system.metadata, {
    passengers: 6,
    cost: 100000,
    weaponNames: "Medium laser cannon",
  });
  assert.deepEqual(ship.items, [
    {
      name: "Medium laser cannon",
      type: "weapon",
      system: {
        skill: "gunnery",
        damage: "6",
        critical: 3,
        range: "close",
        scale: "vehicle",
        qualities: "Linked 1, Accurate",
        metadata: { firingArc: "Turret" },
      },
    },
  ]);
  assert.ok(!JSON.stringify(ship).includes("PRIVATE_"));

  const note = bundle.documents.JournalEntry.find((doc) => doc._id === noteId);
  assert.equal(note.name, "YT-1300 · vehicles");
  assert.equal(note.ownership.default, 0);
  assert.match(note.flags["star-wars-ffg"].gmSource.text, /PRIVATE_VEHICLE_PROSE/);
});

test("vehicles with missing or out-of-range statistics are rejected instead of guessed", async () => {
  const broken = [
      [{ characteristics: undefined }, "Vehicle lacks characteristics or derived statistics."],
      [{ characteristics: { Silhouette: "", Speed: 3, Handling: 0 } }, "Vehicle silhouette is incomplete."],
      [{ characteristics: { Silhouette: 4, Speed: 21, Handling: 0 } }, "Vehicle speed is incomplete."],
      [{ characteristics: { Silhouette: 4, Speed: 3, Handling: -11 } }, "Vehicle handling is incomplete."],
      [{ derived: { armour: 1.5, hull: 10, system: 10 } }, "Vehicle armor is incomplete."],
      [{ derived: { armour: 1, system: 10 } }, "Vehicle hull is incomplete."],
      [{ derived: { armour: 1, hull: 10, system: 10, defence: { port: 5 } } }, "Vehicle port is incomplete."],
      [
        { weapons: [{ name: "Ion cannon", damage: 5, critical: 11, range: "Short" }] },
        "Vehicle critical is incomplete.",
      ],
    ],
    input = source();
  input.collections.vehicles.push(
    ...broken.map(([changes], index) => vehicle({ name: `Wreck ${index}`, ...changes })),
  );
  const bundle = await convertSwaSource(input);
  assert.equal(bundle.report.vehicles, 0);
  assert.ok(!bundle.documents.Actor.some((actor) => actor.type === "vehicle"));
  assert.deepEqual(
    bundle.report.rejected,
    broken.map(([, reason], index) => ({ name: `Wreck ${index}`, reason })),
  );
  assert.equal(notesOfKind(bundle, "vehicles").length, broken.length);
});

test("stats-only imports omit vehicle notes and mark the omission", async () => {
  const input = source();
  input.collections.vehicles.push(vehicle());
  const bundle = await convertSwaSource(input, { includePrivateNotes: false }),
    ship = bundle.documents.Actor.find((actor) => actor.type === "vehicle");
  assert.deepEqual(ship.flags["star-wars-ffg"].swa, {
    notesId: "",
    reviewRequired: true,
    omittedProse: true,
  });
  assert.equal(bundle.documents.JournalEntry.length, 0);
  assert.equal(bundle.report.gmNotes, 0);
  assert.equal(bundle.report.omittedProse, true);
});

test("adversaries that map to the same native actor are rejected, and both notes are kept", async () => {
  const input = source();
  input.collections.adversaries.push({ ...adversary, name: "Synthetic twin" });
  const bundle = await convertSwaSource(input);
  assert.equal(bundle.documents.Actor.length, 1);
  assert.deepEqual(bundle.report.rejected, [
    {
      name: "Synthetic twin",
      reason: "Duplicate native actor identity; source notes retained separately.",
    },
  ]);
  assert.equal(notesOfKind(bundle, "adversary").length, 2);
});

test("related rules resolve abilities, inline weapons and listed skills without duplicates", async () => {
  const input = source();
  input.collections.talents.push({ name: "Adversary", description: "PRIVATE_ADVERSARY" });
  input.collections.skills.push({ name: "Cool", description: "PRIVATE_COOL" });
  input.collections.adversaries[0] = {
    ...adversary,
    abilities: ["Adversary 2"],
    weapons: [
      "Synthetic blade",
      {
        name: "Vibroknife",
        skill: "Melee",
        damage: 1,
        critical: 2,
        range: "Engaged",
        qualities: ["Test Quality"],
      },
      "Unknown blaster",
    ],
    skills: ["Cool"],
  };
  const bundle = await convertSwaSource(input),
    [note] = notesOfKind(bundle, "adversary"),
    { relatedRules } = JSON.parse(note.flags["star-wars-ffg"].gmSource.text),
    names = (rows) => rows.map((row) => row.name);
  assert.deepEqual(names(relatedRules.talents), ["Test Talent"]);
  assert.deepEqual(names(relatedRules.abilities), ["Adversary"]);
  assert.deepEqual(names(relatedRules.weapons), ["Synthetic blade", "Vibroknife"]);
  assert.deepEqual(names(relatedRules.qualities), ["Test Quality"]);
  assert.deepEqual(names(relatedRules.skills), ["Cool"]);
});

test("local exports accept one record or a list, and malformed or oversized sources are refused", async () => {
  const single = await convertSwaSource(adversary);
  assert.equal(single.documents.Actor.length, 1);
  assert.match(
    single.documents.JournalEntry[0].pages[0].text.content,
    /Private source material from SW Adversaries local export\./,
  );
  const list = await convertSwaSource([
    adversary,
    { ...adversary, id: "second", name: "Second adversary" },
  ]);
  assert.equal(list.report.records, 2);
  assert.equal(list.documents.Actor.length, 2);

  for (const input of [
    { format: "swa-source" },
    { format: "swa-source", collections: { adversaries: {} } },
    Array.from({ length: 2001 }, () => adversary),
  ])
    await assert.rejects(convertSwaSource(input), /Unsupported SW Adversaries source bundle/);

  const oddWeapons = source();
  oddWeapons.collections.weapons = {};
  await assert.rejects(convertSwaSource(oddWeapons), /Invalid weapons source collection/);
  const tooManyTalents = source();
  tooManyTalents.collections.talents = Array.from({ length: 2001 }, (_, index) => ({
    name: `Talent ${index}`,
  }));
  await assert.rejects(convertSwaSource(tooManyTalents), /Invalid talents source collection/);
});

test("files with records that are not objects are refused before anything converts", async () => {
  for (const input of [null, [null], [adversary, null], ["Stormtrooper"], [[adversary]]])
    await assert.rejects(
      convertSwaSource(input),
      /^Error: Each adversary must be a JSON object\.$/,
    );
  const nullRule = source();
  nullRule.collections.talents.push(null);
  await assert.rejects(
    convertSwaSource(nullRule),
    /^Error: Invalid talents source collection\.$/,
  );
});

test("source document IDs are stable 64-bit FNV-1a hashes", () => {
  assert.equal(sourceId(""), "cbf29ce484222325");
  assert.equal(sourceId("a"), "af63dc4c8601ec8c");
  assert.equal(sourceId("foobar"), "85944171f73967e8");
  assert.match(sourceId("swa:vehicle:YT-1300"), /^[0-9a-f]{16}$/);
  assert.notEqual(sourceId("swa:vehicle:A"), sourceId("swa:vehicle:B"));
});
