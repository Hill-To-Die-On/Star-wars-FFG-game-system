import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/critical-tables.json' with {type:'json'};
import {validateCriticalTables,criticalTotal,lookupCritical,criticalOutcome} from '../src/critical-injuries.mjs';
import {planActorEffect} from '../src/tabletop-workflows.mjs';

const gm={id:'gm',isGM:true};
const ruling={book:'GM table ruling',page:'Session 3',verification:'gm-ruling'};
const character=(criticals=[],type='character')=>({type,system:{criticals,strain:{value:2,max:12},wounds:{value:4,max:14}},flags:{}});
const vehicle=(critical=[])=>({type:'vehicle',system:{systemStrain:{value:1,max:10},hullTrauma:{value:0,max:12}},flags:{'star-wars-ffg':{vehicleCriticals:critical}}});
const roll=(table,value,extra={})=>({kind:'critical',entryId:`crit-${value}`,note:'Hit beat soak and the Critical rating triggered.',source:ruling,critical:{roll:value,vicious:0,modifier:0,...extra},table});

test('both core critical tables are contiguous, end open-ended and cite all three cores',()=>{
 validateCriticalTables(data);
 assert.deepEqual([data.personal.rows.length,data.vehicle.rows.length],[29,19]);
 assert.deepEqual([data.personal.rows.at(-1).low,data.vehicle.rows.at(-1).low],[151,154]);
 assert.deepEqual(data.personal.sources.map(s=>[s.book,s.page]),[['Edge of The Empire - Core Book','217'],['Age of Rebellion - Core Book','231'],['Force & Destiny - Core Book','225']]);
 const gap=structuredClone(data);gap.personal.rows[1].low=7;
 assert.throws(()=>validateCriticalTables(gap),/contiguous/);
});

test('each unhealed critical and each Vicious rank add ten, with a floor of one',()=>{
 assert.equal(criticalTotal({roll:42,existing:2,vicious:3}),92);
 assert.equal(criticalTotal({roll:5,modifier:-20}),1);
 for(const bad of [{roll:0},{roll:101},{roll:40,vicious:11},{roll:40,existing:-1}])assert.throws(()=>criticalTotal(bad),/whole number/);
 assert.equal(lookupCritical(1).name,'Minor Nick');assert.equal(lookupCritical(150).name,'The End is Nigh');assert.equal(lookupCritical(400).name,'Dead');
 assert.equal(lookupCritical(140,'vehicle').name,'Fire!');
});

test('the outcome names the result, its healing check and an owned core page',()=>{
 const outcome=criticalOutcome('personal',{roll:93,existing:1},{bookMode:'owned',books:['Force & Destiny - Core Book']});
 assert.equal(outcome.row.name,'Maimed');assert.deepEqual(outcome.healing,{skill:'Medicine',difficulty:'Hard'});
 assert.deepEqual(outcome.source,{book:'Force & Destiny - Core Book',page:'225',verification:'gm-reviewed'});
 assert.throws(()=>criticalOutcome('personal',{roll:20},{bookMode:'owned',books:['Age of Rebellion - Cyphers & Masks']}),/core rulebook/);
});

test('a rolled critical records the table result, applies immediate strain and a permanent setback',()=>{
 const nick=planActorEffect(character([{id:'old',name:'Old wound'}]),roll('personal',3),{user:gm,campaign:{bookMode:'all'}});
 const added=nick.after['system.criticals'].at(-1);
 assert.equal(added.name,'Sudden Jolt','one existing critical adds ten to the roll of 3');
 assert.deepEqual([added.roll,added.total,added.severity],[3,13,1]);
 assert.equal(nick.after['system.strain.value'],undefined);
 const minor=planActorEffect(character(),roll('personal',2),{user:gm,campaign:{bookMode:'all'}});
 assert.equal(minor.after['system.strain.value'],3);assert.equal(minor.after['system.criticals'][0].name,'Minor Nick');
 const minion=planActorEffect(character([],'minion'),roll('personal',2),{user:gm,campaign:{bookMode:'all'}});
 assert.equal(minion.after['system.wounds.value'],5,'minions and rivals suffer wounds instead of strain');
 const maimed=planActorEffect(character(),roll('personal',91,{vicious:1}),{user:gm,campaign:{bookMode:'all'}});
 assert.deepEqual(maimed.after['system.criticals'][0].modifier,{die:'setback',count:1,skillKey:'any'});
 assert.equal(maimed.after['system.criticals'][0].automation,'pool-modifier');
 const compromised=planActorEffect(character(),roll('personal',88),{user:gm,campaign:{bookMode:'all'}});
 assert.match(compromised.warning,/apply.*manually/i);
 assert.match(planActorEffect(character(),roll('personal',100,{vicious:6}),{user:gm,campaign:{bookMode:'all'}}).warning,/dies/);
});

test('vehicle critical hits use the vehicle table and apply immediate system strain',()=>{
 const fire=planActorEffect(vehicle(),roll('vehicle',99,{vicious:4}),{user:gm,campaign:{bookMode:'all'}});
 assert.equal(fire.after["flags.star-wars-ffg.vehicleCriticals"][0].name,'Fire!');
 assert.equal(fire.after['system.systemStrain.value'],3);
 assert.deepEqual(fire.after["flags.star-wars-ffg.vehicleCriticals"][0].healing,{skill:'Mechanics',difficulty:'Daunting'});
});
