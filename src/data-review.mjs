import { SYSTEM_PATH } from "./config.mjs";
import { validateTree } from "./advancement.mjs";
import { escapeHTML } from "./mechanics.mjs";
import { talentActivation } from "./talent-activation.mjs";
import { validateTalentNodeRules } from "./talent-rules.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const REVIEW_TYPES = new Set(["weapon", "armor", "gear", "talent", "forcePower", "specialization", "signatureAbility", "attachment"]);
const TREE_TYPES = new Set(["specialization", "signatureAbility"]);
const ABILITY_FIELDS = new Set(["name", "key", "summary", "description", "activation", "source", "effects", "rank", "ranked"]);

const itemContents = (collection) => Array.from(collection?.contents ?? collection ?? []);
const clean = (value) => String(value ?? "").trim();
const sourceValues = (source = {}) => ({ book: clean(source.book), page: clean(source.page) });
const sourceLabel = (source) => [clean(source?.book), clean(source?.page) ? `p. ${clean(source.page)}` : ""].filter(Boolean).join(" · ");

function itemIdentity(item, owner = null) {
  return `${owner?.id ?? "world"}:${item.id ?? item.uuid ?? item.name}`;
}

function abilityGaps(abilities) {
  const gaps = [];
  for (const [index, ability] of Array.from(abilities ?? []).entries()) {
    if (!clean(ability?.name)) gaps.push(`Ability ${index + 1} has no name`);
    if (!clean(ability?.summary ?? ability?.description)) gaps.push(`${clean(ability?.name) || `Ability ${index + 1}`} needs a GM summary`);
    if (!clean(ability?.activation)) gaps.push(`${clean(ability?.name) || `Ability ${index + 1}`} needs an activation or review timing`);
  }
  return gaps;
}

/** Return reviewable gaps without inferring unpublished rule text. */
export function reviewItemGaps(item) {
  const system = item?.system ?? {}, gaps = [], type = item?.type ?? "reference";
  const source = sourceValues(system.source);
  if (!source.book || !source.page) gaps.push("Source book and page");
  if (system.incomplete?.length) gaps.push("Existing source review flags");
  if (TREE_TYPES.has(type)) {
    const tree = system.tree;
    if (!tree?.verified) gaps.push("Tree source verification");
    if (!Array.isArray(tree?.nodes) || !tree.nodes.length) gaps.push("Talent nodes");
    else {
      if (tree.nodes.some((node) => !clean(node.summary))) gaps.push("Talent node guidance");
      if (tree.nodes.some((node) => !talentActivation(node.name, node.activation))) gaps.push("Talent node activation");
      if (tree.nodes.some((node) => !Array.isArray(node.effects) || !node.effects.length)) gaps.push("Structured effect review");
    }
  } else {
    if (!clean(system.description)) gaps.push("GM paraphrase / description");
    if (type === "weapon" && !clean(system.qualities)) gaps.push("Weapon qualities");
    if (type === "talent" && !talentActivation(item.name, system.activation)) gaps.push("Talent activation");
    if (type === "talent" && !system.effects?.length && !system.abilities?.length) gaps.push("Structured rule review");
    if (type !== "weapon" && !system.effects?.length && !system.abilities?.length && ["armor", "gear", "attachment", "forcePower"].includes(type))
      gaps.push("Structured rule or ability review");
    gaps.push(...abilityGaps(system.abilities));
  }
  return [...new Set(gaps)];
}

function reviewDocuments() {
  const result = [], seen = new Set();
  for (const item of itemContents(globalThis.game?.items)) {
    if (!REVIEW_TYPES.has(item.type)) continue;
    const id = itemIdentity(item);
    if (!seen.has(id)) { seen.add(id); result.push({ item, owner: null, id }); }
  }
  for (const actor of itemContents(globalThis.game?.actors)) {
    for (const item of itemContents(actor.items)) {
      if (!REVIEW_TYPES.has(item.type)) continue;
      const id = itemIdentity(item, actor);
      if (!seen.has(id)) { seen.add(id); result.push({ item, owner: actor, id }); }
    }
  }
  return result;
}

