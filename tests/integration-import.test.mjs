import test from "node:test";
import assert from "node:assert/strict";
import {
  exportIntegrationActor,
  exportIntegrationCharacter,
  importIntegrationActor,
  importIntegrationCharacter,
  importIntegrationPackage,
  importIntegrationRulePack,
} from "../src/integration-api.mjs";
import {
  FORMAT,
  actorPackage,
  actorSystem,
  bundle,
  characterPackage,
  rulePack,
} from "./fixtures/integration-packages.mjs";

const SYSTEM = "star-wars-ffg",
  CREATED = {
    kind: "character",
    actorId: "NewActor00000001",
    actorUuid: "Actor.NewActor00000001",
    name: "Ria Vale",
  };

// The world's community rules compendium; records lock changes and writes.
function rulesPack({ index = [], documentName = "Item" } = {}) {
  const pack = {
    collection: "world.star-wars-community-rules",
    documentName,
    locked: true,
    index: new Map(index.map((entry) => [entry._id, entry])),
    configured: [],
    created: [],
    updated: [],
    async configure(options) {
      pack.configured.push(options);
      pack.locked = options.locked;
    },
    async getIndex() {},
    documentClass: {
      async createDocuments(documents, options) {
        assert.deepEqual(options, { pack: pack.collection, render: false });
        pack.created.push(documents);
      },
      async updateDocuments(documents, options) {
        assert.deepEqual(options, { pack: pack.collection, render: false });
        pack.updated.push(documents);
      },
    },
  };
  return pack;
}

const indexed = (id, externalKey) => ({
  _id: id,
  flags: externalKey ? { [SYSTEM]: { integration: { externalKey } } } : {},
});

// Foundry globals for one test; returns the calls it asserts on.
function installFoundry({
  isGM = true,
  canCreate = false,
  actors = [],
  pack,
  newPack,
  createActor = true,
} = {}) {
  const calls = { created: [], hooks: [], files: [], compendiums: [] };
  globalThis.game = {
    user: {
      id: "user1",
      isGM,
      can: (permission) => permission === "ACTOR_CREATE" && canCreate,
    },
    actors: new Map(actors.map((actor) => [actor.id, actor])),
    packs: new Map(pack ? [[pack.collection, pack]] : []),
    system: {
      title: "Star Wars FFG",
      version: "0.3.0",
      url: "https://example.test/system.json",
    },
  };
  globalThis.Actor = {
    async create(source, options) {
      calls.created.push({ source, options });
      if (!createActor) return null;
      return {
        id: "NewActor00000001",
        uuid: "Actor.NewActor00000001",
        name: source.name,
        type: source.type,
      };
    },
  };
  globalThis.Hooks = { callAll: (...args) => calls.hooks.push(args) };
  globalThis.fromUuid = async (uuid) =>
    actors.find((actor) => actor.uuid === uuid) ?? null;
  globalThis.saveDataToFile = (data, type, filename) =>
    calls.files.push({ data, type, filename });
  globalThis.foundry = {
    documents: {
      collections: {
        CompendiumCollection: {
          async createCompendium(metadata) {
            calls.compendiums.push(metadata);
            return newPack;
          },
        },
      },
    },
    utils: {
      getProperty: (object, path) =>
        path.split(".").reduce((value, key) => value?.[key], object),
    },
  };
  return calls;
}

// A world Actor as export sees it.
function actorDocument({ type = "character", name = "Ria Vale", observer = true, img } = {}) {
  const system =
    type === "character" ? characterPackage().payload.system : actorSystem(type);
  return {
    id: `Actor${type}`,
    uuid: `Actor.${type}`,
    documentName: "Actor",
    type,
    name,
    items: [
      {
        id: "Item000000000001",
        name: "Comlink",
        type: "gear",
        toObject: () => ({ system: { description: "", quantity: 1 } }),
      },
    ],
    testUserPermission(user, level) {
      assert.equal(user, game.user);
      assert.equal(level, "OBSERVER");
      return observer;
    },
    toObject: () => ({ ...(img ? { img } : {}), system: structuredClone(system) }),
  };
}

test("players need Foundry's actor-creation permission to import a character, and then own it", async () => {
  installFoundry({ isGM: false });
  await assert.rejects(
    importIntegrationCharacter(characterPackage()),
    /cannot create actors/,
  );

  const calls = installFoundry({ isGM: false, canCreate: true }),
    result = await importIntegrationCharacter(characterPackage()),
    [{ source, options }] = calls.created;
  assert.deepEqual(result, CREATED);
  assert.deepEqual(source.ownership, { user1: 3 });
  assert.deepEqual(options, { renderSheet: true, keepEmbeddedIds: true });
  assert.equal(source.items[0]._id, "AbCdEfGhIjKlMnOp");
  assert.equal(source.items[0].id, undefined);
  assert.deepEqual(calls.hooks, [
    ["starWarsFFGIntegrationImported", result, characterPackage()],
  ]);
});

