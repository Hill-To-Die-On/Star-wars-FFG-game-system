import {
  CHARACTERISTICS,
  SYSTEM_ID,
  SYSTEM_PATH,
  SKILLS,
  skillKey,
  RANGES,
} from "./config.mjs";

const BOOKS = {
  eotebg: "Edge of the Empire Beginner Game",
  aorbg: "Age of Rebellion Beginner Game",
  fadbg: "Force and Destiny Beginner Game",
};
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nameOf = (value) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 200 ||
    /[<>\r\n]/.test(value)
  )
    throw new Error(
      "Adversary names and references must be plain text, at most 200 characters.",
    );
  return value.trim();
};
function integer(value, field, missing, max = 100000) {
  if (value === undefined || value === null || value === "") {
    missing.push(field);
    return 0;
  }
  const n =
    typeof value === "number"
      ? value
      : /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isSafeInteger(n) || n < 0 || n > max)
    throw new Error(
      `Invalid ${field}: expected a whole number from 0 to ${max}.`,
    );
  return n;
}
async function documentId(key) {
  // FNV-1a provides a portable, deterministic document key even on local HTTP
  // Foundry servers without Web Crypto. This is an identifier, not a security hash.
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(key))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, "0");
}
function referenceItems(entries, type, source) {
  if (entries === undefined) return [];
  if (!Array.isArray(entries) || entries.length > 100)
    throw new Error(`Invalid ${type} list.`);
  return entries.map((entry) => {
    const name = nameOf(typeof entry === "string" ? entry : entry?.name);
    const match = type === "talent" ? /^(.*?) (\d+)$/.exec(name) : null;
    return {
      name: match ? match[1] : name,
      type,
      system: {
        source,
        ...(match
          ? { rank: integer(match[2], "talent rank", [], 100), ranked: true }
          : {}),
      },
    };
  });
}
function weaponItem(entry, source) {
  const name = nameOf(typeof entry === "string" ? entry : entry?.name);
  // SWA's named weapon references depend on a separate catalogue. Preserve them
  // as references instead of silently presenting absent statistics as zero damage.
  if (typeof entry === "string")
    return {
      name,
      type: "reference",
      system: {
        source,
        incomplete: ["weapon statistics"],
        metadata: { kind: "weapon" },
      },
    };
  const missing = [];
  const skill = skillKey(entry.skill);
  if (!skill) missing.push("skill");
  const damage =
    typeof entry.damage === "number" ? String(entry.damage) : entry.damage;
  if (typeof damage !== "string" || !/^(?:\d{1,5}|[+]\d{1,2})$/.test(damage))
    missing.push("damage");
  const critical = integer(entry.critical, "critical", missing, 10);
  const range = String(entry.range ?? "").toLowerCase();
  if (!RANGES.includes(range)) missing.push("range");
  const qualities = referenceItems(entry.qualities, "reference", source)
    .map((item) => item.name)
    .join(", ");
  return {
    name,
    type: missing.length ? "reference" : "weapon",
    system: {
      source,
      incomplete: missing,
      metadata: { kind: "weapon" },
      ...(missing.length
        ? {}
        : { damage, critical, skill, range, qualities, equipped: true }),
    },
  };
}

