import test from "node:test";
import assert from "node:assert/strict";
import { registerMinionGroups } from "../src/minion-groups-foundry.mjs";
import { rollPool } from "../src/dice/foundry.mjs";
const sid="star-wars-ffg";
test("real actor damage and roll entry points follow the linked group and combat adds only one slot",async()=>{
 const keys=["Actor","Item","Combat","game","Hooks","ui","foundry"],original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const hooks=new Map(),warnings=[];
 globalThis.Actor=class{};globalThis.Item=class{};
 globalThis.Combat=class{async createEmbeddedDocuments(_type,data){return data;}};
 globalThis.Hooks={on:(key,fn)=>hooks.set(key,fn)};
 globalThis.ui={notifications:{warn:m=>warnings.push(m)}};
 const scene={id:"scene",tokens:[]},actors=new Map();
 globalThis.game={user:{id:"gm",isGM:true},actors,scenes:new Map([[scene.id,scene]])};
 try {
  const {StarWarsActor}=await import("../src/documents.mjs"),{StarWarsCombat}=await import("../src/combat.mjs");
  const actor=Object.assign(new StarWarsActor(),{id:"group",isOwner:true,type:"minion",items:[],
   system:{groupSize:3,wounds:{value:0,max:10},soak:2,skills:{rangedHeavy:{group:true,rank:0}}},
   flags:{[sid]:{minionGroup:{sceneId:scene.id,memberIds:["a","b","c"],inactive:[]}}},
   async update(update){if(update["system.wounds.value"]!==undefined)this.system.wounds.value=update["system.wounds.value"];}});
  actors.set(actor.id,actor);scene.tokens=["a","b","c"].map(id=>({id,parent:scene,actorId:actor.id,flags:{[sid]:{minionGroupId:actor.id}}}));
  assert.equal(actor.skillRank("rangedHeavy"),2);
  const injury=await actor.applyDamage(11,{ignoreSoak:true});assert.equal(injury.exceedsThreshold,false);assert.equal(actor.skillRank("rangedHeavy"),1);
  const defeat=await actor.applyDamage(20,{ignoreSoak:true});assert.equal(defeat.exceedsThreshold,true);assert.equal(actor.skillRank("rangedHeavy"),0);
  globalThis.foundry={dice:{Roll:class{constructor(){throw Error("Dice evaluated unexpectedly");}}}};
  await assert.rejects(rollPool({ability:2},{actor}),/no active members/);
  actor.system.wounds.value=0;assert.equal(actor.skillRank("rangedHeavy"),2);
  const combat=Object.assign(new StarWarsCombat(),{combatants:[]}),data=[{actorId:"group",tokenId:"a"},{actorId:"group",tokenId:"b"},{actorId:"other",tokenId:"d"}];
  assert.deepEqual(await combat.createEmbeddedDocuments("Combatant",data),[data[0],data[2]]);
  combat.combatants=[data[0]];assert.deepEqual(await combat.createEmbeddedDocuments("Combatant",data),[data[2]]);
  registerMinionGroups();assert.equal(hooks.get("preCreateCombatant")({actor,parent:{combatants:[{actorId:actor.id}]}}),false);
  assert.equal(hooks.get("preCreateToken")({actor}),false);assert.equal(warnings.length,2);
 }finally{for(const key of keys)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];}
});
