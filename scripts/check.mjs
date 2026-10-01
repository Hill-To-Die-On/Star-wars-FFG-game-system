import { readFile, readdir } from "node:fs/promises";
import { readVersionMetadata, validateVersionMetadata } from "./version-metadata.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import Handlebars from "handlebars";
import { DICE } from "../src/dice/core.mjs";
import { validateVehicleData } from "../src/vehicle-data.mjs";
import { validateVehicleLoadouts } from "../src/vehicle-loadout-data.mjs";
import { validateRollTables } from "../src/roll-tables.mjs";
import { validateSpeciesAbilityRegistry } from "../src/species-abilities.mjs";
import { validateBookPlayGuidance } from "../src/book-play-guidance.mjs";
import { normalizeBookTitle } from "../src/rules.mjs";
import { auditOriginData } from "../src/origin-data-audit.mjs";
import { validateLocaleManifest } from "../src/localization.mjs";
const typecheck = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json", "--pretty", "false"], { encoding: "utf8" });
if (typecheck.error || typecheck.status !== 0) throw new Error("TypeScript checks failed.\n" + (typecheck.error?.message ?? "") + typecheck.stdout + typecheck.stderr);
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true }))
    result.push(
      ...(entry.isDirectory()
        ? await walk(`${dir}/${entry.name}`)
        : [`${dir}/${entry.name}`]),
    );
  return result;
}
for (const file of [
  ...(await walk("src")),
  ...(await walk("scripts")),
  ...(await walk("tests")),
].filter((f) => f.endsWith(".mjs"))) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`${file}\n${result.stderr}`);
}
for (const file of await walk("templates"))
  Handlebars.precompile(await readFile(file, "utf8"));
const manifest = JSON.parse(await readFile("system.json", "utf8"));
const translations = Object.fromEntries(
  await Promise.all(
    manifest.languages.map(async (language) => [
      language.path,
      JSON.parse(await readFile(language.path, "utf8")),
    ]),
  ),
);
validateLocaleManifest(manifest.languages, translations);

for (const version of [1, 2])
  JSON.parse(
    await readFile(`docs/schemas/integration-v${version}.schema.json`, "utf8"),
  );
validateVehicleData(
  JSON.parse(await readFile("data/vehicle-stats.json", "utf8")),
);
validateVehicleLoadouts(JSON.parse(await readFile("data/vehicle-loadouts.json", "utf8")));
const referenceDatabase = JSON.parse(await readFile("data/reference-database.json", "utf8"));
validateRollTables(
  JSON.parse(await readFile("data/roll-tables.json", "utf8")),
  referenceDatabase.tables.books,
);
const speciesRegistry = validateSpeciesAbilityRegistry(
  JSON.parse(await readFile("data/species-abilities.json", "utf8")),
);
const speciesRows = referenceDatabase.tables.species;
for (const entry of speciesRegistry.entries)
  if (!speciesRows.some((row) => row.Playable === "TRUE" && row.Species === entry.species &&
    normalizeBookTitle(row.Book) === normalizeBookTitle(entry.source.book) &&
    String(row.Page) === String(entry.source.cataloguePage)))
    throw new Error(`Species ability source is absent from the public catalogue: ${entry.species}.`);
const originAudit = auditOriginData({
  database: referenceDatabase,
  advancement: JSON.parse(await readFile("data/advancement-trees.json", "utf8")),
  speciesAbilities: speciesRegistry,
  sourceVerification: JSON.parse(await readFile("data/source-verification.json", "utf8")),
});
if (!originAudit.ok)
  throw new Error(
    "Origin data audit failed.\n" +
      originAudit.errors.map((error) => `${error.code}: ${error.message}`).join("\n"),
  );
const playGuidance = validateBookPlayGuidance(
  JSON.parse(await readFile("data/book-play-guidance.json", "utf8")),
);
const registeredBooks = new Set(referenceDatabase.tables.books.map((row) => normalizeBookTitle(row.books)));
for (const entry of playGuidance.entries)
  if (!registeredBooks.has(normalizeBookTitle(entry.source.book)))
    throw new Error(`Book play guidance source is absent from the public catalogue: ${entry.id}.`);
validateVersionMetadata(await readVersionMetadata());
for (const path of [
  ...manifest.esmodules,
  ...manifest.styles,
  ...manifest.languages.map((l) => l.path),
])
  await readFile(path);
const backdrop = await readFile("assets/ui/saturn-enceladus-concept.webp");
const backdropHash = createHash("sha256")
  .update(backdrop)
  .digest("hex")
  .toUpperCase();
if (
  backdropHash !==
  "D20F953A162694D91BDBD5BE034C61E5A19D62DA75D79AA03EED62D110519337"
)
  throw new Error(
    "Interface backdrop differs from the recorded lossless transcode",
  );
for (const [key, die] of Object.entries(DICE))
  for (let i = 1; i <= die.faces.length; i++) {
    const names = [
      `assets/dice/${key}-${i}.png`,
      ...(key === "ability"
        ? [`assets/dice/${key}-${i}-v2.png`]
        : key === "difficulty"
          ? [`assets/dice/${key}-${i}-v3.png`]
          : []),
    ];
    for (const name of names) {
      const png = await readFile(name);
      if (png.readUInt32BE(16) !== 256 || png.readUInt32BE(20) !== 256)
        throw new Error("Dice face must be 256 × 256");
    }
  }
console.log(
  "TypeScript, syntax, templates, manifest, integration schemas, versions, public vehicle, origin, species and book-play data, NASA backdrop provenance, all 64 dice faces and versioned d8 aliases passed.",
);
