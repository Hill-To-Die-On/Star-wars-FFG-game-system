import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import {
  indexRuleInstructionCandidates,
  filterRuleInstructionCandidates,
} from "../src/rule-instruction-audit.mjs";

const args = process.argv.slice(2);
const books = [];
let output = "", includeUnreferenced = false;
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--book" && args[index + 1]) books.push(args[++index]);
  else if (args[index] === "--out" && args[index + 1]) output = args[++index];
  else if (args[index] === "--include-unreferenced") includeUnreferenced = true;
  else throw new Error(`Unknown or incomplete argument: ${args[index]}`);
}

const database = JSON.parse(await readFile("data/reference-database.json", "utf8"));
const advancement = JSON.parse(await readFile("data/advancement-trees.json", "utf8"));
const index = indexRuleInstructionCandidates(database);
const campaign = {
  bookMode: books.length ? "owned" : "all",
  books,
  includeUnreferenced,
};
const candidates = filterRuleInstructionCandidates(index.records, campaign);
const nodes = advancement.items.flatMap((item) => item.tree.nodes);
const verification = advancement.items.reduce((counts, item) => {
  const level = item.tree.verification?.source ?? "unrecorded";
  counts[level] = (counts[level] ?? 0) + 1;
  return counts;
}, {});
const report = {
  scope: "Catalogue candidates only; a name and source citation do not verify a complete gameplay instruction.",
  registeredBooks: index.registeredBookCount,
  selectedBooks: books,
  totalCandidates: index.records.length,
  selectedCandidates: candidates.length,
  tables: index.summary,
  sameNameAcrossBooks: index.overlaps,
  booksMissingFromRegister: index.unlistedBooks,
  advancement: {
    items: advancement.items.length,
    nodes: nodes.length,
    nodesWithEffects: nodes.filter((node) => node.effects?.length).length,
    chartVerification: verification,
    note: "Chart comparison checks names, costs and connectors; it does not verify every effect.",
  },
};

if (output) {
  const localRoot = resolve(".local");
  const target = resolve(output);
  if (!target.startsWith(`${localRoot}${sep}`))
    throw new Error("Candidate export must stay inside the ignored .local directory.");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    candidates.map((record) => JSON.stringify(record)).join("\n") + "\n",
    "utf8",
  );
}
console.log(JSON.stringify(report, null, 2));
