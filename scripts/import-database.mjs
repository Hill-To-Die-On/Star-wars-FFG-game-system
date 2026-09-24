import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseSqlDump } from "./sql-parser.mjs";
import { skillKey, SYSTEM_ID } from "../src/config.mjs";
import { escapeHTML } from "../src/mechanics.mjs";
const nameColumns = {
  weapons: "Weapon",
  armour: "Armour",
  equipment: "Name",
  talents: "Talent",
  species: "Species",
  careers: "Career",
  career_specialisations: "Specialisation",
  planets: "Planet_Name",
  books: "books",
  force_powers: "Force_Power",
};
const itemTypes = {
  weapons: "weapon",
  vehicle_weapons: "weapon",
  armour: "armor",
  equipment: "gear",
  talents: "talent",
  species: "species",
  careers: "career",
  career_specialisations: "specialization",
  attachments: "attachment",
  vehicle_attachments: "attachment",
  force_powers: "forcePower",
};
const num = (value) => (/^\d+$/.test(String(value ?? "")) ? Number(value) : 0);
const skills = (value) =>
  String(value ?? "")
    .split(",")
    .map((s) => skillKey(s))
    .filter(Boolean);
const source = (table, row) => ({
  table,
  id: String(row.ID ?? ""),
  book: String(row.Book ?? ""),
  page: String(row.Page ?? ""),
});
export function convertDatabase(tables) {
  const bundle = {
    format: "starfall-library",
    version: 1,
    documents: { Item: [], Actor: [], JournalEntry: [] },
    report: { tables: {}, missingVehicleStats: 0, omittedProse: true },
  };
  const ids = new Set();
  for (const [table, rows] of Object.entries(tables)) {
    bundle.report.tables[table] = rows.length;
    if (table.startsWith("dice_") || table === "dice_sides") continue;
    for (const [index, row] of rows.entries()) {
      const name = String(
        row[nameColumns[table]] ??
          row.Name ??
          row.Specialisation ??
          row.Specialization ??
          row.Force_Power ??
          row.Equipment ??
          row.Attachment ??
          row.Vehicle_Weapon ??
          row.Weapon ??
          Object.entries(row).find(
            ([k, v]) => k !== "ID" && typeof v === "string" && v.trim(),
          )?.[1] ??
          `${table} ${index + 1}`,
      ).trim();
      const key = `${table}:${row.ID ?? index}:${index}`;
      const id = createHash("sha256").update(key).digest("hex").slice(0, 16);
      if (ids.has(id)) throw new Error("Duplicate generated id");
      ids.add(id);
      // A strict set of excluded prose fields; original source files are never bundled.
      const metadata = Object.fromEntries(
        Object.entries(row).filter(
          ([k, v]) =>
            v !== null &&
            !/description|^rule$|^special$|text|biography|notes/i.test(k),
        ),
      );
      const common = {
        _id: id,
        name,
        flags: { [SYSTEM_ID]: { importKey: key } },
      };
      const ref = source(table, row);
      if (table === "vehicles") {
        bundle.report.missingVehicleStats++;
        bundle.documents.Actor.push({
          ...common,
          type: "vehicle",
          img: `systems/${SYSTEM_ID}/assets/vehicle.svg`,
          system: {
            model: String(row.Class ?? ""),
            manufacturer: String(row.Manufacturer ?? ""),
            crew: String(row.Crew ?? ""),
            passengers: String(row.Passengers ?? ""),
            cargo: String(row.Encumbrance ?? ""),
            hyperdrive: String(row.Primary_Hyperdrive ?? ""),
            source: ref,
            metadata,
            incomplete: [
              "hullTrauma.max",
              "systemStrain.max",
              "armor",
              "silhouette",
              "speed.max",
              "handling",
              "shields",
            ],
            hullTrauma: { value: 0, max: 0 },
            systemStrain: { value: 0, max: 0 },
            armor: 0,
            silhouette: 0,
            speed: { value: 0, max: 0 },
          },
        });
      } else if (
        [
          "planets",
          "trade_route_list",
          "modular_encounters",
          "adventure_seeds",
          "allies_and_adversaries",
        ].includes(table)
      ) {
        const content = `<h2>${escapeHTML(name)}</h2><p>Reference entry. Consult ${escapeHTML(ref.book || "the source book")}${ref.page ? `, p. ${escapeHTML(ref.page)}` : ""} for details.</p><table>${Object.entries(
          metadata,
        )
          .filter(([k]) => !["ID", "Book", "Page"].includes(k))
          .map(
            ([k, v]) =>
              `<tr><th>${escapeHTML(k.replaceAll("_", " "))}</th><td>${escapeHTML(v)}</td></tr>`,
          )
          .join("")}</table>`;
        bundle.documents.JournalEntry.push({
          ...common,
          pages: [
            {
              name,
              type: "text",
              text: { format: 1, content },
              flags: { [SYSTEM_ID]: { source: ref } },
            },
          ],
        });
      } else {
        const type = itemTypes[table] ?? "reference";
        const system = {
          source: ref,
          metadata,
          description: "",
          price: num(row.Price),
          rarity: num(row.Rarity),
          encumbrance: num(row.Encumbrance),
          hardpoints: num(row.HP),
          restricted: String(row.Restricted).toLowerCase() === "true",
        };
        if (type === "weapon")
          Object.assign(system, {
            skill: skillKey(row.Skill) ?? "gunnery",
            damage: String(row.Damage ?? "0"),
            critical: num(row.Critical),
            range: String(row.Range ?? "short").toLowerCase(),
            qualities: String(row.Special ?? ""),
            scale: table === "vehicle_weapons" ? "vehicle" : "personal",
          });
        if (type === "armor")
          Object.assign(system, {
            soak: num(row.Soak),
            defense: num(row.Defense),
          });
        if (type === "talent")
          Object.assign(system, {
            ranked: String(row.Ranked).toLowerCase() === "true",
            activation: String(row.Activation ?? ""),
          });
        if (["career", "specialization"].includes(type))
          Object.assign(system, {
            career: String(row.Career ?? ""),
            careerSkills: skills(
              row.Career_Skills ??
                row.Specialisation_Skills ??
                row.Specialization_Skills ??
                row.Bonus_Career_Skills,
            ),
            forceRating: num(row.Force_Rating),
            incomplete: type === "specialization" ? ["tree"] : [],
          });
        bundle.documents.Item.push({
          ...common,
          type,
          img: `systems/${SYSTEM_ID}/assets/${type === "weapon" ? "weapon" : "item"}.svg`,
          system,
        });
      }
    }
  }
  bundle.report.documents = Object.fromEntries(
    Object.entries(bundle.documents).map(([type, docs]) => [type, docs.length]),
  );
  return bundle;
}
async function main() {
  const [input, output = ".local/catalog.json"] = process.argv.slice(2);
  if (!input)
    throw new Error(
      'Usage: npm run import:database -- "path/to/backup.sql" [.local/catalog.json]',
    );
  const destination = resolve(output);
  if (
    !destination.includes(
      `${process.platform === "win32" ? "\\" : "/"}.local${process.platform === "win32" ? "\\" : "/"}`,
    )
  )
    throw new Error("Write imported data inside an ignored .local directory.");
  const bundle = convertDatabase(parseSqlDump(await readFile(input, "utf8")));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(bundle, null, 2));
  console.log(JSON.stringify(bundle.report, null, 2));
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
