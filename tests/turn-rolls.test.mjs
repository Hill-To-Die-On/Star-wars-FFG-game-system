import test from "node:test";
import assert from "node:assert/strict";
import { registerTurnEconomy, readTurnBudget, performTurnCommand, turnCostHTML } from "../src/turn-economy-foundry.mjs";
import { rollPool } from "../src/dice/foundry.mjs";

test("Foundry roll and movement entry points commit the same actor ledger",async t=>{
  const original=Object.fromEntries(["game","Hooks","foundry","ChatMessage","ui","fromUuid","canvas"].map(k=>[k,globalThis[k]]));
  const hooks=new Map(), settings=new Map(), messages=[], documents=new Map(), warnings=[];
  const emit=(name,...args)=>{for(const fn of hooks.get(name)??[])fn(...args);};
  const until=async test=>{for(let i=0;i<100;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,2));}throw new Error('Turn receipt did not settle');};
  const actor={id:"pc",uuid:"Actor.pc",type:"character",name:"Pilot",flags:{},items:[],
    system:{strain:{value:0,max:12}},canUserModify:u=>["owner","gm"].includes(u.id),
    update:async updates=>{for(const [path,value] of Object.entries(updates)) {
      const parts=path.split(".");let target=actor;
      for(const key of parts.slice(0,-1)) target=target[key]??={};
      target[parts.at(-1)]=value;
    }}
  };
  const gm={id:"gm",isGM:true,active:true}, combat={id:"fight",started:true,round:1,combatants:[{actor}]};
  let failure=false,evaluations=0,advanceDuringRoll=false;
  globalThis.game={user:gm,users:[gm],combat,combats:[combat],actors:[],socket:{on(){},off(){}},
    settings:{get:(_s,k)=>settings.get(k),set:async(_s,k,v)=>{settings.set(k,v);emit("updateSetting",{});return v;},register:(_s,k,d)=>settings.set(k,d.default)}};
  globalThis.Hooks={callAll:emit,on:(k,f)=>{const a=hooks.get(k)??[];a.push(f);hooks.set(k,a);return f;},off:(k,f)=>hooks.set(k,(hooks.get(k)??[]).filter(row=>row!==f)),once:(k,f)=>globalThis.Hooks.on(k,f)};
  globalThis.ui={notifications:{warn:m=>warnings.push(m)}};
  globalThis.foundry={utils:{randomID:()=>"test-roll-id"},dice:{Roll:class {
    constructor(formula) {this.formula=formula;this.options={};this.dice=[];}
    async evaluate(){evaluations++;if(failure) throw new Error("Evaluation failed");if(advanceDuringRoll) combat.round++;return this;}
  }}};
  globalThis.ChatMessage={getSpeaker:()=>({actor:actor.id}),applyRollMode:data=>data,
    create:async data=>{if(data.flags?.['star-wars-ffg']?.authorityRequest||data.flags?.['star-wars-ffg']?.authorityResponse){const id='receipt-'+documents.size,doc={...data,id,uuid:'ChatMessage.'+id,author:game.user};documents.set(doc.uuid,doc);emit('createChatMessage',doc,{},game.user.id);return doc;}return messages.push({data,actions:readTurnBudget(actor).actionsRemaining});}};
  globalThis.fromUuid=async uuid=>uuid===actor.uuid?actor:documents.get(uuid);
  try {
    registerTurnEconomy();for(const f of hooks.get("ready")) f();
    await (await import("../src/document-transactions.mjs")).getDocumentTransactionBroker().takeAuthority("Fixture explicitly selects this GM tab");
    await t.test("a completed check spends before publishing and rejects an exhausted action before evaluating",async()=>{
      assert.match(turnCostHTML(actor),/Incidental \/ already spent/);
      await rollPool({ability:1},{actor,turnCost:"action"});
      assert.equal(messages[0].actions,0);
      assert.equal(readTurnBudget(actor).actionsRemaining,0);
      const before=evaluations;
      await assert.rejects(rollPool({ability:1},{actor,turnCost:"action"}),/No action/);
      assert.equal(evaluations,before);
    });
    await t.test("initiative/incidental, disabled automation and rolls outside combat do not spend",async()=>{
      await performTurnCommand(actor,"reset");
      await rollPool({ability:1},{actor,turnCost:"none"});
      settings.set("automaticTurnRolls",false);
      await rollPool({ability:1},{actor,turnCost:"action"});
      settings.set("automaticTurnRolls",true);combat.started=false;
      await rollPool({ability:1},{actor,turnCost:"action"});
      combat.started=true;
      assert.equal(readTurnBudget(actor).actionsRemaining,1);
    });
    await t.test("free play indicators replenish when the active scene changes",async()=>{
      combat.started=false;
      globalThis.canvas={scene:{id:"hangar"}};
      await performTurnCommand(actor,"action");
      assert.equal(readTurnBudget(actor).actionsRemaining,0);
      globalThis.canvas.scene={id:"perimeter"};
      assert.equal(readTurnBudget(actor).actionsRemaining,1);
      assert.equal(readTurnBudget(actor).key,"freeplay:perimeter");
      combat.started=true;
      delete globalThis.canvas;
    });
    await t.test("a recorded GM condition changes the next matching pool and leaves other skills alone",async()=>{
      actor.flags['star-wars-ffg'].conditions=[{id:'optic',name:'Damaged optic',modifier:{die:'setback',count:1,skillKey:'rangedLight'}}];
      await rollPool({ability:1},{actor,skillKey:'rangedLight',turnCost:'none'});
      assert.match(messages.at(-1).data.rolls[0].formula,/1ds/);
      assert.match(messages.at(-1).data.content,/Damaged optic/);
      await rollPool({ability:1},{actor,skillKey:'computers',turnCost:'none'});
      assert.doesNotMatch(messages.at(-1).data.rolls[0].formula,/1ds/);
      actor.flags['star-wars-ffg'].conditions=[];
    });
    await t.test("a GM tab without authority cannot roll a pending narrative effect",async()=>{
      const {getDocumentTransactionBroker}=await import("../src/document-transactions.mjs");
      actor.flags['star-wars-ffg'].narrativeEffects=[{id:'pending',label:'GM boost',die:'boost',count:1,skillKey:'computers'}];
      const before=evaluations;
      settings.set('authoritySession',{userId:gm.id,sessionId:'another-gm-tab'});
      try {
        await assert.rejects(rollPool({ability:1},{actor,skillKey:'computers',turnCost:'none'}),/Transaction authority/);
        assert.equal(evaluations,before);
      } finally {
        actor.flags['star-wars-ffg'].narrativeEffects=[];
        await getDocumentTransactionBroker().takeAuthority('Fixture returns authority to this GM tab');
      }
    });
    await t.test("failed evaluation never spends",async()=>{
      failure=true;
      await assert.rejects(rollPool({ability:1},{actor,turnCost:"action"}),/Evaluation failed/);
      failure=false;assert.equal(readTurnBudget(actor).actionsRemaining,1);
    });
    await t.test("a round changing during evaluation cannot charge the new round",async()=>{
      const before=messages.length;
      advanceDuringRoll=true;
      await assert.rejects(rollPool({ability:1},{actor,turnCost:"action"}),/round changed/);
      advanceDuringRoll=false;
      assert.equal(messages.length,before);
      assert.equal(readTurnBudget(actor).actionsRemaining,1);
      combat.round=1;
      const {getDocumentTransactionBroker}=await import("../src/document-transactions.mjs");
      for(const [key,row]of Object.entries(settings.get("authorityReceipts")??{}))if(row.status==="review")await getDocumentTransactionBroker().acknowledge(key,"No actor write occurred; round changed before execution");
    });
    await t.test("one committed drag spends once, replay is idempotent, and buying a light enables the next drag",async()=>{
      const doc={actor},move={id:"one",method:"dragging",origin:{x:0,y:0},destination:{x:100,y:0}};
      const before=hooks.get("preMoveToken")[0],after=hooks.get("moveToken")[0];
      assert.notEqual(before(doc,move,{}),false);
      after(doc,move,{},gm);await until(()=>readTurnBudget(actor).freeRemaining===0);
      assert.equal(readTurnBudget(actor).freeRemaining,0);
      after(doc,move,{},gm);await new Promise(setImmediate);
      assert.equal(readTurnBudget(actor).spent.maneuvers,1);
      assert.equal(before(doc,{...move,id:"two"},{}),false);
      await performTurnCommand(actor,"buyManeuver");assert.equal(actor.system.strain.value,2);
      assert.notEqual(before(doc,{...move,id:"two"},{}),false);
      after(doc,{...move,id:"two"},{},gm);await until(()=>readTurnBudget(actor).spent.maneuvers===2);
      assert.equal(readTurnBudget(actor).spent.maneuvers,2);
    });
    await t.test("round advance restores lights without removing strain and rewind restores spending",()=>{
      combat.round=2;assert.equal(readTurnBudget(actor).freeRemaining,1);
      assert.equal(actor.system.strain.value,2);
      combat.round=1;assert.equal(readTurnBudget(actor).spent.maneuvers,2);
    });
    await t.test("GM-only mode is the registered default and rejects a player reset before dispatch",async()=>{
      assert.equal(settings.get("turnTrackerControl"),"gm");
      game.user={id:"owner",active:true};
      await assert.rejects(performTurnCommand(actor,"reset"),/GM/);
      game.user=gm;
    });
    await t.test("linked member movement uses the authoritative shared ledger, not one manoeuvre per token",async()=>{
      const sid="star-wars-ffg",scene={id:"minion-scene",tokens:[]};
      actor.type="minion";actor.system.wounds={value:0,max:10};actor.system.groupSize=3;
      actor.flags[sid].minionGroup={sceneId:scene.id,memberIds:["a","b","c"],inactive:[]};
      scene.tokens=["a","b","c"].map(id=>({id,actor,parent:scene,actorId:actor.id,flags:{[sid]:{minionGroupId:actor.id}}}));
      game.scenes=new Map([[scene.id,scene]]);combat.round=3;
      const before=hooks.get("preMoveToken")[0],after=hooks.get("moveToken")[0];
      const move={id:"shared-batch",method:"dragging",origin:{x:0,y:0},destination:{x:100,y:0}};
      for(const doc of scene.tokens){assert.notEqual(before(doc,move,{}),false);after(doc,move,{},gm);await until(()=>Object.values(settings.get("authorityReceipts")??{}).some(r=>r.id===`move:${doc.id}:${move.id}`&&r.status==="complete"));}
      assert.equal(readTurnBudget(actor).spent.maneuvers,1);
      assert.equal(before(scene.tokens[0],{...move,id:"again"},{}),false);
      actor.flags[sid].minionGroup.inactive=["b"];combat.round=4;
      assert.equal(before(scene.tokens[1],{...move,id:"out"},{}),false);
    });
  } finally {for(const [key,value] of Object.entries(original)) {
    if(value===undefined) delete globalThis[key];else globalThis[key]=value;
  }}
});
