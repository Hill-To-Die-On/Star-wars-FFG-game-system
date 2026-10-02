import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  ACTOR_ICON_PALETTES,
  CHARACTER_ICON_ARCHETYPES,
  VEHICLE_ICON_ARCHETYPES,
  actorIconDescriptor,
  characterIconProfile,
  vehicleIconProfile,
} from "../src/actor-icons.mjs";
import { vehicleTokenDimensions } from "../src/vehicle-footprints.mjs";

const output = new URL("../docs/images/actor-icon-contact-sheet.svg", import.meta.url);
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const text = (label, x, y, className = "label", anchor = "middle") =>
  `<text class="${className}" x="${x}" y="${y}" text-anchor="${anchor}">${escape(label)}</text>`;
const icon = (actor, x, y, size) => {
  const descriptor = actorIconDescriptor(actor),
    inner = descriptor.svg.match(/<title>.*?<\/title>(.*)<\/svg>$/s)?.[1] ?? "";
  return `<g transform="translate(${x} ${y}) scale(${size / 100})" style="color:${descriptor.palette.foreground}">${inner}</g>`;
};

const roleActors = {
  player: { name: "Player", type: "character", hasPlayerOwner: true, system: { species: "Human" } },
  ally: {
    name: "Ally",
    type: "character",
    hasPlayerOwner: false,
    prototypeToken: { disposition: 1 },
    system: { species: "Human" },
  },
  npc: {
    name: "NPC",
    type: "character",
    hasPlayerOwner: false,
    prototypeToken: { disposition: -1 },
    system: { species: "Human" },
  },
  minion: { name: "Minion", type: "minion", system: { species: "Human" } },
  rival: { name: "Rival", type: "rival", system: { species: "Human" } },
  nemesis: { name: "Nemesis", type: "nemesis", system: { species: "Human" } },
  vehicle: { name: "Vehicle", type: "vehicle", system: { silhouette: 3, model: "Starfighter" } },
  group: { name: "Group", type: "group", system: {} },
};

