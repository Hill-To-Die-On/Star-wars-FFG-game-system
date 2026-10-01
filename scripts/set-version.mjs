import { writeFile } from "node:fs/promises";
import { VERSION_FILES, readVersionMetadata, updateVersionMetadata } from "./version-metadata.mjs";

if (process.argv.length !== 3) throw new Error("Usage: npm run version:set -- <major.minor.patch>");
// Validate the entire update before writing any file; this command neither tags nor publishes.
const updated = updateVersionMetadata(await readVersionMetadata(), process.argv[2]);
for (const [key, path] of Object.entries(VERSION_FILES))
  await writeFile(path, key === "changelog" ? updated[key] : JSON.stringify(updated[key], null, 2) + "\n");
console.log(`Candidate version ${updated.pkg.version}: package, lockfile, manifest/download and changelog synchronized. No release published.`);
