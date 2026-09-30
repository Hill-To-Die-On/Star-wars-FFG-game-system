import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACTOR_ICON_PALETTES,
  CHARACTER_ICON_ARCHETYPES,
  VEHICLE_ICON_ARCHETYPES,
  actorIconCategory,
  actorIconDescriptor,
  actorPortraitSource,
  characterIconArchetype,
  characterIconProfile,
  isDefaultActorImage,
  isProceduralActorIcon,
  proceduralActorSvg,
  vehicleIconArchetype,
  vehicleIconProfile,
} from "../src/actor-icons.mjs";

const database = JSON.parse(
  await readFile(new URL("../data/reference-database.json", import.meta.url), "utf8"),
);

const actor = (overrides = {}) => ({
  name: "Test actor",
  type: "character",
  hasPlayerOwner: true,
  system: { species: "Human" },
  prototypeToken: { disposition: 0 },
  flags: {},
  ...overrides,
});

const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

test("actor roles have distinct, high-contrast procedural palettes", () => {
  assert.deepEqual(Object.keys(ACTOR_ICON_PALETTES), [
    "player",
    "ally",
    "npc",
    "minion",
    "rival",
    "nemesis",
    "vehicle",
    "group",
  ]);
  assert.equal(
    new Set(Object.values(ACTOR_ICON_PALETTES).map(({ background }) => background))
      .size,
    8,
  );
  for (const palette of Object.values(ACTOR_ICON_PALETTES))
    assert.ok(
      contrast(palette.background, palette.foreground) >= 4.5,
      `${palette.label} foreground must meet WCAG AA contrast`,
    );
});

test("actor category follows player ownership, disposition and adversary type", () => {
  assert.equal(actorIconCategory(actor()), "player");
  assert.equal(
    actorIconCategory(
      actor({ hasPlayerOwner: false, prototypeToken: { disposition: 1 } }),
    ),
    "ally",
  );
  assert.equal(
    actorIconCategory(
      actor({ hasPlayerOwner: false, prototypeToken: { disposition: -1 } }),
    ),
    "npc",
  );
  assert.equal(actorIconCategory(actor({ type: "minion" })), "minion");
  assert.equal(actorIconCategory(actor({ type: "rival" })), "rival");
  assert.equal(actorIconCategory(actor({ type: "nemesis" })), "nemesis");
  assert.equal(actorIconCategory(actor({ type: "vehicle" })), "vehicle");
  assert.equal(actorIconCategory(actor({ type: "group" })), "group");
  assert.equal(
    actorIconCategory(
      actor({
        flags: { "star-wars-ffg": { iconRole: "ally" } },
      }),
    ),
    "ally",
  );
});

test("species names resolve to the complete abstract silhouette set", () => {
  assert.ok(Object.keys(CHARACTER_ICON_ARCHETYPES).length >= 20);
  assert.equal(characterIconArchetype("Human"), "humanoid");
  assert.equal(characterIconArchetype("Astromech Droid"), "droid");
  assert.equal(characterIconArchetype("Twi'lek"), "lekku");
  assert.equal(characterIconArchetype("Togruta"), "montral");
  assert.equal(characterIconArchetype("Wookiee"), "furred");
  assert.equal(characterIconArchetype("Mon Calamari"), "aquatic");
  assert.equal(characterIconArchetype("Trandoshan"), "reptilian");
  assert.equal(characterIconArchetype("Jawa"), "hooded");
});

test("vehicle records resolve to the complete hull-symbol set", () => {
  assert.ok(Object.keys(VEHICLE_ICON_ARCHETYPES).length >= 16);
  assert.equal(vehicleIconArchetype(actor({ name: "TIE Interceptor" })), "fighter");
  assert.equal(
    vehicleIconArchetype(actor({ system: { model: "YT-1300 Light Freighter" } })),
    "freighter",
  );
  assert.equal(vehicleIconArchetype(actor({ name: "Lambda Shuttle" })), "shuttle");
  assert.equal(
    vehicleIconArchetype(actor({ name: "Imperial Star Destroyer" })),
    "destroyer",
  );
  assert.equal(
    vehicleIconArchetype(
      actor({ system: { metadata: { Purpose: "Ground Vehicle", Hull: "Droid Tank" } } }),
    ),
    "tank",
  );
  assert.equal(vehicleIconArchetype(actor({ name: "AT-ST Walker" })), "walker");
  assert.equal(vehicleIconArchetype(actor({ name: "74-Z Speeder Bike" })), "bike");
  assert.equal(vehicleIconArchetype(actor({ name: "Orbital Battle Station" })), "station");
});

