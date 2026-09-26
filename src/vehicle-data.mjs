export const VEHICLE_DATA_FORMAT = "star-wars-ffg-vehicle-stats";

const STAT_FIELDS = Object.freeze([
    "hullTrauma.max",
    "systemStrain.max",
    "armor",
    "silhouette",
    "speed.max",
    "handling",
    "shields",
  ]),
  METHODS = new Set(["exact-name", "reviewed-alias", "printed-page"]),
  REASONS = new Set([
    "no complete structured record",
    "conflicting structured records",
    "printed source has partial profile",
  ]),
  PRINTED_FIELDS = new Set([
    "armor",
    "handling",
    "hullTrauma",
    "shields",
    "silhouette",
    "speed",
    "systemStrain",
  ]),
  SIDES = ["fore", "aft", "port", "starboard"];

const assertKeys = (value, allowed, label) => {
  for (const key of Object.keys(value ?? {}))
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported ${key}.`);
};

const safeText = (value, max, label) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /(?:[a-z]:[\\/]|(?:^|[\\/])\.\.(?:[\\/]|$)|\.(?:xml|pdf)\b)/i.test(
      value,
    )
  )
    throw new Error(`${label} is not a safe public value.`);
};

const safeSource = (source, label) => {
  assertKeys(source, new Set(["book", "page"]), label);
  safeText(source?.book, 200, `${label} book`);
  if (
    typeof source?.page !== "string" ||
    source.page.length > 20 ||
    (source.page && !/^\d+(?:[-–]\d+)?$/.test(source.page))
  )
    throw new Error(`${label} needs a safe printed page reference.`);
};

const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${label} is outside the supported range.`);
};

const validateStats = (stats, label) => {
  assertKeys(
    stats,
    new Set([
      "hullTrauma",
      "systemStrain",
      "armor",
      "silhouette",
      "speed",
      "handling",
      "shields",
    ]),
    label,
  );
  integer(stats?.hullTrauma, 0, 100000, `${label} hull trauma`);
  integer(stats?.systemStrain, 0, 100000, `${label} system strain`);
  integer(stats?.armor, 0, 100000, `${label} armor`);
  integer(stats?.silhouette, 0, 20, `${label} silhouette`);
  integer(stats?.speed, 0, 20, `${label} speed`);
  integer(stats?.handling, -10, 10, `${label} handling`);
  assertKeys(stats?.shields, new Set(SIDES), `${label} shields`);
  for (const side of SIDES)
    integer(stats?.shields?.[side], 0, 4, `${label} ${side} shields`);
};

const validateEvidence = (evidence, label) => {
  if (evidence?.method === "printed-page") {
    assertKeys(
      evidence,
      new Set(["method", "matchedFields", "sourceReferences"]),
      label,
    );
    if (
      !Array.isArray(evidence.matchedFields) ||
      evidence.matchedFields.length !== PRINTED_FIELDS.size ||
      evidence.matchedFields.some((value) => !PRINTED_FIELDS.has(value)) ||
      new Set(evidence.matchedFields).size !== PRINTED_FIELDS.size
    )
      throw new Error(`${label} needs all reviewed vehicle fields.`);
    if (
      !Array.isArray(evidence.sourceReferences) ||
      !evidence.sourceReferences.length
    )
      throw new Error(`${label} needs reviewed printed source references.`);
    for (const source of evidence.sourceReferences)
      safeSource(source, `${label} printed source`);
    return;
  }
  assertKeys(
    evidence,
    new Set([
      "method",
      "datasetNames",
      "datasetKeys",
      "structuredSources",
      "matchedFields",
    ]),
    label,
  );
  if (!METHODS.has(evidence?.method))
    throw new Error(`${label} has an unsupported match method.`);
  for (const [key, max] of [
    ["datasetNames", 200],
    ["datasetKeys", 100],
    ["matchedFields", 50],
  ]) {
    const values = evidence?.[key];
    if (
      !Array.isArray(values) ||
      !values.length ||
      values.some(
        (value) =>
          typeof value !== "string" ||
          !value.trim() ||
          value.length > max ||
          /(?:[a-z]:[\\/]|(?:^|[\\/])\.\.(?:[\\/]|$)|\.(?:xml|pdf)\b)/i.test(
            value,
          ),
      )
    )
      throw new Error(`${label} has invalid ${key}.`);
  }
  if (
    !Array.isArray(evidence?.structuredSources) ||
    !evidence.structuredSources.length
  )
    throw new Error(`${label} needs a structured source reference.`);
  for (const source of evidence.structuredSources)
    safeSource(source, `${label} structured source`);
};

