import test from "node:test";
import assert from "node:assert/strict";
import {
  sceneGridMeters,
  vehicleFootprintMeters,
  vehicleTokenCreationUpdate,
  vehicleTokenDimensions,
} from "../src/vehicle-footprints.mjs";
import { VEHICLE_ICON_ARCHETYPES } from "../src/actor-icons.mjs";

const vehicle = (overrides = {}) => ({
  id: "vehicle-1",
  name: "IG-227 Hailfire Tank",
  type: "vehicle",
  system: {
    silhouette: 3,
    model: "IG-227 Hailfire",
    metadata: { Purpose: "Ground Vehicle", Hull: "Droid Tank" },
    footprint: { mode: "automatic", hull: "auto", length: 0, width: 0 },
  },
  ...overrides,
});

const scene = (distance = 5, units = "m") => ({
  grid: { size: 100, distance, units },
});

test("scene grid distances convert common units to metres", () => {
  assert.equal(sceneGridMeters(scene(5, "m")), 5);
  assert.equal(sceneGridMeters(scene(5, "ft")), 1.524);
  assert.equal(sceneGridMeters(scene(1, "km")), 1000);
  assert.equal(sceneGridMeters({ grid: { size: 0, distance: 5, units: "m" } }), null);
});

test("automatic footprints depend on silhouette rather than hull", () => {
  assert.deepEqual(vehicleFootprintMeters(vehicle()), {
    mode: "automatic",
    hull: "tank",
    length: 10,
    width: 10,
  });
  assert.deepEqual(
    vehicleFootprintMeters(
      vehicle({
        name: "AT-ST Walker",
        system: {
          ...vehicle().system,
          model: "AT-ST Walker",
          metadata: { Purpose: "Walker", Hull: "Walker" },
        },
      }),
    ),
    { mode: "automatic", hull: "walker", length: 10, width: 10 },
  );
  const capital = vehicleFootprintMeters(
    vehicle({
      name: "Imperial Star Destroyer",
      system: { ...vehicle().system, silhouette: 8, metadata: { Purpose: "Capital Ship" } },
    }),
  );
  assert.equal(capital.hull, "capital");
  assert.equal(capital.length, 2500);
  assert.equal(capital.width, 2500);
});

test("manual physical dimensions override the estimated footprint", () => {
  assert.deepEqual(
    vehicleFootprintMeters(
      vehicle({
        system: {
          ...vehicle().system,
          footprint: { mode: "manual", hull: "tank", length: 12, width: 6 },
        },
      }),
    ),
    { mode: "manual", hull: "tank", length: 12, width: 6 },
  );
});

test("every hull family shares the same automatic size at a given silhouette",()=>{
  const hulls=Object.keys(VEHICLE_ICON_ARCHETYPES);
  assert.ok(hulls.length>=20,"Exercise the complete visual hull catalogue");
  let previous=0;
  for(let silhouette=0;silhouette<=10;silhouette++) {
    const dimensions=hulls.map(hull=>vehicleTokenDimensions(vehicle({system:{...vehicle().system,silhouette,footprint:{mode:"automatic",hull}}}),scene()));
    assert.equal(new Set(dimensions.map(d=>`${d.width}:${d.height}`)).size,1);
    assert.ok(dimensions[0].width>=previous);
    previous=dimensions[0].width;
  }
});

test("vehicle token dimensions follow the scene scale in half-grid steps", () => {
  const exact = vehicle({
    system: {
      ...vehicle().system,
      footprint: { mode: "manual", hull: "tank", length: 12, width: 6 },
    },
  });
  assert.deepEqual(vehicleTokenDimensions(exact, scene(5, "m")), {
    width: 1.5,
    height: 2.5,
    footprint: { mode: "manual", hull: "tank", length: 12, width: 6 },
    gridMeters: 5,
    scaled: true,
  });
  assert.deepEqual(
    vehicleTokenDimensions(exact, scene(5, "ft")),
    {
      width: 4,
      height: 8,
      footprint: { mode: "manual", hull: "tank", length: 12, width: 6 },
      gridMeters: 1.524,
      scaled: true,
    },
  );
});

test("gridless scenes receive a bounded visual footprint and characters are ignored", () => {
  const result = vehicleTokenDimensions(vehicle(), { grid: { size: 0, distance: 0, units: "" } });
  assert.equal(result.scaled, false);
  assert.deepEqual([result.width, result.height], [2, 2]);
  const latent = vehicleTokenDimensions(vehicle(),{grid:{type:0,size:100,distance:5,units:"m"}});
  assert.equal(latent.scaled,false,"Gridless scenes must ignore latent distance fields");
  assert.equal(vehicleTokenDimensions({ type: "character" }, scene()), null);
});

test("token creation update records auto sizing and keeps vehicles beneath boarders", () => {
  assert.deepEqual(vehicleTokenCreationUpdate(vehicle(), scene()), {
    width: 2,
    height: 2,
    sort: -10,
    flags: {
      "star-wars-ffg": {
        automaticFootprint: true,
        footprintMeters: { length: 10, width: 10 },
        footprintHull: "tank",
        footprintScaled: true,
      },
    },
  });
  assert.equal(vehicleTokenCreationUpdate({ type: "character" }, scene()), null);
});
