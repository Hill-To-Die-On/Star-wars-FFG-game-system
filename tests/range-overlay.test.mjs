import test from "node:test";
import assert from "node:assert/strict";
import {
  RANGE_BAND_ORDER,
  RANGE_SCALES,
  buildAttackTraceSegments,
  calibrationFromPointer,
  chooseAttackTraceLabelLayout,
  chooseRangeLabelLayout,
  classifyRangeDistance,
  createRangeProfile,
  farthestViewportCornerAngle,
  inferCombatRangeScale,
  interpolateRangeLabelAngle,
  normalizeRangeScale,
  pauseBannerScreenBounds,
  reconcileRangeOrigins,
  segmentEllipseIntersection,
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

test("range labels roll around a band to remain inside the visible viewport", () => {
  const viewport = { left: 0, top: 0, right: 800, bottom: 600 };
  const layout = chooseRangeLabelLayout({
    origin: { x: 760, y: 120 },
    radius: 180,
    viewport,
    size: { width: 120, height: 28 },
    preferredAngle: -Math.PI / 4,
  });

  assert.ok(layout);
  assert.equal(layout.onArc, true);
  assert.ok(layout.bounds.left >= 12);
  assert.ok(layout.bounds.right <= 788);
  assert.ok(layout.bounds.top >= 12);
  assert.ok(layout.bounds.bottom <= 588);
  assert.ok(
    Math.abs(Math.hypot(layout.x - 760, layout.y - 120) - 180) < 0.001,
  );
});

test("range labels share the ray from their origin to the furthest viewport corner", () => {
  const origin = { x: 160, y: 120 };
  const viewport = { left: 0, top: 0, right: 800, bottom: 600 };
  const preferredAngle = farthestViewportCornerAngle(origin, viewport);
  assert.ok(
    Math.abs(preferredAngle - Math.atan2(480, 640)) < 0.000001,
  );

  const currentAngle = Math.PI * 0.82;
  const layouts = [120, 240].map((radius) =>
    chooseRangeLabelLayout({
      origin,
      radius,
      viewport,
      size: { width: 100, height: 24 },
      preferredAngle,
      currentAngle,
    }),
  );

  assert.ok(layouts.every(Boolean));
  assert.ok(layouts.every((layout) => layout.onArc));
  assert.ok(
    layouts.every(
      (layout) => Math.abs(layout.angle - preferredAngle) < 0.000001,
    ),
  );
});

test("range labels slide along their own arc to repel actor and prop bounds", () => {
  const origin = { x: 400, y: 300 };
  const preferredAngle = 0;
  const occupied = [{ left: 515, top: 272, right: 650, bottom: 328 }];
  const layout = chooseRangeLabelLayout({
    origin,
    radius: 180,
    viewport: { left: 0, top: 0, right: 800, bottom: 600 },
    size: { width: 100, height: 24 },
    preferredAngle,
    currentAngle: preferredAngle,
    occupied,
  });

  assert.ok(layout);
  assert.equal(layout.onArc, true);
  assert.ok(Math.abs(layout.angle - preferredAngle) > 0.01);
  assert.ok(
    Math.abs(Math.hypot(layout.x - origin.x, layout.y - origin.y) - 180) <
      0.001,
  );
  assert.equal(
    Math.max(
      0,
      Math.min(layout.bounds.right, occupied[0].right) -
        Math.max(layout.bounds.left, occupied[0].left),
    ) *
      Math.max(
        0,
        Math.min(layout.bounds.bottom, occupied[0].bottom) -
          Math.max(layout.bounds.top, occupied[0].top),
      ),
    0,
  );
});

test("range labels stay visible when a band contains the whole viewport", () => {
  const layout = chooseRangeLabelLayout({
    origin: { x: 400, y: 300 },
    radius: 1200,
    viewport: { left: 0, top: 0, right: 800, bottom: 600 },
    size: { width: 100, height: 24 },
  });

  assert.ok(layout);
  assert.equal(layout.onArc, false);
  assert.ok(layout.bounds.left >= 12);
  assert.ok(layout.bounds.right <= 788);
  assert.ok(layout.bounds.top >= 12);
  assert.ok(layout.bounds.bottom <= 588);
  assert.ok(layout.leaderPoint);
});

test("range labels remain hidden when the band itself is completely off screen", () => {
  assert.equal(
    chooseRangeLabelLayout({
      origin: { x: -500, y: -500 },
      radius: 100,
      viewport: { left: 0, top: 0, right: 800, bottom: 600 },
      size: { width: 100, height: 24 },
    }),
    null,
  );
});

test("range label animation takes the short route across the angle boundary", () => {
  const from = (170 * Math.PI) / 180;
  const to = (-170 * Math.PI) / 180;
  const halfway = interpolateRangeLabelAngle(from, to, 0.5);

  assert.ok(Math.abs(Math.abs(halfway) - Math.PI) < 0.000001);
  assert.equal(interpolateRangeLabelAngle(from, to, 1), to);
});

test("combat range inference handles clear personal and vehicle encounters", () => {
  assert.equal(
    inferCombatRangeScale([{ actor: { type: "character" } }, { actor: { type: "nemesis" } }]),
    "personal",
  );
  assert.equal(
    inferCombatRangeScale([{ actor: { type: "vehicle" } }, { actor: { type: "vehicle" } }]),
    "space",
  );
  assert.equal(
    inferCombatRangeScale([{ actor: { type: "character" } }, { actor: { type: "vehicle" } }]),
    null,
  );
  assert.equal(inferCombatRangeScale([]), null);
});

test("attack traces find the first edge of an intervening token", () => {
  const hit = segmentEllipseIntersection(
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 200, y: 0, radiusX: 50, radiusY: 40 },
  );

  assert.ok(hit);
  assert.equal(hit.progress, 0.375);
  assert.deepEqual(hit.point, { x: 150, y: 0 });
  assert.equal(
    segmentEllipseIntersection(
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 200, y: 100, radiusX: 20, radiusY: 20 },
    ),
    null,
  );
});

