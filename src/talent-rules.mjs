import { DICE, SYMBOLS, normalizePool } from "./dice/core.mjs";
import { talentActivation } from "./talent-activation.mjs";

export const TALENT_ACTIVATIONS = Object.freeze([
  "Passive",
  "Incidental",
  "OOT Incidental",
  "Maneuver",
  "Action",
  "Active",
]);

const effectTargets = Object.freeze({
  turn: new Set(["actions", "freeManeuvers", "maneuverLimit", "strainCost"]),
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

const EQUIPMENT_TYPES = new Set(["weapon", "armor", "gear", "attachment"]);
const ITEM_DIRECT_EFFECT_TYPES = new Set([
  "talent",
  "weapon",
  "armor",
  "gear",
  "attachment",
  "forcePower",
]);

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
      throw new Error("Talent effects must target a pool, result, attribute or turn allowance.");
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
      const allowed = new Set(effect.type === "turn"
        ? ["skill", "minimumRank", "equippedItem"]
        : ["equippedArmor", "equippedItem", "minimumSoak"]);
      for (const key of Object.keys(effect.requirements))
        if (!allowed.has(key))
          throw new Error(`Unsupported talent requirement: ${key}`);
      if (effect.requirements.equippedItem !== undefined && typeof effect.requirements.equippedItem !== "boolean")
        throw new Error("The equipped-item requirement must be true or false.");
      if (effect.type === "turn" && (effect.requirements.skill !== undefined || effect.requirements.minimumRank !== undefined) && (
        typeof effect.requirements.skill !== "string" || !effect.requirements.skill.trim() ||
        effect.requirements.skill.length > 64 || !Number.isInteger(effect.requirements.minimumRank) ||
        effect.requirements.minimumRank < 0 || effect.requirements.minimumRank > 10
      )) throw new Error("A turn requirement needs a skill and minimum rank from 0 to 10.");
      if (effect.type === "turn" && effect.requirements.skill === undefined && effect.requirements.minimumRank === undefined && !effect.requirements.equippedItem)
        throw new Error("A turn requirement needs a skill rank or equipped item.");
      if (effect.type !== "turn" && effect.requirements.equippedArmor !== undefined && typeof effect.requirements.equippedArmor !== "boolean")
        throw new Error("The equipped-armour requirement must be true or false.");
      if (effect.type !== "turn" && effect.requirements.minimumSoak !== undefined && (!Number.isInteger(effect.requirements.minimumSoak) || effect.requirements.minimumSoak < 0 || effect.requirements.minimumSoak > 100))
        throw new Error("The minimum soak requirement must be an integer from 0 to 100.");
    }
    if (effect.type === "turn" && (cleanList(effect.skills).length || cleanList(effect.groups).length))
      throw new Error("Turn effects use a skill-rank requirement, not roll selectors.");
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
        activation: talentActivation(node?.name ?? entry.name, node?.activation),
        summary: String(node?.summary ?? ""),
        effects,
        source: node?.reference ?? item?.system?.source ?? entry.source ?? {},
        sourceKind: "advancement",
        itemId: item?.id ?? entry.itemId,
        itemType: item?.type ?? "specialization",
        itemName: item?.name ?? "",
      };
    rule.automation = talentAutomation(rule);
    rules.push(rule);
  }
  return rules;
}

const normalizedEffects = (effects) => Array.from(effects ?? [], (effect) => ({
  type: effect.type,
  operation: effect.operation,
  target: effect.target,
  count: effect.count,
  skills: cleanList(effect.skills),
  groups: cleanList(effect.groups),
  ...(effect.requirements
    ? { requirements: structuredClone(effect.requirements) }
    : {}),
}));

/**
 * Read structured effects attached directly to owned Items.  Advancement
 * nodes are kept separate by learnedTalentRules so their permanent attribute
 * changes are not applied a second time at runtime.
 */
