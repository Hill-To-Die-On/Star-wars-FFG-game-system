import { bookAllowed, normalizeBookTitle } from "./rules.mjs";

export const ROW_NAMES = {
  adventure_seeds: "Name",
  allies_and_adversaries: "Name",
  armour: "Armour",
  attachments: "Attachment",
  books: "books",
  careers: "Career",
  career_rules: "Rule",
  career_specialisations: "Career_Specialisation",
  career_type: "Career_Type",
  corporation: "Corporation",
  deteremine_motivation: "Motivation_Result",
  dice_ability: "Ability",
  dice_boost: "Boost",
  dice_challenge: "Challenge",
  dice_difficulty: "Difficulty",
  dice_proficiency: "Proficiency",
  dice_setback: "Setback",
  dice_sides: "Dice_Sides",
  droid_classification: "Class",
  droid_models: "Model",
  duty: "Duty_Type",
  equipment: "Equipment",
  force_powers: "Force_Powers",
  holocron_skills: "1st_Career_Skill",
  item_qualities: "Item_Qualities",
  modular_encounters: "Encounter",
  morality: "Emotional_Strength",
  motivation: "Motivation_Result",
  obligation: "Obligation",
  personality_traits: "Personality",
  planets: "Planet_Name",
  relics: "Relic",
  resources: "Resources",
  signature_abilities: "signature_abilities",
  silhouette: "Silhouette",
  skills: "Skills",
  species: "Species",
  talents: "Talent",
  trade_route_list: "Trade_Route",
  vehicles: "Name",
  vehicle_attachments: "Attachment",
  vehicle_components: "Component",
  vehicle_weapons: "Weapon",
  weapons: "Weapon",
};
export const tableLabel = (table) =>
  table === "deteremine_motivation"
    ? "Determine motivation"
    : table.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const fieldLabel = (field) =>
  field.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const referenceKey = (table, row, index) =>
  `${table}:${row.ID ?? index}:${index}`;
export const referenceName = (table, row) =>
  String(row[ROW_NAMES[table]] ?? row.Name ?? row.name ?? "").trim() ||
  `${tableLabel(table)} reference ${row.ID ?? ""}`.trim();
export const referenceSource = (table, row) => ({
  table,
  id: String(row.ID ?? ""),
  book: String(
    row.Book ?? row.book ?? (table === "books" ? row.books : "") ?? "",
  ),
  page: String(row.Page ?? row.page ?? ""),
});
const searchText = (value) =>
  String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function indexReferenceDatabase(database) {
  if (
    database?.format !== "starfall-reference-database" ||
    database.version !== 1 ||
    !database.tables
  )
    throw new Error("Unsupported reference database format.");
  const records = [],
    books = new Map(),
    categories = [];
  for (const [table, rows] of Object.entries(database.tables)) {
    if (!Array.isArray(rows) || !Object.hasOwn(ROW_NAMES, table))
      throw new Error(`Unsupported reference table: ${table}`);
    categories.push({
      id: table,
      label: tableLabel(table),
      count: rows.length,
    });
    for (const [index, fields] of rows.entries()) {
      const source = referenceSource(table, fields),
        name = referenceName(table, fields);
      if (source.book) books.set(normalizeBookTitle(source.book), source.book);
      records.push({
        key: referenceKey(table, fields, index),
        name,
        category: table,
        categoryLabel: tableLabel(table),
        source,
        fields,
        search: searchText(
          [name, tableLabel(table), ...Object.values(fields)].join(" "),
        ),
      });
    }
  }
  return {
    records,
    byKey: new Map(records.map((row) => [row.key, row])),
    books: [...books.values()].sort((a, b) => a.localeCompare(b)),
    categories: categories.sort((a, b) => a.label.localeCompare(b.label)),
  };
}
const visible = (row, campaign) => bookAllowed(row.source.book, campaign);
const publicRecord = ({ search: _search, ...row }) => row;
export function findReferences(
  index,
  campaign,
  { query = "", category = "", book = "", page = 0, pageSize = 50 } = {},
) {
  const tokens = searchText(String(query).slice(0, 300))
    .split(" ")
    .filter(Boolean);
  const rows = index.records.filter(
    (row) =>
      visible(row, campaign) &&
      (!category || row.category === category) &&
      (!book ||
        normalizeBookTitle(row.source.book) === normalizeBookTitle(book)) &&
      tokens.every((token) => row.search.includes(token)),
  );
  rows.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.source.book.localeCompare(b.source.book) ||
      a.key.localeCompare(b.key),
  );
  const size = Number.isInteger(pageSize)
    ? Math.min(100, Math.max(1, pageSize))
    : 50;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Number.isInteger(page)
    ? Math.min(pages - 1, Math.max(0, page))
    : 0;
  return {
    total: rows.length,
    page: currentPage,
    pages,
    pageSize: size,
    records: rows
      .slice(currentPage * size, (currentPage + 1) * size)
      .map(publicRecord),
  };
}
export function findReference(index, campaign, key) {
  const row = index.byKey.get(key);
  return row && visible(row, campaign) ? publicRecord(row) : null;
}
export function filterLibraryByBooks(bundle, campaign) {
  return {
    ...bundle,
    documents: Object.fromEntries(
      Object.entries(bundle.documents).map(([type, documents]) => [
        type,
        documents.filter((doc) =>
          bookAllowed(
            (type === "JournalEntry"
              ? doc.pages?.[0]?.flags?.["star-wars-ffg"]?.source
              : doc.system?.source
            )?.book,
            campaign,
          ),
        ),
      ]),
    ),
  };
}
