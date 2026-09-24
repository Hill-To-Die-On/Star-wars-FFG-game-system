import { DICE, SYMBOLS, normalizePool } from "./dice/core.mjs";

export const TALENT_ACTIVATIONS = Object.freeze([
  "Passive",
  "Incidental",
  "OOT Incidental",
  "Maneuver",
  "Action",
]);

const effectTargets = Object.freeze({
  pool: new Set(Object.keys(DICE)),
  result: new Set(SYMBOLS),
  attribute: new Set([
    "strainThreshold",
    "woundThreshold",
    "forceRating",
    "soak",
    "meleeDefense",
    "rangedDefense",
  ]),
});

const attributePaths = Object.freeze({
  strainThreshold: "system.strain.max",
  woundThreshold: "system.wounds.max",
  forceRating: "system.forceRating",
  soak: "system.soak",
  meleeDefense: "system.defense.melee",
  rangedDefense: "system.defense.ranged",
});

const cleanList = (values) =>
  Array.from(values ?? [], (value) => String(value ?? "").trim()).filter(Boolean);

export function validateTalentNodeRules(node) {
  const summary = String(node.summary ?? "");
  if (summary.length > 4000)
    throw new Error("Talent guidance cannot exceed 4,000 characters.");
  const activation = String(node.activation ?? "");
  if (activation && !TALENT_ACTIVATIONS.includes(activation))
    throw new Error(`Unsupported talent activation: ${activation}`);
  const effects = Array.from(node.effects ?? []);
  if (effects.length > 20)
    throw new Error("A talent cannot declare more than 20 structured effects.");
  for (const effect of effects) {
    if (!effect || !effectTargets[effect.type])
      throw new Error("Talent effects must target a dice pool or result.");
    if (!effectTargets[effect.type].has(effect.target))
      throw new Error(`Unsupported talent effect target: ${effect.target}`);
    if (!['add', 'remove'].includes(effect.operation))
      throw new Error("Talent effects must add or remove a value.");
    if (
      !Number.isInteger(effect.count) ||
      effect.count < 1 ||
      effect.count > 10
    )
      throw new Error("Talent effect counts must be from 1 to 10.");
    for (const value of [...cleanList(effect.skills), ...cleanList(effect.groups)])
      if (value.length > 64)
        throw new Error("Talent effect selectors cannot exceed 64 characters.");
    if (effect.requirements) {
      const allowed = new Set(["equippedArmor", "minimumSoak"]);
      for (const key of Object.keys(effect.requirements))
        if (!allowed.has(key))
          throw new Error(`Unsupported talent requirement: ${key}`);
    }
  }
  return node;
}

export function talentAutomation(rule) {
  if (!rule.effects.length) return rule.summary ? "guidance" : "reference";
  return rule.activation === "Passive" ? "automatic" : "decision";
}

function actorItems(actor) {
  return Array.from(actor.items?.contents ?? actor.items ?? []);
}

export function learnedTalentRules(actor) {
  const items = new Map(
      actorItems(actor)
        .filter((item) =>
          ["specialization", "signatureAbility"].includes(item.type),
        )
        .map((item) => [item.id, item]),
    ),
    rules = [];
  for (const entry of actor.system?.advancement ?? []) {
    if (!entry.nodeId) continue;
    const item = items.get(entry.itemId),
      node = item?.system?.tree?.nodes?.find(
        (candidate) => candidate.id === entry.nodeId,
      ),
      effects = Array.from(node?.effects ?? [], (effect) => ({
        type: effect.type,
        operation: effect.operation,
        target: effect.target,
        count: effect.count,
        skills: cleanList(effect.skills),
        groups: cleanList(effect.groups),
        ...(effect.requirements
          ? { requirements: structuredClone(effect.requirements) }
          : {}),
      })),
      rule = {
        id: `${entry.itemId}:${entry.nodeId}`,
        key: String(node?.key ?? ""),
        name: String(node?.name ?? entry.name ?? "Unknown talent"),
        ranked: node?.ranked === true || entry.ranked === true,
        activation: String(node?.activation ?? ""),
        summary: String(node?.summary ?? ""),
        effects,
        source: node?.reference ?? item?.system?.source ?? entry.source ?? {},
      };
    rule.automation = talentAutomation(rule);
    rules.push(rule);
  }
  return rules;
}

const selectedRule = (rule, selected) =>
  selected.has(rule.id.toLocaleLowerCase()) ||
  (rule.key && selected.has(rule.key.toLocaleLowerCase())) ||
  selected.has(rule.name.toLocaleLowerCase());

