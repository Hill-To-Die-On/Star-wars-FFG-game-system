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

const token = (id, x, y, elevation = 0) => ({
  id,
  center: { x, y },
  document: { id, elevation, parent: { id: "scene-test" } },
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

test("scaled maps include token elevation and report sight-wall collisions", () => {
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  globalThis.CONFIG = {
    Canvas: {
      polygonBackends: {
        sight: {
          testCollision(origin, destination, options) {
            assert.deepEqual(origin, { x: 0, y: 0 });
            assert.deepEqual(destination, { x: 300, y: 400 });
            assert.equal(options.mode, "any");
            assert.equal(options.type, "sight");
            return true;
          },
        },
      },
    },
  };
  try {
    const result = measureTokenRange(
      token("source", 0, 0, 0),
      token("target", 300, 400, 12),
      { scene: map },
    );

    assert.equal(result.horizontalSceneDistance, 5);
    assert.equal(result.elevationDifference, 12);
    assert.equal(result.sceneDistance, 13);
    assert.equal(result.distancePx, 1300);
    assert.equal(result.elevationApplied, true);
    assert.equal(result.band, "medium");
    assert.equal(result.lineOfSight, "blocked");
    assert.equal(result.lineOfSightBlocked, true);
  } finally {
    delete globalThis.CONFIG;
  }
});

test("range service reports unavailable sight checks without inventing a result", () => {
  delete globalThis.CONFIG;
  const map = scene({
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    state: { scale: "personal", calibrations: {} },
  });
  const result = measureTokenRange(
    token("source", 0, 0),
    token("target", 300, 0),
    { scene: map },
  );

  assert.equal(result.lineOfSight, "unavailable");
  assert.equal(result.lineOfSightBlocked, null);
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
