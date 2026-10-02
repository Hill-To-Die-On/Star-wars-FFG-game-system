import { SYSTEM_ID, SKILLS } from "./config.mjs";
import { originEntryAllowed, originSelectionUpdate } from "./character-origins.mjs";
import { CREW_ROLES, crewCapacities, occupantCount } from "./vehicle-crew.mjs";

export const CREW_GENERATION_ROLES = Object.freeze({
  ...Object.fromEntries(Object.entries(CREW_ROLES).map(([key,role])=>[key,role.label])),
  support:"Support crew", passenger:"Passengers",
});
export const preparedCrew = actor => actor?.flags?.[SYSTEM_ID]?.preparedCrew ?? [];
export function preparedCrewRows(actor,actors) {
  return preparedCrew(actor).map(entry=>{
    const member=actors.get(entry.actorId);
    return {...entry,actor:member,name:member?.name ?? "Missing crew actor",img:member?.img,
      count:member?occupantCount({actor:member}):0,missing:!member};
  });
}
export function crewGenerationDefaults(actor,rows=[]) {
  const capacity=crewCapacities({actor}).crew,
    free=Math.max(0,(capacity ?? 0)-rows.filter(r=>r.seat==="crew").reduce((n,r)=>n+r.count,0));
  const pilot=free>0&&!rows.some(r=>r.roles.includes("pilot"))?1:0;
  return {...Object.fromEntries(Object.keys(CREW_GENERATION_ROLES).map(key=>[key,0])),pilot,support:Math.min(999,Math.max(0,free-pilot))};
}
export function assertCrewCapacity(actor,existing,added) {
  const cap=crewCapacities({actor});
  for(const seat of ["crew","passenger"]) {
    const count=added.filter(r=>r.seat===seat).reduce((n,r)=>n+r.count,0);
    if(!count)continue;
    if(cap[seat]===null)throw new Error(`Configure an exact ${seat} capacity before generating crew.`);
    const used=existing.filter(r=>r.seat===seat).reduce((n,r)=>n+r.count,0);
    if(used+count>cap[seat])throw new Error(`The ${seat} capacity has only ${Math.max(0,cap[seat]-used)} places free.`);
  }
  if([...existing,...added].filter(r=>r.roles.includes("pilot")).length>1)
    throw new Error("Only one primary pilot can be assigned. Clear the existing pilot duty or generate another role.");
}
/** Original editable NPC presets; published species numbers are not a complete adversary profile. */
export function planCrewGeneration(actor,recipe,{rows=[],species,campaign}={}) {
  if(actor?.type!=="vehicle")throw new Error("Choose a vehicle to generate its crew.");
  if(!originEntryAllowed(species,"species",campaign))throw new Error("Choose a valid species from the campaign's allowed catalogue.");
  const rank=Number(recipe.rank ?? 1),counts=recipe.counts;
  if(!Number.isInteger(rank)||rank<0||rank>5)throw new Error("Specialist skill rank must be a whole number from 0 to 5.");
  if(!counts||Array.isArray(counts)||typeof counts!=="object")throw new Error("Choose crew counts for each duty.");
  for(const [role,value] of Object.entries(counts)) {
    if(!Object.hasOwn(CREW_GENERATION_ROLES,role))throw new Error("Unknown crew duty.");
    if(!Number.isSafeInteger(value)||value<0)throw new Error("Crew counts must be non-negative whole numbers.");
  }
  const people=Object.values(counts).reduce((n,v)=>n+v,0);
  if(!people)throw new Error("Choose at least one crew member or passenger.");
  if(people>1000)throw new Error("Generate at most 1,000 occupants in one batch.");
  if((counts.pilot??0)>1)throw new Error("Only one primary pilot can be assigned.");
  const members=[];
  const base=originSelectionUpdate("species",species,{phase:"play"},campaign);
  for(const [role,label] of Object.entries(CREW_GENERATION_ROLES)) {
    let remaining=counts[role]??0,index=0;
    while(remaining>0) {
      const specialist=Object.hasOwn(CREW_ROLES,role),count=specialist?1:Math.min(100,remaining);
      remaining-=count;index++;
      const skills=Object.fromEntries((CREW_ROLES[role]?.skills??[]).map(key=>[key,{rank,career:false,group:false,characteristic:SKILLS[key].characteristic}]));
      members.push({count,seat:role==="passenger"?"passenger":"crew",roles:specialist?[role]:[],
        source:{name:`${actor.name} · ${label} ${index}`,type:specialist?"rival":"minion",
          ownership:structuredClone(actor.ownership??{}),
          system:{...structuredClone(base),phase:"play",groupSize:count,skills,xp:{total:0,available:0}},
          flags:{[SYSTEM_ID]:{generatedCrew:{kind:"generic-npc-preset",role,speciesId:species.id??species._id,skillRank:specialist?rank:0,
            note:"Editable NPC preset. Review species abilities and supply equipment or talents from owned sources as needed."}}}}});
      if(members.length>50)throw new Error("Generate at most 50 NPC actors in one batch; use support groups for large complements.");
    }
  }
  assertCrewCapacity(actor,rows,members);
  return {people,members,species:species.name,rank};
}
