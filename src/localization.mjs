/**
 * Localisation helpers shared by runtime dialogs and settings.
 *
 * Foundry loads the language selected in Configure Settings from the files
 * declared by system.json. Keeping the fallback beside each call means the
 * system remains usable while Foundry is still booting and when an optional
 * translation has not supplied a newer key yet.
 */
export const REQUIRED_TRANSLATION_KEYS = Object.freeze([
  "TYPES.Actor.character",
  "TYPES.Actor.minion",
  "TYPES.Actor.rival",
  "TYPES.Actor.nemesis",
  "TYPES.Actor.vehicle",
  "TYPES.Actor.group",
  "TYPES.Item.weapon",
  "TYPES.Item.armor",
  "TYPES.Item.gear",
  "TYPES.Item.talent",
  "TYPES.Item.forcePower",
  "TYPES.Item.species",
  "TYPES.Item.career",
  "TYPES.Item.specialization",
  "TYPES.Item.signatureAbility",
  "TYPES.Item.attachment",
  "TYPES.Item.reference",
  "SWFFG.System.Title",
  "SWFFG.System.About",
  "SWFFG.Common.Close",
  "SWFFG.Common.Cancel",
  "SWFFG.Common.Save",
  "SWFFG.Common.Search",
  "SWFFG.Common.Open",
  "SWFFG.Common.Record",
  "SWFFG.Common.Apply",
  "SWFFG.Common.Back",
  "SWFFG.Common.Next",
  "SWFFG.Settings.Groups.CampaignSetup",
  "SWFFG.Settings.Groups.Appearance",
  "SWFFG.Settings.Groups.CombatTurns",
  "SWFFG.Settings.Groups.PlayTools",
  "SWFFG.Settings.Groups.ImportsSources",
  "SWFFG.Settings.Groups.HelpDiagnostics",
  "SWFFG.Settings.Groups.Other",
  "SWFFG.Settings.About.Name",
  "SWFFG.Settings.About.Label",
  "SWFFG.Settings.About.Hint",
  "SWFFG.Settings.Destiny.Name",
  "SWFFG.Settings.Destiny.Hint",
  "SWFFG.Settings.Reference.Name",
  "SWFFG.Settings.Reference.Label",
  "SWFFG.Settings.Reference.Hint",
  "SWFFG.Settings.DataReview.Name",
  "SWFFG.Settings.DataReview.Label",
  "SWFFG.Settings.DataReview.Hint",
  "SWFFG.Settings.OwnedBooks.Name",
  "SWFFG.Settings.OwnedBooks.Label",
  "SWFFG.Settings.OwnedBooks.Hint",
  "SWFFG.Settings.Console.Name",
  "SWFFG.Settings.Console.Label",
  "SWFFG.Settings.Console.Hint",
  "SWFFG.HUD.Destiny",
  "SWFFG.HUD.Light",
  "SWFFG.HUD.Dark",
  "SWFFG.HUD.Actions",
  "SWFFG.HUD.Maneuvers",
  "SWFFG.Sheets.Equipment",
  "SWFFG.Sheets.Abilities",
  "SWFFG.Sheets.Biography",
]);

export const SUPPORTED_LOCALES = Object.freeze([
  "en",
  "en-GB",
  "en-US",
  "es",
  "fr",
  "de",
  "it",
  "pt-BR",
  "pt-PT",
  "ja",
  "ko",
  "zh-CN",
  "zh-TW",
  "pl",
  "ru",
  "nl",
  "sv",
]);

export function localize(key, fallback = key) {
  try {
    const translated = globalThis.game?.i18n?.localize?.(key);
    if (typeof translated === "string" && translated && translated !== key)
      return translated;
  } catch {
    // Foundry is not available to pure data tests or while modules initialise.
  }
  return fallback;
}

export function localizeFormat(key, data = {}, fallback = key) {
  try {
    const format = globalThis.game?.i18n?.format;
    if (typeof format === "function") {
      const translated = format.call(globalThis.game.i18n, key, data);
      if (typeof translated === "string" && translated && translated !== key)
        return translated;
    }
  } catch {
    // Use the readable fallback when Foundry is not ready.
  }
  return localize(key, fallback);
}

export function validateLocaleManifest(languages, translationsByPath) {
  if (!Array.isArray(languages) || !languages.length)
    throw new Error("At least one system language must be registered.");
  const seen = new Set();
  const registered = new Set();
  for (const language of languages) {
    if (!language || typeof language !== "object")
      throw new Error("System language entries must be objects.");
    const lang = String(language.lang ?? "");
    if (!lang || !language.name || !language.path)
      throw new Error("System language entries require lang, name and path.");
    let canonical;
    try {
      canonical = Intl.getCanonicalLocales(lang)[0];
    } catch {
      throw new Error(`Invalid system language locale: ${lang}.`);
    }
    if (canonical !== lang)
      throw new Error(`System language locale must be canonical: ${lang}.`);
    if (seen.has(lang)) throw new Error(`Duplicate system language: ${lang}.`);
    seen.add(lang);
    registered.add(lang);
    if (!/^lang\/[A-Za-z0-9-]+\.json$/.test(language.path))
      throw new Error(`System language path is outside lang/: ${language.path}.`);
    const translations = translationsByPath?.[language.path];
    if (!translations || Array.isArray(translations) || typeof translations !== "object")
      throw new Error(`Language file is not a JSON object: ${language.path}.`);
    for (const key of REQUIRED_TRANSLATION_KEYS) {
      if (typeof translations[key] !== "string" || !translations[key].trim())
        throw new Error(`${language.path} is missing translation key ${key}.`);
    }
  }
  if (!registered.has("en")) throw new Error("The default en locale is required.");
  for (const locale of SUPPORTED_LOCALES)
    if (!registered.has(locale)) throw new Error(`Manifest is missing locale ${locale}.`);
  return true;
}