/** Translate SW Adversaries JSON into native documents; never fetch or copy prose. */
export async function convertSwa(input) {
  const records = Array.isArray(input) ? input : isObject(input) ? [input] : [];
  if (!records.length || records.length > 2000)
    throw new Error("Choose 1 to 2,000 SW Adversaries records.");
  const documents = [],
    ids = new Set();
  const report = {
    records: records.length,
    omittedProse: true,
    incompleteActors: 0,
    weaponReferences: 0,
    review: [],
  };
  for (const record of records) {
    if (!isObject(record))
      throw new Error("Each adversary must be a JSON object.");
    const name = nameOf(record.name);
    const type = String(record.type ?? "").toLowerCase();
    if (!["minion", "rival", "nemesis"].includes(type))
      throw new Error(`${name}: unsupported adversary type.`);
    if (!isObject(record.characteristics) || !isObject(record.derived))
      throw new Error(
        `${name}: characteristics and derived statistics are required.`,
      );
    if (
      record.tags !== undefined &&
      (!Array.isArray(record.tags) || record.tags.length > 200)
    )
      throw new Error(`${name}: invalid tags.`);
    const tags = (record.tags ?? []).map(nameOf);
    const books = tags
      .filter((tag) => tag.startsWith("book:"))
      .map((tag) => tag.slice(5));
    const externalId = record.id === undefined ? "" : nameOf(record.id);
    const key = `swa:${externalId || `${name.toLowerCase()}:${[...books].sort().join("|")}`}`;
    const id = await documentId(key);
    if (ids.has(id))
      throw new Error(
        `${name}: duplicate source ID; import each source record once.`,
      );
    ids.add(id);
    const source = {
      book: books.map((code) => BOOKS[code] ?? code).join(", "),
      page: "",
      table: "sw-adversaries",
      id: externalId || id,
    };
    const incomplete = [];
    const characteristics = Object.fromEntries(
      Object.entries(CHARACTERISTICS).map(([key, label]) => [
        key,
        integer(
          record.characteristics[label],
          `characteristics.${key}`,
          incomplete,
          7,
        ),
      ]),
    );
    const skills = {};
    const groupSkills = type === "minion";
    if (groupSkills ? !Array.isArray(record.skills) : !isObject(record.skills))
      throw new Error(
        `${name}: expected ${groupSkills ? "an array of group skills" : "skill ranks"}.`,
      );
    for (const [label, rank] of groupSkills
      ? record.skills.map((label) => [label, 0])
      : Object.entries(record.skills)) {
      const key = skillKey(nameOf(label));
      if (!key) {
        incomplete.push(`Unknown skill: ${label}`);
        continue;
      }
      skills[key] = {
        rank: integer(rank, `skills.${key}`, incomplete, 5),
        group: groupSkills,
        characteristic: SKILLS[key].characteristic,
      };
    }
    const defence = record.derived.defence ?? [0, 0];
    if (!Array.isArray(defence) || defence.length !== 2)
      throw new Error(`${name}: defence must be [melee, ranged].`);
    const talents = referenceItems(record.talents, "talent", source);
    if (
      record.weapons !== undefined &&
      (!Array.isArray(record.weapons) || record.weapons.length > 100)
    )
      throw new Error(`${name}: invalid weapon list.`);
    const weapons = (record.weapons ?? []).map((entry) =>
      weaponItem(entry, source),
    );
    const weaponReferences = weapons.filter(
      (item) => item.type === "reference",
    ).length;
    const system = {
      phase: "play",
      characteristics,
      skills,
      groupSize: 1,
      species: tags.find((tag) => tag.startsWith("species:"))?.slice(8) ?? "",
      wounds: {
        value: 0,
        max: integer(record.derived.wounds, "wounds.max", incomplete),
      },
      strain: {
        value: 0,
        max:
          type === "nemesis"
            ? integer(record.derived.strain, "strain.max", incomplete)
            : 0,
      },
      soak: integer(record.derived.soak, "soak", incomplete),
      defense: {
        melee: integer(defence[0], "defense.melee", incomplete, 4),
        ranged: integer(defence[1], "defense.ranged", incomplete, 4),
      },
      forceRating:
        talents.find((item) => item.name === "Force Rating")?.system.rank ?? 0,
      source,
      incomplete,
    };
    if (system.forceRating > 10)
      throw new Error(`${name}: Force Rating exceeds the supported range.`);
    if (record.vehicle)
      incomplete.push("Attached vehicle requires a separate vehicle import");
    if (incomplete.length) report.incompleteActors++;
    report.weaponReferences += weaponReferences;
    if (incomplete.length || weaponReferences)
      report.review.push({ name, missing: [...incomplete], weaponReferences });
    documents.push({
      _id: id,
      name,
      type,
      img: `${SYSTEM_PATH}/assets/character.svg`,
      system,
      items: [
        ...weapons,
        ...talents,
        ...referenceItems(record.abilities, "reference", source),
      ],
      flags: {
        [SYSTEM_ID]: {
          importKey: key,
          swa: {
            url: externalId
              ? `https://swa.stoogoff.com/#${encodeURIComponent(externalId)}`
              : "https://swa.stoogoff.com/",
            sourceId: externalId,
            books,
            adventures: tags
              .filter((tag) => tag.startsWith("adventure:"))
              .map((tag) => tag.slice(10)),
            omittedProse: true,
            reviewRequired: true,
          },
        },
      },
    });
  }
  return {
    format: "starfall-library",
    version: 1,
    documents: { Actor: documents },
    report,
  };
}
