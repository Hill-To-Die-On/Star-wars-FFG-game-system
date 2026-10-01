import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { auditOriginData } from "../src/origin-data-audit.mjs";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const output = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--output="))
  ?.slice("--output=".length);

const result = auditOriginData({
  database: await json("data/reference-database.json"),
  advancement: await json("data/advancement-trees.json"),
  speciesAbilities: await json("data/species-abilities.json"),
  sourceVerification: await json("data/source-verification.json"),
});

if (output) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
}

console.log(
  [
    `Species ${result.counts.playableSpecies} playable / ${result.counts.species} catalogue (${result.counts.speciesAbilityReviewed} ability entries checked; ${result.counts.speciesAbilityPending} pending)`,
    `Careers ${result.counts.sourcedCareers} sourced + ${result.counts.abstractCareers} selection categories`,
    `Specializations ${result.counts.specializationsSourceChecked}/${result.counts.specializations} source checked`,
    `Signature abilities ${result.counts.signatureAbilitiesSourceChecked}/${result.counts.signatureAbilities} source checked`,
    `Errors ${result.errors.length}; warnings ${result.warnings.length}`,
  ].join("\n"),
);
if (result.errors.length) {
  for (const error of result.errors) console.error(`${error.code}: ${error.message}`);
  process.exitCode = 1;
}
