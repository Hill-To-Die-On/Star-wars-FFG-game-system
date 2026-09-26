import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INTEGRATION_FORMAT,
  createConnectorRegistry,
  decodeIntegrationPackage,
  encodeConnectionRequest,
  encodeIntegrationPackage,
  integrationCapabilities,
  integrationSummary,
  parseIntegrationHash,
  validateIntegrationPackage,
} from "../src/integration-protocol.mjs";

const source = {
  id: "example.builder",
  name: "Example Builder",
  version: "1.4.0",
  url: "https://builder.example/",
};

function characterPackage() {
  return {
    format: INTEGRATION_FORMAT,
    version: 1,
    kind: "character",
    source,
    payload: {
      name: "Ria Vale",
      type: "character",
      system: {
        line: "edge",
        phase: "play",
        characteristics: { brawn: 2, agility: 3 },
        skills: {
          pilotingSpace: {
            rank: 2,
            career: true,
            group: false,
            characteristic: "agility",
          },
        },
        customSkills: [
          {
            id: "salvage",
            label: "Salvage",
            characteristic: "intellect",
            type: "general",
            rank: 1,
            career: true,
            group: false,
          },
        ],
        motivations: [
          {
            id: "crew",
            name: "Protect the crew",
            category: "Relationship",
            description: "A creator-written motivation.",
            active: true,
            source: { book: "Home campaign", page: "1" },
          },
        ],
        wounds: { value: 2, max: 12 },
        strain: { value: 1, max: 13 },
      },
      items: [
        {
          id: "AbCdEfGhIjKlMnOp",
          name: "Creator's toolkit",
          type: "gear",
          system: {
            description: "Original community equipment guidance.",
            quantity: 1,
            source: { book: "Home campaign", page: "2" },
          },
        },
      ],
    },
  };
}

function rulePack() {
  return {
    format: INTEGRATION_FORMAT,
    version: 1,
    kind: "rulePack",
    source,
    payload: {
      id: "frontier-options",
      name: "Frontier options",
      version: "2.0.0",
      rules: [
        {
          key: "talents.resourceful",
          name: "Resourceful",
          type: "talent",
          system: {
            description: "Creator-written rule guidance.",
            activation: "Passive",
            tree: {
              verified: true,
              nodes: [
                {
                  id: "entry",
                  name: "Resourceful",
                  entry: true,
                  ranked: false,
                  row: 0,
                  col: 0,
                  cost: 5,
                  activation: "Passive",
                  summary: "Add one boost to Mechanics checks.",
                  effects: [
                    {
                      type: "pool",
                      operation: "add",
                      target: "boost",
                      count: 1,
                      skills: ["mechanics"],
                    },
                  ],
                },
              ],
              edges: [],
            },
          },
        },
      ],
    },
  };
}

function actorPackage(type = "vehicle") {
  const systems = {
    character: {
      line: "edge",
      phase: "creation",
      species: "Human",
      characteristics: { brawn: 2, agility: 2 },
      wounds: { value: 0, max: 12 },
      strain: { value: 0, max: 12 },
    },
    minion: {
      line: "edge",
      phase: "play",
      species: "Droid",
      characteristics: { brawn: 3, agility: 2 },
      skills: {
        vigilance: {
          rank: 8,
          career: false,
          group: true,
          characteristic: "willpower",
        },
      },
      wounds: { value: 0, max: 5 },
      strain: { value: 0, max: 0 },
      groupSize: 3,
    },
    rival: { line: "edge", phase: "play", characteristics: { brawn: 3 } },
    nemesis: { line: "edge", phase: "play", characteristics: { willpower: 4 } },
    vehicle: {
      hullTrauma: { value: 0, max: 20 },
      systemStrain: { value: 0, max: 15 },
      armor: 3,
      silhouette: 4,
      speed: { value: 0, max: 3 },
      handling: -1,
      shields: { fore: 1, aft: 1, port: 0, starboard: 0 },
      model: "YT-1300",
      manufacturer: "Corellian Engineering Corporation",
      source: { book: "Edge Core", page: "260", table: "vehicles", id: "1" },
      incomplete: ["source review required"],
    },
    group: {
      base: { name: "Waystation", location: "Outer Rim", description: "" },
      members: {
        pilot: {
          actorId: "",
          playerName: "",
          characterName: "Ria Vale",
          obligation: 10,
          obligationType: "Debt",
          description: "",
          motivation: "",
          duty: 0,
          dutyType: "",
          morality: 50,
        },
      },
      credits: 2500,
      resources: "",
      possessions: "Comlink",
      contacts: "",
      notes: "",
    },
  };
  return {
    format: INTEGRATION_FORMAT,
    version: 2,
    kind: "actor",
    source: { ...source, id: "sw-rpg.info", name: "SW-RPG.info" },
    payload: {
      name: type === "group" ? "Vale Cell" : "Field test actor",
      type,
      system: systems[type],
      items: [
        {
          name: "Field kit",
          type: "gear",
          system: {
            description: "",
            quantity: 1,
            price: 50,
            source: { book: "Edge Core", page: "170", table: "equipment", id: "3" },
          },
        },
      ],
    },
  };
}