export function reviewItemRecords(items = []) {
  return items.map(({ item, owner, id }) => {
    const gaps = reviewItemGaps(item);
    return {
      id,
      item,
      owner,
      name: clean(item.name) || "Unnamed item",
      type: clean(item.type),
      ownerName: clean(owner?.name) || "World item",
      source: sourceValues(item.system?.source),
      sourceLabel: sourceLabel(item.system?.source),
      gaps,
      status: gaps.length ? "Needs review" : "Reviewed",
    };
  }).sort((a, b) => (a.gaps.length ? 0 : 1) - (b.gaps.length ? 0 : 1) || a.name.localeCompare(b.name));
}

function parseJSON(value, field, fallback) {
  const text = clean(value);
  if (!text) return fallback;
  try { return JSON.parse(text); }
  catch (error) { throw new Error(`${field} must be valid JSON: ${error.message}`); }
}

function validateAbilities(abilities) {
  if (!Array.isArray(abilities) || abilities.length > 100) throw new Error("Abilities must be an array of no more than 100 entries.");
  for (const [index, ability] of abilities.entries()) {
    if (!ability || typeof ability !== "object" || Array.isArray(ability)) throw new Error(`Ability ${index + 1} must be an object.`);
    for (const key of Object.keys(ability)) if (!ABILITY_FIELDS.has(key)) throw new Error(`Ability ${index + 1} has unsupported field ${key}.`);
    if (!clean(ability.name)) throw new Error(`Ability ${index + 1} needs a name.`);
    if (ability.activation !== undefined) validateTalentNodeRules({ activation: ability.activation, summary: ability.summary, effects: ability.effects ?? [] });
    if (ability.effects !== undefined) {
      if (!Array.isArray(ability.effects)) throw new Error(`Ability ${index + 1} effects must be an array.`);
      validateTalentNodeRules({ activation: ability.activation, summary: ability.summary, effects: ability.effects });
    }
  }
  return abilities;
}

/** Validate the editable, declarative fields before a Foundry update. */
export function validateReviewData(data, { treeEnabled = false } = {}) {
  const sourceBook = clean(data.sourceBook), sourcePage = clean(data.sourcePage), activation = clean(data.activation);
  if (sourceBook.length > 240 || sourcePage.length > 40) throw new Error("Source book or page is too long.");
  if (activation) validateTalentNodeRules({ activation, effects: [] });
  const effects = parseJSON(data.effectsJSON, "Structured effects", []);
  if (!Array.isArray(effects)) throw new Error("Structured effects must be a JSON array.");
  validateTalentNodeRules({ activation, summary: String(data.description ?? "").slice(0, 4000), effects });
  const abilities = parseJSON(data.abilitiesJSON, "Abilities", []);
  validateAbilities(abilities);
  const incomplete = parseJSON(data.incompleteJSON, "Review flags", []);
  if (!Array.isArray(incomplete) || incomplete.length > 100 || incomplete.some((entry) => typeof entry !== "string" || entry.length > 200))
    throw new Error("Review flags must be an array of up to 100 short text entries.");
  let tree;
  if (treeEnabled) {
    tree = parseJSON(data.treeJSON, "Talent tree", null);
    if (tree) validateTree(tree);
  }
  return {
    source: { book: sourceBook, page: sourcePage },
    description: String(data.description ?? "").slice(0, 50000),
    activation,
    ...(data.qualities !== undefined ? { qualities: String(data.qualities).slice(0, 4000) } : {}),
    effects,
    abilities,
    incomplete,
    ...(tree ? { tree } : {}),
  };
}

function formData(root) {
  const data = new FormData(root.querySelector("form"));
  return Object.fromEntries(data);
}

export function openDataReview() {
  if (!globalThis.game?.user?.isGM) throw new Error("Only the GM can review rule data.");
  return new DataReviewBrowser().render({ force: true });
}

