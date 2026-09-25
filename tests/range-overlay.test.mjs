import test from "node:test";
import assert from "node:assert/strict";
import {
  RANGE_BAND_ORDER,
  RANGE_SCALES,
  calibrationFromPointer,
  classifyRangeDistance,
  createRangeProfile,
  normalizeRangeScale,
  reconcileRangeOrigins,
} from "../src/range-overlay/core.mjs";

test("scaled personal scenes convert the configured map units into narrative bands", () => {
  const profile = createRangeProfile({
    scale: "personal",
    grid: { type: 1, size: 100, distance: 1, units: "m" },
    calibration: { anchorRadiusPx: 37 },
  });

  assert.equal(profile.mode, "map");
  assert.equal(profile.source, "scene-grid");
  assert.equal(profile.scale, "personal");
  assert.equal(profile.anchorBand, "short");
  assert.equal(profile.anchorRadiusPx, 600);
  assert.deepEqual(
    Object.fromEntries(profile.bands.map(({ id, radiusPx }) => [id, radiusPx])),
    {
      engaged: 100,
      short: 600,
      medium: 6000,
      long: 30000,
      extreme: 78000,
    },
  );
  assert.equal(profile.bands[1].distance, 6);
  assert.equal(profile.bands[1].units, "m");
});

test("battlefield and starship map scales use their distinct physical boundaries", () => {
  const battlefield = createRangeProfile({
    scale: "battlefield",
    grid: { type: 1, size: 100, distance: 1, units: "km" },
    calibration: { anchorRadiusPx: 999 },
  });
  const starship = createRangeProfile({
    scale: "vehicle",
    grid: { type: 1, size: 100, distance: 1, units: "km" },
  });

  assert.equal(battlefield.scale, "planetary");
  assert.equal(battlefield.anchorBand, "close");
  assert.deepEqual(
    battlefield.bands.map(({ id, radiusPx }) => [id, radiusPx]),
    [
      ["close", 500],
      ["short", 2400],
      ["medium", 5000],
      ["long", 20000],
      ["extreme", 35000],
    ],
  );
  assert.equal(starship.scale, "space");
  assert.deepEqual(
    starship.bands.map(({ id, radiusPx }) => [id, radiusPx]),
    [
      ["close", 3000],
      ["short", 10000],
      ["medium", 30000],
      ["long", 600000],
      ["extreme", 1200000],
    ],
  );
});

test("gridless scenes use a persisted pointer calibration and scale-specific bands", () => {
  const profile = createRangeProfile({
    scale: "personal",
    grid: { type: 0, size: 100, distance: 1, units: "m" },
    calibration: { anchorRadiusPx: 160 },
  });
  const battlefield = createRangeProfile({
    scale: "planetary",
    grid: { type: 0 },
    calibration: { anchorRadiusPx: 80 },
  });

  assert.equal(profile.mode, "theatre");
  assert.equal(profile.source, "scene-calibration");
  assert.deepEqual(
    Object.fromEntries(profile.bands.map(({ id, radiusPx }) => [id, radiusPx])),
    {
      engaged: 32,
      short: 160,
      medium: 320,
      long: 640,
      extreme: 1280,
    },
  );
  assert.equal(profile.bands.every((band) => band.distance === null), true);
  assert.deepEqual(
    battlefield.bands.map(({ id, radiusPx }) => [id, radiusPx]),
    [
      ["close", 80],
      ["short", 160],
      ["medium", 320],
      ["long", 640],
      ["extreme", 1280],
    ],
  );
});

test("an uncalibrated Theatre-of-the-Mind scene reports that no range profile exists", () => {
  assert.equal(
    createRangeProfile({
      scale: "personal",
      grid: { type: 0, size: 100, distance: 1 },
      calibration: null,
    }),
    null,
  );
});

test("pointer calibration measures from the selected origin and rejects accidental near-clicks", () => {
  assert.deepEqual(
    calibrationFromPointer(
      { x: 100, y: 150 },
      { x: 220, y: 240 },
      { minimumRadiusPx: 40, maximumRadiusPx: 1000 },
    ),
    { anchorRadiusPx: 150 },
  );
  assert.throws(
    () =>
      calibrationFromPointer(
        { x: 100, y: 100 },
        { x: 110, y: 110 },
        { minimumRadiusPx: 40 },
      ),
    /farther from the origin/i,
  );
});

test("distance classification is stable on boundaries and reports beyond Extreme", () => {
  const profile = createRangeProfile({
    scale: "personal",
    grid: { type: 0 },
    calibration: { anchorRadiusPx: 100 },
  });

  assert.deepEqual(
    [20, 21, 100, 101, 200, 201, 400, 401, 800, 801].map(
      (distance) => classifyRangeDistance(distance, profile).band,
    ),
    [
      "engaged",
      "short",
      "short",
      "medium",
      "medium",
      "long",
      "long",
      "extreme",
      "extreme",
      "beyond",
    ],
  );
  assert.deepEqual(RANGE_BAND_ORDER, [
    "engaged",
    "close",
    "short",
    "medium",
    "long",
    "extreme",
  ]);
});

test("scale aliases preserve user terminology while exposing canonical rule contexts", () => {
  assert.equal(normalizeRangeScale("person"), "personal");
  assert.equal(normalizeRangeScale("vehicle"), "space");
  assert.equal(normalizeRangeScale("battlefield"), "planetary");
  assert.deepEqual(Object.keys(RANGE_SCALES), [
    "personal",
    "space",
    "planetary",
  ]);
});

test("single-origin selection follows the latest token while multi-origin selection accumulates", () => {
  assert.deepEqual(
    reconcileRangeOrigins(["one"], { tokenId: "two", controlled: true }),
    ["two"],
  );
  assert.deepEqual(
    reconcileRangeOrigins(
      ["one"],
      { tokenId: "two", controlled: true, multi: true },
    ),
    ["one", "two"],
  );
  assert.deepEqual(
    reconcileRangeOrigins(
      ["one", "two"],
      { tokenId: "one", controlled: false, multi: true },
    ),
    ["one", "two"],
  );
  assert.deepEqual(
    reconcileRangeOrigins(
      ["one", "two"],
      { tokenId: "two", controlled: false, controlledIds: [] },
    ),
    [],
  );
});
