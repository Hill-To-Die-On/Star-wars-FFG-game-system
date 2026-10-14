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

test("the Alpha advertises English while retained translations remain available for review", async () => {
  assert.deepEqual(
    manifest.languages.map((language) => language.lang),
    ["en"],
  );
  assert.equal(validateLocaleManifest(manifest.languages, translations), true);
  for (const locale of SUPPORTED_LOCALES) {
    const path = `lang/${locale}.json`;
    const retained = JSON.parse(await readFile(path, "utf8"));
    assert.equal(validateLocaleManifest([
      manifest.languages[0],
      ...(locale === "en" ? [] : [{ lang: locale, name: locale, path }]),
    ], { ...translations, [path]: retained }), true);
  }
});

test("locale subsets still require English and reject unknown or duplicate locales", () => {
  assert.throws(() => validateLocaleManifest([], {}), /at least one/i);
  assert.throws(() => validateLocaleManifest([
    { lang: "fr", name: "French", path: "lang/fr.json" },
  ], { "lang/fr.json": translations["lang/en.json"] }), /default en/i);
  assert.throws(() => validateLocaleManifest([
    ...manifest.languages,
    { lang: "en-AU", name: "English Australia", path: "lang/en-AU.json" },
  ], { ...translations, "lang/en-AU.json": translations["lang/en.json"] }), /unsupported locale/i);
  assert.throws(() => validateLocaleManifest([
    manifest.languages[0], manifest.languages[0],
  ], translations), /duplicate/i);
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
  const normalizeStaticPhrase = (value) => value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[·,./:;()]+|[·,./:;()]+$/g, "")
    .trim();
  const isNotation = (value) => /^(?:[A-Z](?:\/[A-Z])?|m|cr|XP|×|·|,|\.)$/.test(value);
  for (const file of (await readdir("templates")).filter((entry) => entry.endsWith(".hbs"))) {
    const source = await readFile(`templates/${file}`, "utf8");
    const phrases = new Set();
    // Replace Handlebars expressions with boundaries, then inspect each
    // literal fragment independently. This catches `Roll {{selected.die}}`
    // without joining unrelated branches or dynamic values into one phrase.
    const staticSource = source.replace(/{{{?[\s\S]*?}?}}/g, "\u0000");
    for (const fragment of staticSource.split(/<[^>]*>|\u0000/g)) {
      const phrase = fragment.replace(/\s+/g, " ").trim();
      const normalized = normalizeStaticPhrase(phrase);
      if (normalized && !isNotation(normalized)) {
        const candidates = [phrase, `${phrase}.`, `${phrase}:`, `${phrase}…`];
        if (candidates.some((candidate) => UI_PHRASES[candidate])) phrases.add(phrase);
        else for (const part of phrase.split("·")) {
          const subphrase = normalizeStaticPhrase(part);
          if (subphrase && !isNotation(subphrase)) phrases.add(subphrase);
        }
      }
    }
    for (const match of source.matchAll(/(?:aria-label|title|placeholder|aria-description)="([^"]+)"/g)) {
      const phrase = match[1].trim();
      if (phrase && !phrase.includes("{{")) phrases.add(phrase);
    }
    for (const phrase of phrases) {
      if ([phrase, `${phrase}.`, `${phrase}:`, `${phrase}…`].some((candidate) => UI_PHRASES[candidate])) continue;
      if (phrase.length > 1) missing.push(`${file}: ${phrase}`);
    }
  }
  assert.deepEqual([...new Set(missing)].sort(), []);
});
