import { validateAdvancementData } from "./advancement-data.mjs";
import { SKILLS, skillKey } from "./config.mjs";
import { normalizeBookTitle } from "./rules.mjs";
import { validateSpeciesAbilityRegistry } from "./species-abilities.mjs";

const PLAYABLE = "TRUE";
const SOURCE_LEVELS = new Set(["full-chart", "connectors-only", "pending"]);
const ABSTRACT_CAREERS = new Set([
  "Any Age of Rebellion",
  "Any Edge of The Empire",
  "Any Force and Destiny",
  "Universal",
]);
const ZERO_SKILL_SPECIALIZATIONS = new Set([
  "Force Sensitive Emergent",
  "Force Sensitive Exile",
  "Force Sensitive Outcast",
  "Padawan Survivor",
]);
const SIX_SKILL_SPECIALIZATIONS = new Set(["Retired Clone Trooper"]);
const FLEXIBLE_KNOWLEDGE = /^\(?any one knowledge\)?$/i;
const SPECIES_NUMERIC_FIELDS = [
  "Brawn",
  "Agility",
  "Intellect",
  "Cunning",
  "Willpower",
  "Presence",
  "Wound_Base",
  "Strain_Base",
  "XP",
];

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const positivePage = (value) => /^[1-9]\d*$/.test(String(value ?? ""));
const sourceKey = (name, book, page) =>
  `${String(name ?? "").trim()}|${normalizeBookTitle(book)}|${String(page ?? "").trim()}`;
const bookKey = (book) => normalizeBookTitle(book);

function table(database, name, errors) {
  const rows = database?.tables?.[name];
  if (!Array.isArray(rows)) {
    errors.push({
      code: "missing-table",
      table: name,
      message: `Reference database table ${name} is missing or is not an array.`,
    });
    return [];
  }
  return rows;
}

