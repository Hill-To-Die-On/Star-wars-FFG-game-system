import { validateVehicleData } from "./vehicle-data.mjs";
import { validateVehicleLoadouts, qualityText } from "./vehicle-loadout-data.mjs";

export const VEHICLE_STAT_COLUMNS = Object.freeze({
  hullTrauma: "Hull_Trauma", systemStrain: "System_Strain", armor: "Armor",
  silhouette: "Silhouette", speed: "Speed", handling: "Handling",
});

// Enrichment is additive to the creator's original rows. Re-running the public
// publisher replaces this generated relationship table, never the source SQL.
export function enrichReferenceDatabase(database, { stats, loadouts, nativeActors = [] } = {}) {
  const result = structuredClone(database);
  const rows = result.tables.vehicles ?? [];
  const byId = new Map(rows.map(row => [String(row.ID), row]));
  const assertIdentity = (row, record) => {
    if (!row || row.Name !== record.name || row.Book !== record.source.book || String(row.Page) !== record.source.page)
      throw new Error(`${record.name} vehicle source identity does not match.`);
  };
  if (stats) {
    validateVehicleData(stats);
    const natives = new Map(nativeActors.map(actor => [actor._id, actor]));
    for (const record of stats.records) {
      const row = byId.get(natives.get(record._id)?.system?.source?.id);
      assertIdentity(row, record);
      for (const [field, column] of Object.entries(VEHICLE_STAT_COLUMNS)) row[column] = record.stats[field];
      for (const [side, value] of Object.entries(record.stats.shields)) row[`Defense_${side}`] = value;
      row.Profile_Evidence = record.evidence.method;
    }
  }
  if (loadouts) {
    validateVehicleLoadouts(loadouts);
    result.tables.vehicle_loadouts = [];
    for (const row of rows) row.Weapons_Status = "not recorded";
    for (const record of loadouts.records) {
      const row = byId.get(record.vehicleId); assertIdentity(row, record);
      const verified = record.method === "printed-page";
      row.Weapons_Status = verified ? (record.weapons.length ? "source-checked armed" : "source-checked unarmed") : "source review required";
      row.Loadout_Pages = record.reviewedPages ?? record.source.page;
      const columns = { sensorRange: "Sensor_Range", primaryHyperdrive: "Primary_Hyperdrive", backupHyperdrive: "Backup_Hyperdrive", navigation: "Navigation", consumables: "Consumables", crew: "Crew", passengers: "Passengers", cargo: "Encumbrance" };
      for (const [key, value] of Object.entries(record.systems)) row[`${verified ? "" : "Candidate_"}${columns[key]}`] = value;
      for (const weapon of record.weapons) result.tables.vehicle_loadouts.push({
        ID: `${record.vehicleId}-${weapon.key}`, Vehicle_ID: record.vehicleId,
        Name: `${verified ? "" : "Candidate · "}${record.name} · ${weapon.name} (${weapon.location})`, Weapon: weapon.name,
        Count: weapon.count, Location: weapon.location, Fire_Arcs: weapon.arcs.join(", "),
        Damage: weapon.damage, Critical: weapon.critical, Range: weapon.range, Scale: weapon.scale,
        Skill: weapon.skill, Qualities: qualityText(weapon.qualities),
        Review_Status: verified ? "source-checked" : "source review required", Book: record.source.book, Page: row.Loadout_Pages, Profile_Page: record.source.page,
      });
    }
  }
  return result;
}
