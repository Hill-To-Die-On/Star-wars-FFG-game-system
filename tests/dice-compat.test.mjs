import test from "node:test";
import assert from "node:assert/strict";
import { registerDice } from "../src/dice/foundry.mjs";
test("v0.1 persisted narrative die classes still resolve after the visible rename", () => {
  const priorFoundry = globalThis.foundry,
    priorConfig = globalThis.CONFIG;
  try {
    const standard = class StandardDie {};
    globalThis.foundry = {
      dice: {
        terms: {
          Die: class {
            constructor(data) {
              Object.assign(this, data);
              this.options = {};
              this.results = [];
            }
          },
        },
      },
    };
    globalThis.CONFIG = {
      Dice: { terms: { d: standard }, termTypes: { Die: standard } },
    };
    registerDice();
    for (const name of [
      "Ability",
      "Proficiency",
      "Boost",
      "Difficulty",
      "Challenge",
      "Setback",
      "Force",
    ]) {
      const serializedClass = `Starfall${name}Die`;
      assert.equal(
        CONFIG.Dice.termTypes[serializedClass].name,
        serializedClass,
      );
    }
    assert.equal(CONFIG.Dice.terms.d, standard);
    const die = new CONFIG.Dice.termTypes.StarfallAbilityDie({});
    assert.equal(die.faces, 8);
    assert.equal(die.options.starfallDie, "ability");
  } finally {
    globalThis.foundry = priorFoundry;
    globalThis.CONFIG = priorConfig;
  }
});