export class DataReviewBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "star-wars-data-review",
    tag: "section",
    classes: ["star-wars", "sf-data-review"],
    window: { title: "Star Wars FFG · Data review", resizable: true },
    position: { width: 1180, height: 820 },
    actions: { select: this.select, validate: this.validate, save: this.save, refresh: this.refresh },
  };
  static PARTS = { body: { template: `${SYSTEM_PATH}/templates/data-review.hbs` } };
  selectedId = "";
  filter = "missing";

  async _prepareContext() {
    if (!game.user.isGM) throw new Error("Only the GM can review rule data.");
    const records = reviewItemRecords(reviewDocuments());
    if (!this.selectedId || !records.some((record) => record.id === this.selectedId)) this.selectedId = records.find((record) => record.gaps.length)?.id ?? records[0]?.id ?? "";
    const selected = records.find((record) => record.id === this.selectedId) ?? null;
    const visible = records.filter((record) => this.filter === "all" || record.gaps.length);
    return {
      filter: this.filter,
      missingSelected: this.filter === "missing",
      allSelected: this.filter === "all",
      total: records.length,
      missing: records.filter((record) => record.gaps.length).length,
      reviewed: records.filter((record) => !record.gaps.length).length,
      records: visible.map((record) => ({ ...record, selected: record.id === this.selectedId })),
      selected: selected && {
        ...selected,
        description: String(selected.item.system?.description ?? ""),
        activation: String(selected.item.system?.activation ?? ""),
        effectsJSON: escapeHTML(JSON.stringify(selected.item.system?.effects ?? [], null, 2)),
        abilitiesJSON: escapeHTML(JSON.stringify(selected.item.system?.abilities ?? [], null, 2)),
        treeJSON: TREE_TYPES.has(selected.item.type) ? escapeHTML(JSON.stringify(selected.item.system?.tree ?? {}, null, 2)) : "",
        treeEnabled: TREE_TYPES.has(selected.item.type),
        isWeapon: selected.item.type === "weapon",
        qualities: String(selected.item.system?.qualities ?? ""),
        incompleteJSON: escapeHTML(JSON.stringify(selected.item.system?.incomplete ?? [], null, 2)),
        sourceBook: selected.source.book,
        sourcePage: selected.source.page,
        itemTypeLabel: selected.type,
      },
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="filter"]')?.addEventListener("change", (event) => {
      this.filter = event.target.value === "all" ? "all" : "missing";
      this.render();
    });
  }

  static select(_event, target) { this.selectedId = target.dataset.id; this.render(); }
  static refresh() { this.render(); }
  static async validate() {
    try {
      const selected = reviewItemRecords(reviewDocuments()).find((record) => record.id === this.selectedId);
      if (!selected) throw new Error("Choose an item to review.");
      validateReviewData(formData(this.element), { treeEnabled: TREE_TYPES.has(selected.item.type) });
      ui.notifications.info(`${selected.name}: fields are valid and ready to save.`);
    } catch (error) { ui.notifications.error(error.message); }
  }
  static async save() {
    try {
      if (!game.user.isGM) throw new Error("Only the GM can save rule data.");
      const selected = reviewItemRecords(reviewDocuments()).find((record) => record.id === this.selectedId);
      if (!selected) throw new Error("Choose an item to review.");
      const normalized = validateReviewData(formData(this.element), { treeEnabled: TREE_TYPES.has(selected.item.type) });
      const source = { ...(selected.item.system?.source ?? {}), ...normalized.source };
      const updates = {
        "system.source": source,
        "system.description": normalized.description,
        "system.activation": normalized.activation,
        "system.effects": normalized.effects,
        "system.abilities": normalized.abilities,
        "system.incomplete": normalized.incomplete,
      };
      if (normalized.qualities !== undefined) updates["system.qualities"] = normalized.qualities;
      if (normalized.tree) updates["system.tree"] = normalized.tree;
      await selected.item.update(updates);
      ui.notifications.info(`${selected.name}: rule data saved.`);
      this.render();
    } catch (error) { ui.notifications.error(error.message); }
  }
}
