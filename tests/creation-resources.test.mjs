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
