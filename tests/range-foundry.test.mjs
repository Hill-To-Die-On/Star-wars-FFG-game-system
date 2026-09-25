import test from "node:test";
import assert from "node:assert/strict";
import {
  addRangeSceneControl,
  getSceneRangeProfile,
  measureTokenRange,
} from "../src/range-overlay/foundry.mjs";

const scene = ({ grid, state }) => ({
  id: "scene-test",
  grid,
  getFlag: () => state,
});

const token = (id, x, y) => ({
  id,
  center: { x, y },
  document: { id, parent: { id: "scene-test" } },
});

test("Foundry range service returns one machine-readable band for sheets and DoR", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const profile = getSceneRangeProfile(map);
  const result = measureTokenRange(token("source", 0, 0), token("target", 300, 0), {
    scene: map,
  });

  assert.equal(profile.scale, "personal");
  assert.deepEqual(
    {
      available: result.available,
      band: result.band,
      label: result.label,
      mode: result.profileMode,
      scale: result.scale,
      sceneDistance: result.sceneDistance,
      units: result.units,
    },
    {
      available: true,
      band: "short",
      label: "Short",
      mode: "map",
      scale: "personal",
      sceneDistance: 3,
      units: "m",
    },
  );
});

test("Foundry range service fails closed on an uncalibrated ToM scene", () => {
  const theatre = scene({
    grid: { type: 0, size: 100, distance: 1, units: "m" },
    state: { scale: "battlefield", calibrations: {} },
  });
  const result = measureTokenRange(token("source", 0, 0), token("target", 30, 0), {
    scene: theatre,
  });

  assert.equal(result.available, false);
  assert.equal(result.scale, "planetary");
  assert.match(result.reason, /not been calibrated/i);
});

test("range control keeps the token layer active without reopening Token Controls", () => {
  let activations = 0;
  globalThis.game = {
    user: { isGM: true },
    settings: { get: () => false },
  };
  globalThis.canvas = {
    scene: scene({
      grid: { type: 1, size: 100, distance: 1, units: "m" },
      state: { scale: "personal", calibrations: {} },
    }),
    tokens: {
      active: true,
      activate: () => activations++,
    },
  };

  const controls = {};
  addRangeSceneControl(controls);
  controls.starWarsRange.onChange({}, true);

  assert.equal(activations, 0);
  assert.equal(controls.starWarsRange.activeTool, "rangeSelect");
  assert.ok(controls.starWarsRange.tools.rangeVisible.toggle);
});
