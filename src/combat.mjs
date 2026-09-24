import { SYSTEM_ID } from "./config.mjs";
import { initiativeScore } from "./mechanics.mjs";
export class StarfallCombat extends Combat {
  async rollInitiative(ids, { skill = "vigilance", updateTurn = true } = {}) {
    const updates = [];
    for (const id of typeof ids === "string" ? [ids] : ids) {
      const c = this.combatants.get(id);
      if (!c?.actor?.rollSkill || !c.isOwner || c.actor.type === "vehicle")
        continue;
      const result = await c.actor.rollSkill(skill, { difficulty: 0 });
      const player = c.actor.hasPlayerOwner;
      updates.push({
        _id: id,
        initiative: initiativeScore(result.outcome, player),
        [`flags.${SYSTEM_ID}.slotSide`]: player ? "pc" : "npc",
        [`flags.${SYSTEM_ID}.initiativeOutcome`]: result.outcome,
      });
    }
    await this.updateEmbeddedDocuments("Combatant", updates);
    if (updateTurn && this.turn === null && updates.length)
      await this.update({ turn: 0 });
    return this;
  }
  /** GM explicitly assigns a side's initiative slot; round participation is persisted. */
  async claimSlot(combatantId, actor, tokenId = null) {
    if (!game.user.isGM) throw new Error("The GM assigns initiative slots.");
    const slot = this.combatants.get(combatantId),
      side = actor.hasPlayerOwner ? "pc" : "npc";
    if (!slot || slot.getFlag(SYSTEM_ID, "slotSide") !== side)
      throw new Error("The actor must match the side of the slot.");
    const claims = this.getFlag(SYSTEM_ID, "claims") ?? [];
    if (claims.some((c) => c.round === this.round && c.actorId === actor.id))
      throw new Error("This actor has already used a slot this round.");
    await this.update({
      combatants: [
        { _id: combatantId, actorId: actor.id, tokenId, name: actor.name },
      ],
      [`flags.${SYSTEM_ID}.claims`]: [
        ...claims.filter((c) => c.round === this.round),
        { round: this.round, actorId: actor.id, slot: combatantId },
      ],
    });
  }
}
