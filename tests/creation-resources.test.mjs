import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStartingLoadout,
  creationResourcePlan,
  finalizePocketMoney,
  startingEquipmentOptions,
} from "../src/creation-resources.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";

const item = ({
  id,
  name = id,
  type = "gear",
  price = 100,
  restricted = false,
  book = "Edge of The Empire - Core Book",
  incomplete = [],
  scale = "personal",
}) => ({
  _id: id,
  id,
  name,
  type,
  system: {
    price,
    restricted,
    incomplete,
    scale,
    source: { book, page: "1" },
  },
});

test("Edge and Age packages combine distinct source options within the party-size cap", () => {
  const edge = creationResourcePlan({
    line: "edge",
    partySize: 4,
    choices: ["xp-5", "credits-1000"],
  });
  assert.equal(edge.xpBonus, 5);
  assert.equal(edge.cashBudget, 1500);
  assert.deepEqual(edge.story, {
    mechanic: "obligation",
    base: 10,
    delta: 10,
    value: 20,
  });
  assert.deepEqual(edge.source.pages, ["40", "97"]);

  const age = creationResourcePlan({
    line: "age",
    partySize: 3,
    choices: ["xp-10", "credits-1000"],
    ageStartingResource: "base",
  });
  assert.equal(age.xpBonus, 10);
  assert.equal(age.cashBudget, 1500);
  assert.equal(age.gearGrant, 1000);
  assert.deepEqual(age.story, {
    mechanic: "duty",
    base: 15,
    delta: -15,
    value: 0,
  });
  assert.deepEqual(age.source.pages, ["46", "108", "111"]);

  assert.throws(
    () =>
      creationResourcePlan({
        line: "edge",
        partySize: 4,
        choices: ["xp-10", "credits-1000"],
      }),
    /original starting Obligation/i,
  );
  assert.throws(
    () =>
      creationResourcePlan({
        line: "age",
        partySize: 4,
        choices: ["xp-5", "xp-5"],
      }),
    /once/i,
  );
});

test("Force creation accepts exactly one source option and preserves the morality direction", () => {
  const split = creationResourcePlan({
    line: "force",
    partySize: 4,
    choices: ["xp-5-credits-1000"],
  });
  assert.equal(split.xpBonus, 5);
  assert.equal(split.cashBudget, 1500);
  assert.equal(split.story.value, 50);
  assert.deepEqual(split.source.pages, ["49", "107"]);

  assert.equal(
    creationResourcePlan({
      line: "force",
      partySize: 4,
      choices: ["morality-light"],
    }).story.value,
    71,
  );
  assert.equal(
    creationResourcePlan({
      line: "force",
      partySize: 4,
      choices: ["morality-dark"],
    }).story.value,
    29,
  );
  assert.throws(
    () =>
      creationResourcePlan({
        line: "force",
        partySize: 4,
        choices: ["xp-10", "credits-2500"],
      }),
    /one Force and Destiny option/i,
  );
});

test("starting equipment is database-backed, book-filtered and budgeted without turning a base grant into cash", () => {
  const campaign = {
    ...DEFAULT_CAMPAIGN,
    bookMode: "owned",
    books: ["Edge of The Empire - Core Book"],
  };
  const options = startingEquipmentOptions(
    [
      item({ id: "kit", name: "Field kit", price: 900 }),
      item({ id: "sidearm", name: "Sidearm", type: "weapon", price: 300 }),
      item({ id: "permit", restricted: true, price: 50 }),
      item({ id: "unknown", price: 0, incomplete: ["price not recorded"] }),
      item({ id: "vehicle-gun", type: "weapon", scale: "vehicle" }),
      item({ id: "other-book", book: "Unowned book" }),
      item({ id: "talent", type: "talent" }),
    ],
    campaign,
  );
  assert.deepEqual(
    options.map(({ id }) => id),
    ["kit", "permit", "sidearm"],
  );

  const plan = buildStartingLoadout({
    options,
    selections: [
      { id: "kit", quantity: 1 },
      { id: "sidearm", quantity: 1 },
    ],
    cashBudget: 500,
    gearGrant: 1000,
  });
  assert.equal(plan.cost, 1200);
  assert.equal(plan.credits, 300);
  assert.equal(plan.gearGrantUnused, 0);
  assert.throws(
    () =>
      buildStartingLoadout({
        options,
        selections: [{ id: "permit", quantity: 1 }],
        cashBudget: 500,
      }),
    /GM approval/i,
  );
  assert.equal(
    buildStartingLoadout({
      options,
      selections: [{ id: "permit", quantity: 1 }],
      cashBudget: 500,
      allowRestricted: true,
    }).credits,
    450,
  );
});

test("pocket money can be applied once after the starting loadout", () => {
  const current = {
    credits: 300,
    creation: { applied: true, pocketMoneyPending: true },
  };
  const update = finalizePocketMoney(current, 73);
  assert.equal(update.credits, 373);
  assert.equal(update.creation.pocketMoney, 73);
  assert.equal(update.creation.pocketMoneyPending, false);
  assert.throws(() => finalizePocketMoney(update, 20), /already/i);
  assert.throws(() => finalizePocketMoney(current, 0), /1 and 100/i);
});

