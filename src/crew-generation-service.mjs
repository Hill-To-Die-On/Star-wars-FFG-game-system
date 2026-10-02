import { SYSTEM_ID } from "./config.mjs";
import { CREW_ROLES, crewRoster, attachedPosition } from "./vehicle-crew.mjs";
import { preparedCrew, preparedCrewRows, planCrewGeneration, assertCrewCapacity } from "./crew-generation.mjs";

const moveOptions={starWarsCrewMove:true,starWarsFreeMovement:true,animate:false};
const actorOf=target=>target.actor??target;
const isPlaced=target=>!!target.parent?.tokens&&!!target.actor;
const assertGM=user=>{if(!user?.isGM)throw new Error("Only the GM can generate or deploy a prepared crew.");};

async function rollback(error,cleanup) {
  const result=await Promise.allSettled(cleanup.map(fn=>fn()));
  if(result.some(r=>r.status==="rejected")){
    const incomplete=new Error(`${error.message} Some new documents could not be removed; inspect the crew roster and Actors directory before retrying.`,{cause:error});
    incomplete.rollbackIncomplete=true;throw incomplete;
  }
  throw error;
}
async function attachMembers(vehicle,members,{applied}={}) {
  const scene=vehicle.parent,created=[];
  try {
    for(const member of members) {
      const source=(await member.actor.getTokenDocument()).toObject();
      delete source._id;source.actorLink=false;
      source.flags??={};source.flags[SYSTEM_ID]??={};
      source.flags[SYSTEM_ID].aboard={vehicleId:vehicle.id,seat:member.seat,roles:[...member.roles],
        ...(member.id?{preparedId:member.id}:{}),original:{rotation:source.rotation??0,elevation:vehicle.elevation??0}};
      Object.assign(source,attachedPosition(source,vehicle));
      const [token]=await scene.createEmbeddedDocuments("Token",[source],moveOptions);
      if(!token)throw new Error("Foundry did not create the crew token.");
      created.push(token);
    }
    if(applied)await vehicle.update({[`flags.${SYSTEM_ID}.crewPreparedApplied`]:applied},moveOptions);
    return created;
  }catch(error){return rollback(error,created.length?[()=>scene.deleteEmbeddedDocuments("Token",created.map(t=>t.id),moveOptions)]:[]);}
}

/** Called inside the same scene/actor transaction queue used by manual boarding. */
export async function generateVehicleCrew(target,recipe,context) {
  assertGM(context.user);
  const actor=actorOf(target),placed=isPlaced(target),existing=placed?crewRoster(target,target.parent.tokens):preparedCrewRows(actor,context.actors);
  if(existing.some(r=>r.missing))throw new Error("A prepared crew actor is missing. Repair or remove its roster reference first.");
  const species=context.entries.find(e=>(e.id??e._id)===recipe.speciesId);
  const plan=planCrewGeneration(actor,recipe,{rows:existing,species,campaign:context.campaign}),created=[];
  try {
    for(const member of plan.members) {
      const npc=await context.createActor(member.source);
      if(!npc)throw new Error("Foundry did not create a crew actor.");
      created.push(npc);member.actor=npc;
    }
    if(placed)await attachMembers(target,plan.members);
    else await actor.update({[`flags.${SYSTEM_ID}.preparedCrew`]:[...preparedCrew(actor),...plan.members.map(m=>({id:m.actor.id,actorId:m.actor.id,seat:m.seat,roles:m.roles}))]});
    return {state:placed?"aboard":"prepared",people:plan.people,actorIds:created.map(a=>a.id)};
  }catch(error){if(error.rollbackIncomplete)throw error;return rollback(error,created.map(a=>()=>context.deleteActor(a)));}
}

export async function deployPreparedCrew(vehicle,context) {
  assertGM(context.user);
  if(!isPlaced(vehicle)||vehicle.actor.type!=="vehicle")throw new Error("Place a vehicle on a scene before boarding its prepared crew.");
  const applied=new Set(vehicle.flags?.[SYSTEM_ID]?.crewPreparedApplied??[]),roster=crewRoster(vehicle,vehicle.parent.tokens);
  // Surviving token references also prevent duplication after an interrupted save.
  for(const row of roster)if(row.token.flags[SYSTEM_ID].aboard.preparedId)applied.add(row.token.flags[SYSTEM_ID].aboard.preparedId);
  const members=preparedCrewRows(vehicle.actor,context.actors).filter(m=>!applied.has(m.id));
  for(const m of members) {
    if(m.missing)throw new Error("A prepared crew actor is missing. Restore it or remove its roster reference before boarding.");
    if(!["character","rival","nemesis","minion"].includes(m.actor.type)||!m.count)throw new Error("Each prepared member must be an active character or NPC.");
    if(!["crew","passenger"].includes(m.seat)||!Array.isArray(m.roles)||m.roles.some(r=>!Object.hasOwn(CREW_ROLES,r))||(m.seat==="passenger"&&m.roles.length))
      throw new Error("A prepared crew member has invalid seating or duties.");
  }
  assertCrewCapacity(vehicle.actor,roster,members);
  if(members.length)await attachMembers(vehicle,members,{applied:[...applied,...members.map(m=>m.id)]});
  return {state:"aboard",people:members.reduce((n,m)=>n+m.count,0),actorIds:members.map(m=>m.actorId)};
}
