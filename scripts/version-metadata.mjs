import { readFile } from "node:fs/promises";

export const VERSION_FILES = { pkg: "package.json", lock: "package-lock.json", manifest: "system.json", changelog: "CHANGELOG.md" };
const numberedHeading = /^## (\d+\.\d+\.\d+) — (Unreleased|\d{4}-\d{2}-\d{2})\s*$/m;

export function parseVersion(version) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error("Version must be three numeric parts, for example 0.4.0; Foundry does not support SemVer prerelease/build suffixes.");
  const parts = version.split(".").map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error("Version components must be safe integers.");
  return parts;
}

export async function readVersionMetadata() {
  return Object.fromEntries(await Promise.all(Object.entries(VERSION_FILES).map(async ([key, path]) => {
    const text = await readFile(path, "utf8");
    return [key, key === "changelog" ? text : JSON.parse(text)];
  })));
}

export function validateVersionMetadata({ pkg, lock, manifest, changelog }) {
  const version = pkg.version;
  parseVersion(version);
  if (manifest.version !== version || lock.version !== version || lock.packages?.[""]?.version !== version)
    throw new Error("Package, lockfile and Foundry manifest versions must match. Run npm run version:set -- <version>.");
  if (manifest.download !== `${manifest.url}/releases/download/v${version}/star-wars-ffg.zip`)
    throw new Error("Manifest download URL must match the package version.");
  const firstHeading = changelog.match(/^## .*$/m)?.[0];
  if (firstHeading?.match(numberedHeading)?.[1] !== version)
    throw new Error("The first changelog section must identify the package version and its Unreleased or release date status.");
  return version;
}

export function updateVersionMetadata(data, version) {
  const next = parseVersion(version);
  const current = parseVersion(data.pkg.version);
  const different = next.findIndex((part, index) => part !== current[index]);
  if (different >= 0 && next[different] < current[different]) throw new Error("Version cannot move backwards.");
  const updated = structuredClone(data);
  updated.pkg.version = updated.lock.version = updated.lock.packages[""].version = updated.manifest.version = version;
  updated.manifest.download = `${updated.manifest.url}/releases/download/v${version}/star-wars-ffg.zip`;
  const first = updated.changelog.match(/^## .*$/m);
  if (!first) throw new Error("Changelog needs an existing release or Unreleased section before setting a version.");
  const parsed = first[0].match(numberedHeading);
  if (first[0].trim() === "## Unreleased" || parsed?.[2] === "Unreleased") {
    updated.changelog = updated.changelog.slice(0, first.index) + `## ${version} — Unreleased` + updated.changelog.slice(first.index + first[0].length);
  } else if (parsed?.[1] !== version) {
    if (!parsed) throw new Error("Unrecognized changelog version heading.");
    updated.changelog = updated.changelog.slice(0, first.index) + `## ${version} — Unreleased\n\n` + updated.changelog.slice(first.index);
  }
  validateVersionMetadata(updated);
  return updated;
}