test("every database species has an explicit visual-family assignment", () => {
  const species = [
    ...new Set(database.tables.species.map((record) => record.Species).filter(Boolean)),
  ];
  assert.equal(species.length, 173);
  const profiles = species.map(characterIconProfile);
  assert.deepEqual(
    profiles.filter(({ known }) => !known),
    [],
    "No database species may silently fall back to a generic icon",
  );
  assert.ok(
    new Set(profiles.map(({ archetype }) => archetype)).size >= 20,
    "The database should use a broad visual vocabulary",
  );
});

test("every database hull and purpose has an explicit vehicle-family assignment", () => {
  const profiles = database.tables.vehicles.map((record) =>
    vehicleIconProfile({
      name: record.Name,
      type: "vehicle",
      system: {
        metadata: {
          Hull: record.Hull,
          Purpose: record.Purpose,
          Class: record.Class,
        },
      },
    }),
  );
  assert.deepEqual(
    profiles.filter(({ known }) => !known),
    [],
    "No database vehicle may silently fall back to a generic icon",
  );
  assert.ok(new Set(profiles.map(({ archetype }) => archetype)).size >= 16);
});

test("all character drawings use the same head and body centreline", () => {
  for (const archetype of Object.keys(CHARACTER_ICON_ARCHETYPES)) {
    const svg = proceduralActorSvg(
      actor({
        name: archetype,
        system: { species: "Human" },
        flags: { "star-wars-ffg": { iconArchetype: archetype } },
      }),
    );
    assert.match(svg, /data-head-center="50"/);
    assert.match(svg, /data-body-center="50"/);
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
});

test("characters stay circular while vehicles keep the rounded-square badge", () => {
  const characterSvg = proceduralActorSvg(actor({ system: { species: "Twi'lek" } }));
  const vehicleSvg = proceduralActorSvg(
    actor({ type: "vehicle", name: "IG-227 Hailfire Tank", system: { silhouette: 3 } }),
  );
  assert.match(characterSvg, /data-frame="character"[^<]*<\/circle>/);
  assert.doesNotMatch(characterSvg, /data-frame="vehicle"/);
  assert.match(vehicleSvg, /data-frame="vehicle"[^<]*<\/rect>/);
  assert.match(vehicleSvg, /data-archetype="tank"/);
  assert.match(characterSvg, /data-facing="port"/);
  assert.match(characterSvg, /data-facing="starboard"/);
  assert.match(vehicleSvg, /data-facing="port"/);
  assert.match(vehicleSvg, /data-facing="starboard"/);
  const marks = [...vehicleSvg.matchAll(/data-facing="(?:port|starboard)" d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)"/g)];
  assert.equal(marks.length, 2);
  for (const [index, mark] of marks.entries()) {
    let [, x1, y1, x2, y2] = mark.map(Number);
    if (index === 1) { x1 = 100 - x1; x2 = 100 - x2; }
    const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
    assert.ok(Math.abs(Math.hypot(midX - 20, midY - 20) - 13) < 0.02,
      "The inner rounded frame passes through the midpoint of the tag");
    assert.ok(Math.abs(Math.hypot(x1 - 18, y1 - 18) + 1.5 - 18) < 0.02,
      "The rounded outer tip reaches the badge boundary");
  }
});

test("procedural SVG is deterministic, self-contained and escapes actor labels", () => {
  const unsafe = actor({ name: '<script>alert("x")</script>', system: { species: "Droid" } });
  const first = actorIconDescriptor(unsafe);
  const second = actorIconDescriptor(unsafe);
  assert.equal(first.svg, second.svg);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.src, /^data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(first.svg, /<script>|(?:href|src)="https?:|data:image/i);
  assert.match(first.svg, /&lt;script&gt;/);
});

test("vehicle token badges match rectangular footprints without stretching their hull symbols", () => {
  const vehicle = actor({ type: "vehicle", name: "Test freighter" });
  for (const [width, height] of [[9,12], [12,9], [1,4], [4,1], [30,30]]) {
    const badge = actorIconDescriptor(vehicle, { width, height });
    const dimensions = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(badge.svg).slice(1).map(Number);
    assert.ok(Math.abs(dimensions[0]/dimensions[1] - width/height) < 1e-6);
    const [w,h] = dimensions, short = Math.min(w,h);
    assert.match(badge.svg, new RegExp(`data-frame="vehicle" width="${w}" height="${h}"`));
    assert.match(badge.svg, new RegExp(`data-hull-fit="uniform" transform="translate\\(${(w-short)/2} ${(h-short)/2}\\) scale\\(${short/100}\\)"`));
    const marks = [...badge.svg.matchAll(/data-facing="(?:port|starboard)" d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)"/g)];
    assert.equal(marks.length,2);
    for (const [i,mark] of marks.entries()) {
      let [,x1,y1,x2,y2] = mark.map(Number);
      if (i) { x1=w-x1; x2=w-x2; }
      const midpointDistance = Math.hypot((x1+x2)/2-short*.2,(y1+y2)/2-short*.2);
      assert.ok(Math.abs(midpointDistance-short*.13)<0.02);
    }
    assert.equal(badge.src, actorIconDescriptor(vehicle, { width: width*10, height: height*10 }).src);
  }
  assert.equal(actorIconDescriptor(actor(),{width:9,height:12}).src,actorIconDescriptor(actor()).src);
});

test("canvas SVG sources declare sufficient raster resolution without changing their geometry", async () => {
  for (const [type, pixels] of [["character", 512], ["group", 512], ["vehicle", 2048]]) {
    const descriptor = actorIconDescriptor(actor({ type }));
    const source = Buffer.from(descriptor.src.split(",")[1], "base64").toString("utf8");
    assert.match(source, new RegExp(`<svg[^>]*width="${pixels}"[^>]*height="${pixels}"`));
    assert.match(source, /viewBox="0 0 100 100"/);
  }
  for (const [type, pixels] of [["character", 512], ["vehicle", 2048]]) {
    const source = await readFile(new URL(`../assets/${type}.svg`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`<svg[^>]*width="${pixels}"[^>]*height="${pixels}"`));
    assert.match(source, /viewBox="0 0 100 100"/);
  }
});

test("custom portraits remain selected while known defaults become procedural", () => {
  const source = actor({ img: "portraits/my-pilot.webp" });
  assert.equal(actorPortraitSource(source), "portraits/my-pilot.webp");
  assert.equal(isDefaultActorImage("systems/star-wars-ffg/assets/character.svg", "character"), true);
  assert.equal(isDefaultActorImage("systems/star-wars-ffg/assets/vehicle.svg", "vehicle"), true);
  assert.match(
    actorPortraitSource(actor({ img: "systems/star-wars-ffg/assets/character.svg" })),
    /^data:image\/svg\+xml;base64,/,
  );
});

test("legacy generated images remain upgradeable when a saved actor has lost its managed flag", () => {
  const legacySvg = '<svg viewBox="0 0 100 100"><rect data-frame="vehicle"/><g data-archetype="fighter"/><path data-facing="port"/></svg>';
  const legacy = actor({ type: "vehicle", img: `data:image/svg+xml;base64,${Buffer.from(legacySvg).toString("base64")}`, flags: {} });
  assert.equal(isProceduralActorIcon(legacy), true);
  assert.notEqual(actorPortraitSource(legacy), legacy.img);
  assert.equal(isProceduralActorIcon(actor({ img: "portraits/hand-painted.svg" })), false);
});
