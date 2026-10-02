import { SYSTEM_ID } from "./config.mjs";
import { minionState } from "./mechanics.mjs";
import { turnUpdate } from "./turn-economy.mjs";
export const groupDefinition=actor=>actor?.flags?.[SYSTEM_ID]?.minionGroup??null;
export const groupId=token=>(token?.document??token)?.flags?.[SYSTEM_ID]?.minionGroupId??null;
const doc=t=>t?.document??t;
export function minionGroupState(actor,tokens,{visibleOnly=false,isGM=true}={}) {
  const definition=groupDefinition(actor);if(!definition)return null;
  const byId=new Map(Array.from(tokens??[],t=>[doc(t).id,doc(t)]));
  const members=definition.memberIds.map(id=>byId.get(id)).filter(t=>t&&t.parent?.id===definition.sceneId&&t.actorId===actor.id&&groupId(t)===actor.id);
  const state=minionState(members.length,actor.system.wounds.value,actor.system.wounds.max),inactive=new Set(definition.inactive??[]);
  const active=members.filter((t,index)=>index>=state.defeated&&!inactive.has(t.id));
  const visible=active.filter(t=>!visibleOnly||((!t.hidden||isGM)&&t.object?.visible!==false));
  return {...state,members,active,visible,remaining:active.length,rank:Math.min(5,Math.max(0,active.length-1)),defeated:members.length-active.length};
}
export function groupStateForActor(actor) {
  const definition=groupDefinition(actor);if(!definition)return null;
  const scene=globalThis.game?.scenes?.get(definition.sceneId);
  return scene?minionGroupState(actor,scene.tokens):null;
}
/** Combatants may arrive in one batch, before preCreateCombatant can see a sibling. */
export function extraMinionCombatantIds(actor,combat) {
  const definition=groupDefinition(actor);
  if(!definition||(combat?.scene?.id??combat?.sceneId)!==definition.sceneId)return [];
  const memberIds=new Set(definition.memberIds),slots=Array.from(combat.combatants??[])
    .filter(combatant=>combatant.actorId===actor.id&&memberIds.has(combatant.tokenId));
  if(slots.length<2)return [];
  const keep=slots.reduce((best,slot)=>(slot.initiative??-Infinity)>(best.initiative??-Infinity)?slot:best);
  return slots.filter(slot=>slot.id!==keep.id).map(slot=>slot.id);
}
/** Keep the tracker in step with pooled casualties while preserving a GM's manual defeat. */
export function minionCombatantUpdates(actor,tokens,combat) {
  const definition=groupDefinition(actor);
  if(!definition||(combat?.scene?.id??combat?.sceneId)!==definition.sceneId)return [];
  const state=minionGroupState(actor,tokens);
  if(!state?.members.length)return [];
  const memberIds=new Set(definition.memberIds);
  return Array.from(combat.combatants??[]).filter(slot=>slot.actorId===actor.id&&memberIds.has(slot.tokenId)).flatMap(slot=>{
    const update={_id:slot.id};
    if(slot.name!==actor.name)update.name=actor.name;
    const auto=slot.flags?.[SYSTEM_ID]?.autoMinionDefeated===true;
    if(state.remaining===0&&!slot.defeated){
      update.defeated=true;update[`flags.${SYSTEM_ID}.autoMinionDefeated`]=true;
    } else if(state.remaining>0&&auto){
      update.defeated=false;update[`flags.${SYSTEM_ID}.autoMinionDefeated`]=null;
    }
    return Object.keys(update).length>1?[update]:[];
  });
}
/** Remove missing roster slots without charging their wounds against a second survivor. */
export function reconcileMinionMembers(actor,tokens) {
  const definition=groupDefinition(actor),state=minionGroupState(actor,tokens);
  if(!definition||state.members.length===definition.memberIds.length)return {};
  const ids=new Set(state.members.map(t=>t.id)),old=minionState(definition.memberIds.length,actor.system.wounds.value,actor.system.wounds.max);
  const removedCasualties=definition.memberIds.filter((id,i)=>i<old.defeated&&!ids.has(id)).length;
  return {"system.wounds.value":Math.max(0,actor.system.wounds.value-removedCasualties*actor.system.wounds.max),
    "system.groupSize":Math.max(1,ids.size),[`flags.${SYSTEM_ID}.minionGroup`]:{...definition,memberIds:definition.memberIds.filter(id=>ids.has(id)),inactive:(definition.inactive??[]).filter(id=>ids.has(id))}};
}
const movementEntries=(actor,key)=>actor.flags?.[SYSTEM_ID]?.turnEconomy?.rounds?.find(r=>r.key===key)?.entries??[];
export function hasSharedMinionMove(actor,tokenId,key) {
  return movementEntries(actor,key).some(e=>e.groupMoves&&!e.groupMoves.some(m=>m.tokenId===tokenId));
}
/** One manoeuvre funds one drag per surviving member; the actor transaction queue serializes the batch. */
export function minionMoveUpdate(actor,state,tokenId,options) {
  if(!state?.active.some(t=>t.id===tokenId))throw new Error("Only an active member may use this group's movement.");
  const {key,operationId}=options;
  const entries=movementEntries(actor,key);
  if(entries.some(e=>e.operationId===operationId||e.groupMoves?.some(m=>m.operationId===operationId)))return {};
  let update,index=entries.findIndex(e=>e.groupMoves&&!e.groupMoves.some(m=>m.tokenId===tokenId));
  if(index<0) {
    update=turnUpdate(actor,"maneuver",options);
    const round=update[`flags.${SYSTEM_ID}.turnEconomy`].rounds.find(r=>r.key===key);
    round.entries.at(-1).groupMoves=[{tokenId,operationId}];
  } else {
    const ledger=structuredClone(actor.flags[SYSTEM_ID].turnEconomy);
    ledger.rounds.find(r=>r.key===key).entries[index].groupMoves.push({tokenId,operationId});
    update={[`flags.${SYSTEM_ID}.turnEconomy`]:ledger};
  }
  return update;
}
/** Minimal connecting tree, without drawing every pair or crossing the group repeatedly. */
export function minionLinkEdges(points) {
  if(points.length<2)return [];
  const visited=[points[0]],waiting=points.slice(1),edges=[];
  while(waiting.length) {
    let best={distance:Infinity};
    for(const a of visited)for(let i=0;i<waiting.length;i++) {const b=waiting[i],distance=(a.x-b.x)**2+(a.y-b.y)**2;if(distance<best.distance)best={distance,a,b,i};}
    edges.push([best.a,best.b]);visited.push(best.b);waiting.splice(best.i,1);
  }
  return edges;
}
function profile(actor) {
  const s=actor.system;
  return JSON.stringify({species:s.species,characteristics:s.characteristics,skills:s.skills,customSkills:s.customSkills,
    soak:s.soak,defense:s.defense,threshold:s.wounds.max,ownership:actor.ownership,
    items:Array.from(actor.items??[],item=>({name:item.name,type:item.type,system:item.toObject?.().system??item.system}))});
}
export function validateMinionMembers(values,{combats=[]}={}) {
  const tokens=Array.from(values??[],doc);
  if(tokens.length<2||tokens.length>100||new Set(tokens.map(t=>t.id)).size!==tokens.length)throw new Error("Select 2 to 100 different minion tokens.");
  const tokenIds=new Set(tokens.map(t=>t.id)),sceneId=tokens[0].parent?.id;
  if(Array.from(combats??[]).some(combat=>(combat.scene?.id??combat.sceneId)===sceneId&&
    Array.from(combat.combatants??[]).some(combatant=>tokenIds.has(combatant.tokenId))))
    throw new Error("Remove these minions from the combat tracker before linking them into one group turn.");
  const baseline=profile(tokens[0].actor);
  for(const t of tokens) {
    if(t.actor?.type!=="minion"||t.actor.system.groupSize!==1||t.actor.system.wounds.value!==0||t.actor.system.wounds.max<=0)throw new Error("Select unwounded single-member minion tokens with a positive wound threshold.");
    if(t.parent?.id!==tokens[0].parent?.id||profile(t.actor)!==baseline)throw new Error("Members must be on the same scene with the same statistics and equipment.");
    if(groupId(t)||groupDefinition(t.actor))throw new Error("A selected token already belongs to a minion group.");
    if(t.flags?.[SYSTEM_ID]?.aboard)throw new Error("Disembark minions aboard a vehicle before linking them.");
    if(t.inCombat)throw new Error("Form the group before adding its members to combat.");
  }
  return tokens;
}
export async function createMinionGroup(values,name,{user,createActor,deleteActor,combats=[]}) {
  if(!user?.isGM)throw new Error("Only the GM can form a minion group.");
  const tokens=validateMinionMembers(values,{combats}),source=tokens[0].actor.toObject();delete source._id;
  source.name=String(name??"").trim()||"Minion group";source.system.groupSize=tokens.length;
  source.flags??={};source.flags[SYSTEM_ID]??={};
  source.flags[SYSTEM_ID].minionGroup={sceneId:tokens[0].parent.id,memberIds:tokens.map(t=>t.id),inactive:[]};
  const original=tokens.map(t=>({_id:t.id,actorId:t.actorId,actorLink:t.actorLink,x:t.x,y:t.y,delta:t.toObject?.().delta??{},[`flags.${SYSTEM_ID}.minionGroupId`]:null}));
  const actor=await createActor(source);
  try {
    await tokens[0].parent.updateEmbeddedDocuments("Token",tokens.map(t=>({_id:t.id,actorId:actor.id,actorLink:true,x:t.x,y:t.y,[`flags.${SYSTEM_ID}.minionGroupId`]:actor.id})));
    return actor;
  } catch(error) {
    // Preserve the new actor if restoring a partially written batch fails: its tokens must not become orphans.
    try {await tokens[0].parent.updateEmbeddedDocuments("Token",original);await deleteActor(actor);}
    catch(rollback){throw new Error(`${error.message} Recovery needs GM review: ${rollback.message}`);}
    throw error;
  }
}
