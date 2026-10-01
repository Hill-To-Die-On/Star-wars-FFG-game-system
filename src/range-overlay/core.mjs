import { footprintBoundaryPoint, measureFootprintGap, rangeFootprint } from "./footprints.mjs";

export const RANGE_BAND_ORDER = Object.freeze([
  "engaged",
  "close",
  "short",
  "medium",
  "long",
  "extreme",
]);

const COLORS = Object.freeze({
  engaged: 0xe85d4a,
  close: 0xef7d4d,
  short: 0xf0c54d,
  medium: 0x4dc6b7,
  long: 0x4d8ee8,
  extreme: 0xa879e8,
});

const band = (id, maxMeters, calibrationRatio, relativeGridSpaces) =>
  Object.freeze({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    color: COLORS[id],
    maxMeters,
    calibrationRatio,
    relativeGridSpaces,
  });

// The numeric boundaries are compact mechanical data derived from The User's
// supplied range reference. No source prose or page art is distributed.
export const RANGE_SCALES = Object.freeze({
  personal: Object.freeze({
    id: "personal",
    label: "Personal",
    menuLabel: "Personal",
    anchorBand: "short",
    bands: Object.freeze([
      band("engaged", 1, 0.2, 1),
      band("short", 6, 1, 5),
      band("medium", 60, 2, 10),
      band("long", 300, 4, 20),
      band("extreme", 780, 8, 40),
    ]),
  }),
  space: Object.freeze({
    id: "space",
    label: "Ship / vehicle / space",
    menuLabel: "Ship / vehicle",
    anchorBand: "close",
    bands: Object.freeze([
      band("close", 30_000, 1, 1),
      band("short", 100_000, 2, 3),
      band("medium", 300_000, 4, 10),
      band("long", 6_000_000, 8, 20),
      band("extreme", 12_000_000, 16, 40),
    ]),
  }),
  planetary: Object.freeze({
    id: "planetary",
    label: "Battlefield / planetary",
    menuLabel: "Battlefield",
    anchorBand: "close",
    bands: Object.freeze([
      band("close", 5_000, 1, 1),
      band("short", 24_000, 2, 5),
      band("medium", 50_000, 4, 10),
      band("long", 200_000, 8, 20),
      band("extreme", 350_000, 16, 40),
    ]),
  }),
});

const SCALE_ALIASES = Object.freeze({
  person: "personal",
  character: "personal",
  ship: "space",
  starship: "space",
  vehicle: "space",
  battlefield: "planetary",
  ground: "planetary",
  surface: "planetary",
});

const METERS_PER_UNIT = Object.freeze({
  mm: 0.001,
  cm: 0.01,
  m: 1,
  meter: 1,
  meters: 1,
  metre: 1,
  metres: 1,
  km: 1000,
  kilometer: 1000,
  kilometers: 1000,
  kilometre: 1000,
  kilometres: 1000,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
});

const finitePositive = (value) =>
  Number.isFinite(Number(value)) && Number(value) > 0;

export function normalizeRangeScale(value = "personal") {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();
  const normalized = SCALE_ALIASES[key] ?? key;
  return normalized in RANGE_SCALES ? normalized : "personal";
}

export function hasSceneScaleReference(grid = {}) {
  return (
    Number(grid.type) !== 0 &&
    finitePositive(grid.size) &&
    finitePositive(grid.distance)
  );
}

function mapBands(definition, grid) {
  const size = Number(grid.size);
  const gridDistance = Number(grid.distance);
  const units = String(grid.units ?? "").trim();
  const metersPerUnit = METERS_PER_UNIT[units.toLowerCase()];
  const physical = finitePositive(metersPerUnit);
  return definition.bands.map((entry) => {
    const distance = physical
      ? entry.maxMeters / metersPerUnit
      : gridDistance * entry.relativeGridSpaces;
    return Object.freeze({
      ...entry,
      radiusPx: (distance / gridDistance) * size,
      distance,
      units,
    });
  });
}

