import { bookAllowed, normalizeBookTitle } from "./rules.mjs";
import {
  referenceKey,
  referenceName,
  referenceSource,
} from "./reference-data.mjs";

// These tables contain named mechanics or structured rule choices. Their rows
// are retrieval candidates, not proof that complete book instructions exist.
export const RULE_INSTRUCTION_TABLES = Object.freeze([
  "career_rules",
  "career_specialisations",
  "dice_ability",
  "dice_boost",
  "dice_challenge",
  "dice_difficulty",
  "dice_proficiency",
  "dice_setback",
  "dice_sides",
  "duty",
  "force_powers",
  "item_qualities",
  "morality",
  "obligation",
  "signature_abilities",
  "silhouette",
  "skills",
  "talents",
]);

const normalizedName = (value) => String(value ?? "").trim().toLocaleLowerCase();
const recordedPage = (value) => /^[1-9]\d*(?:[-–][1-9]\d*)?$/.test(String(value ?? "").trim());

export function indexRuleInstructionCandidates(
  database,
  tables = RULE_INSTRUCTION_TABLES,
) {
  if (!database?.tables || !Array.isArray(database.tables.books))
    throw new Error("A reference database with its book register is required.");
  const registeredBooks = new Set(
    database.tables.books.map((row) => normalizeBookTitle(row.books)),
  );
  const records = [], summary = {}, overlapGroups = new Map(), unlistedBooks = new Set();
  for (const table of tables) {
    const rows = database.tables[table];
    if (!Array.isArray(rows)) throw new Error(`Missing rule candidate table: ${table}`);
    const counts = { rows: rows.length, missingBook: 0, missingPage: 0 };
    for (const [index, fields] of rows.entries()) {
      const source = referenceSource(table, fields);
      const name = referenceName(table, fields);
      if (!source.book.trim()) counts.missingBook++;
      else if (!registeredBooks.has(normalizeBookTitle(source.book)))
        unlistedBooks.add(source.book);
      if (!recordedPage(source.page)) counts.missingPage++;
      const record = {
        key: referenceKey(table, fields, index),
        table,
        name,
        source: { book: source.book, page: source.page },
        citation: !source.book.trim()
          ? "missing-book"
          : !recordedPage(source.page)
            ? "missing-page"
            : "book-and-page-recorded",
        review: "candidate",
      };
      records.push(record);
      if (source.book.trim()) {
        const groupKey = `${table}:${normalizedName(name)}`;
        const group = overlapGroups.get(groupKey) ?? { table, name, books: new Map() };
        group.books.set(normalizeBookTitle(source.book), source.book);
        overlapGroups.set(groupKey, group);
      }
    }
    summary[table] = counts;
  }
  const overlaps = [...overlapGroups.values()]
    .filter((group) => group.books.size > 1)
    .map(({ table, name, books }) => ({
      table,
      name,
      books: [...books.values()].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
  return {
    records,
    summary,
    overlaps,
    unlistedBooks: [...unlistedBooks].sort((a, b) => a.localeCompare(b)),
    registeredBookCount: registeredBooks.size,
  };
}

export function filterRuleInstructionCandidates(records, campaign) {
  return records.filter((record) => bookAllowed(record.source.book, campaign));
}
