const keys = (value, allowed, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} needs an object.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} contains unsupported ${key}.`);
};
const text = (value, max, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > max ||
      /[<>]|[a-z]:[\\/]|\.(?:pdf|xml|sql)\b|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(value))
    throw new Error(`${label} is not a safe public value.`);
};
const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} is outside its supported range.`);
};
const ranges = ["close", "short", "medium", "long", "extreme"];
const choice = (value, values, label) => { if (!values.includes(value)) throw new Error(`${label} is invalid.`); };

export function validateVehicleLoadouts(data) {
  keys(data, ["format", "version", "records"], "Vehicle loadouts");
  if (data.format !== "star-wars-ffg-vehicle-loadouts" || data.version !== 1 || !Array.isArray(data.records))
    throw new Error("Unsupported vehicle loadouts format.");
  const ids = new Set();
  for (const record of data.records) {
    keys(record, ["vehicleId", "name", "source", "method", "reviewedPages", "weapons", "systems"], "Vehicle loadout");
    text(record.vehicleId, 64, "Vehicle identity");
    if (ids.has(record.vehicleId)) throw new Error("Vehicle loadouts need unique identities.");
    ids.add(record.vehicleId);
    text(record.name, 300, "Vehicle name");
    keys(record.source, ["book", "page"], "Loadout source");
    text(record.source.book, 200, "Loadout book");
    if (!/^\d+(?:[-–]\d+)?$/.test(record.source.page)) throw new Error("Loadout needs a printed page.");
    choice(record.method, ["printed-page", "structured-source"], "Loadout review method");
    if (record.reviewedPages !== undefined && (record.method !== "printed-page" || !/^\d+(?:[-–]\d+)?$/.test(record.reviewedPages)))
      throw new Error("Reviewed pages must identify the printed stat block.");
    if (!Array.isArray(record.weapons) || record.weapons.length > 100) throw new Error("Invalid loadout weapons.");
    const mounts = new Set();
    for (const weapon of record.weapons) {
      keys(weapon, ["key", "name", "count", "location", "arcs", "damage", "critical", "range", "scale", "skill", "qualities"], "Vehicle weapon");
      text(weapon.key, 80, "Weapon key"); text(weapon.name, 160, "Weapon name");
      if (mounts.has(weapon.key)) throw new Error("Weapon mounts need unique identities.");
      mounts.add(weapon.key);
      integer(weapon.count, 1, 1000, "Weapon count");
      integer(weapon.damage, 0, 1000, "Weapon damage"); integer(weapon.critical, 0, 10, "Weapon critical");
      choice(weapon.location, ["fore", "aft", "port", "starboard", "dorsal", "ventral", "unspecified"], "Weapon location");
      choice(weapon.range, ranges, "Weapon range"); choice(weapon.scale, ["personal", "vehicle"], "Weapon scale");
      choice(weapon.skill, ["gunnery", "rangedHeavy", "rangedLight"], "Weapon skill");
      if (!Array.isArray(weapon.arcs) || !weapon.arcs.length || new Set(weapon.arcs).size !== weapon.arcs.length)
        throw new Error("Weapon arcs are required.");
      for (const arc of weapon.arcs) choice(arc, ["fore", "aft", "port", "starboard"], "Weapon arc");
      if (!Array.isArray(weapon.qualities)) throw new Error("Weapon qualities need an array.");
      const names = new Set();
      for (const quality of weapon.qualities) {
        keys(quality, ["name", "rank"], "Weapon quality"); text(quality.name, 80, "Quality name");
        integer(quality.rank, 0, 100, "Quality rank");
        if (names.has(quality.name)) throw new Error("Duplicate weapon quality."); names.add(quality.name);
      }
    }
    keys(record.systems, ["sensorRange", "primaryHyperdrive", "backupHyperdrive", "navigation", "consumables", "crew", "passengers", "cargo"], "Vehicle systems");
    if (Object.hasOwn(record.systems, "sensorRange")) choice(record.systems.sensorRange, [...ranges, "none"], "Sensor range");
    for (const key of ["crew", "passengers", "cargo"]) if (Object.hasOwn(record.systems, key)) integer(record.systems[key], 0, 100000000, `Vehicle ${key}`);
    for (const key of ["primaryHyperdrive", "backupHyperdrive"]) if (Object.hasOwn(record.systems, key)) {
      const value = record.systems[key];
      if (value !== "none" && (!Number.isFinite(value) || value <= 0 || value > 50)) throw new Error("Backup hyperdrive is invalid.");
    }
    if (Object.hasOwn(record.systems, "navigation")) choice(record.systems.navigation, ["navcomputer", "astromech socket", "none"], "Navigation equipment");
    if (Object.hasOwn(record.systems, "consumables") && !/^\d+(?:\.\d+)? (?:hours?|days?|weeks?|months?|years?)$/.test(record.systems.consumables))
      throw new Error("Consumables must be a duration, without explanatory prose.");
  }
  return data;
}

export const qualityText = qualities => qualities.map(q => `${q.name}${q.rank ? ` ${q.rank}` : ""}`).join(", ");