const effectApplies = (effect, skill) => {
  const skills = cleanList(effect.skills),
    groups = cleanList(effect.groups);
  return (
    (!skills.length && !groups.length) ||
    skills.includes(skill.key) ||
    skills.some(
      (candidate) =>
        candidate.toLocaleLowerCase() === skill.label.toLocaleLowerCase(),
    ) ||
    groups.some(
      (candidate) =>
        candidate.toLocaleLowerCase() === skill.group.toLocaleLowerCase(),
    )
  );
};

const effectReason = (rule, effect) => {
  const value = `${effect.count} ${effect.target}`,
    operation = effect.operation === "add" ? "+" : "remove ";
  return `${rule.name}: ${operation}${value}`;
};

export function talentRulesForCheck(
  actor,
  skill,
  { selectedTalents = [] } = {},
) {
  const selected = new Set(
      Array.from(selectedTalents, (value) => String(value).toLocaleLowerCase()),
    ),
    learned = learnedTalentRules(actor),
    pool = {
      add: Object.fromEntries(Object.keys(DICE).map((key) => [key, 0])),
      remove: Object.fromEntries(Object.keys(DICE).map((key) => [key, 0])),
    },
    automaticResults = Object.fromEntries(SYMBOLS.map((key) => [key, 0])),
    reasons = [],
    decisions = [];
  for (const rule of learned) {
    const effects = rule.effects.filter(
      (effect) =>
        ["pool", "result"].includes(effect.type) &&
        effectApplies(effect, skill),
    );
    if (!effects.length) continue;
    const automatic = rule.activation === "Passive",
      active = automatic || selectedRule(rule, selected);
    if (!active) {
      decisions.push({
        id: rule.id,
        key: rule.key,
        name: rule.name,
        activation: rule.activation,
        summary: rule.summary,
        effects,
      });
      continue;
    }
    for (const effect of effects) {
      if (effect.type === "pool")
        pool[effect.operation][effect.target] += effect.count;
      else
        automaticResults[effect.target] +=
          effect.count * (effect.operation === "add" ? 1 : -1);
      reasons.push(effectReason(rule, effect));
    }
  }
  return { learned, pool, automaticResults, reasons, decisions };
}

export function applyTalentPool(pool, rules) {
  const current = normalizePool(pool),
    adjusted = { ...current };
  for (const key of Object.keys(DICE))
    adjusted[key] = Math.max(
      0,
      current[key] + rules.pool.add[key] - rules.pool.remove[key],
    );
  return normalizePool(adjusted);
}

const sourceValue = (actor, path) =>
  path
    .replace(/^system\./, "")
    .split(".")
    .reduce((value, key) => value?.[key], actor.system);

export function talentPurchaseUpdates(actor, node) {
  const changes = {};
  for (const effect of node.effects ?? []) {
    if (
      effect.type !== "attribute" ||
      effect.operation !== "add" ||
      effect.requirements
    )
      continue;
    const path = attributePaths[effect.target];
    if (!path) continue;
    const cap = effect.target.endsWith("Defense") ? 4 : 1000;
    changes[path] = Math.min(
      cap,
      Number(changes[path] ?? sourceValue(actor, path) ?? 0) + effect.count,
    );
  }
  return changes;
}

const hasEquippedArmor = (actor) =>
  actorItems(actor).some(
    (item) => item.type === "armor" && item.system?.equipped === true,
  );

const requirementsMet = (actor, requirements = {}) =>
  (!requirements.equippedArmor || hasEquippedArmor(actor)) &&
  (!requirements.minimumSoak ||
    Number(actor.system?.soak ?? 0) >= requirements.minimumSoak);

export function effectiveTalentTraits(actor) {
  const traits = {
    soak: Number(actor.system?.soak ?? 0),
    defense: {
      melee: Number(actor.system?.defense?.melee ?? 0),
      ranged: Number(actor.system?.defense?.ranged ?? 0),
    },
    forceRating: Number(actor.system?.forceRating ?? 0),
  };
  for (const rule of learnedTalentRules(actor))
    for (const effect of rule.effects) {
      if (
        effect.type !== "attribute" ||
        effect.operation !== "add" ||
        !effect.requirements ||
        !requirementsMet(actor, effect.requirements)
      )
        continue;
      if (effect.target === "soak") traits.soak += effect.count;
      if (effect.target === "meleeDefense")
        traits.defense.melee = Math.min(4, traits.defense.melee + effect.count);
      if (effect.target === "rangedDefense")
        traits.defense.ranged = Math.min(
          4,
          traits.defense.ranged + effect.count,
        );
    }
  return traits;
}
