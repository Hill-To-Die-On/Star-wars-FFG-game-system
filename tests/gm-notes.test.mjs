import test from "node:test";
import assert from "node:assert/strict";
import {
  generateSourceKey,
  openSource,
  sealSource,
  sourceKeyId,
} from "../src/source-crypto.mjs";
import {
  getGMSourceNotes,
  gmSourceKeyDialog,
  gmSourceLibrary,
  openGMSourceNotes,
  preparePrivateNotes,
  refreshGMNotes,
  searchGMSourceNotes,
} from "../src/gm-notes.mjs";

const SYSTEM = "star-wars-ffg",
  WORLD = "star-wars-validation",
  PLACEHOLDER = /Encrypted GM source material/;

const record = (name, text = `${name} PRIVATE_TEXT`) => ({
  name,
  kind: "adversary",
  source: `${name} · Test book p. 1`,
  text,
});

const actor = (notesId) => ({
  getFlag: (scope, key) =>
    scope === SYSTEM && key === "swa" ? { notesId } : undefined,
});

// Foundry globals for one test; returns the settings and spies it asserts on.
function installFoundry({
  isGM = true,
  userId = "gm",
  activeGM = "gm",
  key,
  pack,
  prompt = () => null,
} = {}) {
  const settings = { gmSourceKeys: key ? { [WORLD]: key } : {} },
    info = [],
    errors = [],
    dialogs = [];
  globalThis.game = {
    world: { id: WORLD },
    user: { id: userId, isGM },
    users: { activeGM: activeGM ? { id: activeGM } : null },
    settings: {
      get: (scope, name) => (scope === SYSTEM ? settings[name] : undefined),
      async set(scope, name, value) {
        assert.equal(scope, SYSTEM);
        settings[name] = value;
      },
    },
    packs: new Map(pack ? [[pack.collection, pack]] : []),
  };
  globalThis.ui = {
    notifications: {
      info: (message) => info.push(message),
      error: (message) => errors.push(message),
    },
  };
  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          async wait(config) {
            dialogs.push(config);
          },
          async prompt(config) {
            dialogs.push(config);
            return prompt(config);
          },
        },
      },
    },
  };
  return { settings, info, errors, dialogs };
}

// A compendium JournalEntry as getDocuments() returns it.
function journal(id, flags) {
  const page = {
    name: "Source",
    text: { format: 1, content: `${id} PRIVATE_PAGE` },
    toObject: () => ({ name: page.name, text: { ...page.text } }),
  };
  return {
    id,
    flags,
    pages: [page],
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    toObject() {
      return {
        _id: id,
        name: `Note ${id}`,
        flags: structuredClone(this.flags),
        pages: this.pages.map((entry) => entry.toObject()),
      };
    },
  };
}

const legacyJournal = (id, note) => journal(id, { [SYSTEM]: { gmSource: note } });

const sealedJournal = async (id, note, key) =>
  journal(id, {
    [SYSTEM]: { gmOnly: true, gmSealed: await sealSource(note, key, WORLD, id) },
  });

// The world's GM notes compendium. It records lock changes and update batches,
// and applies flag updates to its documents the way Foundry does.
function notesPack(docs, { failUpdates = false } = {}) {
  const pack = {
    collection: "world.star-wars-gm-notes",
    documentName: "JournalEntry",
    metadata: { label: "Star Wars FFG · Private GM source notes" },
    locked: true,
    failUpdates,
    configured: [],
    batches: [],
    get index() {
      return docs.map((doc) => ({ _id: doc.id, flags: doc.flags }));
    },
    async getIndex() {},
    async getDocuments() {
      return docs;
    },
    async configure(options) {
      pack.configured.push(options);
      pack.locked = options.locked;
    },
    documentClass: {
      async updateDocuments(updates, options) {
        if (pack.failUpdates) throw new Error("Compendium write failed.");
        assert.deepEqual(options, { pack: pack.collection, render: false });
        pack.batches.push(updates);
        for (const update of updates) {
          const flags = docs.find((doc) => doc.id === update._id).flags[SYSTEM];
          delete flags.gmSource;
          flags.gmSealed = update[`flags.${SYSTEM}.gmSealed`];
        }
      },
    },
  };
  return pack;
}

const newRecord = (id, name) => ({
  _id: id,
  name,
  flags: { [SYSTEM]: { gmSource: record(name) } },
  pages: [],
  ownership: { default: 2 },
});

