import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ADVANCEMENT_DATA_FORMAT,
  validateAdvancementData,
} from "../src/advancement-data.mjs";
import { talentActivation } from "../src/talent-activation.mjs";

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
const source = (value) => ({
  book: String(value?.book ?? "").trim(),
  page: String(value?.page ?? "").trim(),
});
const effect = (value) => ({
  type: value.type,
  operation: value.operation,
  target: value.target,
  count: value.count,
  ...(value.skills?.length
    ? { skills: Array.from(value.skills, (entry) => String(entry)) }
    : {}),
  ...(value.groups?.length
    ? { groups: Array.from(value.groups, (entry) => String(entry)) }
    : {}),
  ...(value.requirements
    ? {
        requirements: Object.fromEntries(
          Object.entries(value.requirements).filter(([key]) =>
            ["equippedArmor", "minimumSoak"].includes(key),
          ),
        ),
      }
    : {}),
});
const talentNode = (value) => ({
  id: String(value.id),
  name: String(value.name),
  ...(value.key ? { key: String(value.key) } : {}),
  ranked: value.ranked === true,
  cost: value.cost,
  row: value.row,
  col: value.col,
  ...(Number.isSafeInteger(value.span) ? { span: value.span } : {}),
  entry: value.entry === true,
  ...(talentActivation(value.name, value.activation) ? { activation: talentActivation(value.name, value.activation) } : {}),
  effects: Array.from(value.effects ?? [], effect),
});
const verificationKey = (kind, name) => `${kind}:${normalize(name)}`;
const chartShape = (tree) => JSON.stringify({
  nodes: Array.from(tree.nodes ?? [], (node) => [
    String(node.id), String(node.name), node.cost, node.row, node.col,
    node.span ?? 1, node.entry === true,
  ]).sort((a, b) => a[0].localeCompare(b[0])),
  edges: Array.from(tree.edges ?? [], (edge) => [...edge].sort().join(":"))
    .sort(),
});

function correctedChart(privateTree, checked, structural, itemName) {
  const nodes = structural ? Array.from(privateTree.nodes, talentNode) : [];
  const edges = structural
    ? Array.from(privateTree.edges ?? [], (edge) => [String(edge[0]), String(edge[1])])
    : [];
  const corrections = checked?.nodeCorrections ?? [];
  const additions = checked?.edgeAdds ?? [];
  if ((!Array.isArray(corrections) || !Array.isArray(additions)) ||
      ((corrections.length || additions.length) && (!structural || checked.level !== "full-chart")))
    throw new Error(`${itemName} needs a fully checked chart before correction.`);
  const ids = new Set(nodes.map((node) => node.id));
  const correctedIds = new Set();
  for (const correction of corrections) {
    const node = nodes.find((value) => value.id === correction.id);
    const keys = Object.keys(correction).sort().join(",");
    if (!node || correctedIds.has(correction.id) ||
        !["id,printedCost,sourceCost", "id,printedName,sourceName"].includes(keys))
      throw new Error(`Invalid ${itemName} node correction.`);
    correctedIds.add(correction.id);
    const field = "printedCost" in correction ? "cost" : "name";
    const before = correction[field === "cost" ? "sourceCost" : "sourceName"];
    const after = correction[field === "cost" ? "printedCost" : "printedName"];
    if ((field === "cost" && (!Number.isInteger(before) || !Number.isInteger(after))) ||
        (field === "name" && (![before, after].every((value) => typeof value === "string" && value.trim() && value.length <= 80))) ||
        node[field] !== before && node[field] !== after)
      throw new Error(`${itemName} node correction does not match the source tree.`);
    node[field] = after;
  }
  for (const pair of additions) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] ||
        !pair.every((id) => ids.has(id)))
      throw new Error(`Invalid ${itemName} edge correction.`);
    if (!edges.some((edge) => edge[0] === pair[0] && edge[1] === pair[1] ||
        edge[0] === pair[1] && edge[1] === pair[0]))
      edges.push([...pair].sort());
  }
  edges.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return { nodes, edges };
}

