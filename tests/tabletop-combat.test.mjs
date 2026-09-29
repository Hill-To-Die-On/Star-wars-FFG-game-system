import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.Combat=class {get combatant(){return this.turns[this.turn];}getFlag(ns,key){return this.flags[ns]?.[key];}};
const {StarWarsCombat}=await import('../src/combat.mjs');
test('active initiative resolves to the claimant while preserving slot order and rewind history',()=>{
 const c=new StarWarsCombat(),a={id:'s1',actor:{uuid:'Actor.a'}},b={id:'s2',actor:{uuid:'Actor.b'}};
 c.combatants=Object.assign([a,b],{get(id){return this.find(row=>row.id===id);}});c.turns=[a,b];c.turn=0;c.round=2;
 c.flags={'star-wars-ffg':{slotClaims:[{round:2,slotId:'s1',actorUuid:'Actor.b'}]}};
 assert.equal(c.combatant,b);assert.equal(c.turns[0],a);assert.equal(c.getClaimedCombatant('s1'),b);
 c.round=1;assert.equal(c.combatant,a);c.round=2;assert.equal(c.combatant,b);
});
test('vehicle manoeuvres use the active crew combat even when only the crew are initiative participants',async()=>{
 const {activeCombatForActor}=await import('../src/turn-economy-foundry.mjs');
 const vehicle={uuid:'Actor.ship',type:'vehicle'},crew={uuid:'Actor.pilot',type:'character'},scene={tokens:[{id:'ship',actor:vehicle},{id:'pilot',actor:crew,flags:{'star-wars-ffg':{aboard:{vehicleId:'ship'}}}}]};
 const combat={id:'crew-combat',started:true,scene,combatants:[{actor:crew,tokenId:'pilot',token:{parent:scene}}]};
 const prior=globalThis.game;globalThis.game={combats:[combat]};
 try {assert.equal(activeCombatForActor(vehicle),combat);assert.equal(activeCombatForActor({uuid:'Actor.unrelated',type:'vehicle'}),null);}finally{globalThis.game=prior;}
});
