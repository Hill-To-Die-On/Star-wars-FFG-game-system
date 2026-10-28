import catalogue from "../data/narrative-options.json" with { type: "json" };
import { bookAllowed, normalizeBookTitle } from "./rules.mjs";

const SYMBOLS = new Set(["advantage", "threat", "triumph", "despair"]);
const GROUPS = { "personal-combat": "Personal combat", "vehicle-combat": "Vehicle combat" };

export function validateNarrativeOptions(data = catalogue) {
  if (data?.format !== "star-wars-narrative-options" || data.version !== 1 || !Array.isArray(data.tables) || !Array.isArray(data.options))
    throw new Error("Invalid narrative option catalogue format.");
  const tables = new Map(data.tables.map((table) => [table.id, table])), ids = new Set();
  if (tables.size !== data.tables.length) throw new Error("Repeated narrative option table.");
  for (const table of data.tables)
    if (!GROUPS[table.context] || !table.sources?.length || table.sources.some((source) => !source.book || !/^\d+$/.test(source.page)))
      throw new Error(`Invalid narrative option table: ${table.id}.`);
  for (const option of data.options) {
    if (!option.id || ids.has(option.id)) throw new Error(`Repeated narrative option: ${option.id}.`);
    ids.add(option.id);
    if (tables.get(option.table)?.context !== option.context) throw new Error(`Unknown narrative option table for ${option.id}.`);
    if (!SYMBOLS.has(option.symbol)) throw new Error(`Unknown symbol for ${option.id}.`);
    if (!Number.isInteger(option.cost) || option.cost < 1 || option.cost > 3) throw new Error(`Invalid cost for ${option.id}.`);
    if (!String(option.label ?? "").trim() || option.label.length > 200) throw new Error(`Invalid label for ${option.id}.`);
  }
  return data;
}
validateNarrativeOptions();
const tables = new Map(catalogue.tables.map((table) => [table.id, table]));
const printedIn = (option, book) => !option.onlyIn || option.onlyIn.some((title) => normalizeBookTitle(title) === normalizeBookTitle(book));

/** Core-table presets for the symbols left on a roll, cited from a book the campaign allows. */
export function bundledSpendingOptions({ symbols = [], campaign = {} } = {}) {
  return catalogue.options.filter((option) => symbols.includes(option.symbol)).flatMap((option) => {
    const source = tables.get(option.table).sources.find((row) => bookAllowed(row.book, campaign) && printedIn(option, row.book));
    if (!source) return [];
    const note = option.costVaries ? "Listed cost is the minimum: a Critical uses the weapon's Critical rating and a quality uses its activation cost."
      : option.condition === "check-failed" ? "Only when the check failed." : "";
    return [{ id: option.id, group: GROUPS[option.context], label: option.label, note, cost: { [option.symbol]: option.cost },
      source: { book: source.book, page: source.page, verification: "gm-reviewed" } }];
  });
}
