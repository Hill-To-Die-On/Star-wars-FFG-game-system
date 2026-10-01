import { bookAllowed, normalizeBookTitle } from "./rules.mjs";

const SIDES = Object.freeze({ d10: 10, d100: 100 });
const REVIEWED_FIELDS = ["die", "ranges", "result labels"];

export function validateRollTables(data, registeredBooks) {
  if (data?.format !== "star-wars-ffg-roll-tables" || data.version !== 1 || !Array.isArray(data.tables))
    throw new Error("Unsupported roll-table data.");
  const books = new Set(registeredBooks.map((row) => normalizeBookTitle(row.books ?? row)));
  const ids = new Set();
  for (const table of data.tables) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(table.id) || ids.has(table.id))
      throw new Error(`Invalid or repeated roll-table ID: ${table.id}`);
    ids.add(table.id);
    if (!books.has(normalizeBookTitle(table.book)))
      throw new Error(`Unknown roll-table book: ${table.book}`);
    if (!/^\d+$/.test(table.page) || !table.title || !table.scope)
      throw new Error(`Invalid roll-table citation or title: ${table.id}`);
    const sides = SIDES[table.die];
    if (!sides) throw new Error(`Unsupported roll-table die: ${table.id}`);
    if (JSON.stringify(table.reviewedFields) !== JSON.stringify(REVIEWED_FIELDS))
      throw new Error(`Review scope is incomplete: ${table.id}`);
    if (!Array.isArray(table.rows) || !table.rows.length)
      throw new Error(`Missing roll-table rows: ${table.id}`);
    let previous = 0;
    for (const row of table.rows) {
      if (!Number.isInteger(row.low) || !Number.isInteger(row.high) || row.low < 1 || row.high > sides || row.low > row.high)
        throw new Error(`Invalid roll range: ${table.id}`);
      if (row.low <= previous) throw new Error(`Roll-table overlap: ${table.id}`);
      if (row.low !== previous + 1) throw new Error(`Roll-table gap: ${table.id}`);
      if (typeof row.label !== "string" || !row.label.trim() || row.label.length > 80)
        throw new Error(`Invalid roll-table result label: ${table.id}`);
      previous = row.high;
    }
    if (previous !== sides) throw new Error(`Roll-table gap at end: ${table.id}`);
  }
  return true;
}

export function filterRollTables(tables, campaign) {
  return tables.filter((table) => bookAllowed(table.book, campaign));
}

export function resolveRollTable(table, roll) {
  const sides = SIDES[table?.die];
  if (!sides || !Number.isInteger(roll) || roll < 1 || roll > sides)
    throw new Error("Roll is outside the table's die range.");
  const row = table.rows.find(({ low, high }) => roll >= low && roll <= high);
  if (!row) throw new Error("Roll-table result is missing; consult the source book.");
  return row;
}