test("the active GM's first private import creates the world key and seals every note", async () => {
  const pack = notesPack([]),
    foundry = installFoundry({ pack });
  assert.deepEqual(await preparePrivateNotes([], pack), []);
  assert.deepEqual(foundry.settings.gmSourceKeys, {});

  const [sealed] = await preparePrivateNotes([newRecord("noteA", "Rancor")], pack),
    key = foundry.settings.gmSourceKeys[WORLD];
  assert.equal(typeof key, "string");
  assert.match(foundry.info[0], /Back it up/);
  assert.equal(sealed.flags[SYSTEM].gmOnly, true);
  assert.equal(sealed.flags[SYSTEM].gmSource, undefined);
  assert.equal(sealed.flags[SYSTEM].gmSealed.keyId, await sourceKeyId(key));
  assert.equal(sealed.ownership.default, 0);
  assert.match(sealed.pages[0].text.content, PLACEHOLDER);
  assert.ok(!JSON.stringify(sealed).includes("PRIVATE_TEXT"));
  assert.deepEqual(
    await openSource(sealed.flags[SYSTEM].gmSealed, key, WORLD, "noteA"),
    record("Rancor"),
  );
});

test("records without a structured source are refused", async () => {
  const pack = notesPack([]);
  installFoundry({ pack });
  await assert.rejects(
    preparePrivateNotes([{ _id: "bare", flags: {} }], pack),
    /structured source record/,
  );
});

test("only the active GM creates the key, and never over existing sealed notes", async () => {
  const pack = notesPack([]),
    doc = newRecord("noteB", "Hutt enforcer");
  installFoundry({ isGM: false, pack });
  await assert.rejects(preparePrivateNotes([doc], pack), /Only the GM/);

  const assistant = installFoundry({ userId: "gm2", activeGM: "gm", pack });
  await assert.rejects(preparePrivateNotes([doc], pack), /active GM must create/);
  assert.deepEqual(assistant.settings.gmSourceKeys, {});

  const sealedPack = notesPack([
      await sealedJournal("old", record("Old"), generateSourceKey()),
    ]),
    freshBrowser = installFoundry({ pack: sealedPack });
  await assert.rejects(
    preparePrivateNotes([doc], sealedPack),
    /Restore this world's GM source key/,
  );
  assert.deepEqual(freshBrowser.settings.gmSourceKeys, {});
});

test("a browser key that does not match the sealed library is refused", async () => {
  const pack = notesPack([
    await sealedJournal("old", record("Old"), generateSourceKey()),
  ]);
  installFoundry({ key: generateSourceKey(), pack });
  await assert.rejects(
    preparePrivateNotes([newRecord("noteC", "Bounty hunter")], pack),
    /does not match the library/,
  );
  await assert.rejects(refreshGMNotes(), /does not match the library/);
});

test("refresh decrypts sealed notes for the GM and resolves each actor's note", async () => {
  const key = generateSourceKey(),
    pack = notesPack([
      await sealedJournal("n1", record("Rancor"), key),
      await sealedJournal("n2", record("Krayt dragon"), key),
    ]);
  installFoundry({ key, pack });
  await refreshGMNotes();
  assert.deepEqual(getGMSourceNotes(actor("n2")), record("Krayt dragon"));
  assert.equal(getGMSourceNotes(actor("missing")), undefined);
  assert.equal(getGMSourceNotes({ getFlag: () => undefined }), undefined);
  assert.equal(getGMSourceNotes({}), undefined);

  installFoundry({ key, pack: notesPack([]) });
  await refreshGMNotes();
  assert.equal(getGMSourceNotes(actor("n2")), undefined);
  installFoundry({ key });
  await refreshGMNotes();
  assert.equal(getGMSourceNotes(actor("n1")), undefined);
});

