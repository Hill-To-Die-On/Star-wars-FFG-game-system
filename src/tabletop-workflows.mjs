import { SYSTEM_ID } from './config.mjs';
import { damageAfterSoak, minionState } from './mechanics.mjs';
import { canSpendXp } from './xp-transactions.mjs';
import { bookAllowed } from './rules.mjs';
import { validateFutureEffect, validatePoolModifier } from './narrative-effects.mjs';

export const SYMBOLS = Object.freeze(['advantage','threat','triumph','despair']);
export function weaponForRecordedRoll(attacker,message) {
  return Array.from(attacker?.items??[]).find(item=>item.type==='weapon' && message?.flavor===`${attacker.name} · ${item.name}`)??null;
}
export const snapshotValues = value => typeof value==='string'?JSON.parse(value):value;
/** Review includes derived results: unchanged wounds do not imply unchanged soak or threshold. */
export const reviewSnapshot = plan => ({version:1,before:plan.before,after:plan.after,
  calculation:plan.calculation??null,source:plan.source,warning:plan.warning??null,downtime:plan.downtime??null});
export const getPath = (object,path) => path.split('.').reduce((value,key)=>value?.[key],object);
const copy=value=>structuredClone(value);
function integer(value,label,min=0,max=1000000) {
  if (!Number.isSafeInteger(value) || value<min || value>max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
export function reviewedSource(source,campaign={}) {
  if (!source?.book?.trim() || !String(source.page??'').trim() || !['gm-reviewed','gm-ruling'].includes(source.verification))
    throw new Error('Record a source book/page and a GM review or an explicit table ruling.');
  if (source.verification==='gm-reviewed' && !bookAllowed(source.book,campaign)) throw new Error('This source is excluded by the campaign book filter.');
  return {book:String(source.book).trim().slice(0,200),page:String(source.page).trim().slice(0,80),verification:source.verification};
}
export function remainingSymbols(outcome,entries=[]) {
  const remaining=Object.fromEntries(SYMBOLS.map(s=>[s,integer(outcome?.[s]??0,s,0,1000)]));
  for (const entry of entries) if (!entry.undone) for (const s of SYMBOLS) remaining[s]-=integer(entry.cost?.[s]??0,s,0,1000);
  if (Object.values(remaining).some(n=>n<0)) throw new Error('The spending record exceeds the roll. Ask the GM to review it.');
  return remaining;
}
export function planSpend(outcome,entries,request,{campaign={}}={}) {
  const available=remainingSymbols(outcome,entries),cost={};
  if (!request.label?.trim()) throw new Error('Describe the narrative result.');
  if (!request.cost || Object.keys(request.cost).some(key=>!SYMBOLS.includes(key))) throw new Error('Unknown narrative symbol.');
  for (const s of SYMBOLS) {const n=integer(request.cost[s]??0,s,0,1000);if(n>available[s])throw new Error(`Not enough ${s} remains.`);cost[s]=n;}
  if (!Object.values(cost).some(Boolean)) throw new Error('Spend at least one symbol.');
  const futureEffect=validateFutureEffect(request.futureEffect);
  const note=String(request.note??'').trim().slice(0,2000);
  if(futureEffect&&!note)throw new Error('Describe the GM decision that grants the future effect.');
  return {label:request.label.trim().slice(0,500),cost,source:reviewedSource(request.source,campaign),note,futureEffect};
}
function requireGM(user) {if(!user?.isGM)throw new Error('Only the GM can commit or undo mechanical effects.');}
function put(plan,actor,path,value) {plan.before[path]=copy(getPath(actor,path)??null);plan.after[path]=copy(value);}
export function planActorEffect(actor,request,{user,campaign={}}={}) {
  requireGM(user);
  if(!actor || actor.type==='group')throw new Error('Choose a character, adversary or vehicle.');
  if(request.sourceRollUuid&&!String(request.note??'').trim())throw new Error('Record the GM decision for this roll.');
  const source=reviewedSource(request.source,campaign),plan={kind:request.kind,label:request.note||request.kind,source,sourceRollUuid:String(request.sourceRollUuid??''),before:{},after:{}},vehicle=actor.type==='vehicle';
  if(request.kind==='damage') {
    const outstanding=Array.isArray(actor.system.incomplete)?actor.system.incomplete.filter(Boolean):[];
    if(outstanding.length&&!String(request.note??'').trim())throw new Error('Record a GM ruling for this actor’s outstanding source checks before applying damage.');
    if(outstanding.length)plan.warning=`Outstanding actor source checks: ${outstanding.join(', ').slice(0,500)}. The GM accepted the displayed combat values for this resolution.`;
    const scale=vehicle?'vehicle':'personal';
    if(request.scale!==scale)throw new Error('Resolve cross-scale damage as an explicit GM ruling first.');
    const amount=integer(request.amount,'Damage'),pierce=integer(request.pierce??0,'Pierce'),breach=integer(request.breach??0,'Breach');
    const soak=integer(request.ignoreSoak?0:vehicle?actor.system.armor:(actor.effectiveTraits?.().soak??actor.system.soak),vehicle?'Armour':'Soak');
    const applied=damageAfterSoak(amount,soak,pierce,breach,scale);
    const resource=vehicle?(request.strain?'systemStrain':'hullTrauma'):(request.strain&&!['minion','rival'].includes(actor.type)?'strain':'wounds');
    const value=integer(actor.system[resource]?.value,'Current damage')+applied;
    put(plan,actor,`system.${resource}.value`,value);
    const threshold=integer(actor.system[resource]?.max,'Damage threshold',1);
    plan.calculation={amount,soak,pierce,breach,applied,resource,threshold,exceedsThreshold:value>threshold};
    if(actor.type==='minion')plan.calculation.minions=minionState(actor.system.groupSize,value,threshold);
  } else if(request.kind==='recover') {
    const valid=vehicle?['hullTrauma','systemStrain']:['wounds',...(['minion','rival'].includes(actor.type)?[]:['strain'])];
    if(!valid.includes(request.resource))throw new Error('Choose a supported recovery resource.');
    const before=integer(actor.system[request.resource]?.value,'Current damage'),amount=integer(request.amount,'Recovery');
    put(plan,actor,`system.${request.resource}.value`,Math.max(0,before-amount));
  } else if(request.kind==='critical'||request.kind==='condition') {
    // TODO: apply critical/condition modifiers after reviewed source mechanics are encoded.
    if(!request.label?.trim())throw new Error('Name the reviewed critical or condition.');
    const key=request.kind==='critical'&&!vehicle?'system.criticals':`flags.${SYSTEM_ID}.${request.kind==='critical'?'vehicleCriticals':'conditions'}`;
    const entries=copy(getPath(actor,key)??[]),id=String(request.entryId??'');
    if(!id)throw new Error('An effect identity is required.');
    if(request.remove) {
      const found=entries.findIndex(e=>e.id===id);if(found<0)throw new Error('The recorded effect no longer exists.');entries.splice(found,1);
    } else {
      if(entries.some(e=>e.id===id))throw new Error('The effect already exists.');
      const modifier=validatePoolModifier(request.modifier);
      entries.push({id,name:request.label.trim().slice(0,200),source,note:String(request.note??'').slice(0,2000),modifier,automation:modifier?'pool-modifier':'record-only'});
    }
    put(plan,actor,key,entries);
    plan.warning=request.modifier?'The GM-reviewed dice modifier applies to matching future checks until this condition is removed.':'Recorded for GM adjudication. No unverified dice or characteristic modifier is inferred.';
  } else if(request.kind==='vehicle-state') {
    if(!vehicle)throw new Error('Choose a vehicle.');
    if(request.speed!==undefined)put(plan,actor,'system.speed.value',integer(request.speed,'Speed',0,actor.system.speed.max));
    for(const [zone,value] of Object.entries(request.shields??{})) {
      if(!['fore','aft','port','starboard'].includes(zone))throw new Error('Unknown shield zone.');
      put(plan,actor,`system.shields.${zone}`,integer(value,'Shield defence',0,4));
    }
  } else throw new Error('Unsupported effect. Resolve its source with the GM.');
  if(!Object.keys(plan.after).length)throw new Error('No changes were requested.');
  return plan;
}
export function planUndo(actor,entry) {
  if(entry.undone)throw new Error('This change has already been undone.');
  for(const [path,value] of Object.entries(snapshotValues(entry.after)))if(JSON.stringify(getPath(actor,path)??null)!==JSON.stringify(value))throw new Error('The affected values changed after this entry. Undo later changes or resolve the conflict manually.');
  return copy(snapshotValues(entry.before));
}
export function planSessionAward(actor,request,{user,campaign={}}={}) {
  requireGM(user);
  if(actor?.type!=='character')throw new Error('Session awards apply to player characters.');
  const plan={kind:'session',label:String(request.label||'Session wrap-up').slice(0,200),source:reviewedSource(request.source,campaign),before:{},after:{},downtime:String(request.downtime??'').slice(0,2000)};
  const xp=integer(request.xp??0,'XP award',0,100000),credits=integer(request.credits??0,'Credit award',0,1000000000);
  for(const path of ['system.xp.available','system.xp.total'])if(xp)put(plan,actor,path,integer(getPath(actor,path),'Current XP')+xp);
  if(credits)put(plan,actor,'system.credits',integer(actor.system.credits,'Current credits',0,1000000000000)+credits);
  for(const [mechanic,delta] of Object.entries(request.story??{})) {
    if(!['obligation','duty','morality','conflict'].includes(mechanic))throw new Error('Unknown story mechanic.');
    if(!campaign[mechanic==='conflict'?'morality':mechanic])throw new Error(`${mechanic} is disabled for this campaign.`);
    integer(delta,mechanic,-100,100);
    const path=mechanic==='conflict'?'system.morality.conflict':`system.${mechanic}.value`;
    const value=integer(getPath(actor,path),'Current story resource')+delta;
    integer(value,mechanic,0,mechanic==='conflict'?1000000:100);
    if(delta)put(plan,actor,path,value);
  }
  if(!Object.keys(plan.after).length&&!plan.downtime.trim())throw new Error('Enter an award, reviewed story adjustment or downtime note.');
  return plan;
}
export function planSlotClaim(combat,actor,request,{user}={}) {
  if(!combat?.started || combat.round!==request.round)throw new Error('The combat round changed. Refresh the slot list.');
  if(!canSpendXp(actor,user))throw new Error('Owner permission is required to claim a turn.');
  const combatants=Array.from(combat.combatants??[]),slot=combatants.find(c=>c.id===request.slotId);
  const participant=combatants.find(c=>c.actor?.uuid===actor.uuid);
  if(!participant || actor.type==='vehicle')throw new Error('Choose an eligible character participant in this combat.');
  if(participant.defeated || actor.type==='minion'&&minionState(actor.system.groupSize,actor.system.wounds.value,actor.system.wounds.max).remaining===0)throw new Error('A defeated participant cannot claim a turn.');
  const side=actor.hasPlayerOwner?'pc':'npc';
  if(!slot || (slot.flags?.[SYSTEM_ID]?.slotSide??(slot.actor?.hasPlayerOwner?'pc':'npc'))!==side)throw new Error('Choose a slot on the same side.');
  if(slot.initiative===null)throw new Error('Roll initiative for this slot first.');
  const slotOrder=Array.from(combat.turns??combatants).findIndex(c=>c.id===slot.id);
  if(!user.isGM&&Number.isInteger(combat.turn)&&slotOrder<combat.turn)throw new Error('This slot has already passed. The GM can reassign it.');
  const claims=copy(combat.flags?.[SYSTEM_ID]?.slotClaims??[]),current=claims.filter(c=>c.round===combat.round),prior=current.find(c=>c.slotId===slot.id);
  if(prior&&!(user.isGM&&request.reassign))throw new Error('This slot has already been claimed.');
  if(current.some(c=>c.actorUuid===actor.uuid&&c.slotId!==slot.id))throw new Error('This participant has already claimed a turn this round.');
  const claim={round:combat.round,actorUuid:actor.uuid,actorId:actor.id,tokenId:participant.tokenId??null,slotId:slot.id,userId:user.id};
  return {claim,claims:[...claims.filter(c=>!(c.round===combat.round&&c.slotId===slot.id)),claim]};
}
