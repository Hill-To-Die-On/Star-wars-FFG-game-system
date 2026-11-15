import { CHARACTERISTICS, SKILLS, SYSTEM_ID } from "./config.mjs";
import { validatePoolModifier } from "./narrative-effects.mjs";

const OPERATIONS = ["Custom", "Multiply by", "Add", "Downgrade to", "Upgrade to", "Set to"];
const clean = (value) => typeof value === "string" ? value.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim() : "";

function fieldLabel(key) {
  const labels = key.replace(/^system\./,"").split(".").map((part, index, path) => {
    if (path[index - 1] === "characteristics" && CHARACTERISTICS[part]) return CHARACTERISTICS[part];
    if (path[index - 1] === "skills" && SKILLS[part]) return SKILLS[part].label;
    return part.replace(/([a-z])([A-Z])/g,"$1 $2");
  });
  labels[0] = labels[0].charAt(0).toUpperCase() + labels[0].slice(1);
  return labels.join(" · ");
}

/** Present current native state and authored injury records without deriving penalties from wounds or imagery. */
export function characterConditions(actor, {localize = (value) => value} = {}) {
  const effects = actor?.allApplicableEffects?.() ?? actor?.effects ?? [];
  const applied = Array.from(effects).filter((effect) =>
    effect && effect.disabled !== true && effect.isSuppressed !== true && effect.active !== false
  ).map((effect) => {
    const changes = Array.from(effect.changes ?? []).filter((change) => clean(change?.key)).map((change) => ({
      operation: OPERATIONS[change.mode] ?? "Adjust",
      value: clean(String(change.value ?? "")),
      field: fieldLabel(clean(change.key)),
    }));
    return {
      name: clean(localize(effect.name ?? "")) || "Active effect",
      description: clean(effect.description),
      changes,
      markerOnly: changes.length === 0,
    };
  });
  const flags = actor?.flags?.[SYSTEM_ID] ?? {};
  const records = [
    ...(flags.conditions ?? []).map(record => ({ record, injury: false })),
    ...(flags.vehicleCriticals ?? []).map(record => ({ record, injury: true })),
    ...(actor?.system?.criticals ?? []).map(record => ({ record, injury: true })),
  ].filter(({record}) =>
    clean(record?.name) && record.healed !== true && record.disabled !== true && record.active !== false
  ).map(({record, injury}) => {
    const book = clean(record.source?.book), page = clean(String(record.source?.page ?? ""));
    let modifier;
    try { modifier = validatePoolModifier(record.modifier); } catch { /* A malformed modifier cannot establish a penalty. */ }
    const changes = modifier ? [{
      operation: "Add",
      value: modifier.count + (modifier.die === "setback" ? " Setback" : " Boost"),
      field: modifier.skillKey === "any" ? "All checks" : (actor.skillDefinition?.(modifier.skillKey)?.label ?? SKILLS[modifier.skillKey]?.label ?? modifier.skillKey),
    }] : [];
    return {
      name: clean(record.name),
      description: clean(record.summary ?? record.description),
      source: [book, page ? "p. " + page : ""].filter(Boolean).join(", "),
      changes,
      markerOnly: !injury && !changes.length,
      injury,
      recordOnly: !changes.length && record.automation === "record-only",
    };
  });
  return [...applied, ...records];
}
