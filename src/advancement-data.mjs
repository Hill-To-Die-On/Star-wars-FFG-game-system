import { validateTree } from "./advancement.mjs";

export const ADVANCEMENT_DATA_FORMAT = "star-wars-ffg-advancement-trees";
const TYPES = new Set(["specialization", "signatureAbility"]),
  SOURCE_LEVELS = new Set(["full-chart", "connectors-only", "pending"]),
  STRUCTURE_LEVELS = new Set(["validated", "missing"]),
  ALLOWED_CHECKS = new Set(["node names", "costs", "connectors"]),
  ITEM_KEYS = new Set([
    "_id",
    "name",
    "type",
    "source",
    "career",
    "careerSkills",
    "universal",
    "grantedForceRating",
    "eligibleCareers",
    "abilityCategory",
    "matchingNodes",
    "tree",
  ]),
  TREE_KEYS = new Set(["nodes", "edges", "verified", "verification", "source"]),
  NODE_KEYS = new Set([
    "id",
    "name",
    "key",
    "ranked",
    "cost",
    "row",
    "col",
    "span",
    "entry",
    "activation",
    "effects",
  ]);

const assertKeys = (value, allowed, label) => {
  for (const key of Object.keys(value ?? {}))
    if (!allowed.has(key)) throw new Error(`${label} contains unsupported ${key}.`);
};
const safeSource = (source, label) => {
  assertKeys(source, new Set(["book", "page"]), label);
  if (
    typeof source?.book !== "string" ||
    typeof source?.page !== "string" ||
    source.book.length > 200 ||
    source.page.length > 20 ||
    /[\\/]|\.pdf\b/i.test(source.book)
  )
    throw new Error(`${label} needs a safe book and page reference.`);
};
const reportFor = (items) => {
  const levels = items.map((item) => item.tree.verification.source);
  return {
    specializations: items.filter((item) => item.type === "specialization")
      .length,
    signatureAbilities: items.filter(
      (item) => item.type === "signatureAbility",
    ).length,
    structuralGraphs: items.filter((item) => item.tree.verified).length,
    fullChartCompared: levels.filter((level) => level === "full-chart").length,
    connectorCompared: levels.filter((level) => level === "connectors-only")
      .length,
    pendingComparison: levels.filter((level) => level === "pending").length,
    missingGraphs: items.filter(
      (item) => item.tree.verification.structure === "missing",
    ).length,
    nodes: items.reduce((total, item) => total + item.tree.nodes.length, 0),
  };
};

export function validateAdvancementData(data) {
  if (
    data?.format !== ADVANCEMENT_DATA_FORMAT ||
    data.version !== 1 ||
    !Array.isArray(data.items)
  )
    throw new Error("Unsupported public advancement data format.");
  assertKeys(
    data,
    new Set(["format", "version", "boundary", "items", "report"]),
    "Advancement data",
  );
  if (
    data.boundary !==
    "Structured paths, costs, references and declarative effects only; source prose and artwork are excluded."
  )
    throw new Error("Advancement data needs the public copyright boundary.");
  const ids = new Set();
  for (const item of data.items) {
    assertKeys(item, ITEM_KEYS, "Advancement item");
    if (
      !/^[a-zA-Z0-9]{16}$/.test(item?._id ?? "") ||
      ids.has(item._id) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !TYPES.has(item.type)
    )
      throw new Error("Advancement items need unique native identities.");
    ids.add(item._id);
    safeSource(item.source, `${item.name} source`);
    assertKeys(item.tree, TREE_KEYS, `${item.name} tree`);
    safeSource(item.tree?.source, `${item.name} tree source`);
    if (
      !Array.isArray(item.tree?.nodes) ||
      !Array.isArray(item.tree?.edges) ||
      typeof item.tree?.verified !== "boolean"
    )
      throw new Error(`${item.name} needs a structured tree.`);
    const verification = item.tree.verification;
    assertKeys(
      verification,
      new Set(["structure", "source", "checked", "evidencePage"]),
      `${item.name} verification`,
    );
    if (
      !STRUCTURE_LEVELS.has(verification?.structure) ||
      !SOURCE_LEVELS.has(verification?.source) ||
      !Array.isArray(verification?.checked) ||
      verification.checked.some((check) => !ALLOWED_CHECKS.has(check)) ||
      (verification.evidencePage !== undefined &&
        (typeof verification.evidencePage !== "string" ||
          !/^\d+$/.test(verification.evidencePage)))
    )
      throw new Error(`${item.name} has invalid verification metadata.`);
    if (
      item.tree.verified !== (verification.structure === "validated") ||
      (item.tree.verified && !item.tree.nodes.length) ||
      (!item.tree.verified && (item.tree.nodes.length || item.tree.edges.length))
    )
      throw new Error(`${item.name} structure status contradicts its tree.`);
    for (const entry of item.tree.nodes)
      assertKeys(entry, NODE_KEYS, `${item.name} node`);
    if (item.tree.verified) validateTree(item.tree);
    if (item.type === "specialization") {
      if (
        typeof item.career !== "string" ||
        !Array.isArray(item.careerSkills) ||
        item.careerSkills.some((skill) => typeof skill !== "string") ||
        typeof item.universal !== "boolean" ||
        !Number.isSafeInteger(item.grantedForceRating)
      )
        throw new Error(`${item.name} has invalid specialization metadata.`);
    } else if (
      !Array.isArray(item.eligibleCareers) ||
      item.eligibleCareers.some((career) => typeof career !== "string") ||
      typeof item.abilityCategory !== "string" ||
      !Array.isArray(item.matchingNodes) ||
      item.matchingNodes.some((value) => typeof value !== "boolean")
    )
      throw new Error(`${item.name} has invalid signature metadata.`);
  }
  if (JSON.stringify(data.report) !== JSON.stringify(reportFor(data.items)))
    throw new Error("Advancement data report does not match its items.");
  return data;
}

export function mergeAdvancementTrees(bundle, data) {
  validateAdvancementData(data);
  const result = structuredClone(bundle),
    items = new Map(
      Array.from(result.documents?.Item ?? [], (item) => [item._id, item]),
    );
  for (const incoming of data.items) {
    const item = items.get(incoming._id);
    if (!item) continue;
    if (
      item.name !== incoming.name ||
      item.type !== incoming.type ||
      String(item.system?.source?.book ?? "") !== incoming.source.book ||
      String(item.system?.source?.page ?? "") !== incoming.source.page
    )
      throw new Error(`${incoming.name} advancement identity does not match.`);
    item.system.tree = structuredClone(incoming.tree);
    item.system.incomplete = Array.from(item.system.incomplete ?? []).filter(
      (entry) => entry !== "tree",
    );
    if (incoming.type === "specialization")
      Object.assign(item.system, {
        career: incoming.career,
        careerSkills: structuredClone(incoming.careerSkills),
        universal: incoming.universal,
        grantedForceRating: incoming.grantedForceRating,
      });
    else
      Object.assign(item.system, {
        eligibleCareers: structuredClone(incoming.eligibleCareers),
        abilityCategory: incoming.abilityCategory,
        matchingNodes: structuredClone(incoming.matchingNodes),
      });
    if (!incoming.tree.verified && !item.system.incomplete.includes("tree"))
      item.system.incomplete.push("tree");
  }
  return result;
}
