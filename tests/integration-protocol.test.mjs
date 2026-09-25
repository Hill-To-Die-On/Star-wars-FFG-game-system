import test from "node:test";
import assert from "node:assert/strict";
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
  assert.deepEqual(capabilities.versions, [1]);
  assert.match(capabilities.schema, /integration-v1\.schema\.json$/);
  assert.ok(capabilities.itemTypes.includes("specialization"));
  assert.ok(capabilities.transports.includes("post-message"));
  assert.equal(capabilities.limits.characterItems, 250);
});
