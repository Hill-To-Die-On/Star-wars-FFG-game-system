import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingSymbols, planSpend, spendableSymbols, planActorEffect, planUndo, planSlotClaim, planSessionAward, weaponForRecordedRoll, tabletopSourceDefaults, damageResolutionDefaults } from '../src/tabletop-workflows.mjs';
const gm={id:'gm',isGM:true,active:true};
const pc={id:'p',isGM:false,active:true};
const actor=(extra={})=>({id:'a',uuid:'Actor.a',name:'Hero',type:'character',hasPlayerOwner:true,system:{wounds:{value:3,max:12},strain:{value:4,max:10},soak:2,xp:{available:10,total:30},credits:50,criticals:[],obligation:{value:10},duty:{value:2},morality:{value:50,conflict:2}},flags:{},testUserPermission:u=>u.id==='p',...extra});
const source={book:'Test table ruling',page:'12',verification:'gm-reviewed'};
const effect={kind:'damage',amount:8,pierce:1,breach:0,scale:'personal',source,note:'Blaster hit'};
test('Force pips can be reviewed and spent once without inventing other symbols',()=>{
 const outcome={advantage:0,threat:0,triumph:0,despair:0,light:1,dark:0};
 assert.deepEqual(spendableSymbols(outcome),['advantage','threat','triumph','despair','light']);
 const entry=planSpend(outcome,[],{label:'Move a shard',note:'One light pip moves a small unsecured shard.',cost:{light:1},source});
 assert.equal(entry.cost.light,1);
 assert.equal(remainingSymbols(outcome,[entry]).light,0);
 assert.throws(()=>planSpend(outcome,[entry],{label:'Use it again',cost:{light:1},source}),/Not enough light/);
 assert.throws(()=>planSpend(outcome,[],{label:'Fabricate darkness',cost:{dark:1},source}),/Unknown narrative symbol/);
});
test('a fresh GM decision uses an explicit session ruling while verified book sources are retained',()=>{
 const ruling=tabletopSourceDefaults({},'Outpost 07 — Perimeter Run');
 assert.deepEqual(ruling,{book:'GM table ruling',page:'Outpost 07 — Perimeter Run',verification:'gm-ruling'});
 assert.equal(planSpend({threat:1},[],{label:'Noise',cost:{threat:1},source:ruling}).source.page,'Outpost 07 — Perimeter Run');
 assert.deepEqual(tabletopSourceDefaults(source,'Other scene'),source);
});
test('a noncombat skill roll never prompts for an owned weapon',()=>{
 const shooter={name:'Tala',items:[{type:'weapon',name:'Blaster Pistol'}]};
 assert.equal(weaponForRecordedRoll(shooter,{flavor:'Tala · Computers'}),null);
 assert.equal(weaponForRecordedRoll(shooter,{flavor:'Tala · Blaster Pistol'}),shooter.items[0]);
});
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
test('a personal weapon hit on a vehicle starts at zero hull damage and needs reviewed conversion',()=>{
 const skiff=actor({type:'vehicle',system:{hullTrauma:{value:0,max:8},systemStrain:{value:0,max:7},armor:0}});
 const carbine={system:{scale:'personal'},damageFor:()=>9};
 const defaults=damageResolutionDefaults(carbine,'vehicle',{passed:true,success:2});
 assert.deepEqual(defaults,{sourceScale:'personal',sourceAmount:9,amount:0,requiresConversion:true});
 const request={...effect,scale:'vehicle',amount:defaults.amount,pierce:0,crossScale:{sourceScale:defaults.sourceScale,sourceAmount:defaults.sourceAmount,reviewed:false}};
 assert.throws(()=>planActorEffect(skiff,request,{user:gm}),/cross-scale.*review/i);
 const reviewed=planActorEffect(skiff,{...request,note:'The carbine scorches the plating but causes no hull trauma.',crossScale:{...request.crossScale,reviewed:true}},{user:gm});
 assert.equal(reviewed.after['system.hullTrauma.value'],0);
 assert.deepEqual(reviewed.calculation.crossScale,{sourceScale:'personal',sourceAmount:9,targetScale:'vehicle',convertedAmount:0});
 assert.throws(()=>planActorEffect(skiff,{...request,amount:9,crossScale:{...request.crossScale,reviewed:true},note:''},{user:gm}),/GM decision|cross-scale/i);
});
test('damage with outstanding source checks requires a documented GM ruling and valid combat stats',()=>{
 const flagged=actor({type:'minion',system:{...actor().system,incomplete:['soak source review'],groupSize:1,wounds:{value:2,max:11},soak:2}});
 assert.throws(()=>planActorEffect(flagged,{...effect,note:''},{user:gm}),/GM ruling/);
 const plan=planActorEffect(flagged,{...effect,amount:7,pierce:0,note:'The GM accepts provisional soak 2 for this encounter.'},{user:gm});
 assert.equal(plan.after['system.wounds.value'],7);
 assert.match(plan.warning,/soak source review/);
 assert.throws(()=>planActorEffect(actor({system:{incomplete:['soak']}}),effect,{user:gm}),/soak|damage|Current/i);
});
test('recovery never underflows',()=>{
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
test('a roll-linked GM decision records its source and an explicit ongoing check modifier',()=>{
 const a=actor(),request={kind:'condition',label:'Damaged optic',note:'The GM rules its ranged targeting is impaired.',entryId:'optic',source,sourceRollUuid:'ChatMessage.attack',modifier:{die:'setback',count:1,skillKey:'rangedLight'}};
 const plan=planActorEffect(a,request,{user:gm});
 assert.equal(plan.sourceRollUuid,'ChatMessage.attack');
 assert.equal(plan.after['flags.star-wars-ffg.conditions'][0].modifier.die,'setback');
 assert.equal(plan.after['flags.star-wars-ffg.conditions'][0].automation,'pool-modifier');
 assert.throws(()=>planActorEffect(a,{...request,note:''},{user:gm}),/GM decision/);
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
