import test from "node:test";
import assert from "node:assert/strict";
import { auditReleaseFiles } from "../scripts/release-policy.mjs";

const manifest = {
  id: "star-wars-ffg", version: "0.3.0", compatibility: { minimum: "14", verified: "14.368", maximum: "14" },
  url: "https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system",
  manifest: "https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/latest/download/system.json",
  download: "https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/download/v0.3.0/star-wars-ffg.zip",
  esmodules: ["src/main.mjs"], styles: ["styles/system.css"], languages: [{path:"lang/en.json"}]
};
const encode = value => new TextEncoder().encode(value);
function fixture() {
  return {
    "system.json": encode(JSON.stringify(manifest)),
    "src/main.mjs": encode("export const ready = true;"),
    "styles/system.css": encode("body {color: white}"),
    "lang/en.json": encode("{}"),
    "README.md": encode("Original system. Books are required."),
    "LICENSE": encode("MIT"),
    "THIRD_PARTY_NOTICES.md": encode("Recorded provenance"),
    "assets/badge.svg": encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  };
}
function audit(files=fixture(), options={}) {
  return auditReleaseFiles(files, {
    version: "0.3.0", inventory: Object.keys(files).sort(),
    manifestBytes: files["system.json"], ...options
  });
}
test("a self-contained original runtime package passes and reports its entry count", () => {
  assert.equal(audit().fileCount, 8);
});
test("private paths and disguised source documents are rejected regardless of folder", () => {
  for (const name of ["docs/book.pdf", "docs/backup.SQL", "assets/source.accdb", "assets/.env", "../escape.mjs", "src/../../key", "C:/Users/example/key", "docs/.local/chart.json", "tests/fixture.mjs"]) {
    const files=fixture(); files[name]=encode("private");
    assert.throws(()=>audit(files), /forbidden|unsafe|allow-list/i, name);
  }
  const renamed=fixture(); renamed["assets/map.png"]=encode("%PDF-1.7\nprivate page");
  assert.throws(()=>audit(renamed), /source document/i);
});
test("private machine paths and credential values cannot ship in text assets", () => {
  for (const text of ["C:\\Users\\private-user\\OneDrive\\book", "/home/private-user/campaign/source", "const apiKey = 'sk-"+"x".repeat(40)+"';", "-----BEGIN PRIVATE KEY-----"]) {
    const files=fixture(); files["docs/leak.md"]=encode(text);
    assert.throws(()=>audit(files), /private path|credential/i);
  }
});
test("URL drift, missing entrypoints, package version and detached manifests fail", () => {
  for (const patch of [{version:"0.4.0"}, {download:"https://evil.example/package.zip"}, {esmodules:["src/missing.mjs"]}, {id:"another-system"}]) {
    const files=fixture(); files["system.json"]=encode(JSON.stringify({...manifest,...patch}));
    assert.throws(()=>audit(files), /version|URL|entry|identifier/i);
  }
  assert.throws(()=>audit(fixture(), {manifestBytes: encode("{}")}), /manifest differs/i);
});
test("inventory is an exact nonempty list rather than a self-attested partial package", () => {
  assert.throws(()=>audit(fixture(), {inventory:["system.json"]}), /inventory/i);
  assert.throws(()=>audit(fixture(), {inventory:[...Object.keys(fixture()),"system.json"]}), /inventory/i);
  assert.throws(()=>auditReleaseFiles({}, {version:"0.3.0",inventory:[],manifestBytes:encode("{}")}), /empty/i);
});