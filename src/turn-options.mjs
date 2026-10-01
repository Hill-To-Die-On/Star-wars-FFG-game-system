import { actorTalentRules, learnedTalentRules } from "./talent-rules.mjs";
import { talentActivation } from "./talent-activation.mjs";
import { speciesAbilityEntry } from "./species-abilities.mjs";

const itemsFor = (actor) => Array.from(actor?.items?.contents ?? actor?.items ?? []);
const quantity = (item) => Number(item?.system?.quantity ?? 1);
const label = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const timing = (value) => {
  const text = label(value).toLowerCase();
  if (/\baction\b/.test(text)) return "action";
  if (/\b(?:maneuver|manoeuvre)\b/.test(text)) return "maneuver";
  return "";
};
const effectSummary = (effects = []) => effects.map((effect) => {
  const operation = effect.operation === "remove" ? "remove" : "add";
  return `${operation} ${effect.count} ${effect.target}`;
}).join(", ");
const itemKind = (item) => item?.type === "forcePower" ? "Force power" :
  ["gear", "armor", "weapon", "attachment"].includes(item?.type) ? "Equipment" :
  ["talent", "career", "specialization", "signatureAbility"].includes(item?.type) ? "Talent" : "Granted";

/** Describe options recorded on an actor. An unknown activation stays a GM review item. */
export function turnOptionLists(actor) {
  const vehicle = actor?.type === "vehicle",
    actions = vehicle ? [] : ["Make a fitting skill check", "Make an unarmed attack"],
    maneuvers = vehicle ? ["Pilot the vehicle as its speed and situation permit (GM checks the vehicle rules)"] :
      ["Move or engage/disengage", "Aim", "Take cover or change posture", "Ready or stow an item", "Interact with a nearby object"],
    review = [], passive = [];
  const add = (kind, text) => {
    if (kind === "action") actions.push(text);
    else if (kind === "maneuver") maneuvers.push(text);
    else review.push(`${text} (timing needs GM review)`);
  };
  const addActivation = (activation, text, { passiveText = "" } = {}) => {
    const kind = timing(activation);
    if (activation === "Passive") passive.push(passiveText || text);
    else if (kind) add(kind, text);
    else add("", text);
  };
  for (const item of itemsFor(actor)) {
    if (quantity(item) <= 0) continue;
    const name = label(item.name);
    if (!name) continue;
    if (item.type === "weapon") {
      actions.push(`Attack with ${name}${item.system?.equipped === false ? " (ready it first if stowed)" : ""}`);
      if (label(item.system?.qualities))
        review.push(`Weapon qualities on ${name}: ${label(item.system.qualities)} (timing and effect need GM review)`);
      for (const ability of item.system?.abilities ?? []) {
        if (!ability?.name || ability.effects?.length) continue;
        const detail = ability.summary ?? ability.description;
        addActivation(ability.activation, `Equipment ability: ${label(ability.name)}${detail ? ` — ${label(detail)}` : ""}`, {
          passiveText: `Equipment ability: ${label(ability.name)}${detail ? ` — ${label(detail)}` : ""}`,
        });
      }
      continue;
    }
    if (item.type === "talent") {
      const activation = talentActivation(name, item.system?.activation);
      const detail = effectSummary(item.system?.effects);
      addActivation(activation, `Talent: ${name}${detail ? ` (${detail})` : ""}`, {
        passiveText: `Talent: ${name}${detail ? ` (${detail})` : ""}`,
      });
      for (const ability of item.system?.abilities ?? []) {
        if (!ability?.name || ability.effects?.length) continue;
        const detail = ability.summary ?? ability.description;
        addActivation(ability.activation, `Talent ability: ${label(ability.name)}${detail ? ` — ${label(detail)}` : ""}`, {
          passiveText: `Talent ability: ${label(ability.name)}${detail ? ` — ${label(detail)}` : ""}`,
        });
      }
      continue;
    }
    if (["career", "specialization", "signatureAbility"].includes(item.type)) {
      for (const ability of item.system?.abilities ?? []) {
        if (!ability?.name) continue;
        if (ability.effects?.length) continue;
        const kind = item.type === "signatureAbility" ? "Signature ability" : "Career ability";
        addActivation(ability.activation, `${kind}: ${label(ability.name)}`, {
          passiveText: `${kind}: ${label(ability.name)}${ability.summary ? ` — ${label(ability.summary)}` : ""}`,
        });
      }
      continue;
    }
    if (["gear", "forcePower", "attachment", "armor"].includes(item.type)) {
      const explicit = timing(item.system?.activation);
      if (explicit && !item.system?.effects?.length) add(explicit, `${item.type === "forcePower" ? "Force power" : "Equipment"}: ${name}${item.system?.equipped === false ? " (ready it first if stowed)" : ""}`);
      else if (item.type === "gear" && /^stimpacks?\b/i.test(name)) maneuvers.push(`Use ${name} on a living target`);
      else if (item.type === "forcePower") add("", `Force power: ${name}`);
      for (const ability of item.system?.abilities ?? []) {
        if (!ability?.name) continue;
        if (ability.effects?.length) continue;
        const detail = ability.summary ?? ability.description;
        addActivation(ability.activation, `${itemKind(item)} ability: ${label(ability.name)}${detail ? ` — ${label(detail)}` : ""}`, {
          passiveText: `${itemKind(item)} ability: ${label(ability.name)}${detail ? ` — ${label(detail)}` : ""}`,
        });
      }
    }
  }
  for (const rule of actor ? learnedTalentRules(actor) : []) {
    const kind = timing(rule.activation);
    const detail = effectSummary(rule.effects);
    if (rule.activation === "Passive") passive.push(`Talent: ${label(rule.name)}${detail ? ` (${detail})` : ""}`);
    else if (kind) add(kind, `Talent: ${label(rule.name)}${detail ? ` (${detail})` : ""}`);
    else if (!rule.activation || rule.activation === "Active") add("", `Talent: ${label(rule.name)}`);
  }
  for (const rule of actor ? actorTalentRules(actor).filter((candidate) => candidate.sourceKind === "item" && (candidate.item?.type !== "talent" || candidate.abilityName)) : []) {
    const name = rule.abilityName ? `${itemKind(rule.item)} ability: ${label(rule.name)}` : `${itemKind(rule.item)}: ${label(rule.itemName || rule.name)}`;
    const detail = effectSummary(rule.effects), text = `${name}${detail ? ` (${detail})` : ""}`;
    addActivation(rule.activation, text, { passiveText: text });
  }
  const species = speciesAbilityEntry(actor?.system?.species, actor?.system?.creation?.species);
  for (const ability of species?.abilities ?? []) {
    const text = `Species ability (${species.species}): ${label(ability.name)}`;
    if (ability.freeManeuvers) maneuvers.push(`${text} grants a free manoeuvre within the turn limit`);
    else if (timing(ability.activation)) add(timing(ability.activation), text);
    else if (ability.application === "manual") add("", text);
  }
  return { actions: unique(actions), maneuvers: unique(maneuvers), review: unique(review), passive: unique(passive) };
}

export function turnOptionTooltips(actor, budget) {
  const options = turnOptionLists(actor),
    actionStatus = `${budget.actionsRemaining} of ${budget.limits.actions} ready${budget.actionsRemaining ? "" : "; action spent this turn or unavailable"}`,
    maneuverStatus = `${budget.freeRemaining} free ready; ${budget.maneuversRemaining} of ${budget.limits.maneuverLimit} possible this turn`,
    pending = options.review.length ? [`Check timing with GM: ${options.review.join("; ")}`] : [],
    passive = options.passive.length ? [`Passive rules currently in force: ${options.passive.join("; ")}`] : [],
    action = [`Actions — ${actionStatus}`, ...options.actions, ...passive, ...pending].join("\n"),
    maneuver = [`Manoeuvres — ${maneuverStatus}`, ...options.maneuvers,
      ...(budget.canPayStrain ? [`Another manoeuvre can cost ${budget.limits.strainCost} ${budget.resourceLabel}.`] : []),
      ...(budget.canTradeAction ? ["An unused action can be traded for a manoeuvre."] : []), ...passive, ...pending].join("\n");
  return { action, maneuver, options };
}
