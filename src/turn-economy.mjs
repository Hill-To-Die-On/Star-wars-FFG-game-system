import { SYSTEM_ID } from "./config.mjs";
import { learnedTalentRules, validateTalentNodeRules } from "./talent-rules.mjs";
import { speciesTurnBonuses } from "./species-abilities.mjs";

export const TURN_DEFAULTS = Object.freeze({ actions: 1, freeManeuvers: 1, maneuverLimit: 2, strainCost: 2 });
export const TURN_LABELS = Object.freeze({ actions: "Actions", freeManeuvers: "Free manoeuvres", maneuverLimit: "Manoeuvre limit", strainCost: "Extra manoeuvre cost" });

export function validateTurnConfig(config = {}) {
  for (const [key, value] of Object.entries(config)) {
    if (!Object.hasOwn(TURN_DEFAULTS, key) || !Number.isInteger(value) || value < 0 || value > 10)
      throw new Error(`Invalid turn allowance: ${key} must be an integer from 0 to 10.`);
  }
  return config;
}

export function turnKey(combat, sceneId = "") {
  return combat?.started && Number(combat.round) > 0 ? `${combat.id}:${combat.round}` :
    sceneId ? `freeplay:${sceneId}` : "freeplay";
}

function stateFor(actor, key) {
  const stored = actor.getFlag?.(SYSTEM_ID, "turnEconomy") ?? actor.flags?.[SYSTEM_ID]?.turnEconomy;
  const rounds = Array.from(stored?.rounds ?? []);
  return { rounds, entries: Array.from(rounds.find(r => r.key === key)?.entries ?? []) };
}

function turnRules(actor) {
  const rules = learnedTalentRules(actor);
  for (const item of actor.items?.contents ?? actor.items ?? []) {
    if (item.type !== "talent" || !item.system?.effects?.length) continue;
    rules.push({ id: `item:${item.id}`, key: item.system.metadata?.talentKey ?? "", name: item.name,
      activation: item.system.activation, ranked: item.system.ranked === true,
      rank: Math.max(1, Math.min(10, Number(item.system.rank) || 1)),
      effects: item.system.effects, source: item.system.source ?? {} });
  }
  const seen = new Set(), ids = new Set();
  return rules.filter(rule => {
    if (ids.has(rule.id)) return false;
    ids.add(rule.id);
    const identity = String(rule.key || rule.name).toLowerCase();
    if (!rule.ranked && seen.has(identity)) return false;
    if (!rule.ranked) seen.add(identity);
    return true;
  });
}

function meetsRequirement(actor, effect) {
  const requirement = effect.requirements;
  if (!requirement?.skill) return true;
  let rank;
  try { rank = actor.skillRank?.(requirement.skill); } catch { return false; }
  rank ??= actor.system?.skills?.[requirement.skill]?.rank ??
    actor.system?.customSkills?.find(s => `custom:${s.id}` === requirement.skill)?.rank ?? 0;
  return Number(rank) >= requirement.minimumRank;
}

export function turnBudget(actor, { key = "freeplay" } = {}) {
  const supported = !!actor && actor.type !== "group", vehicle = actor?.type === "vehicle";
  const { entries } = stateFor(actor ?? {}, key), active = new Set(entries.filter(e => e.kind === "activate").map(e => e.ruleId));
  const limits = { ...TURN_DEFAULTS, ...actor?.system?.turnEconomy };
  validateTurnConfig(limits);
  if (vehicle) Object.assign(limits, { actions: 0, freeManeuvers: 1, maneuverLimit: actor.system.silhouette >= 5 ? 1 : 2, strainCost: 2 });
  const reasons = [], decisions = [];
  for (const rule of supported ? turnRules(actor) : []) {
    const effects = (rule.effects ?? []).filter(e => e.type === "turn");
    if (!effects.length) continue;
    validateTalentNodeRules({ ...rule, effects });
    const applicable = effects.filter(e => meetsRequirement(actor, e));
    if (!applicable.length) continue;
    if (rule.activation !== "Passive" && !active.has(rule.id)) {
      decisions.push({ id:rule.id, name:rule.name, activation:rule.activation, source:rule.source });
      continue;
    }
    for (const effect of applicable) {
      const count = effect.count * (rule.rank ?? 1) * (effect.operation === "remove" ? -1 : 1);
      limits[effect.target] += count;
      reasons.push(`${rule.name}: ${count > 0 ? "+" : ""}${count} ${TURN_LABELS[effect.target].toLowerCase()}`);
    }
  }
  if (actor?.type === "character") {
    const species = speciesTurnBonuses(actor.system?.species, actor.system?.creation?.species);
    limits.freeManeuvers += species.freeManeuvers;
    reasons.push(...species.reasons);
  }
  for (const field of Object.keys(limits)) limits[field] = Math.max(0, Math.min(10, limits[field]));
  if (vehicle) limits.actions = 0;
  limits.freeManeuvers = Math.min(limits.freeManeuvers, limits.maneuverLimit);
  if (actor?.statuses?.has?.("staggered")) { limits.actions = 0; reasons.push("Staggered: no actions"); }
  if (actor?.statuses?.has?.("immobilized")) { limits.maneuverLimit = 0; reasons.push("Immobilized: no manoeuvres"); }
  const spent = entries.reduce((sum, e) => ({ actions:sum.actions+(e.actions ?? 0),
    maneuvers:sum.maneuvers+(e.maneuvers ?? 0), free:sum.free+(e.free ?? 0), grants:sum.grants+(e.grants ?? 0) }),
    { actions:0,maneuvers:0,free:0,grants:0 });
  const actionsRemaining = Math.max(0, limits.actions-spent.actions);
  const maneuversRemaining = Math.max(0, limits.maneuverLimit-spent.maneuvers);
  const freeTotal = Math.min(limits.maneuverLimit, limits.freeManeuvers+spent.grants);
  const freeRemaining = Math.max(0, Math.min(maneuversRemaining, freeTotal-spent.free));
  const resource = vehicle ? "systemStrain" : actor?.type === "rival" ? "wounds" : "strain";
  const resourceLabel = vehicle ? "system strain" : actor?.type === "rival" ? "wounds" : "strain";
  const value = Number(actor?.system?.[resource]?.value) || 0, max = Number(actor?.system?.[resource]?.max) || 0;
  const canPayStrain = supported && actor.type !== "minion" && maneuversRemaining > 0 &&
    freeRemaining === 0 && value+limits.strainCost <= max;
  return { supported, vehicle, key, limits, reasons, decisions, spent, freeTotal,
    actionsRemaining, maneuversRemaining, freeRemaining, resource, resourceLabel,
    canPayStrain, canTradeAction:!vehicle && maneuversRemaining > 0 && freeRemaining === 0 && actionsRemaining > 0,
    canUndo:entries.length > 0,
    actions: Array.from({ length:limits.actions }, (_, i) => ({ available:i >= spent.actions })),
    maneuvers: Array.from({ length:freeTotal }, (_, i) => ({ available:i >= spent.free, temporary:i >= limits.freeManeuvers })),
  };
}