export function createRangeProfile({
  scale = "personal",
  grid = {},
  calibration = null,
} = {}) {
  const scaleId = normalizeRangeScale(scale);
  const definition = RANGE_SCALES[scaleId];
  let bands;
  let mode;
  let source;
  if (hasSceneScaleReference(grid)) {
    bands = mapBands(definition, grid);
    mode = "map";
    source = METERS_PER_UNIT[String(grid.units ?? "").trim().toLowerCase()]
      ? "scene-grid"
      : "scene-grid-relative";
  } else {
    const anchorRadiusPx = Number(calibration?.anchorRadiusPx);
    if (!finitePositive(anchorRadiusPx)) return null;
    bands = definition.bands.map((entry) =>
      Object.freeze({
        ...entry,
        radiusPx: anchorRadiusPx * entry.calibrationRatio,
        distance: null,
        units: "",
      }),
    );
    mode = "theatre";
    source = "scene-calibration";
  }
  const anchor = bands.find((entry) => entry.id === definition.anchorBand);
  return Object.freeze({
    mode,
    source,
    scale: scaleId,
    scaleLabel: definition.label,
    anchorBand: definition.anchorBand,
    anchorRadiusPx: anchor?.radiusPx ?? null,
    bands: Object.freeze(bands),
  });
}

export function calibrationFromPointer(
  origin,
  pointer,
  { minimumRadiusPx = 32, maximumRadiusPx = Number.POSITIVE_INFINITY, footprint = null } = {},
) {
  const distance = footprint ? measureFootprintGap(footprint, rangeFootprint(pointer)).distance : Math.hypot(
    Number(pointer?.x) - Number(origin?.x),
    Number(pointer?.y) - Number(origin?.y),
  );
  if (!Number.isFinite(distance) || distance < minimumRadiusPx)
    throw new Error(
      "Click farther from the origin to define the range anchor.",
    );
  return {
    anchorRadiusPx: Math.min(
      distance,
      Math.max(minimumRadiusPx, maximumRadiusPx),
    ),
  };
}

export function classifyRangeDistance(distancePx, profile) {
  const distance = Number(distancePx);
  if (!profile || !Number.isFinite(distance) || distance < 0)
    return {
      band: "",
      beyond: false,
      distancePx: Number.isFinite(distance) ? distance : null,
      boundaryPx: null,
      profileMode: profile?.mode ?? "",
      scale: profile?.scale ?? "",
    };
  const match = profile.bands.find((entry) => distance <= entry.radiusPx);
  if (match)
    return {
      band: match.id,
      beyond: false,
      distancePx: distance,
      boundaryPx: match.radiusPx,
      profileMode: profile.mode,
      scale: profile.scale,
    };
  return {
    band: "beyond",
    beyond: true,
    distancePx: distance,
    boundaryPx: profile.bands.at(-1)?.radiusPx ?? null,
    profileMode: profile.mode,
    scale: profile.scale,
  };
}

const uniqueIds = (ids) => [
  ...new Set(Array.from(ids ?? [], (id) => String(id ?? "")).filter(Boolean)),
];

export function reconcileRangeOrigins(
  currentIds,
  { tokenId, controlled, controlledIds, multi = false } = {},
) {
  const current = uniqueIds(currentIds);
  const id = String(tokenId ?? "");
  if (controlled && id)
    return multi ? uniqueIds([...current, id]) : [id];
  if (multi) return current;
  if (controlledIds) return uniqueIds(controlledIds).slice(-1);
  return id ? current.filter((candidate) => candidate !== id) : current;
}

const TAU = Math.PI * 2;

function normalizeAngle(angle) {
  const value = Number(angle);
  if (!Number.isFinite(value)) return 0;
  return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

function shortestAngleDelta(from, to) {
  return normalizeAngle(Number(to) - Number(from));
}

export function interpolateRangeLabelAngle(from, to, progress) {
  const amount = Math.max(0, Math.min(1, Number(progress) || 0));
  if (amount === 0) return from;
  if (amount === 1) return to;
  return normalizeAngle(Number(from) + shortestAngleDelta(from, to) * amount);
}

const finitePoint = (point) =>
  Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));