export function itemTalentRules(actor) {
  const rules = [];
  for (const item of actorItems(actor)) {
    const system = item.system ?? {},
      direct = ITEM_DIRECT_EFFECT_TYPES.has(item.type)
        ? normalizedEffects(system.effects)
        : [],
      addRule = (effects, ability = {}, suffix = "") => {
        if (!effects.length) return;
        const name = String(ability.name ?? item.name ?? "Unknown ability").trim();
        const rule = {
          id: `item:${item.id}${suffix}`,
          key: String(ability.key ?? system.metadata?.talentKey ?? ""),
          name,
          ranked: ability.ranked === true || system.ranked === true,
          rank: Math.max(1, Math.min(10, Number(ability.rank ?? system.rank) || 1)),
          activation: talentActivation(name, ability.activation ?? system.activation),
          summary: String(ability.summary ?? ability.description ?? system.description ?? ""),
          effects,
          source: structuredClone(ability.source ?? system.source ?? {}),
          sourceKind: "item",
          itemId: item.id,
          itemType: item.type,
          itemName: String(item.name ?? ""),
          abilityName: ability.name ? name : "",
          item,
        };
        rule.automation = talentAutomation(rule);
        rules.push(rule);
      };
    addRule(direct);
    for (const [index, ability] of Array.from(system.abilities ?? []).entries())
      addRule(normalizedEffects(ability?.effects), ability ?? {}, `:ability:${index}`);
  }
  return rules;
}

/** All owned tree and Item rules used by checks and turn allowances. */
export function actorTalentRules(actor) {
  return [...learnedTalentRules(actor), ...itemTalentRules(actor)];
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
  const source = [rule.source?.book, rule.source?.page].filter(Boolean).join(" · ") || "Source not recorded";
  return `${rule.name}: ${operation}${value} — ${source} (structured effect)`;
};

const itemAvailable = (actor, rule) => {
  if (rule.sourceKind !== "item") return true;
  const item = rule.item ?? actorItems(actor).find((candidate) => candidate.id === rule.itemId);
  if (!item || Number(item.system?.quantity ?? 1) <= 0) return false;
  // Passive equipment rules only apply while that item is equipped.  An
  // explicit false is meaningful; older imported entries without the field
  // remain usable until the owner records a stowed state.
  return !(EQUIPMENT_TYPES.has(item.type) && rule.activation === "Passive" && item.system?.equipped === false);
};

const equippedArmor = (actor) => actorItems(actor)
  .filter((item) => item.type === "armor" && item.system?.equipped === true && Number(item.system?.quantity ?? 1) > 0)
  .sort((a, b) => Number(b.system?.soak ?? 0) - Number(a.system?.soak ?? 0))[0] ?? null;

export const hasEquippedArmor = (actor) => !!equippedArmor(actor);

const requirementsMet = (actor, requirements = {}, rule = {}) => {
  if (requirements.skill !== undefined) {
    let rank;
    try { rank = actor.skillRank?.(requirements.skill); } catch { return false; }
    rank ??= actor.system?.skills?.[requirements.skill]?.rank ??
      actor.system?.customSkills?.find((skill) => `custom:${skill.id}` === requirements.skill)?.rank ?? 0;
    if (Number(rank) < Number(requirements.minimumRank ?? 0)) return false;
  }
  if (requirements.equippedArmor && !hasEquippedArmor(actor)) return false;
  if (requirements.equippedItem) {
    const item = rule.item ?? actorItems(actor).find((candidate) => candidate.id === rule.itemId);
    if (!item || item.system?.equipped !== true) return false;
  }
  if (requirements.minimumSoak !== undefined) {
    const armor = equippedArmor(actor);
    if (!armor || Number(armor.system?.soak ?? 0) < Number(requirements.minimumSoak)) return false;
  }
  return true;
};

export function talentRuleAvailable(actor, rule) {
  return itemAvailable(actor, rule);
}

export function talentEffectRequirementsMet(actor, effect, rule = {}) {
  return requirementsMet(actor, effect?.requirements, rule);
}