function actorGroupPackage() {
  const hero = actorPackage("character").payload,
    hunter = actorPackage("rival").payload;
  hero.name = "Ari Vale";
  hunter.name = "Korda Vex";
  return {
    format: INTEGRATION_FORMAT,
    version: 3,
    kind: "actorGroup",
    source: { ...source, id: "sw-rpg.info", name: "SW-RPG.info" },
    payload: {
      id: "chapter-one",
      name: "Chapter One",
      actors: [
        { id: "hero", actor: hero },
        { id: "hunter", actor: hunter },
      ],
      nodes: [
        {
          id: "hero-node",
          name: "Ari Vale",
          role: "player-character",
          position: { x: 40, y: 75 },
          actorRefs: ["hero"],
        },
        {
          id: "hunter-node",
          name: "Korda Vex",
          role: "enemy-rival",
          position: { x: 320, y: 75 },
          actorRefs: ["hunter"],
        },
      ],
      relationships: [
        {
          id: "bounty",
          fromNodeId: "hunter-node",
          toNodeId: "hero-node",
          kind: "pursues",
          label: "Holds the bounty warrant",
        },
      ],
    },
  };
}

test("character interchange validates, normalizes and round-trips through a handoff token", () => {
  const input = characterPackage(),
    validated = validateIntegrationPackage(input),
    token = encodeIntegrationPackage(input),
    decoded = decodeIntegrationPackage(token);
  assert.deepEqual(decoded, validated);
  assert.notEqual(validated, input);
  assert.equal(validated.payload.items[0].id, "AbCdEfGhIjKlMnOp");
  assert.deepEqual(integrationSummary(validated), {
    kind: "character",
    label: "Ria Vale",
    source: "Example Builder",
    entries: 1,
    items: 1,
  });
  assert.deepEqual(parseIntegrationHash(`#star-wars-ffg-import=${token}`).package, validated);
});

test("interchange rejects document authority and unsafe object fields", () => {
  const authoritative = characterPackage();
  authoritative.payload.ownership = { default: 3 };
  assert.throws(
    () => validateIntegrationPackage(authoritative),
    /payload\.ownership: unsupported field/,
  );

  const poisoned = JSON.parse(JSON.stringify(characterPackage()).replace(
    '"phase":"play"',
    '"__proto__":{"admin":true},"phase":"play"',
  ));
  assert.throws(
    () => validateIntegrationPackage(poisoned),
    /__proto__: unsafe field name/,
  );

  const scriptField = characterPackage();
  scriptField.payload.system.execute = "game.users.get('x').update({role:4})";
  assert.throws(
    () => validateIntegrationPackage(scriptField),
    /system\.execute: unsupported field/,
  );
});

test("character constraints reject impossible ranks and unknown item types", () => {
  const rank = characterPackage();
  rank.payload.system.customSkills[0].rank = 8;
  assert.throws(() => validateIntegrationPackage(rank), /rank: must be an integer from 0 to 5/);

  const item = characterPackage();
  item.payload.items[0].type = "macro";
  assert.throws(() => validateIntegrationPackage(item), /unsupported item type/);

  const missingSystem = characterPackage();
  delete missingSystem.payload.system;
  assert.throws(
    () => validateIntegrationPackage(missingSystem),
    /payload\.system: expected an object/,
  );

  const price = characterPackage();
  price.payload.items[0].system.price = -1;
  assert.throws(
    () => validateIntegrationPackage(price),
    /price: must be an integer from 0/,
  );

  const malformedTree = characterPackage();
  malformedTree.payload.items[0].system.tree = { nodes: [], edges: "invalid" };
  assert.throws(
    () => validateIntegrationPackage(malformedTree),
    /tree: A talent tree needs nodes and edges/,
  );
});

test("version 2 actors validate every supported Foundry actor type", () => {
  for (const type of ["character", "minion", "rival", "nemesis", "vehicle", "group"]) {
    const validated = validateIntegrationPackage(actorPackage(type));
    assert.equal(validated.version, 2);
    assert.equal(validated.kind, "actor");
    assert.equal(validated.payload.type, type);
  }
  assert.deepEqual(integrationSummary(actorPackage("vehicle")), {
    kind: "actor",
    label: "Field test actor",
    source: "SW-RPG.info",
    entries: 1,
    items: 1,
    actorType: "vehicle",
  });
});

