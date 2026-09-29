import {transactionWorld} from './fixtures/document-transactions.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_ID } from "../src/config.mjs";
import { executeCrewCommand, maskEmbarkedToken, crewBadgeHTML, crewManagementHTML, crewRowActor } from "../src/vehicle-crew-foundry.mjs";
import { CrewTransactionCoordinator } from "../src/crew-transactions.mjs";
import { aboard, occupantCount } from "../src/vehicle-crew.mjs";
import { automaticCheckPool, vehicleAttackDifficulty } from "../src/dice/builder.mjs";
import { activeCombatForActor } from "../src/turn-economy-foundry.mjs";
import { applyChatVisibility } from "../src/dice/foundry.mjs";

function put(object,path,value){const keys=path.split(".");let target=object;for(const k of keys.slice(0,-1))target=target[k]??={};target[keys.at(-1)]=structuredClone(value);}
test("crew list opens the specific embarked token actor and the world actor for prepared members",()=>{
  const world={name:"Template"},synthetic={name:"Independent occupant"},actors=new Map([["a",world]]),vehicle={parent:{tokens:new Map([["t",{actor:synthetic}]])}};
  assert.equal(crewRowActor({dataset:{crewToken:"t",crewActor:"a"}},vehicle,actors),synthetic);
  assert.equal(crewRowActor({dataset:{crewActor:"a"}},null,actors),world);
  assert.equal(crewRowActor({dataset:{crewToken:"missing",crewActor:"a"}},vehicle,actors),undefined);
});
test("Foundry 14 message modes preserve public, GM, blind and self roll visibility",()=>{
  const calls=[],current={applyMode:(data,mode)=>{calls.push(mode);return {...data,mode};}};
  for(const [legacy,mode] of Object.entries({publicroll:"public",gmroll:"gm",blindroll:"blind",selfroll:"self"}))
    assert.equal(applyChatVisibility({content:"test"},legacy,current).mode,mode);
  assert.deepEqual(calls,["public","gm","blind","self"]);
  assert.equal(applyChatVisibility({},"blindroll",{applyRollMode:(_data,mode)=>mode}),"blindroll");
});
function fixture() {
  const gm={id:"gm",isGM:true,active:true},player={id:"player",active:true};
  const tokens=new Map(),created=[];
  tokens[Symbol.iterator]=function*(){yield* this.values();};
  const scene={id:"scene",grid:{size:100},tokens,createEmbeddedDocuments:async(_type,data)=>{created.push(...structuredClone(data));return data;}};
  const make=(id,type="character",system={})=>{
    const t={id,uuid:`Scene.scene.Token.${id}`,name:id,actorId:id,actorLink:false,x:100,y:100,width:1,height:1,elevation:0,rotation:180,flags:{},delta:{system:{}},parent:scene};
    t.actor={id,uuid:`${t.uuid}.Actor.${id}`,type,system:{...system},canUserModify:u=>u.id===player.id,toObject:()=>({name:id,type,system:structuredClone(t.actor.system),items:[],effects:[],flags:{}})};
    t.toObject=()=>({id:t.id,_id:t.id,name:t.name,actorId:t.actorId,actorLink:t.actorLink,x:t.x,y:t.y,width:t.width,height:t.height,elevation:t.elevation,rotation:t.rotation,flags:structuredClone(t.flags),delta:structuredClone(t.delta)});
    t.update=async changes=>{for(const [k,v]of Object.entries(changes))put(t,k,v);if(t.delta?.system)t.actor.system={...t.actor.system,...t.delta.system};return t;};
    tokens.set(id,t);return t;
  };
  const vehicle=make("ship","vehicle",{crew:"1",passengers:"10",handling:2});vehicle.width=4;vehicle.height=4;
  return {gm,player,scene,make,vehicle,created};
}
test("the compact roster uses the assigned pilot portrait without exposing a hidden crew member",async()=>{
  const {gm,player,vehicle,make}=fixture(),pilot=make("pilot"),passenger=make("passenger"),old=globalThis.game;
  pilot.texture={src:"pilot-portrait.svg"};passenger.texture={src:"passenger-portrait.svg"};
  await executeCrewCommand(pilot,"board",{vehicleId:vehicle.id},gm);
  await executeCrewCommand(pilot,"role",{role:"pilot"},gm);
  await executeCrewCommand(passenger,"board",{vehicleId:vehicle.id,seat:"passenger"},gm);
  globalThis.game={user:player};
  try {
    const occupied=crewBadgeHTML(vehicle);
    assert.match(occupied,/pilot-portrait.svg/);assert.doesNotMatch(occupied,/passenger-portrait.svg/);
    assert.match(occupied,/2 aboard/);assert.match(occupied,/data-crew-command="roster"/);
    assert.doesNotMatch(occupied,/data-crew-command="role"/);
    pilot.hidden=true;
    const hidden=crewBadgeHTML(vehicle);
    assert.doesNotMatch(hidden,/pilot-portrait.svg/);assert.match(hidden,/No pilot assigned/);assert.match(hidden,/1 aboard/);
  }finally{globalThis.game=old;}
});
test("the full roster shows every visible occupant but only permits owned occupants to disembark",async()=>{
  const {gm,player,vehicle,make}=fixture(),a=make("own"),b=make("other"),old=globalThis.game;
  await executeCrewCommand(a,"board",{vehicleId:vehicle.id},gm);
  await executeCrewCommand(b,"board",{vehicleId:vehicle.id,seat:"passenger"},gm);
  b.actor.canUserModify=()=>false;
  globalThis.game={user:player};
  try {
    const html=crewManagementHTML(vehicle,[{id:a.id,token:a,name:"Own <pilot>",roles:[],seat:"crew",count:1},{id:b.id,token:b,name:"Other occupant",roles:[],seat:"passenger",count:1}],{manage:true});
    assert.match(html,/Own &lt;pilot&gt;/);assert.match(html,/Other occupant/);
    assert.match(html,/name="count-own"[^>]*value="0"(?![^>]*disabled)/);
    assert.match(html,/name="count-other"[^>]*disabled/);
    assert.match(html,/data-crew-command="role"/);
    assert.doesNotMatch(html,/Open character sheet/);
    assert.match(html,/data-crew-sheet data-crew-token="own"/);
  }finally{globalThis.game=old;}
});
test("live command path persists boarding, roles and departure without hiding or resizing original token data",async()=>{
  const {gm,vehicle,make,scene}=fixture(),p=make("pilot");
  await executeCrewCommand(p,"board",{vehicleId:vehicle.id,seat:"crew"},gm);
  assert.equal(aboard(p).vehicleId,"ship");assert.equal(p.width,1);assert.equal(p.hidden,undefined);
  await executeCrewCommand(p,"role",{role:"pilot"},gm);assert.deepEqual(aboard(p).roles,["pilot"]);
  vehicle.x=600;await executeCrewCommand(p,"leave",{point:{x:1100,y:300}},gm);
  assert.equal(aboard(p),null);assert.equal(p.x,1050);assert.equal(p.y,250);assert.equal(scene.tokens.size,2);
});
test("partial minion departure conserves group size, keeps wounds aboard and gives the new group its own actor delta",async()=>{
  const {gm,vehicle,make,created}=fixture(),p=make("troopers","minion",{groupSize:5,wounds:{value:6,max:5},skills:{gunnery:{group:true}}});
  await executeCrewCommand(p,"board",{vehicleId:vehicle.id,seat:"passenger"},gm);
  await executeCrewCommand(p,"split",{count:2,point:{x:900,y:900}},gm);
  assert.equal(created.length,1);assert.equal(p.actor.system.groupSize,3);assert.equal(p.actor.system.wounds.value,6);
  assert.equal(occupantCount(p),2);assert.equal(created[0].delta.system.groupSize,2);assert.equal(created[0].delta.system.wounds.value,0);
  assert.equal(created[0].delta.system.skills.gunnery.group,true);assert.equal(created[0].actorLink,false);
  assert.equal(created[0].flags[SYSTEM_ID].aboard,null);assert.equal(created[0]._id,undefined);assert.equal(aboard(p).seat,"passenger");
});
test("a failed split creation restores the original linked/unlinked token state",async()=>{
  const {gm,vehicle,make,scene}=fixture(),p=make("troopers","minion",{groupSize:5,wounds:{value:0,max:5}});
  p.delta.system=structuredClone(p.actor.system);p.actorLink=true;
  await executeCrewCommand(p,"board",{vehicleId:vehicle.id,seat:"passenger"},gm);
  scene.createEmbeddedDocuments=async()=>{throw new Error("storage unavailable");};
  await assert.rejects(executeCrewCommand(p,"split",{count:2},gm),/storage/);
  assert.equal(p.actor.system.groupSize,5);assert.equal(p.actorLink,true);assert.ok(aboard(p));
});
test("the GM authority serializes competing last-seat requests and rejects a role change by a non-owner",async()=>{
  const {gm,player,vehicle,make,scene}=fixture(),a=make("a"),b=make("b"),listeners=new Set();
  const socket={on:(_c,f)=>listeners.add(f),off:(_c,f)=>listeners.delete(f),emit:(_c,m)=>queueMicrotask(()=>{for(const f of listeners)f(structuredClone(m));})};
  const users=[gm,player],world=transactionWorld(users),getToken=uuid=>[a,b].find(t=>t.uuid===uuid),makeService=user=>new CrewTransactionCoordinator({transport:world.client(user).transport,currentUser:()=>user,users:()=>users,getToken,execute:executeCrewCommand}).start();
  const g=makeService(gm),p=makeService(player);
  try {
    const results=await Promise.allSettled([p.request(a,"board",{vehicleId:vehicle.id}),p.request(b,"board",{vehicleId:vehicle.id})]);
    assert.deepEqual(results.map(r=>r.status),["fulfilled","rejected"]);assert.match(results[1].reason.message,/full/i);
    assert.equal(Array.from(scene.tokens).filter(t=>aboard(t)).length,1);
    await assert.rejects(executeCrewCommand(a,"role",{role:"pilot"},{id:"other"}),/permission/);
  }finally{g.stop();p.stop();world.stop();}
});
test("off-canvas crew documents with read-only visibility are never treated as drawable tokens",async()=>{
  const {gm,vehicle,make}=fixture(),p=make("off-canvas pilot");
  await executeCrewCommand(p,"board",{vehicleId:vehicle.id},gm);
  Object.defineProperty(p,"visible",{get:()=>false});p.object=null;
  assert.doesNotThrow(()=>maskEmbarkedToken(p));
  assert.equal(Object.hasOwn(p,"renderable"),false);assert.ok(aboard(p));
});
test("canvas presentation hides both Foundry render layers only while a valid vehicle is present",async()=>{
  const {gm,vehicle,make,scene}=fixture(),p=make("pilot");
  await executeCrewCommand(p,"board",{vehicleId:vehicle.id},gm);
  const calls=[],token={document:p,controlled:true,visible:true,renderable:true,mesh:{visible:true},release(){this.controlled=false;},renderFlags:{set:f=>calls.push(f)}};
  maskEmbarkedToken(token);assert.equal(token.visible,false);assert.equal(token.mesh.visible,false);assert.equal(token.controlled,false);
  scene.tokens.delete(vehicle.id);maskEmbarkedToken(token);assert.equal(token.renderable,true);assert.deepEqual(calls,[{refreshVisibility:true}]);
});
test("vehicle handling enters pools before talent removal; silhouette controls attacks without bypassing weapon reach",()=>{
  assert.deepEqual([-3,-2,-1,0,1,2,3,4,5].map(d=>vehicleAttackDifficulty(5,5-d)),[1,1,2,2,2,3,4,5,5]);
  const piloting=automaticCheckPool({characteristic:3,rank:2,difficulty:2,skill:"pilotingSpace",boost:2});
  assert.equal(piloting.pool.proficiency,2);assert.equal(piloting.pool.ability,1);assert.equal(piloting.pool.boost,2);
  const attack=automaticCheckPool({characteristic:3,rank:2,skill:"gunnery",vehicleAttack:true,attackerSilhouette:4,targetSilhouette:2,rangeBand:"long",weaponRange:"long"});
  assert.equal(attack.pool.difficulty,3);assert.equal(attack.error,"");
  assert.match(automaticCheckPool({characteristic:3,rank:2,skill:"gunnery",vehicleAttack:true,attackerSilhouette:4,targetSilhouette:4,rangeBand:"long",weaponRange:"short"}).error,/beyond/);
});
test("crew rolls consume their own round budget when only the ship is in combat",async()=>{
  const {gm,vehicle,make,scene}=fixture(),p=make("pilot"),old=globalThis.game;
  await executeCrewCommand(p,"board",{vehicleId:vehicle.id},gm);
  const combat={started:true,round:2,scene,combatants:[{tokenId:vehicle.id,token:vehicle,actor:vehicle.actor}]};
  globalThis.game={combat,combats:[combat]};
  try{assert.equal(activeCombatForActor(p.actor),combat);assert.equal(activeCombatForActor(make("outside").actor),null);}
  finally{globalThis.game=old;}
});