/** One persisted update contains both the resource charge and its turn ledger. */
export function turnUpdate(actor, command, { key = "freeplay", payment = "free", ruleId = "", isGM = false, allowPlayerManagement = false, operationId = "" } = {}) {
  const b = turnBudget(actor, { key }), state = stateFor(actor,key), entries = structuredClone(state.entries), update = {};
  if (!b.supported) throw new Error("Group actors do not have a combat turn.");
  if (operationId && entries.some(e => e.operationId === operationId)) return {};
  let entry;
  const pay = () => {
    if (actor.type === "minion") throw new Error("Minions cannot voluntarily suffer strain.");
    if (!b.canPayStrain) throw new Error("The extra manoeuvre cannot be paid for now.");
    update[`system.${b.resource}.value`] = Number(actor.system[b.resource].value)+b.limits.strainCost;
    return { resource:b.resource, cost:b.limits.strainCost };
  };
  switch (command) {
    case "action":
      if (b.vehicle) throw new Error("Actions belong to the vehicle's crew.");
      if (!b.actionsRemaining) throw new Error("No action is remaining this turn.");
      entry = { kind:"action",actions:1 }; break;
    case "buyManeuver":
      if (!b.maneuversRemaining) throw new Error("The manoeuvre limit has been reached.");
      entry = { kind:"buyManeuver", grants:1, ...pay() }; break;
    case "tradeManeuver":
      if (!b.canTradeAction) throw new Error("No action is remaining to trade for a manoeuvre.");
      entry = { kind:"tradeManeuver", actions:1, grants:1 }; break;
    case "maneuver":
      if (!b.maneuversRemaining) throw new Error("The manoeuvre limit has been reached.");
      entry = { kind:"maneuver", maneuvers:1 };
      if (payment === "free") {
        if (!b.freeRemaining) throw new Error("No free manoeuvre remains. Use + or trade an action.");
        entry.free = 1;
      } else if (payment === "action") {
        if (!b.canTradeAction) throw new Error("No action is remaining to trade for a manoeuvre.");
        entry.actions = 1;
        entry.grants = 1; entry.free = 1;
      } else if (payment === "strain") Object.assign(entry, pay(), { grants:1,free:1 });
      else throw new Error("Unknown manoeuvre payment.");
      break;
    case "grant":
      if (!isGM && !allowPlayerManagement) throw new Error("The GM awards extra manoeuvres.");
      if (b.maneuversRemaining <= b.freeRemaining) throw new Error("The manoeuvre limit has been reached.");
      entry = { kind:"grant", grants:1 }; break;
    case "activate":
      if (!isGM) throw new Error("The GM must confirm this rule's costs and prerequisites.");
      if (entries.some(e => e.kind === "activate" && e.ruleId === ruleId)) throw new Error("This rule is already active this turn.");
      if (!b.decisions.some(rule => rule.id === ruleId)) throw new Error("No eligible learned turn rule was found.");
      entry = { kind:"activate",ruleId }; break;
    case "undo": {
      const last = entries.pop();
      if (!last) throw new Error("Nothing to undo this turn.");
      if ((last.kind === "activate" || (last.kind === "grant" && !allowPlayerManagement)) && !isGM) throw new Error("The GM must undo this ruling.");
      if (last.cost) update[`system.${last.resource}.value`] = Math.max(0,Number(actor.system[last.resource].value)-last.cost);
      break;
    }
    case "reset":
      if (!key.startsWith("freeplay") && !isGM && !allowPlayerManagement) throw new Error("The GM resets a turn during combat.");
      entries.length = 0; break;
    default: throw new Error("Unknown turn command.");
  }
  if (entry) entries.push({ ...entry, ...(operationId ? { operationId } : {}) });
  const rounds = state.rounds.filter(r => r.key !== key).slice(-19);
  rounds.push({ key,entries });
  update[`flags.${SYSTEM_ID}.turnEconomy`] = { rounds };
  return update;
}
