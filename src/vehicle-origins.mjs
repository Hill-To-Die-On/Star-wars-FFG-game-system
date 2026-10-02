import { bookAllowed } from "./rules.mjs";
import { referenceRuleLine } from "./character-origins.mjs";
import { databaseIdentityReset, vehicleIdentityDefaults } from "./homebrew-identities.mjs";

export const VEHICLE_INDEX_FIELDS = ["type", "system.model", "system.manufacturer", "system.source.book", "system.source.page"];
const idOf = entry => String(entry?.id ?? entry?._id ?? "");
const modelOf = entry => String(entry?.system?.model || entry?.name || "").trim();
const manufacturerOf = entry => String(entry?.system?.manufacturer ?? "").trim();
const vehicleAllowed = (entry, campaign) => {
  const line = referenceRuleLine(entry);
  return entry?.type === "vehicle" && !!idOf(entry) && !!modelOf(entry) &&
    bookAllowed(entry.system?.source?.book, campaign) && (!line || campaign.lines.includes(line));
};

export function availableVehicleOptions(entries, campaign, manufacturer = "") {
  const allowed = Array.from(entries ?? []).filter(entry => vehicleAllowed(entry, campaign));
  const manufacturers = new Map();
  for (const entry of allowed) {
    const name = manufacturerOf(entry);
    if (name) manufacturers.set(name, { id: name, name });
  }
  return {
    model: allowed.filter(entry => !manufacturer || manufacturerOf(entry) === manufacturer)
      .map(entry => ({ id: idOf(entry), name: modelOf(entry), source: entry.system.source,
        searchTerms: `${entry.name} ${manufacturerOf(entry)}`, detail: `${entry.name} · ${manufacturerOf(entry)}` }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    manufacturer: [...manufacturers.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function vehicleSelectionUpdate(entry, actor, campaign, { manufacturer = "", registration } = {}) {
  if (!vehicleAllowed(entry, campaign)) throw new Error("Choose a valid vehicle from the enabled database.");
  if (manufacturer && manufacturerOf(entry) !== manufacturer) throw new Error("Choose a model from the selected manufacturer.");
  const current = actor.system ?? {}, source = entry.system, model = modelOf(entry);
  const defaults = vehicleIdentityDefaults(actor, model, registration);
  const system = {
    model, manufacturer: manufacturerOf(entry), registration: defaults.registration,
    footprint: { hull: "auto" },
    source: structuredClone(source.source),
    incomplete: [...(source.incomplete ?? [])],
    metadata: { ...databaseIdentityReset(current, ["model", "manufacturer"]).metadata, ...structuredClone(source.metadata ?? {}),
      ...Object.fromEntries(["Sensor_Range", "Backup_Hyperdrive", "Navigation", "Consumables", "Loadout_Pages", "Weapons_Status",
        "Candidate_Sensor_Range", "Candidate_Backup_Hyperdrive", "Candidate_Navigation", "Candidate_Consumables"].map(key => [key, source.metadata?.[key] ?? null])),
      vehicleStatEvidence: structuredClone(source.metadata?.vehicleStatEvidence ?? null),
      vehicleSelection: { id: idOf(entry), defaultName: defaults.defaultName } },
  };
  for (const key of ["armor", "silhouette", "handling"])
    system[key] = source[key] ?? 0;
  system.shields = structuredClone(source.shields ?? { fore: 0, aft: 0, port: 0, starboard: 0 });
  for (const key of ["crew", "passengers", "cargo", "hyperdrive"])
    system[key] = source[key] ?? "";
  for (const key of ["hullTrauma", "systemStrain", "speed"])
    if (source[key]) system[key] = { ...structuredClone(source[key]), value: current[key]?.value ?? 0 };
  return { ...(defaults.name ? { name: defaults.name } : {}), system };
}