test("GM character imports record provenance without claiming ownership", async () => {
  const calls = installFoundry();
  await importIntegrationCharacter(characterPackage(), { renderSheet: false });
  const [{ source, options }] = calls.created,
    { importedAt, ...provenance } = source.flags[SYSTEM].integration;
  assert.equal(source.ownership, undefined);
  assert.equal(options.renderSheet, false);
  assert.deepEqual(provenance, {
    sourceId: "qa.builder",
    sourceName: "QA Builder",
    sourceVersion: "1.0.0",
    sourceUrl: "https://builder.example/",
    format: FORMAT,
    formatVersion: 1,
  });
  assert.ok(!Number.isNaN(Date.parse(importedAt)));
});

test("only the GM imports adversaries and vehicles; players may import their own characters", async () => {
  installFoundry({ isGM: false, canCreate: true });
  for (const type of ["rival", "vehicle"])
    await assert.rejects(
      importIntegrationActor(actorPackage(type)),
      /Only the GM can import adversaries, vehicles and groups/,
    );

  const player = installFoundry({ isGM: false, canCreate: true }),
    own = await importIntegrationActor(actorPackage("character"));
  assert.equal(own.actorType, "character");
  assert.deepEqual(player.created[0].source.ownership, { user1: 3 });

  const gm = installFoundry(),
    vehicle = await importIntegrationActor(actorPackage("vehicle"));
  assert.deepEqual(vehicle, {
    kind: "actor",
    actorType: "vehicle",
    actorId: "NewActor00000001",
    actorUuid: "Actor.NewActor00000001",
    name: "Field test vehicle",
  });
  assert.equal(gm.created[0].source.type, "vehicle");
  assert.equal(gm.created[0].source.ownership, undefined);
});

test("mismatched package kinds, invalid packages and failed creation are reported", async () => {
  installFoundry({ createActor: false });
  await assert.rejects(
    importIntegrationCharacter(actorPackage("rival")),
    /Choose a character interchange package/,
  );
  await assert.rejects(
    importIntegrationActor(characterPackage()),
    /Choose a version 2 actor interchange package/,
  );
  await assert.rejects(
    importIntegrationRulePack(characterPackage()),
    /Choose a community rule-pack interchange package/,
  );
  await assert.rejects(importIntegrationPackage({ format: FORMAT, version: 9 }));
  await assert.rejects(
    importIntegrationCharacter(characterPackage()),
    /did not create the character/,
  );
  await assert.rejects(
    importIntegrationActor(actorPackage("rival")),
    /did not create the actor/,
  );
});

test("exports need observer permission and resolve actors by ID or UUID", async () => {
  const ria = actorDocument({ img: "icons/svg/mystery-man.svg" }),
    ship = actorDocument({ type: "vehicle", name: "Wayfarer" });
  installFoundry({ actors: [ria, ship] });

  const character = await exportIntegrationCharacter(ria.id);
  assert.equal(character.version, 1);
  assert.equal(character.payload.img, "icons/svg/mystery-man.svg");
  assert.deepEqual(character.payload.items[0], {
    id: "Item000000000001",
    name: "Comlink",
    type: "gear",
    system: { description: "", quantity: 1 },
  });
  assert.deepEqual(character.source, {
    id: SYSTEM,
    name: "Star Wars FFG",
    version: "0.3.0",
    url: "https://example.test/system.json",
  });
  assert.deepEqual(await exportIntegrationCharacter(ria.uuid), character);

  const vehicle = await exportIntegrationActor(ship);
  assert.equal(vehicle.version, 2);
  assert.equal(vehicle.kind, "actor");
  assert.equal(vehicle.payload.type, "vehicle");
  assert.equal(vehicle.payload.img, undefined);

  await assert.rejects(exportIntegrationCharacter(ship), /Choose a player character/);
  await assert.rejects(
    exportIntegrationCharacter("Actor.missing"),
    /Choose a player character/,
  );
  await assert.rejects(
    exportIntegrationCharacter(actorDocument({ observer: false })),
    /Observer permission is required to export this character/,
  );
  await assert.rejects(
    exportIntegrationActor({ ...ship, type: "npc" }),
    /Choose a Star Wars FFG actor/,
  );
  await assert.rejects(
    exportIntegrationActor(actorDocument({ type: "vehicle", observer: false })),
    /Observer permission is required to export this actor/,
  );
});

test("downloads name the file after the actor", async () => {
  const calls = installFoundry();
  await exportIntegrationCharacter(actorDocument({ name: "Ria Vale (Edge)" }), {
    download: true,
  });
  await exportIntegrationCharacter(actorDocument({ name: "!!!" }), {
    download: true,
  });
  await exportIntegrationActor(actorDocument({ type: "vehicle", name: "***" }), {
    download: true,
  });
  assert.deepEqual(
    calls.files.map((file) => file.filename),
    [
      "ria-vale-edge.star-wars-ffg.json",
      "character.star-wars-ffg.json",
      "actor.star-wars-ffg.json",
    ],
  );
  assert.equal(calls.files[0].type, "application/json");
  assert.equal(JSON.parse(calls.files[0].data).payload.name, "Ria Vale (Edge)");
});

