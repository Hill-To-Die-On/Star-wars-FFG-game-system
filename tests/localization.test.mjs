import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateLocaleManifest, localize, SUPPORTED_LOCALES } from "../src/localization.mjs";

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