test("version 3 actor groups preserve stable graph identity and exact authored ties", () => {
  const validated = validateIntegrationPackage(actorGroupPackage());
  assert.equal(validated.version, 3);
  assert.equal(validated.kind, "actorGroup");
  assert.equal(validated.payload.nodes[1].actorRefs[0], "hunter");
  assert.deepEqual(validated.payload.relationships[0], {
    id: "bounty",
    fromNodeId: "hunter-node",
    toNodeId: "hero-node",
    kind: "pursues",
    label: "Holds the bounty warrant",
  });
  assert.deepEqual(integrationSummary(validated), {
    kind: "actorGroup",
    label: "Chapter One",
    source: "SW-RPG.info",
    entries: 2,
    items: 2,
    actors: 2,
    relationships: 1,
  });
});

test("version 3 actor groups accept the complete authored relationship vocabulary", () => {
  const kinds = integrationCapabilities().actorGroupRelationshipKinds;
  assert.equal(kinds.length, 131);
  for (const kind of ["borrows", "stolen-by", "stolen-from", "commandeers", "piloted-by", "berths", "refuels-at", "patrolled-by"]) {
    assert.ok(kinds.includes(kind));
  }
  for (const kind of kinds) {
    const pkg = actorGroupPackage();
    pkg.payload.relationships[0].kind = kind;
    assert.equal(validateIntegrationPackage(pkg).payload.relationships[0].kind, kind);
  }
});

test("actor groups reject dangling references and remain unavailable to older versions", () => {
  const missingActor = actorGroupPackage();
  missingActor.payload.nodes[0].actorRefs[0] = "missing";
  assert.throws(() => validateIntegrationPackage(missingActor), /actorRefs\[0\].*unknown actor/i);

  const missingNode = actorGroupPackage();
  missingNode.payload.relationships[0].toNodeId = "missing";
  assert.throws(() => validateIntegrationPackage(missingNode), /toNodeId.*unknown node/i);

  const reusedActor = actorGroupPackage();
  reusedActor.payload.nodes[1].actorRefs[0] = "hero";
  assert.throws(() => validateIntegrationPackage(reusedActor), /actor reference.*exactly one node/i);

  const legacy = actorGroupPackage();
  legacy.version = 2;
  assert.throws(() => validateIntegrationPackage(legacy), /kind: unsupported package kind/);
});

test("version boundaries remain explicit and adversary ranks do not widen player limits", () => {
  const legacyActor = actorPackage("vehicle");
  legacyActor.version = 1;
  assert.throws(() => validateIntegrationPackage(legacyActor), /kind: unsupported package kind/);

  const futureCharacter = characterPackage();
  futureCharacter.version = 2;
  assert.throws(() => validateIntegrationPackage(futureCharacter), /kind: unsupported package kind/);

  const player = actorPackage("character");
  player.payload.system.skills = {
    vigilance: { rank: 8, career: false, group: false, characteristic: "willpower" },
  };
  assert.throws(() => validateIntegrationPackage(player), /rank: must be an integer from 0 to 5/);
  assert.doesNotThrow(() => validateIntegrationPackage(actorPackage("minion")));
});

test("capability discovery advertises legacy and all-actor interchange without weakening v1", () => {
  const capabilities = integrationCapabilities();
  assert.deepEqual(capabilities.versions, [1, 2, 3]);
  assert.deepEqual(capabilities.actorTypes, [
    "character",
    "minion",
    "rival",
    "nemesis",
    "vehicle",
    "group",
  ]);
  assert.ok(capabilities.imports.includes("actor"));
  assert.match(capabilities.schemas[1], /integration-v1/);
  assert.match(capabilities.schemas[2], /integration-v2/);
  assert.match(capabilities.schemas[3], /integration-v3/);
  assert.ok(capabilities.imports.includes("actorGroup"));
  assert.equal(validateIntegrationPackage(characterPackage()).version, 1);
});

test("community rule packs accept declarative effects and reject executable or duplicate rules", () => {
  const valid = validateIntegrationPackage(rulePack());
  assert.equal(valid.payload.rules[0].system.tree.nodes[0].effects[0].target, "boost");
  assert.equal(integrationSummary(valid).entries, 1);

  const executable = rulePack();
  executable.payload.rules[0].system.macro = "return game;";
  assert.throws(() => validateIntegrationPackage(executable), /system\.macro: unsupported field/);

  const badEffect = rulePack();
  badEffect.payload.rules[0].system.tree.nodes[0].effects[0].target = "arbitraryCode";
  assert.throws(() => validateIntegrationPackage(badEffect), /Unsupported talent effect target/);

  const duplicate = rulePack();
  duplicate.payload.rules.push(structuredClone(duplicate.payload.rules[0]));
  assert.throws(() => validateIntegrationPackage(duplicate), /duplicate rule key/);
});

