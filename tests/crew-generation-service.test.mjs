import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_ID } from "../src/config.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
import { generateVehicleCrew, deployPreparedCrew } from "../src/crew-generation-service.mjs";
import { CrewTransactionCoordinator } from "../src/crew-transactions.mjs";
import { crewRoster, resolveCrewCheck } from "../src/vehicle-crew.mjs";

function fixture() {
  let counter=0;
  const actors=new Map(),tokens=new Map(),created=[],deleted=[];
  tokens[Symbol.iterator]=function*(){yield* this.values();};
  const update=async function(changes){for(const [path,value]of Object.entries(changes)){let p=this;const keys=path.split('.');for(const k of keys.slice(0,-1))p=p[k]??={};p[keys.at(-1)]=structuredClone(value);}return this;};
  const vehicle={id:"v",uuid:"Actor.v",name:"QA ship",type:"vehicle",system:{crew:"3",passengers:"6",handling:-1},flags:{},ownership:{player:3},update};
  const scene={id:"s",grid:{size:100},tokens,
    createEmbeddedDocuments:async(_t,[data])=>{
      const t={...structuredClone(data),id:`t${++counter}`,parent:scene,actor:actors.get(data.actorId),update};tokens.set(t.id,t);return [t];},
    deleteEmbeddedDocuments:async(_t,ids)=>{for(const id of ids)tokens.delete(id);},
  };
  const token={id:"v1",uuid:"Scene.s.Token.v1",actor:vehicle,actorId:"v",parent:scene,x:500,y:700,width:4,height:4,flags:{},update};tokens.set(token.id,token);
  const species={_id:"human",name:"Human",type:"species",system:{source:{book:"Edge of the Empire Core Rulebook",page:"1"},metadata:{Playable:true,Brawn:2,Agility:2,Intellect:2,Cunning:2,Willpower:2,Presence:2,Wound_Base:10,Strain_Base:10,XP:110}}};
  const ctx={user:{id:"gm",active:true,isGM:true},actors,entries:[species],campaign:DEFAULT_CAMPAIGN,
    createActor:async source=>{const a={...structuredClone(source),id:`a${++counter}`};a.getTokenDocument=async()=>({toObject:()=>({name:a.name,actorId:a.id,width:1,height:1,rotation:180,flags:{}})});actors.set(a.id,a);created.push(a);return a;},
    deleteActor:async a=>{deleted.push(a.id);actors.delete(a.id);},
  };
  return {vehicle,token,ctx,scene,created,deleted};
}
const recipe={speciesId:"human",rank:2,counts:{pilot:1,engineer:1}};
test("unplaced generation prepares real NPC sheets without creating scene tokens",async()=>{
  const f=fixture(),r=await generateVehicleCrew(f.vehicle,recipe,f.ctx);
  assert.equal(r.state,"prepared");assert.equal(r.people,2);assert.equal(f.created.length,2);assert.equal(f.scene.tokens.size,1);
  assert.equal(f.vehicle.flags[SYSTEM_ID].preparedCrew.length,2);assert.equal(f.created[0].ownership.player,3);
});
test("deployment attaches independent tokens with skills and handling, and never respawns a departed crew member",async()=>{
  const f=fixture();await generateVehicleCrew(f.vehicle,recipe,f.ctx);
  await deployPreparedCrew(f.token,f.ctx);
  const rows=crewRoster(f.token,f.scene.tokens);assert.equal(rows.length,2);
  assert.ok(rows.every(r=>r.token.actorLink===false));assert.ok(rows.every(r=>r.token.x===650&&r.token.y===850));
  const check=resolveCrewCheck(f.token,f.scene.tokens,"pilotingSpace");assert.equal(check.actor.system.skills.pilotingSpace.rank,2);assert.equal(check.setback,1);
  await deployPreparedCrew(f.token,f.ctx);assert.equal(f.scene.tokens.size,3);
  rows[0].token.flags[SYSTEM_ID].aboard=null;await deployPreparedCrew(f.token,f.ctx);assert.equal(f.scene.tokens.size,3);
  const copy={...f.token,id:"v2",flags:{},update:f.token.update};f.scene.tokens.set(copy.id,copy);
  await deployPreparedCrew(copy,f.ctx);assert.equal(crewRoster(copy,f.scene.tokens).length,2);
  assert.notEqual(crewRoster(copy,f.scene.tokens)[0].id,rows[0].id);
});
test("placed generation respects existing occupants and never writes a template roster",async()=>{
  const f=fixture();await generateVehicleCrew(f.token,{...recipe,counts:{pilot:1}},f.ctx);
  const pilot=crewRoster(f.token,f.scene.tokens)[0];
  await generateVehicleCrew(f.token,{...recipe,counts:{engineer:2}},f.ctx);
  assert.equal(crewRoster(f.token,f.scene.tokens).length,3);assert.equal(f.vehicle.flags[SYSTEM_ID],undefined);
  assert.equal(crewRoster(f.token,f.scene.tokens)[0].id,pilot.id);
  await assert.rejects(generateVehicleCrew(f.token,{...recipe,counts:{gunner:1}},f.ctx),/capacity/);
  assert.equal(f.created.length,3);
});
test("permissions and missing or changed prepared actors fail before any writes",async()=>{
  const f=fixture();await assert.rejects(generateVehicleCrew(f.vehicle,recipe,{...f.ctx,user:{isGM:false}}),/GM/);assert.equal(f.created.length,0);
  await generateVehicleCrew(f.vehicle,recipe,f.ctx);f.created[0].type="vehicle";
  await assert.rejects(deployPreparedCrew(f.token,f.ctx),/NPC|character/);assert.equal(f.scene.tokens.size,1);
  f.created[0].type="rival";f.ctx.actors.delete(f.created[0].id);
  await assert.rejects(deployPreparedCrew(f.token,f.ctx),/missing/i);assert.equal(f.scene.tokens.size,1);
});
test("a failed generation removes only its new actors and rolls back partially created crew tokens",async()=>{
  const f=fixture(),originalCreate=f.scene.createEmbeddedDocuments;
  let n=0;f.scene.createEmbeddedDocuments=async(...args)=>{if(++n===2)throw new Error("storage unavailable");return originalCreate(...args);};
  await assert.rejects(generateVehicleCrew(f.token,recipe,f.ctx),/storage/);
  assert.equal(f.scene.tokens.size,1);assert.ok(f.scene.tokens.has(f.token.id));assert.equal(f.ctx.actors.size,0);assert.equal(f.deleted.length,2);
});
test("a failed prepared-roster save removes newly generated actors",async()=>{
  const f=fixture();f.vehicle.update=async()=>{throw new Error("save failed");};
  await assert.rejects(generateVehicleCrew(f.vehicle,recipe,f.ctx),/save failed/);assert.equal(f.ctx.actors.size,0);
});
test("the transaction queue serializes generation on unplaced Actor documents",async()=>{
  const f=fixture(),calls=[];
  const service=new CrewTransactionCoordinator({currentUser:()=>f.ctx.user,users:()=>[f.ctx.user],execute:async(actor,command)=>{calls.push([actor.uuid,command]);return generateVehicleCrew(actor,{...recipe,counts:{pilot:1}},f.ctx);}});
  const result=await Promise.allSettled([service.request(f.vehicle,"generate",recipe),service.request(f.vehicle,"generate",recipe)]);
  assert.equal(result[0].status,"fulfilled");assert.equal(result[1].status,"rejected");assert.equal(f.created.length,1);assert.equal(calls.length,2);
});
