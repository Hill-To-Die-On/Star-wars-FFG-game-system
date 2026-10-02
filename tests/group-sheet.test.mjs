import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { THEMES } from "../src/config.mjs";
import { motivationSummary } from "../src/motivations.mjs";

// group-sheet.mjs subclasses Foundry's sheet classes as it loads.
class ActorSheetV2 {
  async _prepareContext() {
    return { fromFoundry: true };
  }
  _onRender() {
    this.renderedByFoundry = true;
  }
  async submit() {
    this.submitted = (this.submitted ?? 0) + 1;
  }
}
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: (Base) => class extends Base {} },
    sheets: { ActorSheetV2 },
  },
  utils: { randomID: () => "NewMember0000001" },
};
const { GroupSheet, refreshGroupSheets } = await import("../src/group-sheet.mjs");

function character(id, name, { observer = true, opened = [] } = {}) {
  return {
    id,
    name,
    type: "character",
    system: {
      obligation: { value: 10, label: "Debt" },
      duty: { value: 5, label: "Support" },
      morality: { value: 60 },
      motivations: [{ name: "Protect the crew", category: "Relationship" }],
    },
    testUserPermission(user, level) {
      assert.equal(user, game.user);
      assert.equal(level, "OBSERVER");
      return observer;
    },
    sheet: { render: (options) => opened.push({ id, options }) },
  };
}

const ship = { id: "ship", name: "Wayfarer", type: "vehicle", testUserPermission: () => true };

// A Group sheet over a world holding `actors`; returns the calls it asserts on.
function openGroup({ members = {}, actors = [], theme = "auto", editable = true } = {}) {
  const calls = { updates: [], info: [], consoles: 0 },
    world = new Map(actors.map((actor) => [actor.id, actor]));
  globalThis.game = {
    user: { id: "player" },
    actors: Object.assign([...world.values()], { get: (id) => world.get(id) }),
    settings: {
      get: (scope, key) =>
        ({
          campaign: { lines: ["age"] },
          sheetTheme: "auto",
          destiny: { light: 2, dark: 3 },
        })[key],
    },
    system: {
      api: {
        openConsole() {
          calls.consoles += 1;
          return "console";
        },
      },
    },
  };
  globalThis.ui = { notifications: { info: (message) => calls.info.push(message) } };
  const sheet = new GroupSheet();
  sheet.actor = {
    type: "group",
    system: { theme, base: { name: "Waystation" }, members, credits: 2500 },
    update: async (changes) => calls.updates.push(changes),
  };
  sheet.isEditable = editable;
  sheet.element = { dataset: {} };
  return { sheet, calls };
}

const member = (dataset) => ({ dataset: { member: dataset } });

test("the sheet declares its actions and a template that exists", async () => {
  assert.deepEqual(Object.keys(GroupSheet.DEFAULT_OPTIONS.actions), [
    "addMember",
    "removeMember",
    "syncMembers",
    "openMember",
    "destiny",
    "chooseAsset",
    "openAsset",
    "recordResource",
  ]);
  assert.equal(GroupSheet.DEFAULT_OPTIONS.actions.syncMembers, GroupSheet.syncMembers);
  assert.equal(GroupSheet.PARTS.sheet.template, "systems/star-wars-ffg/templates/group.hbs");
  await access("templates/group.hbs");
});

test("member pickers list only characters the user can observe and never name a hidden link", async () => {
  const ria = character("ria", "Ria Vale"),
    hidden = character("hidden", "Hidden Operative", { observer: false }),
    { sheet } = openGroup({
      actors: [ria, hidden, ship],
      members: {
        m1: { characterName: "Ria", actorId: "ria", obligation: 10 },
        m2: { characterName: "Agent", actorId: "hidden", obligation: 5 },
        m3: { characterName: "Newcomer", actorId: "" },
      },
    }),
    context = await sheet._prepareContext({});
  assert.equal(context.fromFoundry, true);
  assert.equal(context.obligationTotal, 15);
  assert.deepEqual(context.destiny, { light: 2, dark: 3 });

  const [linked, secret, unlinked] = context.members;
  assert.deepEqual(linked.characters, [{ id: "ria", name: "Ria Vale", selected: true }]);
  assert.equal(linked.linked, true);
  assert.deepEqual(secret.characters, [
    { id: "ria", name: "Ria Vale", selected: false },
    { id: "hidden", name: "Unavailable linked character", selected: true },
  ]);
  assert.equal(secret.linked, false);
  assert.ok(!JSON.stringify(context.members).includes("Hidden Operative"));
  assert.deepEqual(unlinked.characters, [{ id: "ria", name: "Ria Vale", selected: false }]);
  assert.equal(unlinked.linked, false);
});

