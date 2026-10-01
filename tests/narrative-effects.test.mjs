import test from 'node:test';
import assert from 'node:assert/strict';
import {activePoolRulings,addPoolRulings,unspentTalentRemovals,validateFutureEffect} from '../src/narrative-effects.mjs';

const system='star-wars-ffg';

test('future narrative dice affect only the chosen actor and matching next skill',()=>{
 const actor={flags:{[system]:{narrativeEffects:[
  {id:'one',die:'boost',count:1,skillKey:'computers',label:'Access path'},
  {id:'two',die:'setback',count:1,skillKey:'any',label:'Smoke',consumedBy:'old-roll'},
 ]}}};
 const matching=activePoolRulings(actor,'computers');
 assert.equal(matching.boost,1);assert.equal(matching.setback,0);
 assert.deepEqual(matching.pendingIds,['one']);
 assert.deepEqual(addPoolRulings({ability:2,difficulty:2},matching),{ability:2,difficulty:2,boost:1,setback:0});
 assert.equal(activePoolRulings(actor,'mechanics').boost,0);
});

test('GM-reviewed ongoing condition modifiers apply until the condition is removed',()=>{
 const actor={flags:{[system]:{conditions:[{id:'jam',name:'Jammed arm',modifier:{die:'setback',count:1,skillKey:'rangedLight'}}]}}};
 assert.equal(activePoolRulings(actor,'rangedLight').setback,1);
 assert.equal(activePoolRulings(actor,'mechanics').setback,0);
});

test('a passive talent removes a future setback only when its allowance was not already used',()=>{
 const galaxyMapper={pool:{add:{setback:0},remove:{setback:1}}};
 const ruling={boost:0,setback:1};
 const unused=unspentTalentRemovals({setback:0,boost:0},galaxyMapper);
 assert.deepEqual(addPoolRulings({ability:2,setback:0},ruling,unused),{ability:2,setback:0,boost:0});
 const alreadyUsed=unspentTalentRemovals({setback:1,boost:0},galaxyMapper);
 assert.deepEqual(addPoolRulings({ability:2,setback:0},ruling,alreadyUsed),{ability:2,setback:1,boost:0});
});

test('future effect metadata rejects unknown dice, invalid actor targets and skills',()=>{
 assert.deepEqual(validateFutureEffect({die:'boost',count:1,actorUuid:'Actor.hero',skillKey:'any'}),{die:'boost',count:1,actorUuid:'Actor.hero',skillKey:'any'});
 assert.throws(()=>validateFutureEffect({die:'ability',count:1,actorUuid:'Actor.hero',skillKey:'any'}),/boost or setback/);
 assert.throws(()=>validateFutureEffect({die:'boost',count:1,actorUuid:'',skillKey:'any'}),/target actor/);
 assert.throws(()=>validateFutureEffect({die:'boost',count:1,actorUuid:'Actor.hero',skillKey:'warpDrive'}),/skill/);
});
