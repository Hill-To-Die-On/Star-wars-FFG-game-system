import test from "node:test";
import assert from "node:assert/strict";
import { minionGroupState, minionLinkEdges, validateMinionMembers, createMinionGroup, reconcileMinionMembers, minionMoveUpdate } from "../src/minion-groups.mjs";
import { turnBudget, turnUpdate } from "../src/turn-economy.mjs";
const sid="star-wars-ffg",base=()=>({type:"minion",name:"Patrol",system:{groupSize:1,wounds:{value:0,max:5},soak:3,characteristics:{brawn:2},skills:{rangedHeavy:{rank:0,group:true}}},items:[],toObject(){return {type:this.type,name:this.name,system:structuredClone(this.system),items:[]};}});
const scene={id:"scene",async updateEmbeddedDocuments(_kind,updates){this.updates=updates;return updates;}};
const members=()=>["a","b","c"].map((id,i)=>({id,parent:scene,actor:base(),actorId:"template",actorLink:false,flags:{},x:i*100,y:0}));
const group=(tokens,wounds=0)=>({id:"group",type:"minion",system:{groupSize:3,wounds:{value:wounds,max:5}},flags:{[sid]:{minionGroup:{sceneId:"scene",memberIds:tokens.map(t=>t.id),inactive:[]}}}});
test("pooled wounds remove members only above thresholds, and healing restores membership",()=>{
 const tokens=members(),actor=group(tokens);tokens.forEach(t=>{t.actor=actor;t.actorId=actor.id;t.flags={[sid]:{minionGroupId:actor.id}};});
 assert.equal(minionGroupState(actor,tokens).remaining,3);
 actor.system.wounds.value=5;assert.equal(minionGroupState(actor,tokens).remaining,3);
 actor.system.wounds.value=6;assert.deepEqual(minionGroupState(actor,tokens).active.map(t=>t.id),["b","c"]);
 assert.equal(minionGroupState(actor,tokens).rank,1);
 actor.system.wounds.value=16;assert.equal(minionGroupState(actor,tokens).remaining,0);
 actor.system.wounds.value=0;assert.equal(minionGroupState(actor,tokens).remaining,3);
 actor.flags[sid].minionGroup.inactive=["b"];assert.deepEqual(minionGroupState(actor,tokens).active.map(t=>t.id),["a","c"]);
 actor.flags[sid].minionGroup.inactive=[];assert.equal(minionGroupState(actor,tokens).remaining,3);
 assert.deepEqual(actor.flags[sid].minionGroup.memberIds,["a","b","c"]);
});
test("visible connection tree omits hidden members and uses only n-1 links",()=>{
 const points=[{id:"a",x:0,y:0},{id:"b",x:10,y:0},{id:"c",x:100,y:0}];
 assert.deepEqual(minionLinkEdges(points).map(([a,b])=>[a.id,b.id]),[["a","b"],["b","c"]]);
 assert.equal(minionLinkEdges([]).length,0);assert.equal(minionLinkEdges(points.slice(0,1)).length,0);
 const tokens=members(),actor=group(tokens);tokens.forEach(t=>{t.actorId=actor.id;t.flags={[sid]:{minionGroupId:actor.id}};});tokens[1].hidden=true;
 assert.deepEqual(minionGroupState(actor,tokens,{visibleOnly:true,isGM:false}).visible.map(t=>t.id),["a","c"]);
 assert.equal(minionGroupState(actor,tokens,{visibleOnly:true,isGM:false}).remaining,3);
});
test("only compatible unwounded single members can form a group",()=>{
 assert.equal(validateMinionMembers(members()).length,3);
 const damaged=members();damaged[1].actor.system.wounds.value=1;assert.throws(()=>validateMinionMembers(damaged),/unwounded/);
 const different=members();different[1].actor.system.soak=9;assert.throws(()=>validateMinionMembers(different),/same/);
 const aboard=members();aboard[0].flags={[sid]:{aboard:{vehicleId:"ship"}}};assert.throws(()=>validateMinionMembers(aboard),/aboard/);
 assert.throws(()=>validateMinionMembers([members()[0]]),/2/);
});
test("group creation binds a fresh shared actor, preserving source actors and permissions",async()=>{
 const tokens=members();let source;
 const made=await createMinionGroup(tokens,"Patrol",{user:{isGM:true},createActor:async data=>{source=data;return {id:"new",...data};},deleteActor:async()=>{throw Error("Unexpected rollback");}});
 assert.equal(made.id,"new");assert.equal(source.system.groupSize,3);assert.equal(tokens[0].actor.system.groupSize,1);
 assert.deepEqual(source.flags[sid].minionGroup.memberIds,["a","b","c"]);
 assert.ok(scene.updates.every(u=>u.actorId==="new"&&u.actorLink===true&&u[`flags.${sid}.minionGroupId`]==="new"));
 await assert.rejects(()=>createMinionGroup(tokens,"x",{user:{isGM:false}}),/GM/);
});
test("failed attachment rolls back token bindings before removing only the new group actor",async()=>{
 const tokens=members(),calls=[];let n=0;const original=scene.updateEmbeddedDocuments;
 scene.updateEmbeddedDocuments=async(_k,updates)=>{calls.push(updates);if(n++===0)throw Error("attachment failed");};
 try {await assert.rejects(()=>createMinionGroup(tokens,"Patrol",{user:{isGM:true},createActor:async()=>({id:"new"}),deleteActor:async a=>calls.push(a.id)}),/attachment failed/);
 assert.equal(calls[1][0].actorId,"template");assert.equal(calls[2],"new");}
 finally{scene.updateEmbeddedDocuments=original;}
});
test("removing a casualty preserves survivors and their remaining wound damage",()=>{
 const tokens=members(),actor=group(tokens,6);tokens.forEach(t=>{t.actorId=actor.id;t.flags={[sid]:{minionGroupId:actor.id}};});
 const update=reconcileMinionMembers(actor,tokens.slice(1));
 assert.equal(update["system.wounds.value"],1);
 assert.equal(update["system.groupSize"],2);
 actor.system.wounds.value=update["system.wounds.value"];actor.flags[sid].minionGroup=update[`flags.${sid}.minionGroup`];
 assert.equal(minionGroupState(actor,tokens.slice(1)).remaining,2);
 assert.deepEqual(reconcileMinionMembers(actor,tokens.slice(1)),{});
 const healthy=reconcileMinionMembers(actor,tokens.slice(2));
 assert.equal(healthy["system.wounds.value"],1);
});
test("individual token drags share each group manoeuvre, persist replay protection, and respect limits",()=>{
 const tokens=members(),actor=group(tokens),key="combat:1";
 actor.items=[];tokens.forEach(t=>{t.actorId=actor.id;t.flags={[sid]:{minionGroupId:actor.id}};});
 const apply=update=>{if(update[`flags.${sid}.turnEconomy`])actor.flags[sid].turnEconomy=update[`flags.${sid}.turnEconomy`];};
 const move=(id,op)=>minionMoveUpdate(actor,minionGroupState(actor,tokens),id,{key,operationId:op});
 apply(move("a","a1"));assert.equal(turnBudget(actor,{key}).spent.maneuvers,1);
 apply(move("b","b1"));apply(move("c","c1"));assert.equal(turnBudget(actor,{key}).spent.maneuvers,1);
 assert.deepEqual(move("b","b1"),{});
 assert.throws(()=>move("a","a2"),/manoeuvre/);
 apply(turnUpdate(actor,"tradeManeuver",{key}));apply(move("a","a2"));apply(move("b","b2"));
 assert.equal(turnBudget(actor,{key}).spent.maneuvers,2);
 assert.throws(()=>move("a","a3"),/limit/);
 actor.flags[sid].minionGroup.inactive=["c"];
 assert.throws(()=>move("c","c2"),/active/);
 assert.throws(()=>move("foreign","f1"),/active/);
 assert.ok(Object.keys(minionMoveUpdate(actor,minionGroupState(actor,tokens),"a",{key:"combat:2",operationId:"new"})).length);
});