test("rule packs are GM-only and accept only preserve or replace for conflicts", async () => {
  const pack = rulesPack();
  installFoundry({ isGM: false, pack });
  await assert.rejects(
    importIntegrationRulePack(rulePack()),
    /Only the GM can import community rule packs/,
  );
  installFoundry({ pack });
  await assert.rejects(
    importIntegrationRulePack(rulePack(), { conflict: "merge" }),
    /Rule conflict mode must be preserve or replace/,
  );
  assert.deepEqual(pack.configured, []);
});

test("new rules are created in batches of 100 with provenance, and the pack is relocked", async () => {
  const pack = rulesPack({ index: [indexed("LocalRule0000001")] }),
    calls = installFoundry({ pack }),
    result = await importIntegrationRulePack(rulePack(150));
  assert.deepEqual(result, {
    kind: "rulePack",
    pack: pack.collection,
    packageId: "qa-rules",
    created: 150,
    updated: 0,
    preserved: 0,
  });
  assert.deepEqual(
    pack.created.map((batch) => batch.length),
    [100, 50],
  );
  assert.deepEqual(pack.configured, [
    {
      locked: false,
      ownership: {
        GAMEMASTER: "OWNER",
        ASSISTANT: "OWNER",
        TRUSTED: "OBSERVER",
        PLAYER: "OBSERVER",
      },
    },
    { locked: true },
  ]);
  const { integration } = pack.created[0][0].flags[SYSTEM];
  assert.equal(integration.externalKey, "qa.builder:qa-rules:gear.item-0");
  assert.equal(integration.ruleKey, "gear.item-0");
  assert.equal(integration.packageName, "QA rules");
  assert.equal(integration.packageVersion, "2.0.0");
  assert.deepEqual(calls.hooks[0].slice(0, 2), [
    "starWarsFFGIntegrationImported",
    result,
  ]);
});

test("a missing community compendium is created readable by players; a wrong type is refused", async () => {
  const pack = rulesPack(),
    calls = installFoundry({ newPack: pack });
  await importIntegrationRulePack(rulePack());
  assert.equal(calls.compendiums.length, 1);
  assert.equal(calls.compendiums[0].name, "star-wars-community-rules");
  assert.equal(calls.compendiums[0].type, "Item");
  assert.equal(calls.compendiums[0].ownership.PLAYER, "OBSERVER");
  assert.equal(pack.created.length, 1);

  const journals = rulesPack({ documentName: "JournalEntry" });
  installFoundry({ pack: journals });
  await assert.rejects(
    importIntegrationRulePack(rulePack()),
    /unexpected document type/,
  );
  assert.deepEqual(journals.configured, []);
});

test("duplicate integration keys stop a rule import before any write, and the pack is relocked", async () => {
  const key = "qa.builder:qa-rules:gear.item-0",
    pack = rulesPack({
      index: [indexed("Existing00000001", key), indexed("Existing00000002", key)],
    });
  installFoundry({ pack });
  await assert.rejects(
    importIntegrationRulePack(rulePack(), { conflict: "replace" }),
    /duplicate integration key qa\.builder:qa-rules:gear\.item-0/,
  );
  assert.deepEqual(pack.created, []);
  assert.deepEqual(pack.updated, []);
  assert.deepEqual(pack.configured.at(-1), { locked: true });
});

test("bundles check every entry's permission before importing anything", async () => {
  const calls = installFoundry({ isGM: false, canCreate: true, pack: rulesPack() });
  await assert.rejects(
    importIntegrationPackage(bundle(actorPackage("character"), rulePack())),
    /Only the GM can import community rule packs/,
  );
  await assert.rejects(
    importIntegrationPackage(
      bundle(actorPackage("character"), actorPackage("rival")),
    ),
    /Only the GM can import adversaries/,
  );
  assert.equal(calls.created.length, 0);
});

test("a GM bundle import returns each result and fires one bundle hook", async () => {
  const calls = installFoundry({ pack: rulesPack() }),
    result = await importIntegrationPackage(
      bundle(actorPackage("character"), rulePack(2)),
    );
  assert.equal(result.kind, "bundle");
  assert.deepEqual(
    result.results.map((entry) => entry.kind),
    ["actor", "rulePack"],
  );
  assert.deepEqual(
    calls.hooks.map(([, value]) => value.kind),
    ["actor", "rulePack", "bundle"],
  );

  assert.equal((await importIntegrationPackage(characterPackage())).kind, "character");
  assert.equal((await importIntegrationPackage(actorPackage("vehicle"))).kind, "actor");
  assert.equal((await importIntegrationPackage(rulePack())).kind, "rulePack");
});