export function talentRulesForCheck(
  actor,
  skill,
  { selectedTalents = [] } = {},
) {
  const selected = new Set(
      Array.from(selectedTalents, (value) => String(value).toLocaleLowerCase()),
    ),
    learned = learnedTalentRules(actor),
    allRules = [...learned, ...itemTalentRules(actor)],
    pool = {
      add: Object.fromEntries(Object.keys(DICE).map((key) => [key, 0])),
      remove: Object.fromEntries(Object.keys(DICE).map((key) => [key, 0])),
    },
    automaticResults = Object.fromEntries(SYMBOLS.map((key) => [key, 0])),
    reasons = [],
    contributions = [],
    decisions = [];
  for (const rule of allRules) {
    const effects = rule.effects.filter(
      (effect) =>
        ["pool", "result"].includes(effect.type) &&
        effectApplies(effect, skill) &&
        requirementsMet(actor, effect.requirements, rule),
    );
    if (!effects.length || !itemAvailable(actor, rule)) continue;
    const automatic = rule.activation === "Passive",
      active = automatic || selectedRule(rule, selected);
    if (!active) {
      decisions.push({
        id: rule.id,
        key: rule.key,
        name: rule.name,
        activation: rule.activation,
        summary: rule.summary,
        source: structuredClone(rule.source),
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
      contributions.push({ruleId:rule.id,name:rule.name,status:automatic ? "automatic" : "selected",verification:"structured-effect",source:structuredClone(rule.source),effect:structuredClone(effect)});
    }
  }
  return { learned, rules: allRules, pool, automaticResults, reasons, contributions, decisions };
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
    if (effect.type !== "attribute" || effect.requirements)
      continue;
    const path = attributePaths[effect.target];
    if (!path) continue;
    const cap = effect.target.endsWith("Defense") ? 4 : 1000;
    const delta = effect.operation === "remove" ? -effect.count : effect.count;
    changes[path] = Math.max(
      0,
      Math.min(cap, Number(changes[path] ?? sourceValue(actor, path) ?? 0) + delta),
    );
  }
  return changes;
}

export function effectiveTalentTraits(actor) {
  const armor = equippedArmor(actor),
    traits = {
    soak: Number(actor.system?.soak ?? 0) + Number(armor?.system?.soak ?? 0),
    defense: {
      melee: Number(actor.system?.defense?.melee ?? 0) + Number(armor?.system?.defense ?? 0),
      ranged: Number(actor.system?.defense?.ranged ?? 0) + Number(armor?.system?.defense ?? 0),
    },
    forceRating: Number(actor.system?.forceRating ?? 0),
    strainThreshold: Number(actor.system?.strain?.max ?? 0),
    woundThreshold: Number(actor.system?.wounds?.max ?? 0),
  };
  const applyAttribute = (effect) => {
    if (effect.target === "soak") traits.soak = Math.max(0, traits.soak + effect.delta);
    if (effect.target === "meleeDefense") traits.defense.melee = Math.max(0, Math.min(4, traits.defense.melee + effect.delta));
    if (effect.target === "rangedDefense") traits.defense.ranged = Math.max(0, Math.min(4, traits.defense.ranged + effect.delta));
    if (effect.target === "forceRating") traits.forceRating = Math.max(0, Math.min(10, traits.forceRating + effect.delta));
    if (effect.target === "strainThreshold") traits.strainThreshold = Math.max(0, traits.strainThreshold + effect.delta);
    if (effect.target === "woundThreshold") traits.woundThreshold = Math.max(0, traits.woundThreshold + effect.delta);
  };
  for (const rule of learnedTalentRules(actor))
    for (const effect of rule.effects) {
      if (
        effect.type !== "attribute" ||
        rule.activation !== "Passive" ||
        !effect.requirements ||
        !requirementsMet(actor, effect.requirements, rule)
      )
        continue;
      applyAttribute({ ...effect, delta: effect.count * (effect.operation === "remove" ? -1 : 1) });
    }
  for (const rule of itemTalentRules(actor)) {
    if (rule.activation !== "Passive" || !itemAvailable(actor, rule)) continue;
    for (const effect of rule.effects) {
      if (effect.type !== "attribute" || !requirementsMet(actor, effect.requirements, rule)) continue;
      applyAttribute({ ...effect, delta: effect.count * (effect.operation === "remove" ? -1 : 1) });
    }
  }
  return traits;
}