test("search matches every word across name and text, returning 1 to 50 notes", async () => {
  const key = generateSourceKey(),
    docs = [];
  for (let index = 0; index < 60; index += 1)
    docs.push(
      await sealedJournal(`st${index}`, record(`Stormtrooper ${index}`, "Imperial patrol"), key),
    );
  docs.push(await sealedJournal("rancor", record("Rancor", "Jabba's pit beast"), key));
  installFoundry({ key, pack: notesPack(docs) });
  await refreshGMNotes();
  assert.deepEqual(
    searchGMSourceNotes("PIT  rancor").map((note) => note.name),
    ["Rancor"],
  );
  assert.deepEqual(searchGMSourceNotes("rancor imperial"), []);
  assert.equal(searchGMSourceNotes("imperial patrol").length, 10);
  assert.equal(searchGMSourceNotes("imperial", 0).length, 10);
  assert.equal(searchGMSourceNotes("imperial", "many").length, 10);
  assert.equal(searchGMSourceNotes("imperial", 500).length, 50);
  assert.equal(searchGMSourceNotes("imperial", -3).length, 1);
  assert.equal(searchGMSourceNotes("").length, 10);
});

test("legacy plaintext notes are sealed in batches of 100 and the pack is relocked", async () => {
  const docs = Array.from({ length: 101 }, (_, index) =>
      legacyJournal(`legacy${index}`, record(`Legacy ${index}`)),
    ),
    pack = notesPack(docs),
    foundry = installFoundry({ pack });
  await refreshGMNotes();
  const key = foundry.settings.gmSourceKeys[WORLD];
  assert.ok(key);
  assert.deepEqual(pack.configured, [{ locked: false }, { locked: true }]);
  assert.deepEqual(
    pack.batches.map((batch) => batch.length),
    [100, 1],
  );
  const [update] = pack.batches[0];
  assert.equal(update[`flags.${SYSTEM}.-=gmSource`], null);
  assert.equal(update[`flags.${SYSTEM}.gmSealed`].keyId, await sourceKeyId(key));
  assert.match(update.pages[0].text.content, PLACEHOLDER);
  assert.deepEqual(update.pages[0].flags, {});
  const written = JSON.stringify(pack.batches);
  assert.ok(!written.includes("PRIVATE_TEXT"));
  assert.ok(!written.includes("PRIVATE_PAGE"));
  assert.deepEqual(getGMSourceNotes(actor("legacy100")), record("Legacy 100"));
});

test("a failed migration relocks the pack and does not block the next refresh", async () => {
  const pack = notesPack([legacyJournal("legacy", record("Legacy"))], {
    failUpdates: true,
  });
  installFoundry({ pack });
  await assert.rejects(refreshGMNotes(), /Compendium write failed/);
  assert.deepEqual(pack.configured.at(-1), { locked: true });

  pack.failUpdates = false;
  await refreshGMNotes();
  assert.deepEqual(getGMSourceNotes(actor("legacy")), record("Legacy"));
});

test("players are refused by every GM notes entry point", async () => {
  const pack = notesPack([]);
  installFoundry({ isGM: false, pack });
  await assert.rejects(openGMSourceNotes(actor("n1")), /Only the GM/);
  await assert.rejects(gmSourceLibrary(), /Only the GM/);
  await assert.rejects(gmSourceKeyDialog(), /Only the GM/);
  await assert.rejects(
    preparePrivateNotes([newRecord("noteD", "Spy")], pack),
    /Only the GM/,
  );
});

test("opening a note loads it on demand and escapes its prose", async () => {
  const key = generateSourceKey(),
    pack = notesPack([
      await sealedJournal(
        "xss",
        {
          name: "Hutt boss",
          kind: "adversary",
          source: '<img src="x" onerror="alert(1)">',
          text: "<script>steal()</script>",
        },
        key,
      ),
    ]),
    foundry = installFoundry({ key, pack });
  await openGMSourceNotes(actor("xss"));
  const [dialog] = foundry.dialogs;
  assert.match(dialog.window.title, /Hutt boss · GM source notes/);
  assert.ok(!dialog.content.includes("<script>"));
  assert.ok(!dialog.content.includes("<img"));
  assert.match(dialog.content, /&lt;script&gt;steal\(\)&lt;\/script&gt;/);
  await assert.rejects(
    openGMSourceNotes(actor("unknown")),
    /Import and unlock GM source notes/,
  );
});

