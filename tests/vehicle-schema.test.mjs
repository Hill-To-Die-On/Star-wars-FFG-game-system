import test from "node:test";
import assert from "node:assert/strict";
import { VEHICLE_ICON_ARCHETYPES } from "../src/actor-icons.mjs";

test("vehicle schema accepts every hull offered by the sheet and legacy choices", async () => {
  const previous = globalThis.foundry;
  class Field {
    constructor(options = {}) { this.options = options; }
  }
  globalThis.foundry = {
    data: { fields: new Proxy({}, { get: () => Field }) },
    abstract: { TypeDataModel: class {} },
  };
  try {
    const { VehicleData, CharacterData } = await import("../src/models.mjs");
    for (const model of [CharacterData, VehicleData]) {
      assert.deepEqual(model.defineSchema().metadata?.options.initial, {}, `${model.name} must persist homebrew identity metadata`);
    }
    const choices = VehicleData.defineSchema().footprint.options.hull.options.choices;
    const hulls = Object.keys(VEHICLE_ICON_ARCHETYPES);
    assert.ok(hulls.length >= 20, "Exercise the complete hull menu");
    for (const hull of ["auto", "capital", "speeder", ...hulls]) {
      assert.ok(choices.includes(hull), `Vehicle sheet cannot save hull: ${hull}`);
    }
    assert.ok(!choices.includes("invented-hull"), "Unknown values stay invalid");
  } finally {
    globalThis.foundry = previous;
  }
});
