import test from "node:test";
import assert from "node:assert/strict";
import { importIntegrationPackage } from "../src/integration-api.mjs";

function actorGroupPackage() {
  const actor = (name, type) => ({
    name,
    type,
    system: type === "character"
      ? {
          line: "edge",
          phase: "creation",
          characteristics: { brawn: 2, agility: 2 },
          wounds: { value: 0, max: 10 },
          strain: { value: 0, max: 10 },
        }
      : { line: "edge", phase: "play", characteristics: { brawn: 3 } },
    items: [],
  });
  return {
    format: "star-wars-ffg-interchange",
    version: 3,
    kind: "actorGroup",
    source: { id: "sw-rpg.info", name: "SW-RPG.info", version: "0.2.0" },
    payload: {
      id: "chapter-one",
      name: "Chapter One",
      actors: [
        { id: "hero", actor: actor("Ari Vale", "character") },
        { id: "hunter", actor: actor("Korda Vex", "rival") },
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

test("actor-group import creates one reviewed batch and preserves reconstructable graph flags", async (t) => {
  const created = [];
  const calls = [];
  globalThis.game = { user: { id: "gm", isGM: true, can: () => true } };
  globalThis.Actor = {
    async createDocuments(sources, options) {
      created.push(...sources);
      assert.deepEqual(options, { renderSheet: false, keepEmbeddedIds: true });
      return sources.map((source, index) => ({
        id: `actor-${index + 1}`,
        uuid: `Actor.actor-${index + 1}`,
        name: source.name,
        type: source.type,
      }));
    },
  };
  globalThis.Hooks = { callAll: (...args) => calls.push(args) };
  t.after(() => {
    delete globalThis.game;
    delete globalThis.Actor;
    delete globalThis.Hooks;
  });

  const pkg = actorGroupPackage();
  const result = await importIntegrationPackage(pkg);

  assert.equal(created.length, 2);
  assert.equal(created[0].flags["star-wars-ffg"].integration.actorGroup.node.id, "hero-node");
  assert.equal(created[1].flags["star-wars-ffg"].integration.actorGroup.relationships[0].kind, "pursues");
  assert.deepEqual(result.actors.map((entry) => [entry.actorRef, entry.nodeId, entry.actorId]), [
    ["hero", "hero-node", "actor-1"],
    ["hunter", "hunter-node", "actor-2"],
  ]);
  assert.deepEqual(result.relationships, pkg.payload.relationships);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "starWarsFFGIntegrationImported");
  assert.equal(calls[0][1].kind, "actorGroup");
});

test("actor-group import remains GM-authoritative", async (t) => {
  let attempted = false;
  globalThis.game = { user: { id: "player", isGM: false, can: () => true } };
  globalThis.Actor = { async createDocuments() { attempted = true; return []; } };
  globalThis.Hooks = { callAll: () => undefined };
  t.after(() => {
    delete globalThis.game;
    delete globalThis.Actor;
    delete globalThis.Hooks;
  });

  await assert.rejects(() => importIntegrationPackage(actorGroupPackage()), /Only the GM can import actor groups/);
  assert.equal(attempted, false);
});
