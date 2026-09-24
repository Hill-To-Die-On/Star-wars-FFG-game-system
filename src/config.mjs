export const SYSTEM_ID = "star-wars-ffg";
export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;
export const THEMES = {
  frontier: {
    name: "Frontier",
    line: "Edge of the Empire",
    tagline: "A debt. A ship. A way out.",
  },
  rebellion: {
    name: "Rebellion",
    line: "Age of Rebellion",
    tagline: "Every mission makes a difference.",
  },
  mystic: {
    name: "Mystic",
    line: "Force and Destiny",
    tagline: "Find the balance within.",
  },
};
export const CHARACTERISTICS = {
  brawn: "Brawn",
  agility: "Agility",
  intellect: "Intellect",
  cunning: "Cunning",
  willpower: "Willpower",
  presence: "Presence",
};
export const SKILLS = Object.fromEntries(
  [
    ["astrogation", "Astrogation", "intellect"],
    ["athletics", "Athletics", "brawn"],
    ["brawl", "Brawl", "brawn", "Combat"],
    ["charm", "Charm", "presence"],
    ["coercion", "Coercion", "willpower"],
    ["computers", "Computers", "intellect"],
    ["cool", "Cool", "presence"],
    ["coordination", "Coordination", "agility"],
    ["deception", "Deception", "cunning"],
    ["discipline", "Discipline", "willpower"],
    ["gunnery", "Gunnery", "agility", "Combat"],
    ["leadership", "Leadership", "presence"],
    ["lightsaber", "Lightsaber", "brawn", "Combat"],
    ["mechanics", "Mechanics", "intellect"],
    ["medicine", "Medicine", "intellect"],
    ["melee", "Melee", "brawn", "Combat"],
    ["negotiation", "Negotiation", "presence"],
    ["perception", "Perception", "cunning"],
    ["pilotingPlanetary", "Piloting (Planetary)", "agility"],
    ["pilotingSpace", "Piloting (Space)", "agility"],
    ["rangedLight", "Ranged (Light)", "agility", "Combat"],
    ["rangedHeavy", "Ranged (Heavy)", "agility", "Combat"],
    ["resilience", "Resilience", "brawn"],
    ["skulduggery", "Skulduggery", "cunning"],
    ["stealth", "Stealth", "agility"],
    ["streetwise", "Streetwise", "cunning"],
    ["survival", "Survival", "cunning"],
    ["vigilance", "Vigilance", "willpower"],
    ["coreWorlds", "Core Worlds", "intellect", "Knowledge"],
    ["education", "Education", "intellect", "Knowledge"],
    ["lore", "Lore", "intellect", "Knowledge"],
    ["outerRim", "Outer Rim", "intellect", "Knowledge"],
    ["underworld", "Underworld", "intellect", "Knowledge"],
    ["warfare", "Warfare", "intellect", "Knowledge"],
    ["xenology", "Xenology", "intellect", "Knowledge"],
  ].map(([key, label, characteristic, group = "General"]) => [
    key,
    { label, characteristic, group },
  ]),
);
export const RANGES = ["engaged", "short", "medium", "long", "extreme"];
export const ITEM_TYPES = [
  "weapon",
  "armor",
  "gear",
  "talent",
  "forcePower",
  "species",
  "career",
  "specialization",
  "attachment",
  "reference",
];
export function skillKey(value) {
  const normalize = (text) =>
    String(text)
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .replace(/^knowledge/, "");
  return (
    Object.entries(SKILLS).find(([key, skill]) =>
      [normalize(key), normalize(skill.label)].includes(normalize(value)),
    )?.[0] ?? null
  );
}