test("the source library searches, lists escaped matches and opens the chosen one", async () => {
  const key = generateSourceKey(),
    pack = notesPack([
      await sealedJournal("lib1", record("Gamorrean guard"), key),
      await sealedJournal(
        "lib2",
        { ...record("Gamorrean <em>chief</em>"), kind: "rival" },
        key,
      ),
    ]),
    answers = [],
    choose = (field, value) => (config) =>
      config.ok.callback(null, { form: { elements: { [field]: { value } } } }),
    foundry = installFoundry({
      key,
      pack,
      prompt: (config) => answers.shift()(config),
    });

  answers.push(() => null);
  assert.equal(await gmSourceLibrary(), undefined);

  answers.push(choose("query", "wookiee"));
  await gmSourceLibrary();
  assert.deepEqual(foundry.info, ["No matching GM source notes."]);

  answers.push(choose("query", "gamorrean"), choose("note", "7"));
  assert.equal(await gmSourceLibrary(), undefined);

  answers.push(choose("query", "gamorrean"), (config) => {
    assert.match(config.content, /Gamorrean &lt;em&gt;chief&lt;\/em&gt; · rival/);
    return choose("note", "1")(config);
  });
  await gmSourceLibrary();
  assert.match(foundry.dialogs.at(-1).window.title, /chief/);
});

test("key backup downloads this world's key as a JSON file", async (t) => {
  const key = generateSourceKey(),
    pack = notesPack([await sealedJournal("bk1", record("Bossk"), key)]),
    foundry = installFoundry({ key, pack }),
    anchor = {
      click() {
        anchor.clicked = true;
      },
    },
    blobs = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "a");
      return anchor;
    },
  };
  t.mock.method(URL, "createObjectURL", (blob) => {
    blobs.push(blob);
    return "blob:backup";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.timers.enable({ apis: ["setTimeout"] });

  await gmSourceKeyDialog();
  const backup = foundry.dialogs[0].buttons.find(
    (button) => button.action === "backup",
  );
  await backup.callback();
  assert.equal(anchor.download, `star-wars-ffg-${WORLD}-gm-source-key.json`);
  assert.equal(anchor.clicked, true);
  assert.deepEqual(JSON.parse(await blobs[0].text()), {
    format: "star-wars-ffg-gm-source-key",
    version: 1,
    world: WORLD,
    key,
  });
  t.mock.timers.tick(1000);
  assert.equal(URL.revokeObjectURL.mock.calls[0].arguments[0], "blob:backup");

  const keyless = installFoundry({ pack });
  await gmSourceKeyDialog();
  await keyless.dialogs[0].buttons[0].callback();
  assert.match(keyless.errors[0], /Restore this world's GM source key/);
  assert.equal(blobs.length, 1);
});

test("key restore accepts only a backup for this world that matches the sealed library", async () => {
  const key = generateSourceKey(),
    pack = notesPack([await sealedJournal("rs1", record("Boba"), key)]),
    foundry = installFoundry({ pack }),
    backup = (changes = {}) =>
      JSON.stringify({
        format: "star-wars-ffg-gm-source-key",
        version: 1,
        world: WORLD,
        key,
        ...changes,
      }),
    file = (text, size = text.length) => ({ size, text: async () => text });
  await gmSourceKeyDialog();
  const restore = foundry.dialogs[0].buttons.find(
      (button) => button.action === "restore",
    ),
    choose = (chosen) =>
      restore.callback(null, {
        form: { elements: { keyFile: { files: chosen ? [chosen] : [] } } },
      });

  await choose(undefined);
  await choose(file(backup(), 5000));
  await choose(file("not json"));
  await choose(file(backup({ world: "campaign-world" })));
  await choose(file(backup({ version: 2 })));
  await choose(file(backup({ key: "c2hvcnQ" })));
  await choose(file(backup({ key: generateSourceKey() })));
  assert.equal(foundry.errors.length, 7);
  assert.deepEqual(foundry.errors.slice(0, 2), [
    "Choose the GM source key backup JSON (under 4 KB).",
    "Choose the GM source key backup JSON (under 4 KB).",
  ]);
  assert.match(foundry.errors[2], /JSON/);
  assert.deepEqual(foundry.errors.slice(3, 5), [
    "Choose a source key backup for this world.",
    "Choose a source key backup for this world.",
  ]);
  assert.match(foundry.errors[5], /32 bytes/);
  assert.equal(
    foundry.errors[6],
    "That key does not match the encrypted source library.",
  );
  assert.deepEqual(foundry.settings.gmSourceKeys, {});

  await choose(file(backup()));
  assert.equal(foundry.settings.gmSourceKeys[WORLD], key);
  assert.deepEqual(foundry.info, ["GM source notes unlocked in this browser."]);
  assert.deepEqual(getGMSourceNotes(actor("rs1")), record("Boba"));
});
