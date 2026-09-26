import test from "node:test";
import assert from "node:assert/strict";
import { reviewIntegrationPackage } from "../src/integration-api.mjs";

function rulePack() {
  return {
    format: "star-wars-ffg-interchange",
    version: 2,
    kind: "rulePack",
    source: {
      id: "qa.builder",
      name: "QA Builder",
      version: "2.0.0",
    },
    payload: {
      id: "qa-rules",
      name: "QA rules",
      version: "2.0.0",
      rules: [
        {
          key: "gear.survey-scanner",
          name: "Survey scanner replacement",
          type: "gear",
          system: {
            description: "Replacement guidance.",
            quantity: 1,
            price: 275,
            rarity: 4,
          },
        },
      ],
    },
  };
}

function installFoundryHarness(conflict) {
  const externalKey = "qa.builder:qa-rules:gear.survey-scanner",
    updates = [],
    notifications = [],
    pack = {
      collection: "world.star-wars-community-rules",
      documentName: "Item",
      locked: true,
      index: new Map([
        [
          "ExistingRule1234",
          {
            _id: "ExistingRule1234",
            flags: {
              "star-wars-ffg": { integration: { externalKey } },
            },
          },
        ],
      ]),
      async configure() {},
      async getIndex() {},
      documentClass: {
        async createDocuments() {
          throw new Error("An existing stable rule key must not create a duplicate.");
        },
        async updateDocuments(documents) {
          updates.push(...documents);
        },
      },
    };

  globalThis.game = {
    user: { isGM: true },
    packs: { get: () => pack },
  };
  globalThis.Hooks = { callAll() {} };
  globalThis.ui = { notifications: { info: (message) => notifications.push(message) } };
  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          async confirm(config) {
            assert.match(config.content, /name="integrationConflict"/);
            assert.match(config.content, /Keep current community rules/);
            assert.match(config.content, /Replace matching community rules/);
            return config.yes.callback(null, {
              form: { elements: { integrationConflict: { value: conflict } } },
            });
          },
        },
      },
    },
    utils: {
      getProperty(object, path) {
        return path.split(".").reduce((value, key) => value?.[key], object);
      },
    },
  };
  return { notifications, updates };
}

test("reviewed rule imports default to preserving matches and allow an explicit replacement", async () => {
  const preserve = installFoundryHarness("preserve"),
    preserved = await reviewIntegrationPackage(rulePack());
  assert.deepEqual(
    { created: preserved.created, updated: preserved.updated, preserved: preserved.preserved },
    { created: 0, updated: 0, preserved: 1 },
  );
  assert.equal(preserve.updates.length, 0);

  const replace = installFoundryHarness("replace"),
    replaced = await reviewIntegrationPackage(rulePack());
  assert.deepEqual(
    { created: replaced.created, updated: replaced.updated, preserved: replaced.preserved },
    { created: 0, updated: 1, preserved: 0 },
  );
  assert.equal(replace.updates[0]._id, "ExistingRule1234");
  assert.equal(replace.updates[0].system.price, 275);
  assert.equal(replace.notifications.length, 1);
});
