import { SYSTEM_ID } from './config.mjs';
import { ActorTransactionQueue, actorMutationQueue, canSpendXp } from './xp-transactions.mjs';
import { planActorEffect, planSessionAward, planSlotClaim, planSpend, planUndo, snapshotValues, reviewSnapshot } from './tabletop-workflows.mjs';
import { activePoolRulings } from './narrative-effects.mjs';
const flag=(doc,key)=>doc.flags?.[SYSTEM_ID]?.[key];
const clone=value=>structuredClone(value);
export const workflowAuthority=users=>Array.from(users??[]).filter(u=>u.active&&u.isGM).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];
export class TabletopWorkflowService {
  #queue=new ActorTransactionQueue();
  constructor({resolve,campaign=()=>({}),now=()=>new Date().toISOString(),verifyProposal,assertAuthority=()=>{}}) {Object.assign(this,{resolve,campaign,now,verifyProposal,assertAuthority});}
  execute(command,args,user,operationId) {
    return this.#queue.run('tabletop',()=>this.#execute(command,args,user,operationId));
  }
  async #execute(command,args,user,operationId) {
    this.assertAuthority();
    if(!operationId || typeof operationId!=='string' || operationId.length>128)throw new Error('A valid operation identity is required.');
    if(!args || typeof args!=='object' || JSON.stringify(args).length>100000)throw new Error('Invalid workflow request.');
    if(!user?.active)throw new Error('The requester is no longer active.');
    if(command==='claim') {
      const combat=await this.resolve(args.combatUuid),actor=await this.resolve(args.actorUuid);
      if(!combat || !actor)throw new Error('The combat participant no longer exists.');
      if(!canSpendXp(actor,user))throw new Error('Owner permission is required to claim a turn.');
      const existing=flag(combat,'slotClaims')?.find(c=>c.operationId===operationId);
      if(existing) {
        if(existing.userId!==user.id || existing.actorUuid!==args.actorUuid || existing.slotId!==args.slotId || existing.round!==args.round)throw new Error('The operation identity belongs to a different claim.');
        return existing;
      }
      const plan=planSlotClaim(combat,actor,args,{user});plan.claim.operationId=operationId;
      this.assertAuthority();await combat.update({[`flags.${SYSTEM_ID}.slotClaims`]:plan.claims});return plan.claim;
    }
    if(command==='consume-future-effect') {
      const actor=await this.resolve(args.actorUuid);
      if(!actor || !canSpendXp(actor,user))throw new Error('Owner permission is required to use a narrative effect.');
      if(!Array.isArray(args.entryIds)||!args.entryIds.length||args.entryIds.length>16||new Set(args.entryIds).size!==args.entryIds.length||!args.rollId||typeof args.rollId!=='string')throw new Error('Choose valid narrative effects and a roll identity.');
      return actorMutationQueue.run(actor.uuid??actor.id,async()=>{
        const effects=clone(flag(actor,'narrativeEffects')??[]),available=new Set(activePoolRulings(actor,args.skillKey).pendingIds);
        for(const id of args.entryIds){
          const entry=effects.find(effect=>effect.id===id);
          if(entry?.consumedBy===args.rollId)continue;
          if(!available.has(id))throw new Error('This narrative effect was already used or does not apply to the chosen skill.');
          entry.consumedBy=args.rollId;entry.consumedAt=this.now();
        }
        this.assertAuthority();await actor.update({[`flags.${SYSTEM_ID}.narrativeEffects`]:effects});
        return effects.filter(entry=>args.entryIds.includes(entry.id));
      });
    }
    if(!user.isGM)throw new Error('The GM must approve this mechanical change.');
    if(command==='effect'||command==='award') {
      const actor=await this.resolve(args.actorUuid);if(!actor?.system)throw new Error('The actor no longer exists.');
      return actorMutationQueue.run(actor.uuid??actor.id,()=>this.#apply(actor,command==='effect'?planActorEffect:planSessionAward,args.request,{user,campaign:this.campaign()},operationId,args.expected));
    }
    if(command==='undo-effect') {
      const actor=await this.resolve(args.actorUuid);if(!actor)throw new Error('The actor no longer exists.');
      return actorMutationQueue.run(actor.uuid??actor.id,async()=>{
      const entries=clone(flag(actor,'workflowHistory')??[]),entry=entries.find(e=>e.id===args.entryId);
      if(!entry)throw new Error('The effect record no longer exists.');
      if(entry.undone)return entry;
      const changes=planUndo(actor,entry);entry.undone=true;entry.undoneBy=user.id;entry.undoneAt=this.now();
      this.assertAuthority();await actor.update({...changes,[`flags.${SYSTEM_ID}.workflowHistory`]:entries});
      const linkWarning=await this.#touchLinkedRoll(entry.sourceRollUuid,operationId);
      return linkWarning?{...entry,linkWarning}:entry;
      });
    }
    if(command==='spend'||command==='undo-spend') {
      const message=await this.resolve(args.messageUuid),facts=flag(message,'outcome');
      if(!message?.rolls?.length || !facts || !message.rolls.some(r=>r.options?.starWars?.outcome && JSON.stringify(r.options.starWars.outcome)===JSON.stringify(facts)))throw new Error('Choose a native narrative roll with matching roll facts.');
      const entries=clone(flag(message,'spending')??[]);
      if(command==='spend') {
        const existing=entries.find(e=>e.id===operationId || args.proposalUuid&&e.proposalUuid===args.proposalUuid);if(existing)return existing;
        if(args.proposalUuid) {
          const proposalDocument=await this.resolve(args.proposalUuid),proposal=flag(proposalDocument,'spendingProposal');
          if(!proposal || proposal.messageUuid!==args.messageUuid || JSON.stringify(proposal.request)!==JSON.stringify(args.request))throw new Error('The proposal changed after review. Review it again.');
          const roller=await this.resolve(flag(message,'actorUuid'));
          const requester=await this.verifyProposal?.(proposalDocument);
          if(!canProposeSpend(message,roller,requester))throw new Error('The proposer does not own the rolling actor.');
        }
        const entry={...planSpend(facts,entries,args.request,{campaign:this.campaign()}),id:operationId,userId:user.id,at:this.now(),...(args.proposalUuid?{proposalUuid:args.proposalUuid}:{})};
        entries.push(entry);
        if(entry.futureEffect){
          const actor=await this.resolve(entry.futureEffect.actorUuid);
          if(!actor?.system||actor.type==='group'||actor.uuid!==entry.futureEffect.actorUuid)throw new Error('The future-effect target actor no longer exists.');
          await actorMutationQueue.run(actor.uuid,async()=>{
            const previous=clone(flag(actor,'narrativeEffects')??[]);
            if(previous.some(effect=>effect.id===entry.id))throw new Error('This narrative effect is already attached to the actor.');
            this.assertAuthority();await actor.update({[`flags.${SYSTEM_ID}.narrativeEffects`]:[...previous,{...entry.futureEffect,id:entry.id,label:entry.label,sourceMessageUuid:message.uuid,at:entry.at}]});
            try {this.assertAuthority();await message.update({[`flags.${SYSTEM_ID}.spending`]:entries});}
            catch(error){await actor.update({[`flags.${SYSTEM_ID}.narrativeEffects`]:previous});throw error;}
          });
        } else {this.assertAuthority();await message.update({[`flags.${SYSTEM_ID}.spending`]:entries});}
        return entry;
      }
      const entry=entries.find(e=>e.id===args.entryId);if(!entry)throw new Error('The spending record no longer exists.');
      if(entry.undone)return entry;
      if(entry.futureEffect){
        const actor=await this.resolve(entry.futureEffect.actorUuid);
        if(!actor)throw new Error('The future-effect target actor no longer exists.');
        await actorMutationQueue.run(actor.uuid,async()=>{
          const effects=clone(flag(actor,'narrativeEffects')??[]),effect=effects.find(row=>row.id===entry.id);
          if(effect?.consumedBy)throw new Error('This narrative effect was already used. Review the later roll before changing the decision.');
          this.assertAuthority();await actor.update({[`flags.${SYSTEM_ID}.narrativeEffects`]:effects.filter(row=>row.id!==entry.id)});
        });
      }
      entry.undone=true;entry.undoneAt=this.now();entry.undoneBy=user.id;
      this.assertAuthority();await message.update({[`flags.${SYSTEM_ID}.spending`]:entries});return entry;
    }
    throw new Error('Unsupported tabletop workflow.');
  }
  async #apply(actor,planner,request,context,id,expected) {
    const entries=clone(flag(actor,'workflowHistory')??[]),prior=entries.find(e=>e.id===id);
    const fingerprint=JSON.stringify(request);
    if(prior){if(prior.userId!==context.user.id || prior.requestFingerprint!==fingerprint)throw new Error('The operation identity belongs to a different actor change.');return prior;}
    const plan=planner(actor,request,context);
    if(expected) {
      const reviewed=snapshotValues(expected);
      // Existing integrations may supply a before-only snapshot; new UI reviews carry full derived results.
      const current=reviewed?.version===1?reviewSnapshot(plan):plan.before;
      if(JSON.stringify(current)!==JSON.stringify(reviewed))throw new Error('The actor changed after the preview. Review a fresh preview before applying.');
    }
    // Foundry expands dotted keys inside flag objects. JSON snapshots preserve paths verbatim.
    const entry={...plan,before:JSON.stringify(plan.before),after:JSON.stringify(plan.after),id,userId:context.user.id,at:this.now(),requestFingerprint:fingerprint};
    this.assertAuthority();await actor.update({...plan.after,[`flags.${SYSTEM_ID}.workflowHistory`]:[...entries,entry]});
    const linkWarning=await this.#touchLinkedRoll(plan.sourceRollUuid,id);
    return linkWarning?{...entry,linkWarning}:entry;
  }
  async #touchLinkedRoll(sourceRollUuid,operationId) {
    if(!sourceRollUuid)return '';
    try {
      const message=await this.resolve(sourceRollUuid);
      if(!message?.update)return 'The effect was saved, but its source roll is unavailable. Review the actor history.';
      this.assertAuthority();await message.update({[`flags.${SYSTEM_ID}.linkedDecisionRevision`]:operationId});
      return '';
    } catch {
      return 'The effect was saved, but the chat card did not refresh. Reopen the chat or review the actor history.';
    }
  }
}

/** Consume document authorship instead of accepting a client-supplied userId. */
export function workflowRequestAuthor(message,users,{requireActive=true}={}) {
  const id=message.author?.id??message.user?.id;
  const user=users.get?.(id)??Array.from(users??[]).find(u=>u.id===id);
  if(!user || requireActive&&!user.active)throw new Error('The request author is not active.');
  return user;
}
export function canProposeSpend(message,actor,user) {
  if(!message || !user)return false;
  if(user.isGM)return true;
  if(!canSpendXp(actor,user))return false;
  // Native visibility getters use game.user, which is the GM during approval.
  // Evaluate the same author/recipient rules explicitly for the proposer instead.
  const authorId=message.author?.id??message.user?.id??message.author??message.user;
  if(authorId===user.id)return !message.blind;
  const recipients=Array.from(message.whisper??[],recipient=>recipient?.id??recipient);
  return recipients.length===0 || recipients.includes(user.id);
}
