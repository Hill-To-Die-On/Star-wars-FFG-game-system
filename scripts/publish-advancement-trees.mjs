import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ADVANCEMENT_DATA_FORMAT,
  validateAdvancementData,
} from "../src/advancement-data.mjs";

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
  ...(value.activation ? { activation: String(value.activation) } : {}),
  effects: Array.from(value.effects ?? [], effect),
});
const verificationKey = (kind, name) => `${kind}:${normalize(name)}`;

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
          structural =
            privateTree.verified === true && privateTree.nodes?.length > 0,
          checked = checks.get(verificationKey(item.type, item.name));
        if (
          checked &&
          (normalize(checked.book) !== normalize(itemSource.book) ||
            String(checked.referencePage) !== itemSource.page)
        )
          throw new Error(`Source verification does not match ${item.name}.`);
        const sourceLevel =
            checked?.level === "full-chart"
              ? "full-chart"
              : checked?.level === "connectors"
                ? "connectors-only"
                : "pending",
          tree = {
            nodes: structural
              ? Array.from(privateTree.nodes, talentNode)
              : [],
            edges: structural
              ? Array.from(privateTree.edges ?? [], (edge) => [
                  String(edge[0]),
                  String(edge[1]),
                ])
              : [],
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
                item.system?.matchingNodes ?? [],
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