test("the theme follows the campaign unless the Group chooses one, and render applies it", async () => {
  const automatic = await openGroup().sheet._prepareContext({});
  assert.equal(automatic.themeKey, "rebellion");
  assert.equal(automatic.theme, THEMES.rebellion);
  assert.equal(automatic.themes.auto, "Automatic · Rebellion");
  assert.equal(automatic.themes.mystic, "Mystic");

  const { sheet } = openGroup({ theme: "mystic" }),
    chosen = await sheet._prepareContext({});
  assert.equal(chosen.themeKey, "mystic");
  sheet._onRender(chosen, {});
  assert.equal(sheet.element.dataset.theme, "mystic");
  assert.equal(sheet.renderedByFoundry, true);
});

test("members are added and removed only on an editable sheet", async () => {
  const members = { m1: { characterName: "Ria" } },
    readOnly = openGroup({ members, editable: false });
  await GroupSheet.addMember.call(readOnly.sheet);
  await GroupSheet.removeMember.call(readOnly.sheet, null, member("m1"));
  assert.deepEqual(readOnly.calls.updates, []);
  assert.equal(readOnly.sheet.submitted, undefined);

  const { sheet, calls } = openGroup({ members });
  await GroupSheet.addMember.call(sheet);
  assert.equal(sheet.submitted, 1);
  await GroupSheet.removeMember.call(sheet, null, member("missing"));
  await GroupSheet.removeMember.call(sheet, null, member("m1"));
  assert.deepEqual(calls.updates, [
    { "system.members.NewMember0000001": { characterName: "New member" } },
    { "system.members.-=m1": null },
  ]);
});

test("sync copies details only from linked characters the user can observe", async () => {
  const ria = character("ria", "Ria Vale"),
    hidden = character("hidden", "Hidden Operative", { observer: false }),
    { sheet, calls } = openGroup({
      actors: [ria, hidden, ship],
      members: {
        a: { characterName: "Old name", actorId: "ria", notes: "Pilot" },
        b: { characterName: "Agent", actorId: "hidden" },
        c: { characterName: "Ship", actorId: "ship" },
        d: { characterName: "Newcomer", actorId: "" },
      },
    });
  await GroupSheet.syncMembers.call(sheet);
  assert.equal(sheet.submitted, 1);
  assert.deepEqual(calls.updates, [
    {
      "system.members.a": {
        characterName: "Ria Vale",
        actorId: "ria",
        notes: "Pilot",
        obligation: 10,
        obligationType: "Debt",
        motivation: motivationSummary(ria.system),
        duty: 5,
        dutyType: "Support",
        morality: 60,
      },
    },
  ]);

  const nothingToSync = openGroup({ actors: [hidden], members: { b: { actorId: "hidden" } } });
  await GroupSheet.syncMembers.call(nothingToSync.sheet);
  assert.deepEqual(nothingToSync.calls.updates, []);
  assert.deepEqual(nothingToSync.calls.info, [
    "Choose a linked character for at least one member first.",
  ]);

  const readOnly = openGroup({ actors: [ria], members: { a: { actorId: "ria" } }, editable: false });
  await GroupSheet.syncMembers.call(readOnly.sheet);
  assert.deepEqual(readOnly.calls.updates, []);
  assert.deepEqual(readOnly.calls.info, []);
});

test("members open only when the user can observe them, and Destiny opens the console", () => {
  const opened = [],
    { sheet, calls } = openGroup({
      actors: [
        character("ria", "Ria Vale", { opened }),
        character("hidden", "Hidden Operative", { observer: false, opened }),
      ],
      members: { a: { actorId: "ria" }, b: { actorId: "hidden" } },
    });
  GroupSheet.openMember.call(sheet, null, member("a"));
  GroupSheet.openMember.call(sheet, null, member("b"));
  GroupSheet.openMember.call(sheet, null, member("missing"));
  assert.deepEqual(opened, [{ id: "ria", options: { force: true } }]);
  assert.equal(GroupSheet.destiny.call(sheet), "console");
  assert.equal(calls.consoles, 1);
});

test("refreshing re-renders only open Group sheets", () => {
  const rendered = [],
    app = (isOpen, name) => ({ rendered: isOpen, render: () => rendered.push(name) });
  globalThis.game = {
    actors: [
      { type: "group", apps: { 1: app(true, "open group"), 2: app(false, "closed group") } },
      { type: "character", apps: { 3: app(true, "open character") } },
    ],
  };
  refreshGroupSheets();
  assert.deepEqual(rendered, ["open group"]);
  globalThis.game = {};
  assert.doesNotThrow(refreshGroupSheets);
});
