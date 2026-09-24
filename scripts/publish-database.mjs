import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSqlDump } from "./sql-parser.mjs";
import { convertDatabase } from "./import-database.mjs";
import { indexReferenceDatabase } from "../src/reference-data.mjs";

export function publishDatabase(sql) {
  const tables = parseSqlDump(sql);
  const database = {
    format: "star-wars-reference-database",
    version: 1,
    provenance: {
      source: "Creator-supplied reference database",
      permission: "Published with its creator's permission",
      sourceSha256: createHash("sha256").update(sql).digest("hex"),
    },
    tables,
  };
  const index = indexReferenceDatabase(database);
  if (!index.records.length || index.records.length > 20000)
    throw new Error("Unexpected database size.");
  return {
    database,
    library: convertDatabase(tables, { retainCreatorNotes: true }),
    counts: {
      tables: Object.keys(tables).length,
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
