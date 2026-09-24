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
export class StarfallActor extends Actor {
  assertOwner() {
    if (!this.isOwner) throw new Error("Owner permission is required.");
  }
  get isVehicle() {
    return this.type === "vehicle";
  }
  skillRank(key) {
    const skill = this.system.skills?.[key];
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
  async rollSkill(key, options = {}) {
    this.assertOwner();
    key = skillKey(key);
    if (!key || this.isVehicle)
      throw new Error("Choose a character's native skill.");
    const characteristic =
      this.system.skills[key].characteristic || SKILLS[key].characteristic;
    const pool = skillPool(
      this.system.characteristics[characteristic],
      this.skillRank(key),
      options,
    );
    return rollPool(pool, {
      label: `${this.name} · ${SKILLS[key].label}`,
      actor: this,
      ...options,
    });
  }
  async rollForce(options = {}) {
    this.assertOwner();
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
    if (this.system.incomplete?.length)
      throw new Error("Verify the missing statistics before applying damage.");
    if (scale !== (this.isVehicle ? "vehicle" : "personal"))
      throw new Error(
        "Resolve cross-scale damage with the GM using the source rules.",
      );
    const applied = damageAfterSoak(
      amount,
      ignoreSoak ? 0 : this.isVehicle ? this.system.armor : this.system.soak,
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
    const known = ledger.filter((e) => e.ranked === false).map((e) => e.name);
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
          time: Date.now(),
        },
      ],
    };
    const name = purchase.node.name.toLowerCase();
    if (name === "grit")
      changes["system.strain.max"] = this.system.strain.max + 1;
    if (name === "toughened")
      changes["system.wounds.max"] = this.system.wounds.max + 2;
    if (name === "force rating")
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
    const skill = this.system.skills[key];
    if (!skill) throw new Error("Unknown skill.");
    const purchase = skillPurchase(
      skill.rank,
      skill.career,
      this.system.xp.available,
      this.system.phase === "creation",
    );
    await this.update({
      [`system.skills.${key}.rank`]: purchase.rank,
      "system.xp.available": purchase.xp,
      "system.advancement": [
        ...this.system.advancement,
        {
          name: `${SKILLS[key].label} ${purchase.rank}`,
          cost: purchase.cost,
          time: Date.now(),
        },
      ],
    });
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
}
export class StarfallItem extends Item {
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
