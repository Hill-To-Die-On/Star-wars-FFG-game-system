import test from "node:test";
import assert from "node:assert/strict";
import { registerDice } from "../src/dice/foundry.mjs";
import { DICE } from "../src/dice/core.mjs";
import { normalizeNarrativeTerm } from "../src/dice/compatibility.mjs";

test("saved narrative dice restore under their new classes without changing standard dice", () => {
  const priorFoundry = globalThis.foundry,
    priorConfig = globalThis.CONFIG;
  try {
    class RollTerm {
      static fromData(data) {
        const cls = CONFIG.Dice.termTypes[data.class] ?? Die;
        return new cls(data);
      }
    }
    class Die extends RollTerm {
      constructor(data) {
        super();
        Object.assign(this, data);
        this.options = data.options ?? {};
        this.results = data.results ?? [];
      }
    }
    globalThis.foundry = { dice: { terms: { Die, RollTerm } } };
    globalThis.CONFIG = { Dice: { terms: { d: Die }, termTypes: { Die } } };
    registerDice();
    const restore = RollTerm.fromData;
    registerDice();
    assert.equal(
      RollTerm.fromData,
      restore,
      "Restoration must only be wrapped once",
    );
    for (const [key, die] of Object.entries(DICE)) {
      const saved = {
        class: `Previous${die.label}Die`,
        faces: die.faces.length,
        options: { previousDie: key, flavor: "Existing check" },
        results: [{ result: 1, active: true }],
      };
      const restored = RollTerm.fromData(saved);
      assert.equal(restored.constructor.name, `StarWars${die.label}Die`);
      assert.equal(restored.options.starWarsDie, key);
      assert.equal(restored.options.flavor, "Existing check");
      assert.ok(!Object.hasOwn(restored.options, "previousDie"));
      assert.deepEqual(restored.results, saved.results);
      assert.equal(
        saved.class,
        `Previous${die.label}Die`,
        "Do not mutate persisted source data",
      );
    }
    assert.equal(CONFIG.Dice.terms.d, Die);
    assert.equal(
      RollTerm.fromData({ class: "Die", faces: 20 }).constructor,
      Die,
    );
    assert.equal(new CONFIG.Dice.termTypes.StarWarsAbilityDie({}).faces, 8);
  } finally {
    globalThis.foundry = priorFoundry;
    globalThis.CONFIG = priorConfig;
  }
});

test("unrelated and malformed dice data are not reinterpreted as narrative dice", () => {
  for (const data of [
    { class: "PreviousAbilityDie", faces: 8, options: {} },
    {
      class: "PreviousAbilityDie",
      faces: 20,
      options: { previousDie: "ability" },
    },
    { class: "Die", faces: 8, options: { previousDie: "ability" } },
    { class: "NumericTerm", number: 4 },
    {
      class: "StarWarsAbilityDie",
      faces: 8,
      options: { starWarsDie: "ability" },
    },
  ])
    assert.equal(normalizeNarrativeTerm(data), data);
});
