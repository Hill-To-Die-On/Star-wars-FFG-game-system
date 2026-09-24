import { CHARACTERISTICS, SKILLS } from "./config.mjs";

export const CUSTOM_SKILL_PREFIX = "custom:";
export const CUSTOM_SKILL_TYPES = Object.freeze({
  general: "General task",
  melee: "Melee combat",
  ranged: "Ranged combat",
});

const cleanLabel = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const plain = (skill) => ({
  id: String(skill.id ?? ""),
  label: cleanLabel(skill.label),
  characteristic: String(skill.characteristic ?? ""),
  type: String(skill.type ?? "general"),
  rank: Number(skill.rank ?? 0),
  career: skill.career === true,
  group: skill.group === true,
});

export const customSkillKey = (id) => `${CUSTOM_SKILL_PREFIX}${id}`;

export function customSkillId(value) {
  const text = String(value ?? "");
  return text.startsWith(CUSTOM_SKILL_PREFIX)
    ? text.slice(CUSTOM_SKILL_PREFIX.length)
    : "";
}

export function resolveCustomSkill(skills, value) {
  const text = String(value ?? ""),
    id = customSkillId(text) || text,
    label = cleanLabel(text).toLocaleLowerCase();
  return (
    Array.from(skills ?? []).find(
      (skill) =>
        String(skill.id) === id ||
        cleanLabel(skill.label).toLocaleLowerCase() === label,
    ) ?? null
  );
}

export function normalizeCustomSkill(
  value,
  { id = value?.id, rankCap = 5, existing = [], ignoreId = "" } = {},
) {
  const skill = plain({ ...value, id });
  if (!skill.id || skill.id.length > 64)
    throw new Error("Custom skill needs a stable identifier.");
  if (!skill.label || skill.label.length > 60)
    throw new Error("Enter a custom skill name of 60 characters or fewer.");
  if (!(skill.characteristic in CHARACTERISTICS))
    throw new Error("Choose a valid characteristic for the custom skill.");
  if (!(skill.type in CUSTOM_SKILL_TYPES))
    throw new Error("Choose how the custom skill is used.");
  if (!Number.isInteger(skill.rank) || skill.rank < 0 || skill.rank > rankCap)
    throw new Error(`Custom skill rank must be from 0 to ${rankCap}.`);
  const reserved = Object.values(SKILLS).some(
    (candidate) =>
      candidate.label.toLocaleLowerCase() === skill.label.toLocaleLowerCase(),
  );
  if (reserved)
    throw new Error("A standard skill already uses that name.");
  const duplicate = Array.from(existing).some(
    (candidate) =>
      String(candidate.id) !== String(ignoreId) &&
      cleanLabel(candidate.label).toLocaleLowerCase() ===
        skill.label.toLocaleLowerCase(),
  );
  if (duplicate) throw new Error("A custom skill already uses that name.");
  return skill;
}

export function appendCustomSkill(
  skills,
  value,
  { id, rankCap = 5 } = {},
) {
  const current = Array.from(skills ?? [], plain);
  return [
    ...current,
    normalizeCustomSkill(value, { id, rankCap, existing: current }),
  ];
}

export function replaceCustomSkill(
  skills,
  id,
  value,
  { rankCap = 5 } = {},
) {
  const current = Array.from(skills ?? [], plain),
    index = current.findIndex((skill) => skill.id === id);
  if (index < 0) throw new Error("Custom skill was not found.");
  current[index] = normalizeCustomSkill(value, {
    id,
    rankCap,
    existing: current,
    ignoreId: id,
  });
  return current;
}

export function discardCustomSkill(skills, id) {
  const current = Array.from(skills ?? [], plain),
    next = current.filter((skill) => skill.id !== id);
  if (next.length === current.length)
    throw new Error("Custom skill was not found.");
  return next;
}

export function customSkillDefinition(skill) {
  if (!skill) return null;
  return {
    label: skill.label,
    characteristic: skill.characteristic,
    group: skill.type === "general" ? "General" : "Combat",
    melee: skill.type === "melee",
    custom: true,
  };
}