test("bundles combine characters and rules without allowing recursive bundles", () => {
  const bundle = {
    format: INTEGRATION_FORMAT,
    version: 1,
    kind: "bundle",
    source,
    payload: { packages: [characterPackage(), rulePack()] },
  };
  const summary = integrationSummary(bundle);
  assert.equal(summary.entries, 2);
  assert.equal(summary.items, 2);
  assert.equal(summary.packages.length, 2);

  const recursive = structuredClone(bundle);
  recursive.payload.packages[0] = structuredClone(bundle);
  assert.throws(() => validateIntegrationPackage(recursive), /nested bundles are not supported/);
});

test("version 2 bundles combine actors and rules without mixing contract versions", () => {
  const actor = actorPackage("group"),
    rules = { ...rulePack(), version: 2 },
    bundle = {
      format: INTEGRATION_FORMAT,
      version: 2,
      kind: "bundle",
      source,
      payload: { packages: [actor, rules] },
    },
    summary = integrationSummary(bundle);
  assert.equal(summary.entries, 2);
  assert.equal(summary.packages[0].actorType, "group");

  bundle.payload.packages[1] = rulePack();
  assert.throws(
    () => validateIntegrationPackage(bundle),
    /bundle entries must use version 2/,
  );
});

test("direct links fail closed when a valid package is too large for a browser URL", () => {
  const large = rulePack();
  large.payload.rules = Array.from({ length: 5 }, (_, index) => ({
    ...structuredClone(large.payload.rules[0]),
    key: `large.rule-${index}`,
    name: `Large rule ${index}`,
    system: { description: "x".repeat(50000) },
  }));
  assert.doesNotThrow(() => validateIntegrationPackage(large));
  assert.throws(() => encodeIntegrationPackage(large), /postMessage or JSON-file transport/);
});

test("connection requests bind a nonce to one exact web origin", () => {
  const nonce = "12345678-1234-1234-1234-123456789abc",
    token = encodeConnectionRequest({ origin: "https://builder.example", nonce }),
    parsed = parseIntegrationHash(`#star-wars-ffg-connect=${token}`);
  assert.deepEqual(parsed, {
    type: "connection",
    request: { origin: "https://builder.example", nonce },
  });
  assert.throws(
    () => encodeConnectionRequest({ origin: "https://builder.example/path", nonce }),
    /exact HTTP or HTTPS origin/,
  );
});

test("connector registration is duplicate-safe and returns defensive copies", () => {
  const registry = createConnectorRegistry(),
    manifest = {
      id: "example-builder",
      name: "Example Builder",
      version: "1.0.0",
      url: "https://builder.example/connect",
      capabilities: ["character.import", "rules.import"],
    },
    registered = registry.register(manifest);
  registered.capabilities.push("changed.outside");
  assert.deepEqual(registry.list()[0].capabilities, [
    "character.import",
    "rules.import",
  ]);
  assert.throws(() => registry.register(manifest), /already registered/);
  assert.equal(registry.unregister(manifest.id), true);
  assert.deepEqual(registry.list(), []);
});

test("capability discovery publishes explicit limits and supported document types", () => {
  const capabilities = integrationCapabilities();
  assert.equal(capabilities.format, INTEGRATION_FORMAT);
  assert.deepEqual(capabilities.versions, [1, 2, 3]);
  assert.match(capabilities.schema, /integration-v3\.schema\.json$/);
  assert.ok(capabilities.itemTypes.includes("specialization"));
  assert.ok(capabilities.actorTypes.includes("vehicle"));
  assert.ok(capabilities.transports.includes("post-message"));
  assert.equal(capabilities.limits.characterItems, 250);
  assert.equal(capabilities.limits.actorGroupActors, 200);
  assert.equal(capabilities.limits.actorGroupRelationships, 1000);
  assert.equal(capabilities.actorGroupRelationshipKinds.length, 131);
  assert.ok(capabilities.actorGroupRelationshipKinds.includes("stolen-by"));
  assert.ok(capabilities.actorGroupRelationshipKinds.includes("repaired-by"));
});

test("actor-group relationship capabilities stay aligned with the public v3 schema", () => {
  const schema = JSON.parse(readFileSync(new URL("../docs/schemas/integration-v3.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(
    schema.$defs.relationship.properties.kind.enum,
    integrationCapabilities().actorGroupRelationshipKinds,
  );
});
