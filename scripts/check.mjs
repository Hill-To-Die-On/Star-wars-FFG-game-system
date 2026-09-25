import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import Handlebars from "handlebars";
import { DICE } from "../src/dice/core.mjs";
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
JSON.parse(await readFile("docs/schemas/integration-v1.schema.json", "utf8"));
if (manifest.version !== pkg.version)
  throw new Error("Manifest and package versions differ");
for (const path of [
  ...manifest.esmodules,
  ...manifest.styles,
  ...manifest.languages.map((l) => l.path),
])
  await readFile(path);
for (const [key, die] of Object.entries(DICE))
  for (let i = 1; i <= die.faces.length; i++) {
    const png = await readFile(`assets/dice/${key}-${i}.png`);
    if (png.readUInt32BE(16) !== 256 || png.readUInt32BE(20) !== 256)
      throw new Error("Dice face must be 256 × 256");
  }
console.log(
  "Syntax, templates, manifest, integration schema, versions and all 64 dice assets passed.",
);