const pointAt = (source, target, progress) => ({
  x: Number(source.x) + (Number(target.x) - Number(source.x)) * progress,
  y: Number(source.y) + (Number(target.y) - Number(source.y)) * progress,
});

/**
 * Return the first place a line enters an axis-aligned token ellipse. Token
 * art is usually round or oval, so this is less surprising than treating the
 * transparent corners of its rectangular bounds as cover.
 */
export function segmentEllipseIntersection(source, target, ellipse = {}) {
  if (!finitePoint(source) || !finitePoint(target) || !finitePoint(ellipse))
    return null;
  const radiusX = Number(ellipse.radiusX);
  const radiusY = Number(ellipse.radiusY);
  if (!(radiusX > 0) || !(radiusY > 0)) return null;
  const startX = (Number(source.x) - Number(ellipse.x)) / radiusX;
  const startY = (Number(source.y) - Number(ellipse.y)) / radiusY;
  const deltaX = (Number(target.x) - Number(source.x)) / radiusX;
  const deltaY = (Number(target.y) - Number(source.y)) / radiusY;
  const a = deltaX ** 2 + deltaY ** 2;
  if (a <= Number.EPSILON) return null;
  const b = 2 * (startX * deltaX + startY * deltaY);
  const c = startX ** 2 + startY ** 2 - 1;
  if (c <= 0) return { progress: 0, point: { x: Number(source.x), y: Number(source.y) } };
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const progress = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((value) => value >= 0 && value <= 1)
    .sort((left, right) => left - right)[0];
  return Number.isFinite(progress)
    ? { progress, point: pointAt(source, target, progress) }
    : null;
}

/**
 * Produce renderer-neutral line pieces for one frame of an attack trace.
 * The trace remains solid up to the first obstruction and becomes a sequence
 * of separated dotted segments from there to the animated endpoint.
 */
export function buildAttackTraceSegments({
  source,
  target,
  obstruction = null,
  progress = 1,
  dashLength = 14,
  gapLength = 9,
} = {}) {
  if (!finitePoint(source) || !finitePoint(target)) return [];
  const amount = Math.max(0, Math.min(1, Number(progress) || 0));
  if (amount <= 0) return [];
  const endpoint = pointAt(source, target, amount);
  const obstructionProgress = Number(obstruction?.progress);
  const blocked =
    finitePoint(obstruction?.point) &&
    Number.isFinite(obstructionProgress) &&
    obstructionProgress >= 0 &&
    obstructionProgress < 1;
  if (!blocked || amount <= obstructionProgress)
    return [{ style: "solid", from: { x: Number(source.x), y: Number(source.y) }, to: endpoint }];

  const obstructionPoint = {
    x: Number(obstruction.point.x),
    y: Number(obstruction.point.y),
  };
  const segments = [
    {
      style: "solid",
      from: { x: Number(source.x), y: Number(source.y) },
      to: obstructionPoint,
    },
  ];
  const deltaX = endpoint.x - obstructionPoint.x;
  const deltaY = endpoint.y - obstructionPoint.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= Number.EPSILON) return segments;
  const dash = Math.max(1, Number(dashLength) || 14);
  const gap = Math.max(0, Number(gapLength) || 0);
  const position = (distanceAlong) => ({
    x: obstructionPoint.x + (deltaX * distanceAlong) / distance,
    y: obstructionPoint.y + (deltaY * distanceAlong) / distance,
  });
  for (let cursor = 0; cursor < distance; cursor += dash + gap) {
    const end = Math.min(distance, cursor + dash);
    segments.push({
      style: "dotted",
      from: position(cursor),
      to: position(end),
    });
  }
  return segments;
}

