import { CHARACTERISTICS, SKILLS } from "./config.mjs";
import { bookAllowed, RULE_LINES } from "./rules.mjs";

const SPECIES_STATS = [
  ...Object.values(CHARACTERISTICS),
  "Wound_Base",
  "Strain_Base",
  "XP",
];
const ORIGIN_REVIEW =
  "Verify species abilities and any exceptional creation rules in the source book.";
export const ORIGIN_INDEX_FIELDS = [
  "type",
  "system.career",
  "system.careerSkills",
  "system.metadata.Playable",
  ...SPECIES_STATS.map((key) => `system.metadata.${key}`),
  "system.source.book",
  "system.source.page",
];

const documentId = (entry) => String(entry?.id ?? entry?._id ?? "");
const truthyDatabaseValue = (value) =>
  value === true || ["true", "yes", "1"].includes(String(value).toLowerCase());
const validStat = (value) => {
  const number = Number(value);
  return value !== "" && value != null && Number.isInteger(number) && number >= 0;
};
const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function referenceRuleLine(entry) {
  const book = normalizeSearch(entry?.system?.source?.book);
  if (/\bedge of (?:the )?empire\b/.test(book)) return "edge";
  if (/\bage of rebellion\b/.test(book)) return "age";
  if (/\bforce (?:and )?destiny\b/.test(book)) return "force";
  if (entry?.type === "career") {
    const name = normalizeSearch(entry.name);
    if (name === "jedi") return "force";
    if (name === "clone soldier") return "age";
  }
  return "";
}

export function originEntryAllowed(entry, kind, campaign) {
  if (!entry || entry.type !== kind || !documentId(entry)) return false;
  if (!bookAllowed(entry.system?.source?.book, campaign)) return false;
  const line = referenceRuleLine(entry);
  if (line && !(campaign?.lines ?? []).includes(line)) return false;
  if (kind === "species")
    return (
      truthyDatabaseValue(entry.system?.metadata?.Playable) &&
      SPECIES_STATS.every((key) => validStat(entry.system?.metadata?.[key]))
    );
  if (kind === "career")
    return (
      entry.system?.career === entry.name &&
      Array.isArray(entry.system?.careerSkills) &&
      entry.system.careerSkills.length > 0 &&
      entry.system.careerSkills.every((key) => Object.hasOwn(SKILLS, key))
    );
  return false;
}

const optionFromEntry = (entry) => ({
  id: documentId(entry),
  name: entry.name,
  source: {
    book: String(entry.system?.source?.book ?? ""),
    page: String(entry.system?.source?.page ?? ""),
  },
  ruleLine: referenceRuleLine(entry),
});

export function availableOriginOptions(entries, campaign) {
  const source = Array.from(entries ?? []);
  const choices = (kind) =>
    source
      .filter((entry) => originEntryAllowed(entry, kind, campaign))
      .map(optionFromEntry)
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.source.book.localeCompare(b.source.book) ||
          a.id.localeCompare(b.id),
      );
  return { species: choices("species"), career: choices("career") };
}

function fuzzyScore(option, query) {
  const words = normalizeSearch(
      `${option.name} ${option.source?.book ?? ""}`,
    ),
    compactWords = words.replaceAll(" ", ""),
    normalizedQuery = normalizeSearch(query),
    compactQuery = normalizedQuery.replaceAll(" ", "");
  if (!compactQuery) return 0;
  if (words === normalizedQuery || compactWords === compactQuery) return 0;
  if (words.startsWith(normalizedQuery) || compactWords.startsWith(compactQuery))
    return 10 + words.length - normalizedQuery.length;
  const substring = words.indexOf(normalizedQuery);
  if (substring >= 0) return 100 + substring;
  let position = -1,
    gaps = 0;
  for (const character of compactQuery) {
    const next = compactWords.indexOf(character, position + 1);
    if (next < 0) return Number.POSITIVE_INFINITY;
    if (position >= 0) gaps += next - position - 1;
    position = next;
  }
  return 200 + gaps + position - compactQuery.length;
}

export function fuzzyOriginOptions(options, query, limit = 40) {
  return Array.from(options ?? [])
    .map((option, order) => ({ option, order, score: fuzzyScore(option, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.option.name.localeCompare(b.option.name) ||
        a.order - b.order,
    )
    .slice(0, Math.max(0, limit))
    .map(({ option }) => option);
}

export function originChoiceLocked(system) {
  return system?.phase === "play" || system?.creation?.applied === true;
}

function creationLine(entry, current, campaign) {
  const inferred = referenceRuleLine(entry);
  if (inferred && campaign.lines.includes(inferred)) return inferred;
  if (campaign.lines.includes(current?.line)) return current.line;
  return campaign.lines.find((line) => RULE_LINES[line]) ?? "edge";
}

function speciesStat(entry, key) {
  const value = Number(entry.system.metadata[key]);
  if (!validStat(entry.system.metadata[key]))
    throw new Error(`Species ${key} is missing; verify the source first.`);
  return value;
}

export function originSelectionUpdate(kind, entry, current, campaign) {
  if (!originEntryAllowed(entry, kind, campaign))
    throw new Error(
      `Choose a valid ${kind} from the enabled campaign reference library.`,
    );
  const creation = { ...(current?.creation ?? {}), applied: false };
  if (kind === "species") {
    const characteristics = Object.fromEntries(
        Object.entries(CHARACTERISTICS).map(([key, label]) => [
          key,
          speciesStat(entry, label),
        ]),
      ),
      xp = speciesStat(entry, "XP");
    return {
      species: entry.name,
      characteristics,
      soak: characteristics.brawn,
      xp: { total: xp, available: xp },
      wounds: {
        value: 0,
        max: speciesStat(entry, "Wound_Base") + characteristics.brawn,
      },
      strain: {
        value: 0,
        max: speciesStat(entry, "Strain_Base") + characteristics.willpower,
      },
      creation: {
        ...creation,
        speciesId: documentId(entry),
        species: entry.system.source,
        speciesAbilitiesPending: true,
      },
      incomplete: [
        ...new Set([...(current?.incomplete ?? []), ORIGIN_REVIEW]),
      ],
    };
  }
  const careerSkills = new Set(entry.system.careerSkills);
  return {
    line: creationLine(entry, current, campaign),
    career: entry.name,
    skills: Object.fromEntries(
      Object.entries(SKILLS).map(([key, definition]) => [
        key,
        {
          rank: Number(current?.skills?.[key]?.rank) || 0,
          career: careerSkills.has(key),
          group: !!current?.skills?.[key]?.group,
          characteristic:
            current?.skills?.[key]?.characteristic || definition.characteristic,
        },
      ]),
    ),
    creation: {
      ...creation,
      careerId: documentId(entry),
      career: entry.system.source,
    },
  };
}
