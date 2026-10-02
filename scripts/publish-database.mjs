import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSqlDump } from "./sql-parser.mjs";
import { convertDatabase } from "./import-database.mjs";
import { indexReferenceDatabase } from "../src/reference-data.mjs";
import { enrichReferenceDatabase } from "../src/catalogue-enrichment.mjs";

// Short labels checked against the held book's printed roll table.
export function correctSourceRows(tables) {
  for (const row of tables.duty ?? []) {
    if (row.Book !== "Age of Rebellion - Cyphers & Masks" || String(row.Page) !== "17") continue;
    if (String(row.ID) === "52" && row.Duty_Type === "Communication")
      row.Duty_Type = "Communications";
    if (String(row.ID) === "60" && row.Duty_Type === "Psycological Warfare")
      row.Duty_Type = "Psychological Warfare";
  }
  for (const row of tables.species ?? []) {
    if (String(row.ID) !== "17" || row.Species !== "Aqualish - Ualaq" ||
      row.Book !== "Edge of The Empire - Dangerous Covenants" || String(row.Page) !== "19") continue;
    if (row.Special === "Breathe underwater, Brawl +1, Survival +1 OR Perception -1, Darkness +1, Perception -1")
      row.Special = "Breathe underwater; Brawl +1; Survival or Perception +1; remove 1 darkness Setback; add 1 Perception Setback in bright light";
  }
  return tables;
}

export function publishDatabase(sql, { vehicleStats, vehicleLoadouts } = {}) {
  const tables = correctSourceRows(parseSqlDump(sql));
  let database = {
    format: "star-wars-reference-database",
    version: 1,
    provenance: {
      source: "Creator-supplied reference database",
      permission: "Published with its creator's permission",
      sourceSha256: createHash("sha256").update(sql).digest("hex"),
    },
    tables,
  };
  if (vehicleStats || vehicleLoadouts) {
    database = enrichReferenceDatabase(database, { stats: vehicleStats, loadouts: vehicleLoadouts,
      nativeActors: convertDatabase(tables).documents.Actor });
    for (const [key, value] of Object.entries({ vehicleStats, vehicleLoadouts }))
      if (value) database.provenance[`${key}Sha256`] = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
  const index = indexReferenceDatabase(database);
  if (!index.records.length || index.records.length > 20000)
    throw new Error("Unexpected database size.");
  return {
    database,
    library: convertDatabase(database.tables, { retainCreatorNotes: true }),
    counts: {
      tables: Object.keys(database.tables).length,
      rows: index.records.length,
      books: index.books.length,
    },
  };
}
async function main() {
  const [input] = process.argv.slice(2);
  if (!input)
    throw new Error("Provide the creator-authorized SQL database path.");
  const { database, library, counts } = publishDatabase(
    await readFile(input, "utf8"),
    { vehicleStats: JSON.parse(await readFile("data/vehicle-stats.json", "utf8")),
      vehicleLoadouts: JSON.parse(await readFile("data/vehicle-loadouts.json", "utf8")) },
  );
  await mkdir("data", { recursive: true });
  await writeFile(
    "data/reference-database.json",
    JSON.stringify(database, null, 2) + "\n",
  );
  await writeFile(
    "data/reference-library.json",
    JSON.stringify(library, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ ...counts, nativeDocuments: library.report.documents }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