const normalizedViewport = (viewport = {}) => ({
  left: Math.min(Number(viewport.left) || 0, Number(viewport.right) || 0),
  top: Math.min(Number(viewport.top) || 0, Number(viewport.bottom) || 0),
  right: Math.max(Number(viewport.left) || 0, Number(viewport.right) || 0),
  bottom: Math.max(Number(viewport.top) || 0, Number(viewport.bottom) || 0),
});

export function farthestViewportCornerAngle(origin, viewport) {
  if (!finitePoint(origin)) return null;
  const view = normalizedViewport(viewport ?? {});
  if (view.right <= view.left || view.bottom <= view.top) return null;
  const corners = [
    { x: view.right, y: view.top },
    { x: view.right, y: view.bottom },
    { x: view.left, y: view.bottom },
    { x: view.left, y: view.top },
  ];
  let farthest = corners[0];
  let farthestDistance = -1;
  for (const corner of corners) {
    const distance = Math.hypot(
      corner.x - Number(origin.x),
      corner.y - Number(origin.y),
    );
    if (distance > farthestDistance) {
      farthest = corner;
      farthestDistance = distance;
    }
  }
  return normalizeAngle(
    Math.atan2(
      farthest.y - Number(origin.y),
      farthest.x - Number(origin.x),
    ),
  );
}

function labelCandidateAngles(preferredAngle, samples, currentAngle) {
  const preferred = normalizeAngle(preferredAngle);
  const count = Math.max(12, Math.round(Number(samples) || 72));
  const current = Number(currentAngle);
  const firstDirection =
    Number.isFinite(current) && shortestAngleDelta(preferred, current) < 0
      ? -1
      : 1;
  const angles = [preferred];
  for (let index = 1; index <= Math.floor(count / 2); index++) {
    const offset = (index / count) * TAU;
    angles.push(normalizeAngle(preferred + firstDirection * offset));
    if (Math.abs(offset - Math.PI) > 0.000001)
      angles.push(normalizeAngle(preferred - firstDirection * offset));
  }
  return angles;
}

function labelLayoutAt(origin, radius, size, angle, footprint) {
  const width = Math.max(1, Number(size?.width) || 1);
  const height = Math.max(1, Number(size?.height) || 1);
  const { x, y } = footprintBoundaryPoint(footprint ?? rangeFootprint(origin), radius, angle);
  return {
    angle,
    x,
    y,
    onArc: true,
    bounds: {
      left: x - width / 2,
      top: y - height / 2,
      right: x + width / 2,
      bottom: y + height / 2,
    },
  };
}

function overflowAmount(bounds, viewport, padding) {
  return (
    Math.max(0, viewport.left + padding - bounds.left) +
    Math.max(0, viewport.top + padding - bounds.top) +
    Math.max(0, bounds.right - (viewport.right - padding)) +
    Math.max(0, bounds.bottom - (viewport.bottom - padding))
  );
}

function overlapArea(left, right) {
  const width = Math.max(
    0,
    Math.min(left.right, right.right) - Math.max(left.left, right.left),
  );
  const height = Math.max(
    0,
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top),
  );
  return width * height;
}

/**
 * Place the completed attack summary near its trace while keeping the whole
 * card inside the canvas and away from transient interface overlays.
 */
