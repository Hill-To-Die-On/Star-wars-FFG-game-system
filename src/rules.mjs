export const RULE_LINES = {
  edge: {
    label: "Edge of the Empire",
    theme: "frontier",
    mechanic: "obligation",
    freeCareerRanks: 4,
    freeSpecializationRanks: 2,
  },
  age: {
    label: "Age of Rebellion",
    theme: "rebellion",
    mechanic: "duty",
    freeCareerRanks: 4,
    freeSpecializationRanks: 2,
  },
  force: {
    label: "Force and Destiny",
    theme: "mystic",
    mechanic: "morality",
    freeCareerRanks: 3,
    freeSpecializationRanks: 2,
  },
};
export const DEFAULT_CAMPAIGN = {
  lines: ["edge", "age", "force"],
  obligation: true,
  duty: true,
  morality: true,
  books: [],
  beginnerMode: false,
};
export function validateCampaign(value) {
  if (
    !Array.isArray(value.lines) ||
    !value.lines.length ||
    value.lines.some((id) => !RULE_LINES[id])
  )
    throw new Error("Select at least one supported rule line.");
  return {
    lines: [...new Set(value.lines)],
    obligation: !!value.obligation,
    duty: !!value.duty,
    morality: !!value.morality,
    books: [...new Set((value.books ?? []).map(String))],
    beginnerMode: !!value.beginnerMode,
  };
}
export function campaignGuidance(campaign) {
  const c = validateCampaign(campaign);
  return [
    `Enabled lines: ${c.lines.map((id) => RULE_LINES[id].label).join("; ")}.`,
    `Track separately: ${[c.obligation && "Obligation", c.duty && "Duty", c.morality && "Morality and Conflict"].filter(Boolean).join(", ") || "none"}.`,
    "Use the same narrative dice pool and shared Destiny pool for the party. A sheet theme does not change mechanics.",
    "Use each character's creation line for career skills, starting ranks and Force rating. Do not grant a second starting package when adding a rule line.",
    "Obligation, Duty and Morality are independent resources. Resolve their session triggers separately; do not convert one score into another or stack extra starting XP from multiple creation packages.",
    "Advancement spends XP, not character levels. Follow the purchased specialization's connected talent graph. Unranked duplicate talents may be traversed after being acquired elsewhere; ranked entries are separate purchases.",
    "Characteristic increases normally cost ten times the new rating and are restricted to creation. Later increases need an applicable talent such as Dedication; read its reference before applying it.",
    "Triumph and Despair retain their effects even when their success/failure components cancel. Advantage and Threat form a separate axis; Force pips never cancel each other.",
    c.beginnerMode
      ? "Beginner mode: follow the active adventure's staged rules. Do not assume the beginner folio is the full core specialization tree; transition explicitly to the core rules. Only introduce Obligation, Duty, Morality, talents or other core subsystems when the active adventure or GM calls for them; enabling a line does not insert those rules into its beginner tutorial."
      : "Core mode: beginner encounters can be used, but their teaching shortcuts do not replace core character creation or advancement.",
    `Book filter: ${c.books.length ? c.books.join("; ") : "All locally imported references"}.`,
  ].join("\n");
}
export function bookAllowed(book, campaign) {
  return !campaign.books?.length || campaign.books.includes(book);
}
