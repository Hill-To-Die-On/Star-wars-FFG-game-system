import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
const files = {};
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await collect(name);
    else files[name] = new Uint8Array(await readFile(name));
  }
}
// Positive allow-list: private imports, previews, tests and PDFs can never enter a release.
for (const dir of ["src", "templates", "styles", "assets", "lang", "docs"])
  await collect(dir);
for (const name of [
  "system.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "THIRD_PARTY_NOTICES.md",
  "data/reference-database.json",
  "data/reference-library.json",
  "data/advancement-trees.json",
  "data/source-verification.json",
  "data/source-requests.json",
])
  files[name] = new Uint8Array(await readFile(name));
for (const name of Object.keys(files))
  if (/(?:\.local|\.pdf$|\.sql$|\.xml$|\.env)/i.test(name))
    throw new Error(`Forbidden release entry ${name}`);
await mkdir("dist", { recursive: true });
await writeFile("dist/star-wars-ffg.zip", zipSync(files, { level: 9 }));
await writeFile("dist/system.json", files["system.json"]);
await writeFile(
  "dist/contents.json",
  JSON.stringify(Object.keys(files).sort(), null, 2),
);
console.log(
  `Packaged ${Object.keys(files).length} public files, including the creator-authorized reference database; no PDFs or private adventure imports.`,
);