test("attack trace geometry draws solid to a blocker and dotted thereafter", () => {
  const direct = buildAttackTraceSegments({
    source: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
    progress: 0.5,
  });
  assert.deepEqual(direct, [
    {
      style: "solid",
      from: { x: 0, y: 0 },
      to: { x: 50, y: 0 },
    },
  ]);

  const blocked = buildAttackTraceSegments({
    source: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
    obstruction: { point: { x: 40, y: 0 }, progress: 0.4 },
    progress: 1,
    dashLength: 10,
    gapLength: 5,
  });
  assert.deepEqual(blocked[0], {
    style: "solid",
    from: { x: 0, y: 0 },
    to: { x: 40, y: 0 },
  });
  assert.deepEqual(blocked[1], {
    style: "dotted",
    from: { x: 40, y: 0 },
    to: { x: 50, y: 0 },
  });
  assert.equal(blocked.at(-1).style, "dotted");
  assert.ok(blocked.at(-1).to.x <= 100);
  assert.ok(blocked.some((segment) => segment.from.x > 40));
});

test("attack trace labels choose a visible side of the line away from UI overlays", () => {
  const pauseBanner = { left: 320, top: 250, right: 680, bottom: 350 };
  const layout = chooseAttackTraceLabelLayout({
    source: { x: 100, y: 300 },
    target: { x: 900, y: 300 },
    size: { width: 420, height: 90 },
    viewport: { left: 0, top: 0, right: 1000, bottom: 700 },
    occupied: [pauseBanner],
  });

  assert.ok(layout);
  assert.ok(layout.bounds.left >= 12);
  assert.ok(layout.bounds.right <= 988);
  assert.ok(layout.bounds.top >= 12);
  assert.ok(layout.bounds.bottom <= 688);
  assert.ok(
    layout.bounds.bottom <= pauseBanner.top ||
      layout.bounds.top >= pauseBanner.bottom ||
      layout.bounds.right <= pauseBanner.left ||
      layout.bounds.left >= pauseBanner.right,
  );
});

test("paused scenes reserve the central Foundry canvas area for its banner", () => {
  assert.deepEqual(pauseBannerScreenBounds({ width: 1500, height: 1000 }), {
    left: 570,
    top: 380,
    right: 930,
    bottom: 630,
  });
  assert.equal(pauseBannerScreenBounds({ width: 0, height: 1000 }), null);
});
