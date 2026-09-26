import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import Handlebars from "handlebars";
import { DICE } from "../src/dice/core.mjs";
import { validateVehicleData } from "../src/vehicle-data.mjs";
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
const pkg = JSON.parse(await readFile("package.json", "utf8"));
for (const version of [1, 2])
  JSON.parse(
    await readFile(`docs/schemas/integration-v${version}.schema.json`, "utf8"),
  );
validateVehicleData(
  JSON.parse(await readFile("data/vehicle-stats.json", "utf8")),
);
if (manifest.version !== pkg.version)
  throw new Error("Manifest and package versions differ");
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
  "Syntax, templates, manifest, integration schemas, versions, public vehicle data, NASA backdrop provenance, all 64 dice faces and versioned d8 aliases passed.",
);
