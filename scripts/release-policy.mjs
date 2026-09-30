import { createHash } from "node:crypto";

const ROOT_FILES = new Set(["system.json", "README.md", "LICENSE", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]);
const DATA_FILES = new Set(["reference-database.json", "reference-library.json", "advancement-trees.json", "vehicle-stats.json", "vehicle-loadouts.json", "source-verification.json", "source-requests.json", "roll-tables.json", "species-abilities.json", "book-play-guidance.json"]);
const RUNTIME_DIRS = new Set(["src", "templates", "styles", "assets", "lang", "docs"]);
const REPOSITORY = "https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system";
const decoder = new TextDecoder();

export function validateReleasePath(name) {
  if (typeof name !== "string" || !name || name.includes("\\") || name.startsWith("/") ||
      /[\u0000-\u001f:]/.test(name) || name.split("/").some(part => !part || part === "." || part === ".."))
    throw new Error("Unsafe release entry path.");
  const parts = name.split("/");
  if (parts.some(part => part.startsWith(".") || ["node_modules", "test-results", "coverage"].includes(part)) ||
      /\.(?:pdf|sql|xml|accdb|mdb|sqlite|db|pem|key|pfx|p12|psd|psb|zip|map)$/i.test(name))
    throw new Error("Forbidden release entry: " + name);
  if (!ROOT_FILES.has(name) && !RUNTIME_DIRS.has(parts[0]) && !(parts[0] === "data" && parts.length === 2 && DATA_FILES.has(parts[1])))
    throw new Error("Release entry is outside the allow-list: " + name);
}

function inspectContents(name, bytes) {
  const header = decoder.decode(bytes.subarray(0, 1024));
  if (/^\s*%PDF-/.test(header) || /Standard (?:Jet|ACE) DB/.test(header) || /^SQLite format 3/.test(header))
    throw new Error("Forbidden source document disguised as " + name);
  if (!/\.(?:mjs|js|ts|mts|cts|css|hbs|html|json|md|txt|svg|yaml|yml|toml|patch)$/i.test(name) && !ROOT_FILES.has(name)) return;
  const text = decoder.decode(bytes);
  if (/[A-Z]:[\\\/]+Users[\\\/]+[^\\\/\s]+[\\\/]|\/(?:Users|home)\/[^/\s]+\//i.test(text))
    throw new Error("Private path found in " + name);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/.test(text))
    throw new Error("Credential material found in " + name);
}

/** Audit the actual archive bytes, not only the build's proposed file list. */
export function auditReleaseFiles(files, { version, inventory, manifestBytes } = {}) {
  const names = Object.keys(files);
  if (!names.length) throw new Error("Release archive is empty.");
  for (const name of names) {
    validateReleasePath(name);
    if (!(files[name] instanceof Uint8Array)) throw new Error("Invalid release entry bytes: " + name);
    inspectContents(name, files[name]);
  }
  if (!Array.isArray(inventory) || inventory.length !== names.length ||
      new Set(inventory).size !== inventory.length ||
      [...inventory].sort().some((name, index) => name !== [...names].sort()[index]))
    throw new Error("Release inventory does not exactly match the archive.");
  for (const required of ["system.json", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"])
    if (!files[required]?.length) throw new Error("Missing release entry: " + required);
  const manifestText = decoder.decode(files["system.json"]);
  if (!(manifestBytes instanceof Uint8Array) || !Buffer.from(files["system.json"]).equals(Buffer.from(manifestBytes)))
    throw new Error("Download manifest differs from the archive manifest.");
  const manifest = JSON.parse(manifestText);
  if (manifest.id !== "star-wars-ffg") throw new Error("Unexpected system identifier.");
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version) || manifest.version !== version)
    throw new Error("Manifest and package version differ or are invalid.");
  if (manifest.url !== REPOSITORY || manifest.manifest !== REPOSITORY + "/releases/latest/download/system.json" ||
      manifest.download !== REPOSITORY + "/releases/download/v" + version + "/star-wars-ffg.zip")
    throw new Error("Release URL does not point to the expected repository and version.");
  for (const field of ["esmodules", "styles", "languages"])
    if (!Array.isArray(manifest[field]) || !manifest[field].length) throw new Error("Missing manifest entrypoints: " + field);
  for (const entry of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(language => language.path)]) {
    validateReleasePath(entry);
    if (!files[entry]?.length) throw new Error("Missing manifest entrypoint: " + entry);
  }
  if (manifest.compatibility?.minimum !== "14" || manifest.compatibility?.maximum !== "14" || !/^14(?:\.\d+)?$/.test(manifest.compatibility?.verified ?? ""))
    throw new Error("Foundry compatibility must match the supported v14 runtime.");
  return {
    schemaVersion: 1, passed: true, systemId: manifest.id, version, fileCount: names.length,
    files: names.sort().map(path => ({ path, bytes: files[path].length, sha256: createHash("sha256").update(files[path]).digest("hex") }))
  };
}
