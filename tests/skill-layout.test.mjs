import test from "node:test";
import assert from "node:assert/strict";
import { buildSkillColumns, SKILL_VIEWS } from "../src/skill-layout.mjs";

const standard = [
    { key: "z", label: "Zoology", category: "Knowledge" },
    { key: "a", label: "Athletics", category: "General" },
    { key: "m", label: "Melee", category: "Combat" },
    { key: "c", label: "Charm", category: "General" },
  ],
  custom = [
    { key: "custom:1", label: "Diplomacy", custom: true },
    { key: "custom:2", label: "Cryptography", custom: true },
  ];

test("grouped skills preserve rule categories and a single custom add control", () => {
  const columns = buildSkillColumns(standard, custom, "grouped"),
    sections = columns.flatMap((column) => column.sections);
  assert.equal(columns.length, 3);
  assert.ok(sections.some((section) => section.label === "Combat"));
  assert.ok(sections.some((section) => section.label === "Knowledge"));
  assert.equal(sections.filter((section) => section.addCustom).length, 1);
  assert.equal(
    sections.flatMap((section) => section.skills).filter((skill) => skill.custom)
      .length,
    2,
  );
});

test("alphabetical skills keep one global A–Z order across balanced columns", () => {
  const columns = buildSkillColumns(standard, custom, "alphabetical"),
    sections = columns.flatMap((column) => column.sections),
    labels = sections.flatMap((section) =>
      section.skills.map((skill) => skill.label),
    );
  assert.deepEqual(labels, [
    "Athletics",
    "Charm",
    "Cryptography",
    "Diplomacy",
    "Melee",
    "Zoology",
  ]);
  assert.deepEqual(
    sections.map((section) => section.skills.length),
    [2, 2, 2],
  );
  assert.equal(sections.filter((section) => section.addCustom).length, 1);
  assert.throws(() => buildSkillColumns([], [], "unknown"));
  assert.deepEqual(Object.keys(SKILL_VIEWS), ["grouped", "alphabetical"]);
});
