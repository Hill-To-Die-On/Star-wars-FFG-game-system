import { learnedTalentRules } from "./talent-rules.mjs";
import { talentActivation } from "./talent-activation.mjs";
import { speciesAbilityEntry } from "./species-abilities.mjs";

const itemsFor = (actor) => Array.from(actor?.items?.contents ?? actor?.items ?? []);
const quantity = (item) => Number(item?.system?.quantity ?? 1);
const label = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const timing = (value) => {
  const text = label(value).toLowerCase();
  if (text === "action") return "action";
  if (["maneuver", "manoeuvre"].includes(text)) return "maneuver";
  return "";
};

/** Describe options recorded on an actor. An unknown activation stays a GM review item. */
export function turnOptionLists(actor) {
  const vehicle = actor?.type === "vehicle",
    actions = vehicle ? [] : ["Make a fitting skill check", "Make an unarmed attack"],
    maneuvers = vehicle ? ["Pilot the vehicle as its speed and situation permit (GM checks the vehicle rules)"] :
      ["Move or engage/disengage", "Aim", "Take cover or change posture", "Ready or stow an item", "Interact with a nearby object"],
    review = [];
  const add = (kind, text) => {
    if (kind === "action") actions.push(text);
    else if (kind === "maneuver") maneuvers.push(text);
    else review.push(`${text} (timing needs GM review)`);
  };
  for (const item of itemsFor(actor)) {
    if (quantity(item) <= 0) continue;
    const name = label(item.name);
    if (!name) continue;
    if (item.type === "weapon") {
      actions.push(`Attack with ${name} (ready it first if stowed)`);
      continue;
    }
    if (item.type === "talent") {
      const activation = talentActivation(name, item.system?.activation);
      if (timing(activation)) add(timing(activation), `Talent: ${name}`);
      else if (!activation || activation === "Active") add("", `Talent: ${name}`);
      continue;
    }
    if (["career", "specialization"].includes(item.type)) {
      for (const ability of item.system?.abilities ?? []) {
        if (!ability?.name) continue;
        add(timing(ability.activation), `Career ability: ${label(ability.name)}`);
      }
      continue;
    }
    if (["gear", "forcePower", "attachment"].includes(item.type)) {
      const explicit = timing(item.system?.activation);
      if (explicit) add(explicit, `${item.type === "forcePower" ? "Force power" : "Equipment"}: ${name}`);
      else if (item.type === "gear" && /^stimpacks?\b/i.test(name)) maneuvers.push(`Use ${name} on a living target`);
      else if (item.type === "forcePower") add("", `Force power: ${name}`);
    }
  }
  for (const rule of actor ? learnedTalentRules(actor) : []) {
    const kind = timing(rule.activation);
    if (kind) add(kind, `Talent: ${label(rule.name)}`);
    else if (!rule.activation || rule.activation === "Active") add("", `Talent: ${label(rule.name)}`);
  }
  const species = speciesAbilityEntry(actor?.system?.species, actor?.system?.creation?.species);
  for (const ability of species?.abilities ?? []) {
    const text = `Species ability (${species.species}): ${label(ability.name)}`;
    if (ability.freeManeuvers) maneuvers.push(`${text} grants a free manoeuvre within the turn limit`);
    else if (timing(ability.activation)) add(timing(ability.activation), text);
    else if (ability.application === "manual") add("", text);
  }
  return { actions: unique(actions), maneuvers: unique(maneuvers), review: unique(review) };
}

export function turnOptionTooltips(actor, budget) {
  const options = turnOptionLists(actor),
    actionStatus = `${budget.actionsRemaining} of ${budget.limits.actions} ready${budget.actionsRemaining ? "" : "; action spent this turn or unavailable"}`,
    maneuverStatus = `${budget.freeRemaining} free ready; ${budget.maneuversRemaining} of ${budget.limits.maneuverLimit} possible this turn`,
    pending = options.review.length ? [`Check timing with GM: ${options.review.join("; ")}`] : [],
    action = [`Actions — ${actionStatus}`, ...options.actions, ...pending].join("\n"),
    maneuver = [`Manoeuvres — ${maneuverStatus}`, ...options.maneuvers,
      ...(budget.canPayStrain ? [`Another manoeuvre can cost ${budget.limits.strainCost} ${budget.resourceLabel}.`] : []),
      ...(budget.canTradeAction ? ["An unused action can be traded for a manoeuvre."] : []), ...pending].join("\n");
  return { action, maneuver, options };
}
