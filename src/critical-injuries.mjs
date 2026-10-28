import tables from "../data/critical-tables.json" with { type: "json" };
import { bookAllowed } from "./rules.mjs";

export function validateCriticalTables(data = tables) {
  if (data?.format !== "star-wars-critical-tables" || data.version !== 1) throw new Error("Invalid critical table format.");
  for (const name of ["personal", "vehicle"]) {
    const table = data[name];
    if (!table?.sources?.length || !Array.isArray(table.rows) || !table.rows.length) throw new Error(`Missing ${name} critical table.`);
    table.rows.forEach((row, index) => {
      const last = index === table.rows.length - 1, expectedLow = index ? table.rows[index - 1].high + 1 : 1;
      if (row.low !== expectedLow || (last ? row.high !== null : !(row.high >= row.low)))
        throw new Error(`The ${name} critical table must be contiguous and end open-ended.`);
      if (!row.name || !row.summary || !row.effect?.kind || (row.severity !== null && ![1, 2, 3, 4].includes(row.severity)))
        throw new Error(`Incomplete ${name} critical row: ${row.name}.`);
    });
  }
  return data;
}
validateCriticalTables();

function whole(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
/** d100 + 10 per unhealed critical + 10 per Vicious rank + any reviewed talent modifier, never below 1. */
export function criticalTotal({ roll, existing = 0, vicious = 0, modifier = 0 } = {}) {
  return Math.max(1, whole(roll, "Critical roll", 1, 100) + 10 * whole(existing, "Existing criticals", 0, 50)
    + 10 * whole(vicious, "Vicious rating", 0, 10) + whole(modifier, "Critical modifier", -200, 200));
}
export function lookupCritical(total, table = "personal") {
  return tables[table].rows.find((row) => total >= row.low && (row.high === null || total <= row.high));
}
export function criticalOutcome(table, request, campaign = {}) {
  if (!["personal", "vehicle"].includes(table)) throw new Error("Unknown critical table.");
  const total = criticalTotal(request), row = lookupCritical(total, table),
    cited = tables[table].sources.find((source) => bookAllowed(source.book, campaign));
  if (!cited) throw new Error("The critical tables are printed in the core rulebooks. Enable a core rulebook in the campaign books.");
  const healing = tables.healing[table], difficulty = row.severity ? healing.difficultyBySeverity[String(row.severity)] : null;
  return { table, total, row, healing: difficulty ? { skill: healing.skill, difficulty } : null,
    source: { book: cited.book, page: cited.page, verification: "gm-reviewed" } };
}
/** Only unambiguous effects are automated; everything else stays a recorded GM reminder. */
export function criticalAutomation(table, row, actorType = "character") {
  const effect = row.effect, resources = [];
  if (table === "personal" && effect.kind === "immediate" && effect.strain)
    resources.push({ resource: ["minion", "rival"].includes(actorType) ? "wounds" : "strain", amount: effect.strain });
  if (table === "vehicle" && effect.kind === "immediate" && effect.vehicle?.systemStrain)
    resources.push({ resource: "systemStrain", amount: effect.vehicle.systemStrain });
  const pool = effect.pool, lasting = ["permanent", "until-healed"].includes(effect.kind);
  const modifier = lasting && pool && !Array.isArray(pool) && pool.scope === "all" && pool.setback && Object.keys(pool).length === 2
    ? { die: "setback", count: pool.setback, skillKey: "any" } : null;
  const automated = resources.length || modifier, manual = effect.kind === "death" ? null
    : Object.keys(effect).some((key) => !["kind", "duration", ...(modifier ? ["pool"] : []), ...(resources.length ? ["strain", "vehicle"] : [])].includes(key)) || effect.kind === "timed"
      ? `${row.summary}${effect.duration ? ` (${effect.duration})` : ""} Apply this effect manually.` : null;
  return { resources, modifier, manual, automated: !!automated };
}
