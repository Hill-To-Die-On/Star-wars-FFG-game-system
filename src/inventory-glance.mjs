import { SKILLS } from "./config.mjs";
import { talentActivation } from "./talent-activation.mjs";
import { renderTalentMarkup, talentMarkupText } from "./talent-markup.mjs";
import { learnedTalentRules } from "./talent-rules.mjs";
import { speciesAbilityEntry } from "./species-abilities.mjs";

const EQUIPMENT_TYPES = new Set(["weapon", "armor", "gear", "attachment"]);
const TYPE_LABELS = Object.freeze({
  weapon: "Weapon", armor: "Armor", gear: "Gear", attachment: "Attachment",
  species: "Species", career: "Career", specialization: "Specialization",
  talent: "Talent", forcePower: "Force power", signatureAbility: "Signature ability",
  reference: "Reference",
});
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const present = (value) => value !== null && value !== undefined && clean(value) !== "";
const chip = (label, value) => ({ label, value: clean(value) });
const short = (value, limit = 185) => {
  const text = clean(talentMarkupText(clean(value).replace(/<[^>]*>/g, " ")));
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
};
const sourceLabel = (source) => [clean(source?.book), present(source?.page) ? `p. ${clean(source.page)}` : ""]
  .filter(Boolean).join(" · ");
