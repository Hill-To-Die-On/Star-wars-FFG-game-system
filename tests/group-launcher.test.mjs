import test from "node:test";
import assert from "node:assert/strict";
import { openGroupRecord } from "../src/group-launcher.mjs";

test("GM launcher creates one player-visible group record, then reopens it", async () => {
  const old = Object.fromEntries(["game", "Actor", "ui"].map(key => [key, globalThis[key]]));
  const opened = [], created = [];
  const group = { type: "group", name: "Party Group Record", testUserPermission: () => true, sheet: { render: opts => opened.push(opts) } };
  const actors = [];
  globalThis.game = { user: { isGM: true }, actors };
  globalThis.Actor = { create: async data => { created.push(data); actors.push(group); return group; } };
  globalThis.ui = { notifications: { warn: () => assert.fail("GM can create a Group record") } };
  try {
    assert.equal(await openGroupRecord(), group);
    assert.deepEqual(created, [{ name: "Party Group Record", type: "group", ownership: { default: 2 } }]);
    assert.equal(await openGroupRecord(), group);
    assert.equal(created.length, 1);
    assert.deepEqual(opened, [{ force: true }, { force: true }]);
  } finally { for (const [key, value] of Object.entries(old)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
});

test("player launcher opens only a visible group and cannot create one", async () => {
  const old = Object.fromEntries(["game", "Actor", "ui"].map(key => [key, globalThis[key]]));
  const opened = [], warnings = [];
  const hidden = { type: "group", testUserPermission: () => false, sheet: { render: () => assert.fail("hidden") } };
  const visible = { type: "group", testUserPermission: () => true, sheet: { render: opts => opened.push(opts) } };
  globalThis.game = { user: { isGM: false }, actors: [hidden, visible] };
  globalThis.Actor = { create: () => assert.fail("player must not create") };
  globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
  try {
    assert.equal(await openGroupRecord(), visible);
    assert.deepEqual(opened, [{ force: true }]);
    game.actors = [hidden];
    assert.equal(await openGroupRecord(), null);
    assert.match(warnings[0], /GM.*group record/i);
  } finally { for (const [key, value] of Object.entries(old)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
});
