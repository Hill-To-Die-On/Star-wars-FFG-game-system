import { SYSTEM_ID, SKILLS, skillKey } from "./config.mjs";
import { skillPool } from "./dice/core.mjs";
import { rollPool } from "./dice/foundry.mjs";
import { minionState, damageAfterSoak, weaponDamage } from "./mechanics.mjs";
import {
  talentPurchase,
  skillPurchase,
  characteristicPurchase,
  specializationCost,
} from "./advancement.mjs";
import {
  appendCustomSkill,
  customSkillDefinition,
  customSkillKey,
  discardCustomSkill,
  replaceCustomSkill,
  resolveCustomSkill,
} from "./custom-skills.mjs";
import {
  applyTalentPool,
  effectiveTalentTraits,
  learnedTalentRules,
  talentPurchaseUpdates,
  talentRulesForCheck as resolveTalentRulesForCheck,
} from "./talent-rules.mjs";
import {
  appendMotivation,
  discardMotivation,
  normalizeMotivation,
  replaceMotivation,
} from "./motivations.mjs";
import {
  availableSignatureNodes,
  signatureAttachmentCandidates,
  validateSignatureAttachment,
} from "./signature-abilities.mjs";
export class StarWarsActor extends Actor {
  assertOwner() {
    if (!this.isOwner) throw new Error("Owner permission is required.");
  }
  get isVehicle() {
    return this.type === "vehicle";
  }
  customSkillSources() {
    return Array.from(this.system.customSkills ?? [], (skill) => ({
      id: skill.id,
      label: skill.label,
      characteristic: skill.characteristic,
      type: skill.type,
      rank: skill.rank,
      career: skill.career,
      group: skill.group,
    }));
  }
  motivationSources() {
    return Array.from(this.system.motivations ?? [], (motivation) =>
      normalizeMotivation(motivation),
    );
  }
  skillDefinition(key) {
    const nativeKey = SKILLS[key] ? key : skillKey(key);
    if (nativeKey)
      return {
        key: nativeKey,
        ...SKILLS[nativeKey],
        state: this.system.skills[nativeKey],
        custom: false,
      };
    const state = resolveCustomSkill(this.system.customSkills, key),
      definition = customSkillDefinition(state);
    return definition
      ? {
          key: customSkillKey(state.id),
          id: state.id,
          ...definition,
          state,
        }
      : null;
  }
  skillRank(key) {
    const definition = this.skillDefinition(key),
      skill = definition?.state;
    if (!skill) throw new Error(`Unknown skill: ${key}`);
    return this.type === "minion"
      ? skill.group
        ? Math.min(
            5,
            minionState(
              this.system.groupSize,
              this.system.wounds.value,
              this.system.wounds.max,
            ).rank,
          )
        : 0
      : skill.rank;
  }
  learnedTalentRules() {
    return learnedTalentRules(this);
  }
  effectiveTraits() {
    return effectiveTalentTraits(this);
  }
  talentRulesForCheck(key, options = {}) {
    const definition = this.skillDefinition(key);
    if (!definition) throw new Error(`Unknown skill: ${key}`);
    return resolveTalentRulesForCheck(this, definition, options);
  }
  async rollSkill(key, options = {}) {
    this.assertOwner();
    const definition = this.skillDefinition(key);
    if (!definition || this.isVehicle || this.type === "group")
      throw new Error("Choose a character's native skill.");
    const characteristic =
      definition.state.characteristic || definition.characteristic;
    const { selectedTalents = [], label, ...rollOptions } = options,
      rules = this.talentRulesForCheck(definition.key, { selectedTalents }),
      pool = applyTalentPool(
        skillPool(
          this.system.characteristics[characteristic],
          this.skillRank(definition.key),
          rollOptions,
        ),
        rules,
      );
    return rollPool(pool, {
      label: label ?? `${this.name} · ${definition.label}`,
      actor: this,
      ...rollOptions,
      automaticResults: rules.automaticResults,
      ruleNotes: rules.reasons,
    });
  }
  async rollForce(options = {}) {
    this.assertOwner();
    if (this.type === "group")
      throw new Error("Roll Force dice from a character sheet.");
    const force = Math.max(
      0,
      (this.system.forceRating ?? 0) - (this.system.committedForce ?? 0),
    );
    if (!force) throw new Error("No uncommitted Force dice are available.");
    return rollPool(
      { force },
      { label: `${this.name} · Force`, actor: this, ...options },
    );
  }
  async applyDamage(
    amount,
    {
      strain = false,
      ignoreSoak = false,
      pierce = 0,
      breach = 0,
      scale = this.isVehicle ? "vehicle" : "personal",
    } = {},
  ) {
    this.assertOwner();
    if (this.type === "group")
      throw new Error(
        "A group record is not a combatant and cannot take damage.",
      );
    if (this.system.incomplete?.length)
      throw new Error("Verify the missing statistics before applying damage.");
    if (scale !== (this.isVehicle ? "vehicle" : "personal"))
      throw new Error(
        "Resolve cross-scale damage with the GM using the source rules.",
      );
    const applied = damageAfterSoak(
      amount,
      ignoreSoak
        ? 0
        : this.isVehicle
          ? this.system.armor
          : this.effectiveTraits().soak,
      pierce,
      breach,
      scale,
    );
    const resource = this.isVehicle
      ? strain
        ? "systemStrain"
        : "hullTrauma"
      : strain && this.type !== "minion" && this.type !== "rival"
        ? "strain"
        : "wounds";
    const value = this.system[resource].value + applied;
    await this.update({ [`system.${resource}.value`]: value });
    return {
      applied,
      resource,
      value,
      exceedsThreshold: value > this.system[resource].max,
    };
  }
  async buyTalent(itemId, nodeId, { characteristic } = {}) {
    this.assertOwner();
    const item = this.items.get(itemId);
    if (!item?.system.tree?.verified)
      throw new Error(
        "This tree needs verified source connections before XP can be spent.",
      );
    const ledger = this.system.advancement;
    const owned = ledger
      .filter((e) => e.itemId === itemId)
      .map((e) => e.nodeId);
    const specializationIds = new Set(
        this.items
          .filter((candidate) => candidate.type === "specialization")
          .map((candidate) => candidate.id),
      ),
      known =
        item.type === "specialization"
          ? ledger
              .filter(
                (entry) =>
                  entry.ranked === false &&
                  specializationIds.has(entry.itemId),
              )
              .map((entry) => entry.name)
          : [];
    if (
      item.type === "signatureAbility" &&
      !availableSignatureNodes(this, item).some((node) => node.id === nodeId)
    )
      throw new Error(
        "This signature upgrade is locked. Learn a matching bottom-row talent on its linked specialization first, then follow the connected ability path.",
      );
    const purchase = talentPurchase(
      item.system.tree,
      owned,
      nodeId,
      this.system.xp.available,
      known,
    );
    const changes = {
      "system.xp.available": purchase.xp,
      "system.advancement": [
        ...ledger,
        {
          itemId,
          nodeId,
          name: purchase.node.name,
          cost: purchase.node.cost,
          ranked: purchase.node.ranked,
          source: item.system.source,
          category: item.type,
          time: Date.now(),
        },
      ],
    };
    const name = purchase.node.name.toLowerCase(),
      structuredChanges = talentPurchaseUpdates(this, purchase.node),
      hasStructuredAttribute = (purchase.node.effects ?? []).some(
        (effect) => effect.type === "attribute" && !effect.requirements,
      );
    Object.assign(changes, structuredChanges);
    if (!hasStructuredAttribute && name === "grit")
      changes["system.strain.max"] = this.system.strain.max + 1;
    if (!hasStructuredAttribute && name === "toughened")
      changes["system.wounds.max"] = this.system.wounds.max + 2;
    if (!hasStructuredAttribute && name === "force rating")
      changes["system.forceRating"] = this.system.forceRating + 1;
    if (name === "dedication") {
      const current = this.system.characteristics[characteristic];
      if (!Number.isInteger(current) || current >= 6)
        throw new Error("Dedication needs a characteristic below 6.");
      changes[`system.characteristics.${characteristic}`] = current + 1;
      if (characteristic === "brawn")
        changes["system.soak"] = this.system.soak + 1;
      changes["system.advancement"][
        changes["system.advancement"].length - 1
      ].choice = characteristic;
    }
    await this.update(changes);
    return purchase;
  }
  async buySkill(key) {
    this.assertOwner();
    const definition = this.skillDefinition(key),
      skill = definition?.state;
    if (!skill) throw new Error("Unknown skill.");
    const purchase = skillPurchase(
      skill.rank,
      skill.career,
      this.system.xp.available,
      this.system.phase === "creation",
    );
    const updates = {
      "system.xp.available": purchase.xp,
      "system.advancement": [
        ...this.system.advancement,
        {
          name: `${definition.label} ${purchase.rank}`,
          cost: purchase.cost,
          time: Date.now(),
        },
      ],
    };
    if (definition.custom) {
      const customSkills = this.customSkillSources(),
        custom = customSkills.find((candidate) => candidate.id === definition.id);
      custom.rank = purchase.rank;
      updates["system.customSkills"] = customSkills;
    } else updates[`system.skills.${definition.key}.rank`] = purchase.rank;
    await this.update(updates);
  }
  async createCustomSkill(data) {
    this.assertOwner();
    if (this.isVehicle || this.type === "group")
      throw new Error("Custom skills belong to character and adversary sheets.");
    const customSkills = appendCustomSkill(this.customSkillSources(), data, {
      id: foundry.utils.randomID(),
      rankCap: this.type === "character" ? 5 : 10,
    });
    await this.update({ "system.customSkills": customSkills });
    return customSkills.at(-1);
  }
  async updateCustomSkill(id, data) {
    this.assertOwner();
    const customSkills = replaceCustomSkill(
      this.customSkillSources(),
      id,
      data,
      { rankCap: this.type === "character" ? 5 : 10 },
    );
    await this.update({ "system.customSkills": customSkills });
    return customSkills.find((skill) => skill.id === id);
  }
  async deleteCustomSkill(id) {
    this.assertOwner();
    const customSkills = discardCustomSkill(this.customSkillSources(), id);
    await this.update({ "system.customSkills": customSkills });
  }
  async createMotivation(data) {
    this.assertOwner();
    if (this.type !== "character")
      throw new Error("Structured motivations belong to player characters.");
    const motivations = appendMotivation(this.motivationSources(), data, {
      id: foundry.utils.randomID(),
    });
    await this.update({ "system.motivations": motivations });
    return motivations.at(-1);
  }
  async updateMotivation(id, data) {
    this.assertOwner();
    const motivations = replaceMotivation(
      this.motivationSources(),
      id,
      data,
    );
    await this.update({ "system.motivations": motivations });
    return motivations.find((motivation) => motivation.id === id);
  }
  async deleteMotivation(id) {
    this.assertOwner();
    const motivations = discardMotivation(this.motivationSources(), id);
    await this.update({ "system.motivations": motivations });
  }
  async buyCharacteristic(key) {
    this.assertOwner();
    const purchase = characteristicPurchase(
      this.system.characteristics[key],
      this.system.xp.available,
      this.system.phase,
    );
    const updates = {
      [`system.characteristics.${key}`]: purchase.value,
      "system.xp.available": purchase.xp,
      "system.advancement": [
        ...this.system.advancement,
        {
          name: `${key} ${purchase.value}`,
          cost: purchase.cost,
          time: Date.now(),
        },
      ],
    };
    if (key === "brawn") {
      updates["system.soak"] = this.system.soak + 1;
      updates["system.wounds.max"] = this.system.wounds.max + 1;
    }
    if (key === "willpower")
      updates["system.strain.max"] = this.system.strain.max + 1;
    await this.update(updates);
  }
  specializationPrice(item) {
    const current = this.items.filter((i) => i.type === "specialization");
    const identity = (name) =>
      name
        .replace(/\s+\([^)]*\)$/, " ")
        .trim()
        .toLowerCase();
    if (current.some((i) => identity(i.name) === identity(item.name)))
      throw new Error(
        "This specialization is already attached to the character.",
      );
    if (!current.length)
      throw new Error(
        "Choose the free first specialization with the character creation workflow.",
      );
    return specializationCost(
      current.length,
      item.system.career === this.system.career,
      item.system.universal || item.system.career.toLowerCase() === "universal",
    );
  }
  async acquireSpecialization(item) {
    this.assertOwner();
    const cost = this.specializationPrice(item);
    if (cost > this.system.xp.available)
      throw new Error(
        `This specialization costs ${cost} XP; only ${this.system.xp.available} is available.`,
      );
    const copy = item.toObject();
    copy._id = foundry.utils.randomID();
    const updates = {
      "system.xp.available": this.system.xp.available - cost,
      items: [...this.items.map((i) => i.toObject()), copy],
      "system.advancement": [
        ...this.system.advancement,
        {
          name: `Specialization: ${item.name}`,
          cost,
          itemId: copy._id,
          time: Date.now(),
        },
      ],
    };
    for (const skill of item.system.careerSkills)
      if (this.system.skills[skill])
        updates[`system.skills.${skill}.career`] = true;
    if (item.system.grantedForceRating > this.system.forceRating)
      updates["system.forceRating"] = item.system.grantedForceRating;
    await this.update(updates);
    return { cost, itemId: copy._id };
  }
  signatureAttachmentCandidates(item) {
    return signatureAttachmentCandidates(this, item);
  }
  async acquireSignatureAbility(item, specializationId) {
    this.assertOwner();
    if (this.type !== "character")
      throw new Error("Signature abilities belong to player characters.");
    validateSignatureAttachment(this, item, specializationId);
    const identity = (name) =>
      name
        .replace(/\s+\([^)]*\)$/, " ")
        .trim()
        .toLocaleLowerCase();
    if (
      this.items.some(
        (owned) =>
          owned.type === "signatureAbility" &&
          identity(owned.name) === identity(item.name),
      )
    )
      throw new Error("This signature ability is already attached.");
    const copy = item.toObject();
    delete copy._id;
    copy.system.linkedSpecializationId = specializationId;
    const [created] = await this.createEmbeddedDocuments("Item", [copy]);
    return {
      itemId: created.id,
      linkedSpecializationId: specializationId,
    };
  }
}
export class StarWarsItem extends Item {
  async roll(options = {}) {
    if (this.type !== "weapon" || !this.actor || this.actor.isVehicle)
      throw new Error(
        "Roll a weapon from its character or choose the vehicle's gunner.",
      );
    return this.actor.rollSkill(this.system.skill, {
      ...options,
      label: `${this.actor.name} · ${this.name}`,
    });
  }
  damageFor(outcome) {
    return outcome.passed
      ? weaponDamage(
          this.system.damage,
          this.actor?.system.characteristics?.brawn ?? 0,
          outcome.success,
        )
      : 0;
  }
}
