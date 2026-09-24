import { SYSTEM_ID, SKILLS, CHARACTERISTICS } from "./config.mjs";
import { campaignGuidance, DEFAULT_CAMPAIGN } from "./rules.mjs";
import { availableTalents } from "./advancement.mjs";
import { minionState } from "./mechanics.mjs";
export function actorContext(actor) {
  const s = actor.system;
  const campaign =
    globalThis.game?.settings?.get(SYSTEM_ID, "campaign") ?? DEFAULT_CAMPAIGN;
  return {
    systemId: SYSTEM_ID,
    actorUuid: actor.uuid,
    name: actor.name,
    type: actor.type,
    source: s.source,
    incomplete: s.incomplete,
    campaign,
    guidance: campaignGuidance(campaign),
    characteristics: s.characteristics,
    skills: s.skills,
    wounds: s.wounds,
    strain: s.strain,
    soak: s.soak,
    defense: s.defense,
    hullTrauma: s.hullTrauma,
    systemStrain: s.systemStrain,
    armor: s.armor,
    silhouette: s.silhouette,
    obligation: campaign.obligation ? s.obligation : undefined,
    duty: campaign.duty ? s.duty : undefined,
    morality: campaign.morality ? s.morality : undefined,
    forceRating: s.forceRating,
    xp: s.xp,
    creation: s.creation,
    phase: s.phase,
    advancement: s.advancement,
    specializations: (actor.items?.contents ?? [])
      .filter((i) => i.type === "specialization")
      .map((item) => ({
        name: item.name,
        source: item.system.source,
        verified: item.system.tree?.verified === true,
        available: item.system.tree?.verified
          ? availableTalents(
              item.system.tree,
              (s.advancement ?? [])
                .filter((e) => e.itemId === item.id)
                .map((e) => e.nodeId),
              (s.advancement ?? [])
                .filter((e) => e.ranked === false)
                .map((e) => e.name),
            ).map((node) => ({
              id: node.id,
              name: node.name,
              cost: node.cost,
              affordable: node.cost <= s.xp.available,
            }))
          : [],
      })),
  };
}
export const directorAdapter = {
  name: "Starfall narrative dice",
  systemId: SYSTEM_ID,
  getActorHP(actor) {
    const s = actor.system,
      resource = actor.type === "vehicle" ? s.hullTrauma : s.wounds;
    const threshold =
      actor.type === "minion"
        ? minionState(s.groupSize, resource.value, resource.max).threshold
        : resource.max;
    // Incapacitation occurs above the threshold, not when it is exactly reached.
    return {
      current: Math.max(0, threshold + 1 - resource.value),
      max: threshold + 1,
      temp: 0,
    };
  },
  extractCurrentHealth(actor) {
    return this.getActorHP(actor).current;
  },
  extractMaxHealth(actor) {
    return this.getActorHP(actor).max;
  },
  getActorAbilities(actor) {
    return { ...actor.system.characteristics };
  },
  extractSkills(actor) {
    return Object.fromEntries(
      Object.keys(SKILLS).map((key) => [
        SKILLS[key].label,
        actor.system.skills?.[key]?.rank ?? 0,
      ]),
    );
  },
  getItemQuantity(item) {
    return item.system.quantity;
  },
  getStudioItemKind(item) {
    return item.type === "forcePower" ? "action" : "item";
  },
  getNarrativeSheetStats(actor) {
    const s = actor.system;
    if (actor.type === "vehicle")
      return [
        {
          label: "Hull trauma / threshold",
          value: `${s.hullTrauma.value}/${s.hullTrauma.max}`,
        },
        { label: "Missing source statistics", value: s.incomplete.join(", ") },
      ];
    const paths = actorContext(actor)
      .specializations.map(
        (tree) =>
          `${tree.name} (${tree.source.book}, p. ${tree.source.page}): ${tree.verified ? tree.available.map((n) => `${n.name} ${n.cost} XP${n.affordable ? "" : " (not affordable)"}`).join("; ") : "chart unavailable"}`,
      )
      .join("\n");
    return [
      {
        label: "Characteristics",
        value: Object.entries(CHARACTERISTICS)
          .map(([key, label]) => `${label} ${s.characteristics[key]}`)
          .join(", "),
      },
      {
        label: "Wounds / threshold",
        value: `${s.wounds.value}/${s.wounds.max}`,
      },
      {
        label: "Strain / threshold",
        value: `${s.strain.value}/${s.strain.max}`,
      },
      {
        label: "Defense",
        value: `Melee ${s.defense.melee}, ranged ${s.defense.ranged}; soak ${s.soak}`,
      },
      {
        label: "Advancement",
        value: `${s.xp.available} available XP; ${s.career}; ${s.phase}`,
      },
      {
        label: "Available talent paths",
        value: paths || "No specialization attached",
      },
      {
        label: "Campaign rules",
        value: campaignGuidance(game.settings.get(SYSTEM_ID, "campaign")),
      },
    ];
  },
  getRecapStats(actor) {
    return this.getNarrativeSheetStats(actor);
  },
  getNativeCheckRules() {
    return {
      skills: Object.values(SKILLS).map((s) => s.label),
      targetSemantics: "successes",
      defaultTarget: 1,
      guidance:
        "Resolve checks through actor.rollSkill(skill, {difficulty, boost, setback, upgradeDifficulty}). Difficulty is a count of purple dice, not a DC. Net success > 0 passes. Read advantage, threat, triumph and despair independently from the returned outcome. Preserve the active adventure's difficulty; never invent a d20 target.",
    };
  },
  async executeCheck(actor, skill, options) {
    return actor.rollSkill(skill, options);
  },
  async applyDamage(actor, amount, options) {
    return actor.applyDamage(amount, options);
  },
  getCharacterContext: actorContext,
  openAdvancement(actor) {
    return actor.sheet.render({ force: true });
  },
  // Native range bands cannot safely be inferred from a token's distance in metres.
  async executeAttack() {
    throw new Error(
      "Narrative attacks require an explicit range band, weapon, target defense and GM-approved pool. Use the Starfall weapon workflow.",
    );
  },
};
