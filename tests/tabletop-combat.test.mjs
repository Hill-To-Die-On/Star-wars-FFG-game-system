import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.Combat=class {get combatant(){return this.turns[this.turn];}getFlag(ns,key){return this.flags[ns]?.[key];}};
const {StarWarsCombat,initiativeSightWarning}=await import('../src/combat.mjs');
test('initiative warns when opposed actors have no verified sight, without forbidding other detection',()=>{
 const hero={actor:{hasPlayerOwner:true},token:{id:'hero'}};
 const droid={actor:{hasPlayerOwner:false},token:{id:'droid'}};
 assert.match(initiativeSightWarning([hero,droid],()=>({available:true,lineOfSight:'blocked'})),/no clear line of sight/i);
 assert.equal(initiativeSightWarning([hero,droid],()=>({available:true,lineOfSight:'clear',requiresGmRuling:false})),null);
 assert.match(initiativeSightWarning([hero,droid],()=>({available:true,lineOfSight:'unavailable'})),/no clear line of sight/i);
 assert.equal(initiativeSightWarning([hero],()=>({available:true,lineOfSight:'blocked'})),null);
});
test('the GM sees a sight warning before rolling initiative in the active scene',async()=>{
 const previous={canvas:globalThis.canvas,game:globalThis.game,ui:globalThis.ui,CONFIG:globalThis.CONFIG};
 const scene={id:'sight-warning-scene',grid:{type:1,size:100,distance:1,units:'m'},getFlag:()=>({scale:'personal'}),levels:[]};
 const token=id=>({id,center:{x:id==='hero'?100:800,y:100},w:100,h:100,document:{id,parent:scene,elevation:0}});
 const heroToken=token('hero'),droidToken=token('droid'),warnings=[];
 const actor=(hasPlayerOwner)=>({hasPlayerOwner,type:'character',rollSkill:async()=>({outcome:{netSuccess:1,netAdvantage:0}})});
 const rows=[{id:'h',token:heroToken,actor:actor(true),isOwner:true},{id:'d',token:droidToken,actor:actor(false),isOwner:true}];
 const combat=new StarWarsCombat();
 combat.sceneId=scene.id;combat.combatants=Object.assign(rows,{get(id){return this.find(row=>row.id===id);}});
 combat.turn=0;combat.updateEmbeddedDocuments=async()=>{};
 globalThis.canvas={scene,tokens:{get:id=>id==='hero'?heroToken:droidToken,placeables:[heroToken,droidToken]}};
 globalThis.game={user:{isGM:true}};
 globalThis.ui={notifications:{warn:message=>warnings.push(message)}};
 globalThis.CONFIG={Canvas:{polygonBackends:{sight:{testCollision:(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})}}}};
 try {
  await combat.rollInitiative(['h','d']);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/no clear line of sight/i);
  await combat.rollInitiative(['h']);
  assert.equal(warnings.length,1,'repeat rolls do not spam the warning');
 }finally{Object.assign(globalThis,previous);}
});
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