const database = JSON.parse(
    await readFile(new URL("../data/reference-database.json", import.meta.url), "utf8"),
  ),
  speciesNames = [
    ...new Set(database.tables.species.map((record) => record.Species).filter(Boolean)),
  ],
  speciesCounts = Object.fromEntries(
    Object.keys(CHARACTER_ICON_ARCHETYPES).map((key) => [
      key,
      speciesNames.filter((name) => characterIconProfile(name).archetype === key).length,
    ]),
  ),
  vehicleProfiles = database.tables.vehicles.map((record) => ({
    record,
    profile: vehicleIconProfile({
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
  })),
  vehicleCounts = Object.fromEntries(
    Object.keys(VEHICLE_ICON_ARCHETYPES).map((key) => [
      key,
      {
        records: vehicleProfiles.filter(({ profile }) => profile.archetype === key).length,
        hulls: new Set(
          vehicleProfiles
            .filter(({ profile }) => profile.archetype === key)
            .map(({ record }) => record.Hull)
            .filter(Boolean),
        ).size,
      },
    ]),
  ),
  speciesSamples = Object.entries(CHARACTER_ICON_ARCHETYPES),
  vehicleSamples = Object.entries(VEHICLE_ICON_ARCHETYPES);

const cells = [];
function iconGrid(entries, y, makeActor, metaFor) {
  entries.forEach(([key, label], index) => {
    const column = index % 6,
      row = Math.floor(index / 6),
      x = 105 + column * 270,
      top = y + row * 180,
      actor = makeActor(key, label);
    cells.push(`<g>${icon(actor, x, top, 112)}${text(label, x + 56, top + 136, "icon-label")}${text(metaFor(key), x + 56, top + 159, "meta")}</g>`);
  });
}

Object.keys(ACTOR_ICON_PALETTES).forEach((key, index) => {
  const x = 105 + index * 205,
    y = 250,
    palette = ACTOR_ICON_PALETTES[key];
  cells.push(`<g>${icon(roleActors[key], x, y, 112)}${text(palette.label, x + 56, y + 136, "icon-label")}${text(palette.background.toUpperCase(), x + 56, y + 159, "meta")}</g>`);
});

iconGrid(speciesSamples, 520, (archetype, label) => ({
  name: label,
  type: "character",
  hasPlayerOwner: true,
  system: { species: label },
  flags: { "star-wars-ffg": { iconArchetype: archetype } },
}), (key) => `${speciesCounts[key]} database species`);

iconGrid(vehicleSamples, 1300, (archetype, label) => ({
  name: label,
  type: "vehicle",
  system: {
    silhouette: archetype === "destroyer" || archetype === "station" ? 7 : 3,
    footprint: { mode: "automatic", hull: "auto", length: 0, width: 0 },
  },
  flags: { "star-wars-ffg": { iconArchetype: archetype } },
}), (key) => `${vehicleCounts[key].hulls} hulls · ${vehicleCounts[key].records} vehicles`);

function footprintCard(actor, x, y, gridDistance, title) {
  const dimensions = vehicleTokenDimensions(actor, {
      grid: { size: 60, distance: gridDistance, units: "m" },
    }),
    cell = 48,
    gridWidth = 6 * cell,
    gridHeight = 5 * cell,
    footprintWidth = dimensions.width * cell,
    footprintHeight = dimensions.height * cell,
    left = x + (gridWidth - footprintWidth) / 2,
    top = y + 54 + (gridHeight - footprintHeight) / 2,
    badge = Math.min(92, footprintWidth, footprintHeight),
    lines = [];
  for (let column = 0; column <= 6; column++)
    lines.push(`<path d="M${x + column * cell} ${y + 54}V${y + 54 + gridHeight}"/>`);
  for (let row = 0; row <= 5; row++)
    lines.push(`<path d="M${x} ${y + 54 + row * cell}H${x + gridWidth}"/>`);
  return `<g class="footprint-card">${text(title, x + gridWidth / 2, y + 22, "icon-label")}${text(`${gridDistance} m grid · ${dimensions.width} × ${dimensions.height} spaces`, x + gridWidth / 2, y + 44, "meta")}<g class="grid">${lines.join("")}</g><rect class="footprint" x="${left}" y="${top}" width="${footprintWidth}" height="${footprintHeight}" rx="10"/>${icon(actor, left + (footprintWidth - badge) / 2, top + (footprintHeight - badge) / 2, badge)}<circle class="boarder" cx="${left + footprintWidth * 0.76}" cy="${top + footprintHeight * 0.72}" r="20"/><path class="boarder-mark" d="M${left + footprintWidth * 0.76 - 9} ${top + footprintHeight * 0.72 + 8}q9-17 18 0M${left + footprintWidth * 0.76} ${top + footprintHeight * 0.72 - 9}v8"/></g>`;
}

const footprintY = 2150;
cells.push(
  footprintCard(
    {
      name: "Repulsor Tank",
      type: "vehicle",
      system: {
        silhouette: 3,
        footprint: { mode: "automatic", hull: "tank", length: 0, width: 0 },
      },
    },
    105,
    footprintY,
    5,
    "Tank with boarder",
  ),
  footprintCard(
    {
      name: "Scout Walker",
      type: "vehicle",
      system: {
        silhouette: 3,
        footprint: { mode: "automatic", hull: "walker", length: 0, width: 0 },
      },
    },
    650,
    footprintY,
    5,
    "Walker with boarder",
  ),
  footprintCard(
    {
      name: "Interceptor",
      type: "vehicle",
      system: {
        silhouette: 3,
        footprint: { mode: "automatic", hull: "fighter", length: 0, width: 0 },
      },
    },
    1195,
    footprintY,
    10,
    "Starfighter",
  ),
);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2600" viewBox="0 0 1800 2600" role="img" aria-labelledby="title description"><title id="title">Procedural actor icon contact sheet</title><desc id="description">Role colours, every character silhouette family, every vehicle hull-symbol family and canvas footprint examples.</desc><style>
  .page{fill:#091216}.panel{fill:#101d22;stroke:#34505a;stroke-width:2}.title{fill:#f7e5b2;font:700 46px system-ui,sans-serif;letter-spacing:4px}.subtitle{fill:#a8bec3;font:24px system-ui,sans-serif}.section{fill:#f7e5b2;font:700 30px system-ui,sans-serif;letter-spacing:2px}.icon-label{fill:#f4efe0;font:700 18px system-ui,sans-serif}.meta{fill:#98adb2;font:13px ui-monospace,monospace;text-transform:uppercase}.rule{stroke:#34505a;stroke-width:2}.grid path{stroke:#526971;stroke-width:1;opacity:.65}.footprint{fill:#1f5365;fill-opacity:.34;stroke:#83aeb7;stroke-width:3;stroke-dasharray:8 6}.boarder{fill:#173d4d;stroke:#f7e5b2;stroke-width:3}.boarder-mark{fill:none;stroke:#f7e5b2;stroke-width:2;stroke-linecap:round}
</style><rect class="page" width="1800" height="2600"/><rect class="panel" x="55" y="55" width="1690" height="2490" rx="26"/>${text("PROCEDURAL ACTOR ICONS", 100, 120, "title", "start")}${text("Original SVG pictograms · 173 species · 110 hull labels · 399 vehicle records", 100, 158, "subtitle", "start")}${text("ROLE COLOURS", 100, 205, "section", "start")}<path class="rule" d="M100 225H1700"/>${text("CHARACTER VISUAL FAMILIES", 100, 465, "section", "start")}<path class="rule" d="M100 485H1700"/>${text("VEHICLE HULL FAMILIES", 100, 1245, "section", "start")}<path class="rule" d="M100 1265H1700"/>${text("CANVAS FOOTPRINTS", 100, 2095, "section", "start")}<path class="rule" d="M100 2115H1700"/>${cells.join("")}</svg>`;

await mkdir(new URL("../docs/images/", import.meta.url), { recursive: true });
await writeFile(output, svg, "utf8");
console.log(`Wrote ${output.pathname}`);

if (process.argv.includes("--png")) {
  const { chromium } = await import("playwright"),
    browser = await chromium.launch({
      headless: true,
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 2600 } });
    await page.goto(output.href);
    const session = await page.context().newCDPSession(page),
      capture = await session.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: 1800, height: 2600, scale: 1 },
      });
    await writeFile(
      new URL("../docs/images/actor-icon-contact-sheet.png", import.meta.url),
      Buffer.from(capture.data, "base64"),
    );
  } finally {
    await browser.close();
  }
}