const listNames = (names) => names.length < 2 ? names.join("") :
  `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
const abilityCard = ({id, name, typeLabel, activation, detail, source, needsReview = false, origin = "",
  destination = "", parentItemId = "", richDetail = false}) => {
  const chips = [chip("Origin", origin)];
  if (present(activation)) chips.push(chip("Activation", activation));
  return {
    id, name, typeLabel, chips, detail: short(detail),
    detailHtml: richDetail && present(detail) ? renderTalentMarkup(detail) : "",
    source: sourceLabel(source),
    needsReview, noGlance: !present(detail), destination, parentItemId,
  };
};

/** Present only values recorded on the item; incomplete entries cannot imply verified combat stats. */
export function inventoryGlance(item) {
  const s = item?.system ?? {}, type = item?.type ?? "reference",
    needsReview = (s.incomplete?.length ?? 0) > 0,
    chips = [],
    add = (label, value) => { if (present(value)) chips.push(chip(label, value)); },
    source = sourceLabel(s.source);

  if (type === "weapon") {
    if (!needsReview) {
      if (present(s.damage) && clean(s.damage) !== "0") add("Damage", s.damage);
      if (Number(s.critical) > 0) add("Critical", s.critical);
      if (chips.length) {
        add("Range", s.range);
        add("Skill", SKILLS[s.skill]?.label ?? s.skill);
      }
    }
    add("Encumbrance", s.encumbrance);
  } else if (type === "armor") {
    if (!needsReview) {
      add("Soak", s.soak);
      add("Defense", s.defense);
    }
    add("Encumbrance", s.encumbrance);
  } else if (EQUIPMENT_TYPES.has(type)) {
    add("Encumbrance", s.encumbrance);
    if (type === "attachment") add("Hard points", s.hardpoints);
    add("Price", present(s.price) ? `${s.price} cr` : "");
    add("Rarity", s.rarity);
  } else if (type === "talent") {
    add("Activation", talentActivation(item?.name, s.activation));
    if (s.ranked && Number(s.rank) > 0) add("Rank", s.rank);
  } else if (type === "forcePower") {
    add("Activation", s.activation);
    if (Number(s.forceRating) > 0) add("Force rating", s.forceRating);
  } else if (type === "species") {
    add("Starting XP", s.metadata?.XP);
    add("Wound base", s.metadata?.Wound_Base);
    add("Strain base", s.metadata?.Strain_Base);
  } else if (type === "career") {
    if (s.careerSkills?.length) add("Career skills", s.careerSkills.length);
  } else if (type === "specialization" || type === "signatureAbility") {
    if (s.tree?.nodes?.length) add("Tree nodes", s.tree.nodes.length);
    if (type === "specialization") add("Career", s.career);
    else if (s.eligibleCareers?.length) add("Eligible careers", s.eligibleCareers.join(", "));
  } else {
    add("Category", s.abilityCategory);
  }

  const detail = short(type === "weapon" && present(s.qualities) ? s.qualities : s.description),
    quantity = Number(s.quantity ?? 1);
  return {
    id: item?.id,
    name: item?.name,
    type,
    typeLabel: TYPE_LABELS[type] ?? clean(type),
    img: item?.img,
    chips,
    detail,
    source,
    needsReview,
    noGlance: !chips.length && !detail,
    quantity: Number.isFinite(quantity) && quantity > 1 ? quantity : null,
    equipped: EQUIPMENT_TYPES.has(type) && s.equipped === true,
    weapon: type === "weapon",
  };
}

export function inventoryGroups(input) {
  const actor = input?.items ? input : null,
    items = actor?.items ?? input,
    sourceItems = Array.from(items?.contents ?? items ?? []),
    equipmentItems = [], abilityItems = [], ownedAbilityItems = [];
  for (const item of sourceItems) {
    const view = inventoryGlance(item);
    (EQUIPMENT_TYPES.has(item?.type) ? equipmentItems : abilityItems).push(view);
  }
  if (actor) {
    const byId = new Map(sourceItems.map((item) => [item.id, item]));
    for (const rule of learnedTalentRules(actor)) {
      const parent = byId.get(rule.id.split(":")[0]);
      ownedAbilityItems.push(abilityCard({
        id: rule.id, name: rule.name,
        typeLabel: parent?.type === "signatureAbility" ? "Purchased signature ability" : "Purchased talent",
        activation: rule.activation, detail: rule.summary,
        source: rule.source, origin: parent?.name ?? "Advancement record",
        needsReview: !parent || !present(rule.summary),
        destination: "advancement",
        richDetail: true,
      }));
    }
    const system = actor.system ?? {},
      species = actor.type === "character" ? speciesAbilityEntry(system.species, system.creation?.species) : null;
    if (species) {
      for (const trait of species.abilities) {
        ownedAbilityItems.push(abilityCard({
          id: `species:${species.species}:${trait.name}`, name: trait.name,
          typeLabel: "Species trait", activation: trait.activation,
          detail: trait.summary, source: species.source, origin: species.species,
          needsReview: trait.application === "manual" && system.creation?.speciesAbilitiesPending === true,
          destination: "overview",
        }));
      }
      if (system.creation?.applied === true) {
        const grants = [
          ...(system.creation.speciesSkillGrants ?? []),
          ...(system.creation.nonCareerSkillChoices ?? []),
        ].filter((key) => SKILLS[key]);
        if (grants.length) ownedAbilityItems.push(abilityCard({
          id: `species:${species.species}:skills`, name: `${species.species} starting skill ranks`,
          typeLabel: "Species grant",
          detail: `${listNames(grants.map((key) => SKILLS[key].label))} ${grants.length === 1 ? "gained" : "each gained"} one starting rank at creation.`,
          source: species.source, origin: species.species,
          destination: "overview",
        }));
      }
    }
    for (const item of sourceItems) {
      for (const [index, ability] of Array.from(item.system?.abilities ?? []).entries()) {
        if (!present(ability?.name)) continue;
        ownedAbilityItems.push(abilityCard({
          id: `${item.id}:ability:${index}`, name: ability.name,
          typeLabel: EQUIPMENT_TYPES.has(item.type) ? "Equipment ability" : "Granted ability",
          activation: ability.activation, detail: ability.summary ?? ability.description,
          source: ability.source?.book ? ability.source : item.system?.source,
          origin: item.name, needsReview: (item.system?.incomplete?.length ?? 0) > 0 ||
            !present(ability.summary ?? ability.description),
          parentItemId: item.id,
        }));
      }
    }
  }
  return { equipmentItems, abilityItems, ownedAbilityItems,
    hasAnyAbilities: ownedAbilityItems.length + abilityItems.length > 0 };
}
