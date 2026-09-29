import { SYSTEM_ID } from "./config.mjs";
import { initiativeScore } from "./mechanics.mjs";
import { groupDefinition } from "./minion-groups.mjs";
export class StarWarsCombat extends Combat {
  async createEmbeddedDocuments(type,data,options={}) {
    if(type==="Combatant") {
      const seen=new Set(Array.from(this.combatants??[],c=>c.actorId));
      data=data.filter(entry=>{
        const actor=game.actors.get(entry.actorId);
        if(!groupDefinition(actor))return true;
        if(seen.has(actor.id))return false;
        seen.add(actor.id);return true;
      });
    }
    return super.createEmbeddedDocuments(type,data,options);
  }
  async rollInitiative(ids, { skill = "vigilance", updateTurn = true } = {}) {
    const updates = [];
    for (const id of typeof ids === "string" ? [ids] : ids) {
      const c = this.combatants.get(id);
      if (!c?.actor?.rollSkill || !c.isOwner || c.actor.type === "vehicle")
        continue;
      const result = await c.actor.rollSkill(skill, { difficulty: 0, turnCost: "none" });
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
  /** Slot order stays stable; the claimant supplies the active actor/token. */
  getClaimedCombatant(slotId) {
    const slot = this.combatants.get(slotId);
    const claim = (this.getFlag(SYSTEM_ID, "slotClaims") ?? []).find(c => c.round === this.round && c.slotId === slotId);
    return claim ? this.combatants.find(c => c.actor?.uuid === claim.actorUuid) ?? slot : slot;
  }
  get combatant() {
    const slot = super.combatant;
    return slot ? this.getClaimedCombatant(slot.id) : slot;
  }
  async claimSlot(combatantId, actor, tokenId = null) {
    const { requestTabletop } = await import("./tabletop-foundry.mjs");
    return requestTabletop("claim", {combatUuid:this.uuid,slotId:combatantId,actorUuid:actor.uuid,round:this.round});
  }
}
