import { SYSTEM_ID } from "./config.mjs";
import { initiativeScore } from "./mechanics.mjs";
import { groupDefinition } from "./minion-groups.mjs";
const initiativeSightWarnings = new WeakSet();
const slotTurnViews = new WeakMap();
/** While core works out which turn to keep, Combat#combatant names the slot, not its claimant. */
async function withSlotTurn(combat, run) {
  if (!combat) return run();
  slotTurnViews.set(combat, (slotTurnViews.get(combat) ?? 0) + 1);
  try {
    return await run();
  } finally {
    slotTurnViews.set(combat, slotTurnViews.get(combat) - 1);
  }
}

export function initiativeSightWarning(combatants, measure) {
  const entries = Array.from(combatants ?? []);
  const players = entries.filter(entry => entry.actor?.hasPlayerOwner && entry.token);
  const opponents = entries.filter(entry => entry.actor && !entry.actor.hasPlayerOwner && entry.token);
  if (!players.length || !opponents.length) return null;
  let checked = 0;
  for (const player of players) for (const opponent of opponents) {
    const result = measure(player.token, opponent.token);
    if (result?.available !== true) continue;
    checked++;
    if (result.lineOfSight === "clear" && result.requiresGmRuling === false) return null;
    if (result.lineOfSight === "clear" && result.requiresGmRuling === undefined) return null;
  }
  return checked
    ? "Opposing combatants have no clear line of sight. Confirm another detection cue before rolling initiative, such as sound, a scanner, or a remote alarm."
    : null;
}

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
    const activeScene = globalThis.canvas?.scene;
    if (globalThis.game?.user?.isGM && !initiativeSightWarnings.has(this) && activeScene &&
        (this.scene?.id ?? this.scene ?? this.sceneId) === activeScene.id) {
      const { measureTokenRange } = await import("./range-overlay/foundry.mjs");
      const combatants = Array.from(this.combatants ?? [], entry => ({
        actor: entry.actor,
        token: entry.token?.object ?? entry.token ?? globalThis.canvas?.tokens?.get?.(entry.tokenId),
      }));
      const warning = initiativeSightWarning(combatants,
        (source, target) => measureTokenRange(source, target, { scene: activeScene }));
      if (warning) {
        globalThis.ui?.notifications?.warn?.(warning);
        initiativeSightWarnings.add(this);
      }
    }
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
    return slot && !slotTurnViews.get(this) ? this.getClaimedCombatant(slot.id) : slot;
  }
  resetAll(options) {
    return withSlotTurn(this, () => super.resetAll(options));
  }
  async claimSlot(combatantId, actor, tokenId = null) {
    const { requestTabletop } = await import("./tabletop-foundry.mjs");
    return requestTabletop("claim", {combatUuid:this.uuid,slotId:combatantId,actorUuid:actor.uuid,round:this.round});
  }
}

export class StarWarsCombatant extends Combatant {
  static _preCreateOperation(documents, operation, user) {
    return withSlotTurn(operation.parent, () => super._preCreateOperation(documents, operation, user));
  }
  static _preUpdateOperation(documents, operation, user) {
    return withSlotTurn(operation.parent, () => super._preUpdateOperation(documents, operation, user));
  }
  static _preDeleteOperation(documents, operation, user) {
    return withSlotTurn(operation.parent, () => super._preDeleteOperation(documents, operation, user));
  }
}
