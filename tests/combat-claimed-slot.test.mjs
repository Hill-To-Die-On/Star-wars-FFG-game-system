import test from 'node:test';
import assert from 'node:assert/strict';
// Mirrors core 14.370: Combatant writes keep the turn on whichever combatant Combat#combatant names.
const turnOf=(combat,id)=>Math.max(combat.turns.findIndex(entry=>entry.id===id),0);
globalThis.Combat=class {
 get combatant(){return this.turn===null?null:this.turns[this.turn];}
 getFlag(ns,key){return this.flags?.[ns]?.[key];}
 async resetAll(){this.resetFrom=this.combatant?.id;return this;}
};
globalThis.Combatant=class {
 static keep(operation){const current=operation.parent?.combatant;if(current)operation.combatTurn=turnOf(operation.parent,current.id);}
 static async _preCreateOperation(_documents,operation){await Promise.resolve();this.keep(operation);}
 static async _preUpdateOperation(_documents,operation){await Promise.resolve();this.keep(operation);}
 static async _preDeleteOperation(_documents,operation){
  await Promise.resolve();
  const combat=operation.parent,current=combat.combatant;
  if(!operation.ids.includes(current.id))return this.keep(operation);
  const survivor=combat.turns.slice(combat.turn).find(entry=>!operation.ids.includes(entry.id));
  operation.combatTurn=survivor?turnOf(combat,survivor.id):combat.turn;
 }
};
const {StarWarsCombat,StarWarsCombatant}=await import('../src/combat.mjs');
const claimedCombat=()=>{
 const combat=new StarWarsCombat(),rows=['s1','s2','s3'].map(id=>({id,actor:{uuid:`Actor.${id}`}}));
 combat.combatants=Object.assign([...rows],{get(id){return this.find(row=>row.id===id);}});
 combat.turns=rows;combat.turn=0;combat.round=1;
 combat.flags={'star-wars-ffg':{slotClaims:[{round:1,slotId:'s1',actorUuid:'Actor.s2'}]}};
 return combat;
};
test('players still see the claimant as the active combatant',()=>{
 assert.equal(claimedCombat().combatant.id,'s2');
});
for(const [hook,ids] of [['_preCreateOperation',undefined],['_preUpdateOperation',undefined],['_preDeleteOperation',['s3']]]) {
 test(`${hook} keeps the turn on the claimed slot, not the claimant's own slot`,async()=>{
  const combat=claimedCombat(),operation={parent:combat,ids};
  await StarWarsCombatant[hook]([],operation,{});
  assert.equal(operation.combatTurn,0);
  assert.equal(combat.combatant.id,'s2','the claimant is restored once the write has been prepared');
 });
}
test('deleting the claimed slot passes the turn to the next survivor',async()=>{
 const combat=claimedCombat(),operation={parent:combat,ids:['s1']};
 await StarWarsCombatant._preDeleteOperation([],operation,{});
 assert.equal(combat.turns[operation.combatTurn].id,'s2');
});
test('deleting only the claimant does not count as deleting the current turn',async()=>{
 const combat=claimedCombat(),operation={parent:combat,ids:['s2']};
 await StarWarsCombatant._preDeleteOperation([],operation,{});
 assert.equal(combat.turns[operation.combatTurn].id,'s1');
});
test('resetting initiative keeps the claimed slot current',async()=>{
 const combat=claimedCombat();
 await combat.resetAll();
 assert.equal(combat.resetFrom,'s1');
 assert.equal(combat.combatant.id,'s2');
});
test('overlapping writes restore the claimant only after the last one',async()=>{
 const combat=claimedCombat(),first={parent:combat},second={parent:combat};
 await Promise.all([StarWarsCombatant._preUpdateOperation([],first,{}),StarWarsCombatant._preUpdateOperation([],second,{})]);
 assert.deepEqual([first.combatTurn,second.combatTurn],[0,0]);
 assert.equal(combat.combatant.id,'s2');
});
test('a Combatant with no parent Combat is left to core',async()=>{
 const operation={ids:[]};
 await StarWarsCombatant._preUpdateOperation([],operation,{});
 assert.equal(operation.combatTurn,undefined);
});
