import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  CHARACTER_ICON_ARCHETYPES,
  VEHICLE_ICON_ARCHETYPES,
  actorIconDescriptor,
  characterIconProfile,
  vehicleIconProfile,
} from "../src/actor-icons.mjs";

const SYSTEM_ID = "star-wars-ffg",
  outputDirectory = new URL("../docs/images/", import.meta.url),
  reportPath = new URL("../docs/actor-icon-audit.json", import.meta.url),
  previewPath = new URL("../docs/images/actor-icon-token-preview.png", import.meta.url),
  database = JSON.parse(
    await readFile(new URL("../data/reference-database.json", import.meta.url), "utf8"),
  );

const iconActor = (family, archetype, label) => ({
  name: label,
  type: family === "vehicle" ? "vehicle" : "character",
  hasPlayerOwner: family !== "vehicle",
  system:
    family === "vehicle"
      ? { silhouette: 3, footprint: { mode: "automatic", hull: "auto" } }
      : { species: label },
  flags: { [SYSTEM_ID]: { iconArchetype: archetype } },
});

const entries = [
  ...Object.entries(CHARACTER_ICON_ARCHETYPES).map(([archetype, label]) => ({
    family: "character",
    archetype,
    label,
    ...actorIconDescriptor(iconActor("character", archetype, label)),
  })),
  ...Object.entries(VEHICLE_ICON_ARCHETYPES).map(([archetype, label]) => ({
    family: "vehicle",
    archetype,
    label,
    ...actorIconDescriptor(iconActor("vehicle", archetype, label)),
  })),
];

const cards = entries
  .map(
    ({ family, archetype, label, svg }) =>
      `<figure class="icon" data-family="${family}" data-key="${archetype}">${svg}<figcaption>${label}</figcaption></figure>`,
  )
  .join("");

const executablePath =
    process.env.CHROMIUM_PATH ||
    (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined),
  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

let geometry, sourceSizes;
try {
  const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
  await page.setContent(`<!doctype html><style>
    *{box-sizing:border-box}body{margin:0;background:#091216;color:#f7e5b2;font:12px system-ui}
    #sheet{width:1040px;min-height:760px;padding:22px;display:grid;grid-template-columns:repeat(8,1fr);gap:18px 10px}
    .icon{margin:0;text-align:center}.icon svg{display:block;width:64px;height:64px;margin:0 auto 6px}.icon figcaption{line-height:1.15;min-height:28px}
  </style><main id="sheet">${cards}</main>`);

  geometry = await page.evaluate(() =>
    [...document.querySelectorAll(".icon")].map((card) => {
      const box = (selector) => {
          const node = card.querySelector(selector);
          if (!node) return null;
          const value = node.getBBox();
          return {
            x: value.x,
            y: value.y,
            width: value.width,
            height: value.height,
            centerX: value.x + value.width / 2,
          };
        },
        family = card.dataset.family;
      return {
        family,
        archetype: card.dataset.key,
        glyph: box("[data-archetype]"),
        head: box("[data-part='head']"),
        body: box("[data-part='body']"),
        hull: box("[data-part='hull']"),
        port: box("[data-facing='port']"),
        starboard: box("[data-facing='starboard']"),
      };
    }),
  );

  sourceSizes = await page.evaluate(async (entries) => {
    const results = [];
    for (const { family, archetype, src } of entries) {
      const image = new Image();
      image.src = src;
      await image.decode();
      results.push({ family, archetype, width: image.naturalWidth, height: image.naturalHeight });
    }
    return results;
  }, entries.map(({ family, archetype, src }) => ({ family, archetype, src })));

  const session = await page.context().newCDPSession(page),
    capture = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: 1040, height: 760, scale: 1 },
    });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(previewPath, Buffer.from(capture.data, "base64"));
} finally {
  await browser.close();
}

const failures = [],
  alignmentErrors = [];
for (const result of geometry) {
  if (!result.glyph) failures.push(`${result.archetype}: missing glyph`);
  if (result.glyph) {
    const right = result.glyph.x + result.glyph.width,
      bottom = result.glyph.y + result.glyph.height;
    if (result.glyph.x < 7 || right > 93 || result.glyph.y < 7 || bottom > 93)
      failures.push(`${result.archetype}: glyph exceeds protected frame area`);
  }
  if (result.family === "character") {
    if (!result.head || !result.body)
      failures.push(`${result.archetype}: missing head/body geometry`);
    else {
      const error = Math.abs(result.head.centerX - result.body.centerX);
      alignmentErrors.push(error);
      if (error > 0.25)
        failures.push(`${result.archetype}: head/body centres differ by ${error}`);
    }
  } else {
    if (!result.hull) failures.push(`${result.archetype}: missing hull geometry`);
    for (const [side, mark] of [["port", result.port], ["starboard", result.starboard]]) {
      if (!mark) { failures.push(`${result.archetype}: missing ${side} mark`); continue; }
      const centerX = side === "port" ? 20 : 80;
      if (Math.abs(Math.hypot(mark.centerX - centerX, mark.y + mark.height / 2 - 20) - 13) > 0.02)
        failures.push(`${result.archetype}: ${side} mark does not cross the inner frame at its midpoint`);
      const outerX = side === "port" ? mark.x : 100 - mark.x - mark.width;
      if (Math.abs(Math.hypot(outerX - 18, mark.y - 18) + 1.5 - 18) > 0.02)
        failures.push(`${result.archetype}: ${side} mark does not reach the outer badge edge`);
    }
  }
}

for (const result of sourceSizes) {
  const expected = result.family === "vehicle" ? 2048 : 512;
  if (result.width !== expected || result.height !== expected)
    failures.push(`${result.archetype}: SVG decodes to ${result.width} by ${result.height}, expected ${expected}`);
}

const species = [
    ...new Set(database.tables.species.map((record) => record.Species).filter(Boolean)),
  ],
  speciesUnknown = species.filter((name) => !characterIconProfile(name).known),
  vehicleUnknown = database.tables.vehicles.filter(
    (record) =>
      !vehicleIconProfile({
        name: record.Name,
        type: "vehicle",
        system: {
          metadata: {
            Hull: record.Hull,
            Purpose: record.Purpose,
            Class: record.Class,
          },
        },
      }).known,
  ),
  report = {
    format: "star-wars-ffg-actor-icon-audit",
    version: 1,
    renderedTokenSize: 64,
    decodedSourcePixels: { character: 512, vehicle: 2048 },
    characterFamilies: Object.keys(CHARACTER_ICON_ARCHETYPES).length,
    vehicleFamilies: Object.keys(VEHICLE_ICON_ARCHETYPES).length,
    databaseSpecies: species.length,
    databaseVehicleRecords: database.tables.vehicles.length,
    databaseHullLabels: new Set(
      database.tables.vehicles.map((record) => record.Hull).filter(Boolean),
    ).size,
    unknownSpecies: speciesUnknown,
    unknownVehicles: vehicleUnknown.map(({ ID, Name }) => ({ ID, Name })),
    maximumHeadBodyCentreError: Math.max(0, ...alignmentErrors),
    failures,
    result: failures.length || speciesUnknown.length || vehicleUnknown.length ? "fail" : "pass",
  };

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (report.result !== "pass") process.exitCode = 1;