export function chooseAttackTraceLabelLayout({
  source,
  target,
  size,
  viewport,
  occupied = [],
  padding = 12,
  preferredProgress = 0.58,
  current = null,
} = {}) {
  if (!finitePoint(source) || !finitePoint(target)) return null;
  const view = normalizedViewport(viewport ?? {});
  if (view.right <= view.left || view.bottom <= view.top) return null;
  const width = Math.max(1, Number(size?.width) || 1);
  const height = Math.max(1, Number(size?.height) || 1);
  const deltaX = Number(target.x) - Number(source.x);
  const deltaY = Number(target.y) - Number(source.y);
  const distance = Math.hypot(deltaX, deltaY);
  const perpendicular = distance > Number.EPSILON
    ? { x: -deltaY / distance, y: deltaX / distance } : { x: 0, y: 1 };
  const baseOffset = Math.max(
    height / 2 + 18,
    Math.min(70, Math.max(38, distance * 0.08)),
  );
  const preferred = Math.max(0.15, Math.min(0.85, Number(preferredProgress) || 0.58));
  const progressCandidates = [
    preferred,
    1 - preferred,
    0.7,
    0.3,
    0.82,
    0.18,
  ];
  const candidates = [];
  if (finitePoint(current)) candidates.push(current);
  for (const offsetMultiplier of [1, 1.65, 2.3]) {
    for (const progress of progressCandidates) {
      const middle = pointAt(source, target, progress);
      for (const side of [1, -1]) {
        const x = middle.x + perpendicular.x * baseOffset * offsetMultiplier;
        const y = middle.y + perpendicular.y * baseOffset * offsetMultiplier;
        candidates.push({ x, y });
      }
    }
  }
  const minX = view.left + padding + width / 2;
  const maxX = Math.max(minX, view.right - padding - width / 2);
  const minY = view.top + padding + height / 2;
  const maxY = Math.max(minY, view.bottom - padding - height / 2);
  const layoutAt = (point) => {
    const x = Math.max(minX, Math.min(maxX, point.x));
    const y = Math.max(minY, Math.min(maxY, point.y));
    return { x, y, bounds: { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 } };
  };
  const obstacles = occupied.filter(entry => entry && overlapArea(view, entry) > 0);
  let best = null;
  const assess = (point, preference) => {
    const candidate = layoutAt(point);
    const overflow = overflowAmount(candidate.bounds, view, padding);
    const overlap = obstacles.reduce(
      (total, entry) => total + overlapArea(candidate.bounds, entry),
      0,
    );
    const score = overflow * 1_000_000_000 + overlap * 1_000_000 + preference;
    if (!best || score < best.score) best = { ...candidate, score };
    return overflow === 0 && overlap === 0;
  };
  for (const [index, candidate] of candidates.entries()) {
    if (assess(candidate, index)) { delete best.score; return best; }
  }
  // Only a crowded trace needs a wider search. Every free rectangular pocket
  // has a corner on these expanded obstacle or viewport boundaries.
  const reference = finitePoint(current) ? current : candidates[0];
  const xs = new Set([minX, maxX, Math.max(minX, Math.min(maxX, reference.x))]);
  const ys = new Set([minY, maxY, Math.max(minY, Math.min(maxY, reference.y))]);
  for (const obstacle of obstacles) {
    for (const x of [obstacle.left - width / 2 - 1, obstacle.right + width / 2 + 1])
      if (x >= minX && x <= maxX) xs.add(x);
    for (const y of [obstacle.top - height / 2 - 1, obstacle.bottom + height / 2 + 1])
      if (y >= minY && y <= maxY) ys.add(y);
  }
  for (const x of xs) for (const y of ys) assess({ x, y }, 100 + Math.hypot(x - reference.x, y - reference.y));
  if (best) delete best.score;
  return best;
}

export function pauseBannerScreenBounds({ width, height } = {}) {
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (!(safeWidth > 0) || !(safeHeight > 0)) return null;
  return {
    left: safeWidth * 0.38,
    top: safeHeight * 0.38,
    right: safeWidth * 0.62,
    bottom: safeHeight * 0.63,
  };
}

/**
 * Place a label on its range circumference. Labels prefer one shared radial
 * guide, then repel from occupied bounds by taking the shortest clear path
 * around their own arc. The rare no-arc fallback is clamped inside the
 * viewport and exposes the original circumference point for a leader line.
 */