const reportFor = (data) => ({
  databaseVehicles: data.records.length + data.unresolved.length,
  matched: data.records.length,
  unresolved: data.unresolved.length,
  conflicts: data.unresolved.filter(
    (record) => record.reason === "conflicting structured records",
  ).length,
});

export function validateVehicleData(data) {
  if (
    data?.format !== VEHICLE_DATA_FORMAT ||
    data.version !== 1 ||
    !Array.isArray(data.records) ||
    !Array.isArray(data.unresolved)
  )
    throw new Error("Unsupported public vehicle data format.");
  assertKeys(
    data,
    new Set([
      "format",
      "version",
      "boundary",
      "records",
      "unresolved",
      "report",
    ]),
    "Vehicle data",
  );
  if (
    data.boundary !==
    "Numeric vehicle mechanics and source references only; descriptions, artwork and private paths are excluded."
  )
    throw new Error("Vehicle data needs the public copyright boundary.");
  const ids = new Set();
  for (const record of [...data.records, ...data.unresolved]) {
    const matched = Object.hasOwn(record, "stats");
    assertKeys(
      record,
      new Set(
        matched
          ? ["_id", "name", "source", "stats", "evidence"]
          : ["_id", "name", "source", "reason"],
      ),
      "Vehicle record",
    );
    if (
      !/^[a-zA-Z0-9]{16}$/.test(record?._id ?? "") ||
      ids.has(record._id)
    )
      throw new Error("Vehicle records need unique native identities.");
    ids.add(record._id);
    safeText(record.name, 300, "Vehicle name");
    safeSource(record.source, `${record.name} source`);
    if (matched) {
      validateStats(record.stats, `${record.name} stats`);
      validateEvidence(record.evidence, `${record.name} evidence`);
    } else if (!REASONS.has(record.reason))
      throw new Error(`${record.name} has an unsupported unresolved reason.`);
  }
  if (JSON.stringify(data.report) !== JSON.stringify(reportFor(data)))
    throw new Error("Vehicle data report does not match its records.");
  return data;
}

export function mergeVehicleStats(bundle, data) {
  validateVehicleData(data);
  const result = structuredClone(bundle),
    actors = new Map(
      Array.from(result.documents?.Actor ?? [], (actor) => [actor._id, actor]),
    );
  for (const record of data.records) {
    const actor = actors.get(record._id);
    if (!actor) continue;
    if (
      actor.type !== "vehicle" ||
      actor.name !== record.name ||
      String(actor.system?.source?.book ?? "") !== record.source.book ||
      String(actor.system?.source?.page ?? "") !== record.source.page
    )
      throw new Error(`${record.name} vehicle identity does not match.`);
    const { stats } = record;
    Object.assign(actor.system, {
      hullTrauma: { value: 0, max: stats.hullTrauma },
      systemStrain: { value: 0, max: stats.systemStrain },
      armor: stats.armor,
      silhouette: stats.silhouette,
      speed: { value: 0, max: stats.speed },
      handling: stats.handling,
      shields: structuredClone(stats.shields),
      incomplete: Array.from(actor.system.incomplete ?? []).filter(
        (entry) => !STAT_FIELDS.includes(entry),
      ),
      metadata: {
        ...(actor.system.metadata ?? {}),
        vehicleStatEvidence: structuredClone(record.evidence),
      },
    });
  }
  return result;
}

export { STAT_FIELDS as VEHICLE_STAT_FIELDS };