test("resource plans reject unsupported lines, options and party sizes", () => {
  assert.throws(() => creationResourcePlan({ line: "clone-wars" }), /supported creation rule line/);
  assert.throws(
    () => creationResourcePlan({ line: "edge", choices: "xp-5" }),
    /choices must be a list/,
  );
  assert.throws(
    () => creationResourcePlan({ line: "edge", choices: ["morality-light"] }),
    /only starting resource options from the selected rule line/,
  );
  for (const partySize of [1, 2.5, "four"])
    assert.throws(
      () => creationResourcePlan({ line: "edge", partySize }),
      /Party size must be at least 2/,
    );
  assert.throws(
    () => creationResourcePlan({ line: "age", ageStartingResource: "star-destroyer" }),
    /supported Age of Rebellion group resource/,
  );
});

test("parties larger than the printed table start at 5 Obligation or Duty", () => {
  const large = creationResourcePlan({ line: "edge", partySize: 7 });
  assert.deepEqual(large.story, { mechanic: "obligation", base: 5, delta: 0, value: 5 });
  assert.throws(
    () => creationResourcePlan({ line: "edge", partySize: 7, choices: ["xp-10"] }),
    /exceed the original starting Obligation value/,
  );
  const force = creationResourcePlan({ line: "force", choices: ["standard"] });
  assert.deepEqual(force.story, { mechanic: "morality", base: 50, delta: 0, value: 50 });
});

test("equipment options accept either ID field, skip unnamed entries and sort ties by book, then ID", () => {
  const unsourced = item({ id: "Comlink0000000002", name: "Comlink" });
  delete unsourced.system.source;
  delete unsourced.system.incomplete;
  const legacy = { ...item({ id: "Comlink0000000003", name: "Comlink" }), id: undefined };
  const options = startingEquipmentOptions(
    [
      item({ id: "Comlink0000000004", name: "Comlink", book: "Age of Rebellion - Core Book" }),
      legacy,
      unsourced,
      item({ id: "Comlink0000000001", name: "Comlink", book: "Age of Rebellion - Core Book" }),
      { ...item({ id: "Unnamed000000001" }), name: "  " },
      { ...item({ id: "Nameless00000001" }), name: undefined },
      { ...item({ id: "NoIds00000000001" }), id: undefined, _id: undefined },
    ],
    DEFAULT_CAMPAIGN,
  );
  assert.deepEqual(
    options.map(({ id, source }) => [id, source.book]),
    [
      ["Comlink0000000002", ""],
      ["Comlink0000000001", "Age of Rebellion - Core Book"],
      ["Comlink0000000004", "Age of Rebellion - Core Book"],
      ["Comlink0000000003", "Edge of The Empire - Core Book"],
    ],
  );
  assert.deepEqual(startingEquipmentOptions(undefined, DEFAULT_CAMPAIGN), []);
});

test("starting loadouts refuse invalid budgets, selections and quantities", () => {
  const options = [
      { id: "kit", name: "Field kit", price: 100, restricted: false },
      { id: "rope", name: "Rope", price: 10, restricted: false },
    ],
    build = (changes) =>
      buildStartingLoadout({ options, cashBudget: 500, selections: [], ...changes });
  for (const cashBudget of [-1, 2.5, "lots"])
    assert.throws(() => build({ cashBudget }), /Starting credit budget must be a non-negative whole number/);
  assert.throws(() => build({ gearGrant: -5 }), /Starting gear grant must be a non-negative whole number/);
  assert.throws(
    () => build({ options: [...options, { ...options[0] }] }),
    /require unique database IDs/,
  );
  assert.throws(() => build({ selections: { id: "kit" } }), /selections must be a list/);
  for (const selection of [{ id: "blaster", quantity: 1 }, null])
    assert.throws(
      () => build({ selections: [selection] }),
      /Choose starting equipment from the available database entries/,
    );
  assert.throws(
    () => build({ selections: [{ id: "kit", quantity: 1 }, { id: "kit", quantity: 2 }] }),
    /Combine duplicate equipment into one quantity/,
  );
  for (const quantity of [0, 100, 1.5, "two"])
    assert.throws(
      () => build({ selections: [{ id: "rope", quantity }] }),
      /quantity must be between 1 and 99/,
    );
  assert.deepEqual(build({ options: undefined }).items, []);
});

test("starting loadouts stay within the allowance and never overflow the cost", () => {
  const options = [
    { id: "kit", name: "Field kit", price: 100, restricted: false },
    { id: "huge", name: "Capital hull", price: Number.MAX_SAFE_INTEGER, restricted: false },
    { id: "half", name: "Half hull", price: 2 ** 52, restricted: false },
    { id: "half-b", name: "Other half hull", price: 2 ** 52, restricted: false },
  ];
  assert.throws(
    () =>
      buildStartingLoadout({ options, cashBudget: 500, selections: [{ id: "kit", quantity: 6 }] }),
    /exceeds the 500-credit allowance/,
  );
  assert.throws(
    () =>
      buildStartingLoadout({
        options,
        cashBudget: 500,
        gearGrant: 1000,
        selections: [{ id: "kit", quantity: 16 }],
      }),
    /exceeds the 1500-credit allowance/,
  );
  assert.throws(
    () =>
      buildStartingLoadout({ options, cashBudget: 500, selections: [{ id: "huge", quantity: 2 }] }),
    /cost is too large/,
  );
  assert.throws(
    () =>
      buildStartingLoadout({
        options,
        cashBudget: 500,
        selections: [
          { id: "half", quantity: 1 },
          { id: "half-b", quantity: 1 },
        ],
      }),
    /cost is too large/,
  );
  const exact = buildStartingLoadout({
    options,
    cashBudget: 500,
    gearGrant: 1000,
    selections: [{ id: "kit", quantity: 15 }],
  });
  assert.deepEqual(
    [exact.cost, exact.gearGrantUsed, exact.cashSpent, exact.credits],
    [1500, 1000, 500, 0],
  );
});