export function publishAdvancementTrees(catalog, verification) {
  if (
    catalog?.format !== "star-wars-library" ||
    catalog.version !== 1 ||
    !Array.isArray(catalog.documents?.Item)
  )
    throw new Error("Choose an enriched private Star Wars library catalogue.");
  if (
    verification?.format !== "star-wars-ffg-source-verification" ||
    verification.version !== 1 ||
    !Array.isArray(verification.checks)
  )
    throw new Error("Choose a source-verification manifest.");
  const checks = new Map(
      verification.checks.map((entry) => [
        verificationKey(entry.kind, entry.name),
        entry,
      ]),
    ),
    items = catalog.documents.Item.filter((item) =>
      ["specialization", "signatureAbility"].includes(item.type),
    )
      .map((item) => {
        const itemSource = source(item.system?.source),
          privateTree = item.system?.tree ?? {},
          checked = checks.get(verificationKey(item.type, item.name));
        if (
          checked &&
          (normalize(checked.book) !== normalize(itemSource.book) ||
            String(checked.referencePage) !== itemSource.page)
        )
          throw new Error(`Source verification does not match ${item.name}.`);
        const standalone = checked?.chart;
        const privateStructural = privateTree.verified === true && privateTree.nodes?.length > 0;
        if (standalone &&
            (item.type !== "signatureAbility" || checked.level !== "full-chart" ||
             !Array.isArray(standalone.nodes) || standalone.nodes.length !== 9 ||
             !Array.isArray(standalone.edges) ||
             !Array.isArray(standalone.matchingNodes) ||
             standalone.matchingNodes.length !== 4 ||
             !standalone.matchingNodes.every((value) => typeof value === "boolean") ||
             !standalone.matchingNodes.some(Boolean) ||
             privateStructural &&
               (chartShape(privateTree) !== chartShape(standalone) ||
                JSON.stringify(item.system?.matchingNodes) !== JSON.stringify(standalone.matchingNodes))))
          throw new Error(`Invalid checked signature chart for ${item.name}.`);
        const sourceTree = standalone && !privateStructural
            ? { nodes: standalone.nodes, edges: standalone.edges }
            : privateTree,
          structural = Boolean(standalone) || privateStructural;
        const sourceLevel =
            checked?.level === "full-chart"
              ? "full-chart"
              : checked?.level === "connectors"
                ? "connectors-only"
                : "pending",
          chart = correctedChart(sourceTree, checked, structural, item.name),
          tree = {
            nodes: chart.nodes,
            edges: chart.edges,
            verified: structural,
            verification: {
              structure: structural ? "validated" : "missing",
              source: sourceLevel,
              checked: Array.from(checked?.checked ?? [], String),
              ...(checked?.evidencePage
                ? { evidencePage: String(checked.evidencePage) }
                : {}),
            },
            source: itemSource,
          },
          common = {
            _id: item._id,
            name: String(item.name),
            type: item.type,
            source: itemSource,
            tree,
          };
        return item.type === "specialization"
          ? {
              ...common,
              career: String(item.system?.career ?? ""),
              careerSkills: Array.from(
                item.system?.careerSkills ?? [],
                String,
              ),
              universal: item.system?.universal === true,
              grantedForceRating: Number.isSafeInteger(
                item.system?.grantedForceRating,
              )
                ? item.system.grantedForceRating
                : 0,
            }
          : {
              ...common,
              eligibleCareers: Array.from(
                item.system?.eligibleCareers ?? [],
                String,
              ),
              abilityCategory: String(item.system?.abilityCategory ?? ""),
              matchingNodes: Array.from(
                standalone?.matchingNodes ?? item.system?.matchingNodes ?? [],
                Boolean,
              ),
            };
      })
      .sort(
        (a, b) =>
          a.type.localeCompare(b.type) ||
          a.name.localeCompare(b.name) ||
          a._id.localeCompare(b._id),
      );
  const levels = items.map((item) => item.tree.verification.source),
    data = {
      format: ADVANCEMENT_DATA_FORMAT,
      version: 1,
      boundary:
        "Structured paths, costs, references and declarative effects only; source prose and artwork are excluded.",
      items,
      report: {
        specializations: items.filter(
          (item) => item.type === "specialization",
        ).length,
        signatureAbilities: items.filter(
          (item) => item.type === "signatureAbility",
        ).length,
        structuralGraphs: items.filter((item) => item.tree.verified).length,
        fullChartCompared: levels.filter((level) => level === "full-chart")
          .length,
        connectorCompared: levels.filter(
          (level) => level === "connectors-only",
        ).length,
        pendingComparison: levels.filter((level) => level === "pending")
          .length,
        missingGraphs: items.filter(
          (item) => item.tree.verification.structure === "missing",
        ).length,
        nodes: items.reduce(
          (total, item) => total + item.tree.nodes.length,
          0,
        ),
      },
    };
  return validateAdvancementData(data);
}

async function main() {
  const [
      catalogPath = ".local/catalog.json",
      verificationPath = "data/source-verification.json",
      outputPath = "data/advancement-trees.json",
    ] = process.argv.slice(2),
    catalogFile = resolve(catalogPath),
    destination = resolve(outputPath);
  if (!catalogFile.split(/[\\/]/).includes(".local"))
    throw new Error("The enriched source catalogue must remain under .local.");
  if (dirname(destination) !== resolve("data"))
    throw new Error("Write public advancement data directly under data.");
  const published = publishAdvancementTrees(
    JSON.parse(await readFile(catalogFile, "utf8")),
    JSON.parse(await readFile(resolve(verificationPath), "utf8")),
  );
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(published, null, 2)}\n`);
  console.log(JSON.stringify(published.report));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
