import { SYSTEM_ID } from "./config.mjs";
import { vehicleIconArchetype } from "./actor-icons.mjs";

const METRES_PER_UNIT = Object.freeze({
  m: 1,
  metre: 1,
  metres: 1,
  meter: 1,
  meters: 1,
  km: 1000,
  kilometre: 1000,
  kilometres: 1000,
  kilometer: 1000,
  kilometers: 1000,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
  cm: 0.01,
  centimetre: 0.01,
  centimetres: 0.01,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
});

const SILHOUETTE_LENGTH_METRES = Object.freeze({
  0: 1,
  1: 1.5,
  2: 4,
  3: 10,
  4: 30,
  5: 80,
  6: 250,
  7: 750,
  8: 2500,
  9: 7500,
  10: 20000,
});

const FOOTPRINT_HULLS = new Set(["fighter","freighter","shuttle","capital","tank","walker","speeder","station"]);

const FOOTPRINT_HULL_BY_ICON = Object.freeze({
  fighter: "fighter",
  bomber: "fighter",
  drone: "fighter",
  freighter: "freighter",
  gunship: "freighter",
  barge: "freighter",
  submarine: "freighter",
  shuttle: "shuttle",
  cruiser: "capital",
  destroyer: "capital",
  carrier: "capital",
  station: "station",
  tank: "tank",
  crawler: "tank",
  industrial: "tank",
  walker: "walker",
  airspeeder: "speeder",
  landspeeder: "speeder",
  bike: "speeder",
  podracer: "speeder",
});

const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const roundedMetres = (value) => Math.round(value * 10) / 10;
const halfGridCeiling = (value) => Math.max(0.5, Math.ceil(value * 2 - 1e-9) / 2);

export function sceneGridMeters(scene) {
  const grid = scene?.grid ?? scene?.dimensions,
    size = Number(grid?.size),
    distance = Number(grid?.distance),
    multiplier = METRES_PER_UNIT[String(grid?.units ?? "").trim().toLowerCase()];
  if (grid?.type === 0 || !positive(size) || !positive(distance) || !positive(multiplier)) return null;
  return distance * multiplier;
}

function silhouetteLength(silhouette) {
  const value = Math.max(0, Math.min(20, Math.round(Number(silhouette) || 0)));
  if (value in SILHOUETTE_LENGTH_METRES) return SILHOUETTE_LENGTH_METRES[value];
  return SILHOUETTE_LENGTH_METRES[10] * 2 ** (value - 10);
}

export function vehicleFootprintMeters(actor) {
  const footprint = actor?.system?.footprint ?? {},
    selectedHull = String(footprint.hull ?? ""),
    hull =
      FOOTPRINT_HULLS.has(selectedHull)
        ? selectedHull
        : FOOTPRINT_HULL_BY_ICON[vehicleIconArchetype(actor)] ?? "fighter",
    manual =
      footprint.mode === "manual" && positive(footprint.length) && positive(footprint.width);
  if (manual)
    return {
      mode: "manual",
      hull,
      length: roundedMetres(Number(footprint.length)),
      width: roundedMetres(Number(footprint.width)),
    };
  // Display calibration, not a rules conversion from silhouette to physical dimensions.
  const extent = silhouetteLength(actor?.system?.silhouette);
  return { mode: "automatic", hull, length:extent, width:extent };
}

export function vehicleTokenDimensions(actor, scene) {
  if (actor?.type !== "vehicle") return null;
  const footprint = vehicleFootprintMeters(actor),
    gridMeters = sceneGridMeters(scene);
  if (gridMeters)
    return {
      width: halfGridCeiling(footprint.width / gridMeters),
      height: halfGridCeiling(footprint.length / gridMeters),
      footprint,
      gridMeters,
      scaled: true,
    };
  const silhouette = Math.max(0, Number(actor?.system?.silhouette) || 0),
    height = Math.min(6, halfGridCeiling(0.5 + silhouette * 0.5)),
    ratio = footprint.width / footprint.length;
  return {
    width: Math.min(6, halfGridCeiling(height * ratio)),
    height,
    footprint,
    gridMeters: null,
    scaled: false,
  };
}

export function vehicleTokenCreationUpdate(actor, scene) {
  const dimensions = vehicleTokenDimensions(actor, scene);
  if (!dimensions) return null;
  return {
    width: dimensions.width,
    height: dimensions.height,
    sort: -10,
    flags: {
      [SYSTEM_ID]: {
        automaticFootprint: true,
        footprintMeters: {
          length: dimensions.footprint.length,
          width: dimensions.footprint.width,
        },
        footprintHull: dimensions.footprint.hull,
        footprintScaled: dimensions.scaled,
      },
    },
  };
}
