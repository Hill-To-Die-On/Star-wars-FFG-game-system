import { readFile, writeFile } from "node:fs/promises";

export const normalizeActivation = (value) => ({
  "Active (Action)": "Action",
  "Active (Maneuver)": "Maneuver",
  "Active (Incidental)": "Incidental",
  "Active (Incidental, Out of Turn)": "OOT Incidental",
  Active: "Active",
  Passive: "Passive",
})[String(value ?? "").trim()] ?? "";

export function publishTalentActivations(rows) {
  const activations = {};
  for (const row of rows) {
    const name = String(row.Talent ?? "").trim().toLowerCase();
    const activation = normalizeActivation(row.Activation);
    if (name && activation) activations[name] = activation;
  }
  return { format: "star-wars-ffg-talent-activations", version: 1,
    activations: Object.fromEntries(Object.entries(activations).sort(([a], [b]) => a.localeCompare(b))) };
}

if (process.argv[1]?.endsWith("publish-talent-activations.mjs")) {
  const database = JSON.parse(await readFile("data/reference-database.json", "utf8"));
  const result = publishTalentActivations(database.tables.talents);
  await writeFile("data/talent-activations.json", `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Published ${Object.keys(result.activations).length} talent activations.`);
}
