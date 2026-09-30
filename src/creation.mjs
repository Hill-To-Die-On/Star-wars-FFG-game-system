import { CHARACTERISTICS, SKILLS } from "./config.mjs";
import { ruleLine } from "./rules.mjs";
import {
  buildStartingLoadout,
  creationResourcePlan,
} from "./creation-resources.mjs";
import { speciesAbilityEntry, speciesStartingSkills, validateNonCareerSkillChoices } from "./species-abilities.mjs";
import { defaultOriginBiography } from "./career-story.mjs";
export function creationPlan({
  species,
  career,
  specialization,
  line,
  careerRanks = [],
  specializationRanks = [],
  speciesSkillChoice = "",
  nonCareerSkillChoices = [],
  partySize = 4,
  resourceChoices = [],
  ageStartingResource = "lambda",
  startingEquipment = [],
  allowRestricted = false,
}) {
  const rule = ruleLine(line);
  if (
    !rule ||
    species?.type !== "species" ||
    career?.type !== "career" ||
    specialization?.type !== "specialization"
  )
    throw new Error(
      "Choose a species, career, specialization and creation line.",
    );
  if (specialization.system.career !== career.name)
    throw new Error(
      "The first specialization must belong to the selected career.",
    );
  const validate = (selected, available, maximum) => {
    if (
      new Set(selected).size !== selected.length ||
      selected.length !== Math.min(maximum, available.length) ||
      selected.some((key) => !available.includes(key))
    )
      throw new Error(
        `Choose ${Math.min(maximum, available.length)} different eligible free skills.`,
      );
  };
  validate(careerRanks, career.system.careerSkills, rule.freeCareerRanks);
  validate(
    specializationRanks,
    specialization.system.careerSkills,
    rule.freeSpecializationRanks,
  );
  const resources = creationResourcePlan({
      line,
      partySize,
      choices: resourceChoices,
      ageStartingResource,
    }),
    data = species.system.metadata;
  const stat = (key) => {
    const value = Number(data[key]);
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > 1000 ||
      data[key] === "" ||
      data[key] == null
    )
      throw new Error(`Species ${key} is missing; verify the source first.`);
    return value;
  };
  const characteristics = Object.fromEntries(
    Object.entries(CHARACTERISTICS).map(([key, label]) => [key, stat(label)]),
  );
  const loadout = buildStartingLoadout({
    options: startingEquipment,
    selections: startingEquipment.map(({ id, quantity }) => ({ id, quantity })),
    cashBudget: resources.cashBudget,
    gearGrant: resources.gearGrant,
    allowRestricted,
    encumbranceLimit: 5 + characteristics.brawn,
  });
  const allCareer = new Set([
    ...career.system.careerSkills,
    ...specialization.system.careerSkills,
  ]);
  const skills = Object.fromEntries(
    Object.entries(SKILLS).map(([key, skill]) => [
      key,
      {
        rank:
          Number(careerRanks.includes(key)) +
          Number(specializationRanks.includes(key)),
        career: allCareer.has(key),
        group: false,
        characteristic: skill.characteristic,
      },
    ]),
  );
  const speciesRules = speciesAbilityEntry(species.name, species.system.source);
  const speciesSkillGrants = speciesStartingSkills(speciesRules, speciesSkillChoice);
  const speciesAbilitiesPending = !speciesRules || speciesRules.abilities.some((ability) => ability.application !== "automatic");
  for (const key of speciesSkillGrants) {
    if (skills[key].rank >= 2)
      throw new Error(`${species.name} grants ${SKILLS[key].label}, but that skill would exceed rank 2 during creation. Choose different free skills.`);
    skills[key].rank += 1;
  }
  const nonCareerGrants = validateNonCareerSkillChoices(speciesRules, nonCareerSkillChoices, [...allCareer], skills);
  for (const key of nonCareerGrants) skills[key].rank += 1;
  return {
    line,
    phase: "creation",
    species: species.name,
    career: career.name,
    biography: defaultOriginBiography(species.name, career.name),
    characteristics,
    skills,
    soak: characteristics.brawn,
    credits: loadout.credits,
    xp: {
      total: stat("XP") + resources.xpBonus,
      available: stat("XP") + resources.xpBonus,
    },
    wounds: { value: 0, max: stat("Wound_Base") + characteristics.brawn },
    strain: { value: 0, max: stat("Strain_Base") + characteristics.willpower },
    forceRating: line === "force" ? 1 : 0,
    ...(resources.story.mechanic === "obligation"
      ? { obligation: { value: resources.story.value, label: "" } }
      : {}),
    ...(resources.story.mechanic === "duty"
      ? { duty: { value: resources.story.value, label: "", contribution: 0 } }
      : {}),
    ...(resources.story.mechanic === "morality"
      ? {
          morality: {
            value: resources.story.value,
            conflict: 0,
            strength: "",
            weakness: "",
          },
        }
      : {}),
    creation: {
      applied: true,
      speciesId: String(species.id ?? species._id ?? ""),
      careerId: String(career.id ?? career._id ?? ""),
      specializationId: String(
        specialization.id ?? specialization._id ?? "",
      ),
      species: species.system.source,
      career: career.system.source,
      specialization: specialization.system.source,
      careerRanks,
      specializationRanks,
      speciesSkillChoice,
      speciesSkillGrants,
      nonCareerSkillChoices: nonCareerGrants,
      speciesAbilitySource: speciesRules?.source ?? null,
      speciesAbilitiesPending,
      startingResources: {
        ...resources,
        ...loadout,
      },
      pocketMoneyPending: true,
    },
    incomplete: speciesAbilitiesPending
      ? ["Verify species abilities and any exceptional creation rules in the source book."]
      : [],
  };
}
