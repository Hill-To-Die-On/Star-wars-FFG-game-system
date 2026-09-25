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
  { minimumRadiusPx = 32, maximumRadiusPx = Number.POSITIVE_INFINITY } = {},
) {
  const distance = Math.hypot(
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