export function chooseRangeLabelLayout({
  origin,
  radius,
  viewport,
  size,
  preferredAngle = -Math.PI / 4,
  currentAngle = null,
  footprint = null,
  occupied = [],
  padding = 12,
  samples = 72,
} = {}) {
  const safeRadius = Number(radius);
  if (
    !Number.isFinite(Number(origin?.x)) ||
    !Number.isFinite(Number(origin?.y)) ||
    !Number.isFinite(safeRadius) ||
    safeRadius <= 0
  )
    return null;
  const view = normalizedViewport(viewport ?? {});
  if (view.right <= view.left || view.bottom <= view.top) return null;
  const nearestX = Math.max(view.left, Math.min(view.right, Number(origin.x)));
  const nearestY = Math.max(view.top, Math.min(view.bottom, Number(origin.y)));
  const nearestDistance = Math.hypot(
    Number(origin.x) - nearestX,
    Number(origin.y) - nearestY,
  );
  if (safeRadius + Math.hypot(footprint?.width ?? 0, footprint?.height ?? 0) / 2 < nearestDistance) return null;
  const collides = (bounds) =>
    occupied.reduce((total, entry) => total + overlapArea(bounds, entry), 0);

  const preferred = normalizeAngle(preferredAngle);
  const angles = labelCandidateAngles(preferred, samples, currentAngle);
  let best = null;
  for (const angle of angles) {
    const layout = labelLayoutAt(origin, safeRadius, size, angle, footprint);
    const overflow = overflowAmount(layout.bounds, view, padding);
    const overlap = collides(layout.bounds);
    const deviation = Math.abs(shortestAngleDelta(preferred, angle));
    const continuity = Number.isFinite(Number(currentAngle))
      ? Math.abs(shortestAngleDelta(Number(currentAngle), angle))
      : 0;
    const score =
      overflow * 1_000_000_000 +
      overlap * 1_000_000 +
      deviation * 100 +
      continuity;
    if (!best || score < best.score) best = { ...layout, score };
    if (overflow === 0 && overlap === 0 && deviation === 0) break;
  }
  if (!best) return null;
  if (overflowAmount(best.bounds, view, padding) === 0) {
    delete best.score;
    return best;
  }

  const width = best.bounds.right - best.bounds.left;
  const height = best.bounds.bottom - best.bounds.top;
  let fallback = null;
  for (const angle of angles) {
    const arc = labelLayoutAt(origin, safeRadius, size, angle, footprint);
    const x = Math.max(
      view.left + padding + width / 2,
      Math.min(view.right - padding - width / 2, arc.x),
    );
    const y = Math.max(
      view.top + padding + height / 2,
      Math.min(view.bottom - padding - height / 2, arc.y),
    );
    const bounds = {
      left: x - width / 2,
      top: y - height / 2,
      right: x + width / 2,
      bottom: y + height / 2,
    };
    const overlap = collides(bounds);
    const deviation = Math.abs(shortestAngleDelta(preferred, angle));
    const continuity = Number.isFinite(Number(currentAngle))
      ? Math.abs(shortestAngleDelta(Number(currentAngle), angle))
      : 0;
    const displacement = Math.hypot(x - arc.x, y - arc.y);
    const score =
      overlap * 1_000_000_000 +
      deviation * 1_000_000 +
      displacement +
      continuity;
    if (!fallback || score < fallback.score)
      fallback = {
        angle,
        x,
        y,
        onArc: false,
        leaderPoint: { x: arc.x, y: arc.y },
        bounds,
        score,
      };
    if (overlap === 0 && deviation === 0) break;
  }
  if (!fallback) return null;
  delete fallback.score;
  return fallback;
}

export function inferCombatRangeScale(combatants = []) {
  const actorTypes = Array.from(combatants, (combatant) =>
    String(combatant?.actor?.type ?? combatant?.actorType ?? ""),
  ).filter(Boolean);
  if (!actorTypes.length) return null;
  if (actorTypes.every((type) => type === "vehicle")) return "space";
  if (actorTypes.every((type) => type !== "vehicle")) return "personal";
  return null;
}
