import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingSymbols, planSpend, planActorEffect, planUndo, planSlotClaim, planSessionAward } from '../src/tabletop-workflows.mjs';
const gm={id:'gm',isGM:true,active:true};
const pc={id:'p',isGM:false,active:true};
const actor=(extra={})=>({id:'a',uuid:'Actor.a',name:'Hero',type:'character',hasPlayerOwner:true,system:{wounds:{value:3,max:12},strain:{value:4,max:10},soak:2,xp:{available:10,total:30},credits:50,criticals:[],obligation:{value:10},duty:{value:2},morality:{value:50,conflict:2}},flags:{},testUserPermission:u=>u.id==='p',...extra});
const source={book:'Test table ruling',page:'12',verification:'gm-reviewed'};
const effect={kind:'damage',amount:8,pierce:1,breach:0,scale:'personal',source,note:'Blaster hit'};
test('symbols preserve Triumph and Despair independently and refund only undone spends',()=>{
 assert.deepEqual(remainingSymbols({advantage:3,threat:0,triumph:1,despair:1},[{cost:{advantage:2}},{cost:{triumph:1},undone:true}]),{advantage:1,threat:0,triumph:1,despair:1});
});
test('spending requires a reviewed reference and sufficient uncancelled symbols',()=>{
 assert.throws(()=>planSpend({advantage:1},[],{cost:{advantage:2},label:'Recover',source}),/enough/);
 assert.throws(()=>planSpend({advantage:1},[],{cost:{advantage:1},label:'Recover',source:{}}),/source/);
 assert.throws(()=>planSpend({advantage:1},[],{cost:{success:1},label:'bad',source}),/symbol/);
 assert.equal(planSpend({advantage:1},[],{cost:{advantage:1},label:'Recover',source}).cost.advantage,1);
});
test('damage preview respects soak and strain routing and forbids unknown cross-scale rules',()=>{
 const plan=planActorEffect(actor(),effect,{user:gm});assert.equal(plan.after['system.wounds.value'],10);
 assert.equal(planActorEffect(actor({type:'rival'}),{...effect,strain:true},{user:gm}).after['system.wounds.value'],10);
 assert.throws(()=>planActorEffect(actor(),{...effect,scale:'vehicle'},{user:gm}),/cross-scale/);
 assert.throws(()=>planActorEffect(actor(),effect,{user:pc}),/GM/);
});
test('incomplete profiles cannot be damaged and recovery never underflows',()=>{
 assert.throws(()=>planActorEffect(actor({system:{incomplete:['soak']}}),effect,{user:gm}),/missing/);
 assert.equal(planActorEffect(actor(),{kind:'recover',resource:'strain',amount:99,source},{user:gm}).after['system.strain.value'],0);
});
test('undo refuses to overwrite later unrelated changes and preserves before values',()=>{
 const a=actor(),plan=planActorEffect(a,effect,{user:gm});
 assert.throws(()=>planUndo(a,plan),/changed/);
 a.system.wounds.value=10;assert.equal(planUndo(a,plan)['system.wounds.value'],3);
});
test('session award increases available and total XP and checks enabled story mechanics',()=>{
 const p=planSessionAward(actor(),{xp:5,credits:7,downtime:'Repairs',story:{obligation:2},source},{user:gm,campaign:{obligation:true}});
 assert.equal(p.after['system.xp.available'],15);assert.equal(p.after['system.xp.total'],35);assert.equal(p.after['system.credits'],57);assert.equal(p.after['system.obligation.value'],12);
 assert.throws(()=>planSessionAward(actor(),{xp:2,story:{morality:2},source},{user:gm,campaign:{morality:false}}),/disabled/);
});
test('slot claims require participation, side, ownership, current round and a free slot',()=>{
 const a=actor(),combat={id:'c',round:2,started:true,combatants:[{id:'slot',actor:a,actorId:'a',tokenId:'t',flags:{'star-wars-ffg':{slotSide:'pc'}}}],flags:{}};
 const request={slotId:'slot',round:2,actorUuid:a.uuid};
 const p=planSlotClaim(combat,a,request,{user:pc});assert.equal(p.claim.actorUuid,a.uuid);
 assert.throws(()=>planSlotClaim(combat,a,{...request,round:1},{user:pc}),/round/);
 assert.throws(()=>planSlotClaim(combat,actor({uuid:'Actor.other',id:'other'}),request,{user:pc}),/participant/);
 combat.flags={'star-wars-ffg':{slotClaims:[p.claim]}};
 assert.throws(()=>planSlotClaim(combat,a,request,{user:pc}),/already|claimed/);
});
test('GM reassignment replaces the slot claim but still forbids two turns for one participant',()=>{
 const a=actor(),other=actor({id:'b',uuid:'Actor.b'}),combat={id:'c',round:2,started:true,combatants:[{id:'s1',actor:a,actorId:'a',flags:{'star-wars-ffg':{slotSide:'pc'}}},{id:'s2',actor:other,actorId:'b',flags:{'star-wars-ffg':{slotSide:'pc'}}}],flags:{'star-wars-ffg':{slotClaims:[{round:2,actorUuid:'Actor.b',slotId:'s1'}]}}};
 assert.equal(planSlotClaim(combat,a,{slotId:'s1',round:2,reassign:true},{user:gm}).claims.length,1);
 assert.throws(()=>planSlotClaim(combat,other,{slotId:'s2',round:2,reassign:true},{user:gm}),/already/);
});
test('critical, condition and vehicle state changes remain reversible without inferred modifiers',()=>{
 const a=actor();const critical=planActorEffect(a,{kind:'critical',label:'Reviewed injury',entryId:'crit',source},{user:gm});
 assert.equal(critical.after['system.criticals'][0].automation,'record-only');
 assert.deepEqual(Object.keys(critical.after),['system.criticals']);
 const condition=planActorEffect(a,{kind:'condition',label:'Pinned',entryId:'condition',source},{user:gm});
 assert.equal(condition.after['flags.star-wars-ffg.conditions'][0].name,'Pinned');
 const ship=actor({type:'vehicle',system:{speed:{value:1,max:3},shields:{fore:1,aft:0,port:0,starboard:0}}});
 assert.equal(planActorEffect(ship,{kind:'vehicle-state',speed:2,shields:{fore:2},source},{user:gm}).after['system.speed.value'],2);
 assert.throws(()=>planActorEffect(ship,{kind:'vehicle-state',speed:4,source},{user:gm}),/Speed/);
 assert.throws(()=>planActorEffect(ship,{kind:'vehicle-state',shields:{up:2},source},{user:gm}),/zone/);
});
test('filtered source options, malformed amounts, disabled story rules and overflow fail closed',()=>{
 assert.throws(()=>planActorEffect(actor(),effect,{user:gm,campaign:{bookMode:'owned',books:['Different book']}}),/excluded/);
 assert.throws(()=>planActorEffect(actor(),{...effect,amount:NaN},{user:gm}),/whole number/);
 assert.throws(()=>planActorEffect(actor(),{...effect,pierce:-1},{user:gm}),/whole number/);
 assert.throws(()=>planSessionAward(actor(),{story:{morality:99},source},{user:gm,campaign:{morality:true}}),/whole number/);
 assert.throws(()=>planSessionAward(actor(),{xp:-1,source},{user:gm}),/whole number/);
});
test('players cannot claim passed or unrolled slots and empty minion groups cannot act',()=>{
 const a=actor(),combat={id:'c',round:2,turn:1,started:true,combatants:[{id:'slot',actor:a,initiative:2,flags:{'star-wars-ffg':{slotSide:'pc'}}}],flags:{}};
 const request={slotId:'slot',round:2};
 assert.throws(()=>planSlotClaim(combat,a,request,{user:pc}),/passed/);
 combat.turn=0;combat.combatants[0].initiative=null;
 assert.throws(()=>planSlotClaim(combat,a,request,{user:pc}),/Roll initiative/);
 const minion=actor({type:'minion',system:{groupSize:2,wounds:{value:11,max:5}}});combat.combatants[0].actor=minion;
 assert.throws(()=>planSlotClaim(combat,minion,request,{user:pc}),/defeated/);
});

test('passed-slot validation follows initiative order when combatant insertion differs',()=>{
 const a=actor(),other=actor({id:'b',uuid:'Actor.b'});
 const low={id:'low',actor:a,initiative:1},high={id:'high',actor:other,initiative:5};
 const combat={round:2,turn:1,started:true,combatants:[low,high],turns:[high,low],flags:{}};
 assert.throws(()=>planSlotClaim(combat,a,{slotId:'high',round:2},{user:pc}),/passed/);
 assert.equal(planSlotClaim(combat,a,{slotId:'low',round:2},{user:pc}).claim.slotId,'low');
});
