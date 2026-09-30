import registry from "../data/species-abilities.json" with { type: "json" };
import { SKILLS } from "./config.mjs";
import { normalizeBookTitle } from "./rules.mjs";

const positivePage = (value) => /^[1-9]\d*$/.test(String(value ?? ""));

export function validateSpeciesAbilityRegistry(data = registry) {
  if (data?.format !== "star-wars-species-abilities" || data.version !== 1 || !Array.isArray(data.entries))
    throw new Error("Invalid species ability registry format.");
  const identities = new Set();
  for (const entry of data.entries) {
    const identity = `${entry.species}|${normalizeBookTitle(entry.source?.book)}`;
    if (!entry.species || !entry.source?.book || !positivePage(entry.source.page) || !positivePage(entry.source.cataloguePage) || identities.has(identity))
      throw new Error(`Invalid or repeated species ability source: ${identity}.`);
    identities.add(identity);
    if (!Array.isArray(entry.startingSkillRanks) || entry.startingSkillRanks.some((key) => !SKILLS[key]) || new Set(entry.startingSkillRanks).size !== entry.startingSkillRanks.length)
      throw new Error(`Invalid starting skill ranks for ${entry.species}.`);
    if (entry.choiceSkillRank !== undefined && entry.choiceSkillRank !== true)
      throw new Error(`Invalid skill choice for ${entry.species}.`);
    if (entry.choiceSkillOptions !== undefined && (!entry.choiceSkillRank || !Array.isArray(entry.choiceSkillOptions) || !entry.choiceSkillOptions.length || entry.choiceSkillOptions.some((key) => !SKILLS[key]) || new Set(entry.choiceSkillOptions).size !== entry.choiceSkillOptions.length))
      throw new Error(`Invalid skill choice options for ${entry.species}.`);
    if (!Array.isArray(entry.abilities) || entry.abilities.some((ability) =>
      !ability.name || !ability.summary || !["automatic", "manual"].includes(ability.application) ||
      (ability.checkBoostSkills !== undefined && (!Array.isArray(ability.checkBoostSkills) || !ability.checkBoostSkills.length || ability.checkBoostSkills.some((key) => !SKILLS[key]))) ||
      (ability.checkAdvantageSkills !== undefined && (!Array.isArray(ability.checkAdvantageSkills) || !ability.checkAdvantageSkills.length || ability.checkAdvantageSkills.some((key) => !SKILLS[key]) || !Number.isInteger(ability.automaticAdvantage) || ability.automaticAdvantage < 1)) ||
      (ability.automaticAdvantage !== undefined && !ability.checkAdvantageSkills) ||
      (ability.freeManeuvers !== undefined && ability.freeManeuvers !== 1) ||
      (ability.application === "automatic") !== !!(ability.checkBoostSkills || ability.checkAdvantageSkills || ability.freeManeuvers)))
      throw new Error(`Invalid ability for ${entry.species}.`);
  }
  return data;
}

validateSpeciesAbilityRegistry();

export function speciesAbilityEntry(name, source, data = registry) {
  if (!name || !source?.book || !source?.page) return null;
  return data.entries.find((entry) =>
    entry.species === name &&
    normalizeBookTitle(entry.source.book) === normalizeBookTitle(source.book) &&
    String(entry.source.cataloguePage) === String(source.page)) ?? null;
}

export function speciesStartingSkills(entry, choice = "") {
  if (!entry) {
    if (choice) throw new Error("This species has no verified skill choice.");
    return [];
  }
  if (entry.choiceSkillRank && !SKILLS[choice])
    throw new Error(`Choose one valid starting skill for ${entry.species}.`);
  if (entry.choiceSkillOptions && !entry.choiceSkillOptions.includes(choice))
    throw new Error(`Choose an allowed starting skill for ${entry.species}.`);
  if (!entry.choiceSkillRank && choice)
    throw new Error(`${entry.species} does not grant a starting skill choice.`);
  return [...entry.startingSkillRanks, ...(entry.choiceSkillRank ? [choice] : [])];
}

export function speciesCheckBonuses(name, source, skill) {
  const entry = speciesAbilityEntry(name, source);
  const boost = entry?.abilities.filter((ability) => ability.checkBoostSkills?.includes(skill)) ?? [];
  const advantage = entry?.abilities.filter((ability) => ability.checkAdvantageSkills?.includes(skill)) ?? [];
  return {
    boost: boost.length,
    advantage: advantage.reduce((sum, ability) => sum + ability.automaticAdvantage, 0),
    reasons: [
      ...boost.map((ability) => `${entry.species}: ${ability.name} adds one Boost die (${entry.source.book}, p. ${entry.source.page}).`),
      ...advantage.map((ability) => `${entry.species}: ${ability.name} adds ${ability.automaticAdvantage} automatic Advantage (${entry.source.book}, p. ${entry.source.page}).`),
    ],
  };
}

export function speciesTurnBonuses(name, source) {
  const entry = speciesAbilityEntry(name, source);
  const abilities = entry?.abilities.filter((ability) => ability.freeManeuvers) ?? [];
  return {
    freeManeuvers: abilities.reduce((sum, ability) => sum + ability.freeManeuvers, 0),
    reasons: abilities.map((ability) => `${entry.species}: ${ability.name} adds one free maneuver (${entry.source.book}, p. ${entry.source.page}); the two-maneuver limit still applies.`),
  };
}

export const SPECIES_ABILITY_REGISTRY = registry;
