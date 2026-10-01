import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { validateLocaleManifest, localize, SUPPORTED_LOCALES, UI_PHRASES } from "../src/localization.mjs";

const manifest = JSON.parse(await readFile("system.json", "utf8"));
const translations = Object.fromEntries(
  await Promise.all(
    manifest.languages.map(async (language) => [
      language.path,
      JSON.parse(await readFile(language.path, "utf8")),
    ]),
  ),
);

test("every advertised locale is canonical, present, and complete for the core UI vocabulary", () => {
  assert.deepEqual(
    manifest.languages.map((language) => language.lang),
    SUPPORTED_LOCALES,
  );
  assert.equal(validateLocaleManifest(manifest.languages, translations), true);
});

test("localize uses Foundry's selected language and keeps a readable fallback", () => {
  const original = globalThis.game;
  globalThis.game = { i18n: { localize: (key) => key === "SWFFG.Common.Close" ? "Fermer" : key } };
  assert.equal(localize("SWFFG.Common.Close", "Close"), "Fermer");
  assert.equal(localize("SWFFG.Missing", "Readable fallback"), "Readable fallback");
  globalThis.game = original;
});

test("every static template label is present in the shared UI catalogue", async () => {
  const missing = [];
  for (const file of (await readdir("templates")).filter((entry) => entry.endsWith(".hbs"))) {
    const source = await readFile(`templates/${file}`, "utf8");
    const phrases = new Set();
    for (const match of source.matchAll(/>([^<>\n{}][^<>]*?)</g)) {
      const phrase = match[1].replace(/\s+/g, " ").trim();
      if (phrase && !/^[-·×+\d]+$/.test(phrase) && !phrase.includes("{{")) phrases.add(phrase);
    }
    for (const match of source.matchAll(/(?:aria-label|title|placeholder|aria-description)="([^"]+)"/g)) {
      const phrase = match[1].trim();
      if (phrase && !phrase.includes("{{")) phrases.add(phrase);
    }
    for (const phrase of phrases) if (!UI_PHRASES[phrase] && phrase.length > 1) missing.push(`${file}: ${phrase}`);
  }
  assert.deepEqual(missing, []);
});
