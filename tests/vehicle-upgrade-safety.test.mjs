import test from 'node:test';
import assert from 'node:assert/strict';
import {registerActorArtwork} from '../src/actor-artwork-foundry.mjs';
const id='star-wars-ffg';
test('ready-time migration and later scale changes preserve legacy vehicle extents unless explicitly opted in',async()=>{
 const globals={Hooks:globalThis.Hooks,game:globalThis.game,Actor:globalThis.Actor,CONFIG:globalThis.CONFIG},hooks=new Map(),updates=[];
 const actor={id:'ship',type:'vehicle',name:'Legacy ship',img:'portraits/ship.webp',system:{silhouette:3},flags:{},
  prototypeToken:{texture:{src:'portraits/ship.webp'},getFlag:(_scope,key)=>key==='proceduralToken.enabled'?true:undefined,flags:{[id]:{proceduralToken:{version:999}}}},getFlag:()=>undefined};
 const token=(name,flag)=>({id:name,actorId:actor.id,actor,width:2,height:3,rotation:135,texture:{src:'tokens/custom.webp'},getFlag:(_scope,key)=>key==='automaticFootprint'?flag:undefined});
 const scene={grid:{type:1,size:100,distance:1,units:'m'},tokens:[token('legacy',undefined),token('manual',false),token('managed',true)],
  async updateEmbeddedDocuments(_type,rows){updates.push(...rows);}};
 try {
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn),once:(name,fn)=>hooks.set(name,fn)};
  globalThis.game={user:{isGM:true},actors:[actor],scenes:[scene]};
  globalThis.Actor={updateDocuments:async rows=>assert.deepEqual(rows,[])};globalThis.CONFIG={};
  registerActorArtwork();
  hooks.get('ready')();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(updates.map(u=>u._id),['managed']);
  assert.equal(updates[0].width,10);assert.equal(updates[0].height,10);
  assert.ok(!('rotation' in updates[0]));
  updates.length=0;hooks.get('updateScene')(scene,{'grid.distance':2});await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(updates.map(u=>u._id),['managed']);
  updates.length=0;hooks.get('updateActor')(actor,{'system.silhouette':4});await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(updates.filter(u=>'width' in u).map(u=>u._id),['managed']);
 } finally {Object.assign(globalThis,globals);}
});
