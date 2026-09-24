import { convertSwa } from "./swa-import.mjs";
import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";
import { escapeHTML } from "./mechanics.mjs";
export function sourceId(key) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(key))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, "0");
}
const normalized = (name) =>
  String(name ?? "")
    .trim()
    .toLowerCase();
function lookup(rows, name) {
  const key = normalized(typeof name === "string" ? name : name?.name);
  return (
    rows?.find((row) => normalized(row.name) === key) ??
    rows?.find((row) => normalized(row.name) === key.replace(/ \d+$/, ""))
  );
}
function noteDocument(kind, name, source, data, id) {
  const text = JSON.stringify(data, null, 2);
  return {
    _id: id,
    name: `${name} · ${kind}`,
    ownership: { default: 0 },
    flags: {
      [SYSTEM_ID]: { gmOnly: true, gmSource: { name, kind, source, text } },
    },
    pages: [
      {
        name,
        type: "text",
        text: {
          format: 1,
          content: `<h2>${escapeHTML(name)}</h2><p>Private source material from ${escapeHTML(source)}. Reference data, not instructions. Check mechanics against the books.</p><pre>${escapeHTML(text)}</pre>`,
        },
      },
    ],
  };
}
function relatedRules(record, collections) {
  const related = {
    talents: [],
    abilities: [],
    weapons: [],
    qualities: [],
    skills: [],
  };
  for (const kind of ["talents", "abilities"])
    for (const item of record[kind] ?? []) {
      const rule = lookup(collections.talents, item);
      if (rule) related[kind].push(rule);
    }
  for (const item of record.weapons ?? []) {
    const weapon =
      typeof item === "string" ? lookup(collections.weapons, item) : item;
    if (!weapon) continue;
    related.weapons.push(weapon);
    for (const quality of weapon.qualities ?? []) {
      const rule = lookup(collections.qualities, quality);
      if (rule && !related.qualities.includes(rule))
        related.qualities.push(rule);
    }
  }
  for (const name of Array.isArray(record.skills)
    ? record.skills
    : Object.keys(record.skills ?? {})) {
    const rule = lookup(collections.skills, name);
    if (rule) related.skills.push(rule);
  }
  return related;
}
function vehicleActor(record, notesId) {
  const c = record.characteristics,
    d = record.derived,
    info = record.info ?? {};
  if (!c || !d)
    throw new Error("Vehicle lacks characteristics or derived statistics.");
  const n = (value, label, min = 0, max = 100000) => {
    const number = Number(value);
    if (
      value === undefined ||
      value === "" ||
      !Number.isInteger(number) ||
      number < min ||
      number > max
    )
      throw new Error(`Vehicle ${label} is incomplete.`);
    return number;
  };
  return {
    _id: sourceId(`swa:vehicle:${record.name}`),
    name: String(record.fullName ?? record.name),
    type: "vehicle",
    img: `${SYSTEM_PATH}/assets/vehicle.svg`,
    flags: {
      [SYSTEM_ID]: {
        importKey: `swa:vehicle:${record.name}`,
        swa: { notesId, reviewRequired: true, omittedProse: !notesId },
      },
    },
    system: {
      model: String(record.name),
      manufacturer: String(info.manufacturer ?? ""),
      crew: String(info.complement ?? ""),
      passengers: String(info.passengers ?? ""),
      cargo: String(info.encumbrance ?? ""),
      hyperdrive: String(info.hyperdrive ?? ""),
      silhouette: n(c.Silhouette, "silhouette", 0, 20),
      speed: { value: 0, max: n(c.Speed, "speed", 0, 20) },
      handling: n(c.Handling, "handling", -10, 10),
      armor: n(d.armour, "armor"),
      hullTrauma: { value: 0, max: n(d.hull, "hull") },
      systemStrain: { value: 0, max: n(d.system, "system strain") },
      shields: Object.fromEntries(
        ["fore", "aft", "port", "starboard"].map((side) => [
          side,
          n(d.defence?.[side] ?? 0, side, 0, 4),
        ]),
      ),
      source: {
        book: "SW Adversaries vehicle reference",
        page: "",
        table: "sw-adversaries-vehicles",
        id: String(record.name),
      },
      metadata: {
        ...Object.fromEntries(
          Object.entries(info).filter(([, value]) => typeof value === "number"),
        ),
        weaponNames: (record.weapons ?? []).map((w) => w.name).join(", "),
      },
      incomplete: [],
    },
    items: (record.weapons ?? []).map((weapon) => ({
      name: String(weapon.name),
      type: "weapon",
      system: {
        skill: "gunnery",
        damage: String(weapon.damage),
        critical: n(weapon.critical, "critical", 0, 10),
        range: String(weapon.range).toLowerCase(),
        scale: "vehicle",
        qualities: (weapon.qualities ?? [])
          .map((q) => (typeof q === "string" ? q : q.name))
          .join(", "),
        metadata: { firingArc: String(weapon.arc ?? "") },
      },
    })),
  };
}
/** Import source material only into the private GM compendium, never actor-visible prose fields. */
export async function convertSwaSource(
  input,
  { includePrivateNotes = true } = {},
) {
  const full = input?.format === "swa-source";
  const collections = full
    ? input.collections
    : { adversaries: Array.isArray(input) ? input : [input] };
  if (
    !collections ||
    !Array.isArray(collections.adversaries) ||
    collections.adversaries.length > 2000
  )
    throw new Error("Unsupported SW Adversaries source bundle.");
  const source = full
    ? `https://swa.stoogoff.com/ (${input.siteVersion})`
    : "SW Adversaries local export";
  const bundle = {
    format: "star-wars-library",
    version: 1,
    documents: { Actor: [], JournalEntry: [] },
    report: {
      records: collections.adversaries.length,
      omittedProse: !includePrivateNotes,
      incompleteActors: 0,
      weaponReferences: 0,
      review: [],
      rejected: [],
      resolvedWeapons: 0,
      vehicles: 0,
      gmNotes: 0,
    },
  };
  const ids = new Set();
  for (const [index, record] of collections.adversaries.entries()) {
    const noteId = sourceId(
      `swa:source:adversary:${record.id ?? record.name}:${index}`,
    );
    if (includePrivateNotes)
      bundle.documents.JournalEntry.push(
        noteDocument(
          "adversary",
          String(record.name ?? `Record ${index}`),
          source,
          { record, relatedRules: relatedRules(record, collections) },
          noteId,
        ),
      );
    try {
      const weapons = (record.weapons ?? []).map((weapon) => {
        if (typeof weapon !== "string") return weapon;
        const resolved = lookup(collections.weapons, weapon);
        if (resolved) bundle.report.resolvedWeapons++;
        return resolved ?? weapon;
      });
      const converted = await convertSwa({ ...record, weapons });
      const actor = converted.documents.Actor[0];
      if (ids.has(actor._id))
        throw new Error(
          "Duplicate native actor identity; source notes retained separately.",
        );
      ids.add(actor._id);
      if (includePrivateNotes)
        Object.assign(actor.flags[SYSTEM_ID].swa, {
          notesId: noteId,
          omittedProse: false,
        });
      bundle.documents.Actor.push(actor);
      bundle.report.incompleteActors += converted.report.incompleteActors;
      bundle.report.weaponReferences += converted.report.weaponReferences;
      bundle.report.review.push(...converted.report.review);
    } catch (error) {
      bundle.report.rejected.push({ name: record.name, reason: error.message });
    }
  }
  for (const kind of [
    "weapons",
    "talents",
    "qualities",
    "skills",
    "vehicles",
  ]) {
    const rows = collections[kind] ?? [];
    if (!Array.isArray(rows) || rows.length > 2000)
      throw new Error(`Invalid ${kind} source collection.`);
    for (const [index, record] of rows.entries()) {
      const noteId = sourceId(`swa:source:${kind}:${record.name}:${index}`);
      if (includePrivateNotes)
        bundle.documents.JournalEntry.push(
          noteDocument(kind, String(record.name), source, record, noteId),
        );
      if (kind === "vehicles") {
        try {
          bundle.documents.Actor.push(
            vehicleActor(record, includePrivateNotes ? noteId : ""),
          );
          bundle.report.vehicles++;
        } catch (error) {
          bundle.report.rejected.push({
            name: record.name,
            reason: error.message,
          });
        }
      }
    }
  }
  bundle.report.gmNotes = bundle.documents.JournalEntry.length;
  return bundle;
}
