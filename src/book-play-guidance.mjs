import registry from "../data/book-play-guidance.json" with { type: "json" };
import { bookAllowed, normalizeBookTitle } from "./rules.mjs";

export function validateBookPlayGuidance(data = registry) {
  if (data?.format !== "star-wars-ffg-book-play-guidance" || data.version !== 1 || !Array.isArray(data.entries))
    throw new Error("Invalid book play guidance registry.");
  const ids = new Set();
  for (const entry of data.entries) {
    if (!entry.id || ids.has(entry.id) || !["adventure-guidance", "reward-guidance"].includes(entry.kind) ||
      !entry.title || !entry.scope || !entry.source?.book || !Array.isArray(entry.source.pages) ||
      !entry.source.pages.length || entry.source.pages.some((page) => !Number.isSafeInteger(page) || page < 1) ||
      entry.review !== "page-image-reviewed" || entry.automatic !== false)
      throw new Error(`Invalid book play guidance entry: ${entry.id ?? "unnamed"}.`);
    if (entry.kind === "adventure-guidance" &&
      (!Array.isArray(entry.beats) || !entry.beats.length || entry.beats.some((beat) =>
        !["prepare", "during-play", "wrap-up"].includes(beat?.phase) ||
        typeof beat.prompt !== "string" || !beat.prompt.trim())))
      throw new Error(`Invalid adventure beats: ${entry.id}.`);
    if (entry.kind === "reward-guidance" &&
      (entry.reward?.amount !== null || !Array.isArray(entry.reward.decisionPoints) || !entry.reward.decisionPoints.length ||
        entry.reward.decisionPoints.some((point) => typeof point !== "string" || !point.trim())))
      throw new Error(`Invalid reward review: ${entry.id}.`);
    ids.add(entry.id);
  }
  return data;
}

validateBookPlayGuidance();

export function selectBookPlayGuidance(campaign, { book = "", kind = "" } = {}, data = registry) {
  validateBookPlayGuidance(data);
  const requestedBook = normalizeBookTitle(book);
  return data.entries
    .filter((entry) => bookAllowed(entry.source.book, campaign) &&
      (!requestedBook || normalizeBookTitle(entry.source.book) === requestedBook) &&
      (!kind || entry.kind === kind))
    .map((entry) => structuredClone(entry));
}

export function seedReferencePage(result) {
  const seeds = (result?.records ?? [])
    .filter((record) => record.category === "adventure_seeds")
    .map((record) => ({
      key: record.key,
      title: record.name,
      hook: String(record.fields.Description ?? "").trim() || null,
      forceSensitive: record.fields.Force_Sensitive === "TRUE" ? true : record.fields.Force_Sensitive === "FALSE" ? false : null,
      suggestedCareerType: String(record.fields.Suggested_Career_Type ?? "").trim() || null,
      suggestedCareer: String(record.fields.Suggested_Career ?? "").trim() || null,
      suggestedSpecialisation: String(record.fields.Suggested_Specialisation ?? "").trim() || null,
      associatedAllyOrAdversary: String(record.fields.Associated_Ally_or_Adversary ?? "").trim() || null,
      associatedVehicle: String(record.fields.Associated_Vehicle ?? "").trim() || null,
      planet: String(record.fields.Planet ?? "").trim() || null,
      region: String(record.fields.Region ?? "").trim() || null,
      source: {
        book: record.source.book,
        page: record.source.page,
      },
    }));
  return {
    status: "catalogue-seeds",
    automatic: false,
    instruction: "These are GM starting points, not complete adventures or authority to invent mechanics. Review the cited book before using a seed.",
    total: result?.total ?? 0,
    page: result?.page ?? 0,
    pages: result?.pages ?? 1,
    seeds,
  };
}
