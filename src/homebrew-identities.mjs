import { SYSTEM_ID } from "./config.mjs";

export const HOME_BREW_REVIEW = "Homebrew identity: GM review of the recorded statistics and abilities is required.";
export const SPECIES_SOURCE_REVIEW = "Verify species abilities and any exceptional creation rules in the source book.";
const KINDS = ["species", "career", "model", "manufacturer"];
const homebrewSource = () => ({ book: "Homebrew", page: "", table: "", id: "" });

export function vehicleIdentityDefaults(actor, model, suppliedRegistration) {
  const current = actor.system ?? {};
  const bytes = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  const generated = current.registration || suppliedRegistration ? "" : bytes();
  const registration = current.registration || suppliedRegistration || `SW-${generated.slice(0, 4)}-${generated.slice(4)}`;
  const defaultName = `${model} · ${registration}`;
  const currentName = String(actor.name ?? "").trim();
  const automatic = !currentName || /^Vehicle(?:\s+\d+)?$/i.test(currentName) || currentName === current.metadata?.vehicleSelection?.defaultName;
  return { registration, defaultName, ...(automatic ? { name: defaultName } : {}) };
}

export function registerHomebrewIdentities(onChange) {
  game.settings.register(SYSTEM_ID, "allowHomebrewIdentities", {
    name: "Allow homebrew identities",
    hint: "GM override: let actor owners use custom species, careers, vehicle models and manufacturers. Database search remains available. Custom entries retain the current stats for manual setup and GM review; character-creation locks still apply.",
    scope: "world", config: true, restricted: true, type: Boolean, default: false, onChange,
  });
}

export function homebrewIdentityState(system) {
  const entries = KINDS.flatMap(kind => {
    const entry = system?.metadata?.homebrewIdentities?.[kind];
    return entry?.name ? [{ kind, name: String(entry.name), reviewed: entry.reviewed === true }] : [];
  });
  return { active: entries.length > 0, pending: entries.some(entry => !entry.reviewed), entries };
}

export function sourceReviewIncomplete(system) {
  return homebrewIdentityState(system).pending ? [HOME_BREW_REVIEW] : [];
}

export function databaseIdentityReset(current, kinds) {
  const homebrewIdentities = { ...(current?.metadata?.homebrewIdentities ?? {}) };
  for (const kind of kinds) homebrewIdentities[kind] = null;
  const metadata = { ...(current?.metadata ?? {}), homebrewIdentities };
  const pending = homebrewIdentityState({ metadata }).pending;
  return { metadata, incomplete: (current?.incomplete ?? []).filter(message => pending || message !== HOME_BREW_REVIEW) };
}

export function homebrewIdentityUpdate(actor, kind, value, { allowed = false, editable = false } = {}) {
  if (!allowed) throw new Error("The GM must enable homebrew identities first.");
  if (!editable) throw new Error("Owner permission is required.");
  const character = actor?.type === "character";
  if (!(character ? ["species", "career"] : actor?.type === "vehicle" ? ["model", "manufacturer"] : []).includes(kind))
    throw new Error("Choose an appropriate homebrew identity field.");
  const current = actor.system ?? {};
  if (character && (current.phase === "play" || current.creation?.applied === true))
    throw new Error("Species and starting career are locked after character creation or campaign play begins.");
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error("Enter a homebrew name using plain text.");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) throw new Error("Enter a homebrew name of 1–120 characters.");
  const metadata = { ...(current.metadata ?? {}), homebrewIdentities: {
    ...(current.metadata?.homebrewIdentities ?? {}), [kind]: { name, reviewed: false },
  } };
  const system = { [kind]: name, metadata, incomplete: [...new Set([...(current.incomplete ?? []).filter(message => kind !== "species" || message !== SPECIES_SOURCE_REVIEW), HOME_BREW_REVIEW])] };
  let identity = {};
  if (character) {
    system.creation = { ...(current.creation ?? {}), [`${kind}Id`]: "", [kind]: homebrewSource() };
  } else {
    system.source = homebrewSource();
    metadata.vehicleSelection = { ...(metadata.vehicleSelection ?? {}), id: "" };
    metadata.vehicleStatEvidence = null;
    if (kind === "model") {
      const defaults = vehicleIdentityDefaults(actor, name);
      system.registration = defaults.registration;
      metadata.vehicleSelection.defaultName = defaults.defaultName;
      if (defaults.name) identity = { name: defaults.name };
      // A new custom model cannot inherit the old catalogue's hull classification.
      for (const key of ["Purpose", "purpose", "Hull", "hull", "Class", "class"]) metadata[key] = "";
    }
  }
  return { ...identity, system };
}

export function reviewHomebrewIdentityUpdate(actor, { allowed = false, isGM = false, adventureStarted = false } = {}) {
  if (!isGM) throw new Error("Only the GM can finish homebrew setup.");
  if (!allowed) throw new Error("Enable homebrew identities before finishing their setup.");
  const current = actor.system ?? {}, state = homebrewIdentityState(current);
  if (!state.active) throw new Error("There is no homebrew identity to review.");
  if (actor.type === "character" && (!current.species?.trim() || !current.career?.trim()))
    throw new Error("Set both species and career before finishing homebrew character creation.");
  const homebrewIdentities = { ...(current.metadata?.homebrewIdentities ?? {}) };
  for (const { kind } of state.entries) homebrewIdentities[kind] = { ...homebrewIdentities[kind], reviewed: true };
  const system = { metadata: { ...(current.metadata ?? {}), homebrewIdentities },
    incomplete: (current.incomplete ?? []).filter(message => message !== HOME_BREW_REVIEW) };
  if (actor.type === "character") {
    system.creation = { ...(current.creation ?? {}), applied: true, homebrew: true };
    if (state.entries.some(entry => entry.kind === "species")) system.creation.speciesAbilitiesPending = false;
    system.phase = adventureStarted || current.phase === "play" ? "play" : "creation";
  }
  return { system };
}