function skillTokens(value) {
  return String(value ?? "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function normalizeCareerSkills(value) {
  const tokens = Array.isArray(value) ? value : skillTokens(value);
  return tokens.map((token) => ({
    token,
    key: FLEXIBLE_KNOWLEDGE.test(token) ? "__anyKnowledge__" : skillKey(token),
  }));
}

function skillSet(values) {
  return new Set(values.map((value) => (typeof value === "string" ? value : value.key)));
}

function compareCareerSkills(raw, overlay) {
  const rawSkills = normalizeCareerSkills(raw);
  const overlaySkills = normalizeCareerSkills(overlay);
  const rawSet = skillSet(rawSkills);
  const overlaySet = skillSet(overlaySkills);
  if (rawSet.has(null) || overlaySet.has(null)) return false;
  if (rawSet.has("__anyKnowledge__")) {
    rawSet.delete("__anyKnowledge__");
    return rawSet.size === overlaySet.size && [...rawSet].every((key) => overlaySet.has(key));
  }
  return rawSet.size === overlaySet.size && [...rawSet].every((key) => overlaySet.has(key));
}

function sourceAvailable(source, registeredBooks) {
  return (
    hasText(source?.book) &&
    positivePage(source?.page) &&
    registeredBooks.has(bookKey(source.book))
  );
}

function pushPendingWarning(warnings, code, label, names) {
  if (!names.length) return;
  warnings.push({
    code,
    message: `${names.length} ${label} still need source comparison.`,
    names,
  });
}

/**
 * Audit the public species, career, specialization and advancement identities.
 * This checks structured consistency and recorded source coverage. It does not
 * copy or reproduce sourcebook prose.
 */
export function auditOriginData({
  database,
  advancement,
  speciesAbilities,
  sourceVerification,
} = {}) {
  const errors = [];
  const warnings = [];
  const referenceBooks = table(database, "books", errors);
  const species = table(database, "species", errors);
  const careers = table(database, "careers", errors);
  const specializations = table(database, "career_specialisations", errors);
  const signatureRows = table(database, "signature_abilities", errors);
  table(database, "skills", errors);
  const registeredBooks = new Set(referenceBooks.map((row) => bookKey(row.books)));
  const validSkillKeys = new Set(Object.keys(SKILLS));

  const playableSpecies = species.filter((row) => row.Playable === PLAYABLE);
  const playableSpeciesWithSource = playableSpecies.filter((row) =>
    sourceAvailable({ book: row.Book, page: row.Page }, registeredBooks),
  );
  const duplicateSpeciesNames = Object.entries(
    species.reduce((counts, row) => {
      const name = String(row.Species ?? "").trim();
      if (name) counts[name] = (counts[name] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .filter(([, count]) => count > 1)
    .map(([name]) => name);
  if (duplicateSpeciesNames.length)
    warnings.push({
      code: "duplicate-species-names",
      message: "Some species names have more than one catalogue row; selection must retain source identity.",
      names: duplicateSpeciesNames,
    });

  for (const row of species) {
    if (!hasText(row.Species))
      errors.push({ code: "species-name", message: "Species needs a name.", row });
    if (!["TRUE", "FALSE"].includes(row.Playable))
      errors.push({
        code: "species-playable",
        species: row.Species,
        message: `${row.Species} needs an explicit playable flag.`,
      });
  }
  for (const row of playableSpecies) {
    if (!hasText(row.Special))
      errors.push({
        code: "species-special",
        species: row.Species,
        message: `${row.Species} needs a recorded Special field.`,
      });
    for (const field of SPECIES_NUMERIC_FIELDS)
      if (!/^\d+$/.test(String(row[field] ?? "")))
        errors.push({
          code: "species-stat",
          species: row.Species,
          field,
          message: `${row.Species} has a non-numeric ${field}.`,
        });
    const hasBook = hasText(row.Book);
    const hasPage = positivePage(row.Page);
    if (hasBook !== hasPage)
      errors.push({
        code: "species-source",
        species: row.Species,
        message: `${row.Species} has only half of a source reference.`,
      });
    else if (hasBook && !registeredBooks.has(bookKey(row.Book)))
      errors.push({
        code: "species-book",
        species: row.Species,
        book: row.Book,
        message: `${row.Species} cites a book absent from the public book table.`,
      });
  }

  const speciesRegistry = (() => {
    try {
      return validateSpeciesAbilityRegistry(speciesAbilities);
    } catch (error) {
      errors.push({ code: "species-ability-registry", message: error.message });
      return { entries: [] };
    }
  })();
  for (const entry of speciesRegistry.entries ?? []) {
    const matches = playableSpecies.filter(
      (row) =>
        row.Species === entry.species &&
        normalizeBookTitle(row.Book) === normalizeBookTitle(entry.source.book) &&
        String(row.Page) === String(entry.source.cataloguePage),
    );
    if (!matches.length)
      errors.push({
        code: "species-ability-source",
        species: entry.species,
        message: "Species ability entry does not map to a playable catalogue row.",
      });
    if (!registeredBooks.has(bookKey(entry.source.book)))
      errors.push({
        code: "species-ability-book",
        species: entry.species,
        book: entry.source.book,
        message: "Species ability entry cites a book absent from the public book table.",
      });
  }
  const reviewedSpeciesRows = playableSpecies.filter((row) =>
    [...(speciesRegistry.entries ?? [])].some(
      (entry) =>
        row.Species === entry.species &&
        normalizeBookTitle(row.Book) === normalizeBookTitle(entry.source.book) &&
        String(row.Page) === String(entry.source.cataloguePage),
    ),
  );
  const speciesAbilityPending = playableSpecies.length - reviewedSpeciesRows.length;
  if (speciesAbilityPending)
    warnings.push({
      code: "species-ability-review-pending",
      message: `${speciesAbilityPending} playable species still need a source-checked ability entry or source citation.`,
      names: playableSpecies
        .filter((row) => !reviewedSpeciesRows.includes(row))
        .map((row) => row.Species),
    });
  const speciesWithoutSource = playableSpecies
    .filter((row) => !sourceAvailable({ book: row.Book, page: row.Page }, registeredBooks))
    .map((row) => row.Species);
  if (speciesWithoutSource.length)
    warnings.push({
      code: "species-source-pending",
      message: `${speciesWithoutSource.length} playable species have no usable source reference.`,
      names: speciesWithoutSource,
    });

  const careerNames = new Set(careers.map((row) => row.Career));
  const abstractCareers = careers.filter((row) => ABSTRACT_CAREERS.has(row.Career)).map((row) => row.Career);
  const sourcedCareers = careers.filter((row) => !ABSTRACT_CAREERS.has(row.Career));
  for (const row of careers) {
    const tokens = skillTokens(row.Career_Skills);
    if (!hasText(row.Career)) {
      errors.push({ code: "career-name", message: "Career needs a name.", row });
      continue;
    }
    if (ABSTRACT_CAREERS.has(row.Career)) {
      if (tokens.length || hasText(row.Book) || positivePage(row.Page))
        errors.push({ code: "abstract-career", career: row.Career, message: `${row.Career} must remain an unreferenced selection category.` });
      continue;
    }
    if (tokens.length < 6 || tokens.length > 8)
      errors.push({ code: "career-skill-count", career: row.Career, message: `${row.Career} must list six to eight career skills.` });
    for (const token of tokens)
      if (!skillKey(token) || !validSkillKeys.has(skillKey(token)))
        errors.push({ code: "career-skill", career: row.Career, skill: token, message: `${row.Career} contains an unknown career skill.` });
    if (!sourceAvailable({ book: row.Book, page: row.Page }, registeredBooks))
      errors.push({ code: "career-source", career: row.Career, message: `${row.Career} needs a registered book and page.` });
  }

  let advancementData;
  try {
    advancementData = validateAdvancementData(advancement);
  } catch (error) {
    errors.push({ code: "advancement-data", message: error.message });
    advancementData = { items: [], report: {} };
  }
  const advancementItems = advancementData.items ?? [];
  const specializationItems = advancementItems.filter((item) => item.type === "specialization");
  const signatureItems = advancementItems.filter((item) => item.type === "signatureAbility");
  const specializationByIdentity = new Map(specializationItems.map((item) => [sourceKey(item.name, item.source.book, item.source.page), item]));
  const signatureByIdentity = new Map(signatureItems.map((item) => [sourceKey(item.name, item.source.book, item.source.page), item]));

  for (const row of specializations) {
    const identity = sourceKey(row.Career_Specialisation, row.Book, row.Page);
    const item = specializationByIdentity.get(identity);
    if (!careerNames.has(row.Career))
      errors.push({ code: "specialization-career", specialization: row.Career_Specialisation, career: row.Career, message: "Specialization points to an unknown career." });
    if (!sourceAvailable({ book: row.Book, page: row.Page }, registeredBooks))
      errors.push({ code: "specialization-source", specialization: row.Career_Specialisation, message: "Specialization needs a registered book and page." });
    const parsed = normalizeCareerSkills(row.Bonus_Career_Skills);
    const invalid = parsed.filter((skill) => skill.key === null);
    if (invalid.length)
      errors.push({ code: "specialization-skill", specialization: row.Career_Specialisation, message: `${row.Career_Specialisation} contains an unknown bonus skill.` });
    const expectedCount = ZERO_SKILL_SPECIALIZATIONS.has(row.Career_Specialisation)
      ? 0
      : SIX_SKILL_SPECIALIZATIONS.has(row.Career_Specialisation)
        ? 6
        : 4;
    if (parsed.length !== expectedCount)
      errors.push({ code: "specialization-skill-count", specialization: row.Career_Specialisation, message: `${row.Career_Specialisation} should list ${expectedCount} bonus career skills.` });
    if (!item)
      errors.push({ code: "specialization-advancement", specialization: row.Career_Specialisation, message: "Specialization is absent from the public advancement bundle." });
    else {
      if (item.career !== row.Career)
        errors.push({ code: "specialization-career-mismatch", specialization: row.Career_Specialisation, message: "Database and advancement career identities differ." });
      if (!compareCareerSkills(row.Bonus_Career_Skills, item.careerSkills))
        errors.push({
          code: "specialization-skill-mismatch",
          specialization: row.Career_Specialisation,
          database: parsed.map((skill) => skill.key),
          advancement: item.careerSkills,
          message: "Database bonus skills differ from the source-backed advancement overlay.",
        });
    }
  }

  const signatureByName = new Map(signatureRows.map((row) => [row.signature_abilities, row]));
  for (const item of signatureItems) {
    const row = signatureByName.get(item.name);
    if (!row)
      errors.push({ code: "signature-database", signatureAbility: item.name, message: "Signature ability is absent from the reference database." });
    else if (
      normalizeBookTitle(row.book) !== normalizeBookTitle(item.source.book) ||
      String(row.page) !== String(item.source.page)
    )
      errors.push({ code: "signature-source-mismatch", signatureAbility: item.name, message: "Database and advancement source identities differ." });
  }
  for (const row of signatureRows)
    if (!signatureByIdentity.has(sourceKey(row.signature_abilities, row.book, row.page)))
      errors.push({ code: "signature-advancement", signatureAbility: row.signature_abilities, message: "Signature ability is absent from the public advancement bundle." });

  const verificationChecks = Array.isArray(sourceVerification?.checks) ? sourceVerification.checks : [];
  if (sourceVerification?.format !== "star-wars-ffg-source-verification" || sourceVerification?.version !== 1 || !Array.isArray(sourceVerification?.checks))
    errors.push({ code: "source-verification", message: "Invalid source-verification format." });
  const checkedIdentities = new Map();
  for (const check of verificationChecks) {
    if (!check?.name || !check?.book || !check?.referencePage || !["specialization", "signatureAbility"].includes(check.kind) || !SOURCE_LEVELS.has(check.level))
      errors.push({ code: "source-verification-entry", message: "Source-verification entry is incomplete.", check });
    const key = `${check.kind}|${sourceKey(check.name, check.book, check.referencePage)}`;
    if (checkedIdentities.has(key)) errors.push({ code: "source-verification-duplicate", message: `Repeated source-verification entry for ${check.name}.` });
    checkedIdentities.set(key, check);
  }
  const sourcePendingSpecializations = specializationItems
    .filter((item) => checkedIdentities.get(`specialization|${sourceKey(item.name, item.source.book, item.source.page)}`)?.level !== "full-chart")
    .map((item) => item.name);
  const sourcePendingSignatures = signatureItems
    .filter((item) => checkedIdentities.get(`signatureAbility|${sourceKey(item.name, item.source.book, item.source.page)}`)?.level !== "full-chart")
    .map((item) => item.name);
  pushPendingWarning(warnings, "specialization-source-pending", "specializations", sourcePendingSpecializations);
  pushPendingWarning(warnings, "signature-source-pending", "signature abilities", sourcePendingSignatures);
  for (const check of verificationChecks) {
    const map = check.kind === "specialization" ? specializationByIdentity : signatureByIdentity;
    if (!map.has(sourceKey(check.name, check.book, check.referencePage)))
      errors.push({ code: "orphan-source-verification", name: check.name, message: "Source-verification entry has no matching advancement item." });
  }
  for (const item of advancementItems) {
    const check = checkedIdentities.get(`${item.type}|${sourceKey(item.name, item.source.book, item.source.page)}`);
    if (check && String(check.referencePage) !== String(item.source.page))
      errors.push({ code: "source-page-mismatch", name: item.name, message: "Advancement source page and source-verification page differ." });
  }

  const counts = {
    species: species.length,
    playableSpecies: playableSpecies.length,
    playableSpeciesWithSource: playableSpeciesWithSource.length,
    speciesAbilityReviewed: reviewedSpeciesRows.length,
    speciesAbilityPending,
    speciesAbilityEntries: speciesRegistry.entries?.length ?? 0,
    speciesWithoutSource: speciesWithoutSource.length,
    careers: careers.length,
    sourcedCareers: sourcedCareers.length,
    abstractCareers: abstractCareers.length,
    specializations: specializationItems.length,
    specializationsSourceChecked: specializationItems.length - sourcePendingSpecializations.length,
    specializationsPending: sourcePendingSpecializations.length,
    signatureAbilities: signatureItems.length,
    signatureAbilitiesSourceChecked: signatureItems.length - sourcePendingSignatures.length,
    signatureAbilitiesPending: sourcePendingSignatures.length,
    advancementNodes: advancementItems.reduce((total, item) => total + item.tree.nodes.length, 0),
    advancementStructuralGraphs: advancementItems.filter((item) => item.tree.verified).length,
    sourceVerificationChecks: verificationChecks.length,
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts,
    pending: {
      speciesWithoutSource,
      speciesAbility: playableSpecies.filter((row) => !reviewedSpeciesRows.includes(row)).map((row) => row.Species),
      specializations: sourcePendingSpecializations,
      signatureAbilities: sourcePendingSignatures,
    },
    duplicateSpeciesNames,
  };
}
