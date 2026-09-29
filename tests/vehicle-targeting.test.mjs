import test from "node:test";
import assert from "node:assert/strict";
import { buildAttackTracePreview, vehicleAttackOptions, loadAttackTracePool } from "../src/range-overlay/foundry.mjs";

function fixture(run) {
  const saved=Object.fromEntries(["canvas","game","CONFIG"].map(k=>[k,globalThis[k]]));
  const tokens=new Map();tokens[Symbol.iterator]=function*(){yield* this.values();};
  const scene={id:"arc-scene",grid:{type:1,size:100,distance:1,units:"m"},tokens,getFlag:()=>({scale:"space"})};
  const make=(id,type,x,y)=>{
    const actor={id,name:id,type,system:{silhouette:type==="vehicle"?3:1,characteristics:{agility:2},skills:{gunnery:{rank:1}},defense:{ranged:0}},items:[],isOwner:true};
    actor.skillRank=()=>actor.system.skills.gunnery.rank;
    const document={id,name:id,actor,parent:scene,rotation:180,flags:{},elevation:0};
    tokens.set(id,document);
    return {id,center:{x,y},w:100,h:100,actor,document,visible:true};
  };
  const source=make("ship","vehicle",0,0),target=make("enemy","nemesis",600,-600);
  const novice=make("Novice","character",0,0),expert=make("Expert","character",0,0);
  for(const member of [novice,expert]) member.document.flags={"star-wars-ffg":{aboard:{vehicleId:source.id,seat:"crew",roles:["gunner"]}}};
  expert.actor.system.characteristics.agility=4;expert.actor.system.skills.gunnery.rank=3;
  const mount=(id,damage,fireArcs)=>({id,name:id,type:"weapon",system:{damage:String(damage),scale:"vehicle",skill:"gunnery",range:"close",equipped:true,metadata:{fireArcs}}});
  source.actor.items=[mount("Light cannon",5,["fore","starboard"]),mount("Heavy cannon",8,["fore"]),mount("Aft cannon",30,["aft"])];
  globalThis.game={user:{id:"gm",isGM:true}};globalThis.CONFIG={Canvas:{polygonBackends:{sight:{testCollision:()=>null}}}};
  globalThis.canvas={scene,dimensions:scene.grid,tokens:{placeables:[source,target,novice,expert]}};
  try{run({source,target,novice,expert,scene});}
  finally{for(const[k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
}
test("automatic attack uses the strongest legal mount and actual assigned gunner, not an unusable powerful gun",()=>fixture(({source,target,scene})=>{
  const preview=buildAttackTracePreview(source,target,{scene});
  assert.equal(preview.error,"");assert.equal(preview.attack.itemId,"Heavy cannon");assert.equal(preview.attack.crewName,"Expert");
  assert.equal(preview.attack.firingArc,"fore");assert.ok(preview.strength.expectedImpact>0);
  assert.equal(preview.pool.proficiency,3);assert.equal(preview.pool.ability,1);
}));
test("a selected lighter weapon, side arc and novice remain selected and supply the staged pool",()=>fixture(({source,target,scene})=>{
  const preview=buildAttackTracePreview(source,target,{scene,selection:{itemId:"Light cannon",fireArc:"starboard",crewTokenId:"Novice"}});
  assert.equal(preview.error,"");assert.equal(preview.attack.itemId,"Light cannon");assert.equal(preview.attack.crewName,"Novice");
  assert.equal(preview.attack.firingArc,"starboard");assert.equal(preview.attack.selectionMode,"Selected");
  let staged;loadAttackTracePool(preview,{sourceToken:source,loader:(pool,context)=>{staged={pool,context};return pool;}});
  assert.equal(staged.context.actor.name,"Novice");assert.deepEqual(staged.pool,preview.pool);
}));
test("a player cannot see or auto-select a hidden gunner and the test includes a stronger visible control",()=>fixture(({source,target,expert,scene})=>{
  game.user={id:"player",isGM:false};
  for(const t of scene.tokens)t.actor.canUserModify=()=>true;
  assert.equal(buildAttackTracePreview(source,target,{scene}).attack.crewName,"Expert");
  expert.document.hidden=true;
  const rows=vehicleAttackOptions(source,target,{scene});
  assert.ok(rows.length>0);assert.ok(rows.some(row=>row.attack.crewName==="Novice"));
  assert.ok(rows.every(row=>row.attack.crewName!=="Expert"));
  assert.equal(buildAttackTracePreview(source,target,{scene}).attack.crewName,"Novice");
}));
test("weapon arcs and the agreed target shield zone are separate choices",()=>fixture(({source,target,scene})=>{
  target.actor.type="vehicle";target.document.rotation=0;target.actor.system.shields={fore:2,aft:0,port:1,starboard:1};
  assert.match(buildAttackTracePreview(source,target,{scene}).error,/defence zone/);
  const preview=buildAttackTracePreview(source,target,{scene,selection:{defenseZone:"fore"}});
  assert.equal(preview.error,"");assert.equal(preview.pool.setback,2);assert.equal(preview.attack.defenseZone,"fore");
}));
test("a removed selected weapon fails closed instead of silently firing another mount",()=>fixture(({source,target,scene})=>{
  const preview=buildAttackTracePreview(source,target,{scene,selection:{itemId:"removed mount",fireArc:"fore",crewTokenId:"Expert"}});
  assert.match(preview.error,/selected weapon.*unavailable/i);
  assert.equal(preview.pool,null);
}));

test("a far-side corner preview cannot stage its shield pool, while the exposed Aft face can",()=>fixture(({source,target,scene})=>{
  source.center={x:400,y:-800};target.actor.type="vehicle";target.center={x:1000,y:0};target.w=400;target.h=1000;
  target.document.rotation=0;target.actor.system.shields={fore:2,aft:1,port:0,starboard:1};
  const selection={itemId:"Light cannon",crewTokenId:"Expert",fireArc:"starboard"};
  const hidden=buildAttackTracePreview(source,target,{scene,selection:{...selection,defenseZone:"port"}});
  assert.match(hidden.error,/defensive zone/);
  let staged=0;const options={sourceToken:source,loader:pool=>{staged++;return pool;}};
  assert.equal(loadAttackTracePool(hidden,options),null);assert.equal(staged,0);
  const visible=buildAttackTracePreview(source,target,{scene,selection:{...selection,defenseZone:"aft"}});
  assert.equal(visible.error,"");assert.equal(visible.pool.setback,1);
  assert.deepEqual(loadAttackTracePool(visible,options),visible.pool);assert.equal(staged,1);
}));
test("Up and Down select recorded dorsal and ventral mounts without inventing a firing arc",()=>fixture(({source,target,scene})=>{
  source.actor.items[0].system.metadata.location="dorsal";
  const dorsal=buildAttackTracePreview(source,target,{scene,selection:{fireFacing:"dorsal"}});
  assert.equal(dorsal.error,"");assert.equal(dorsal.attack.itemId,"Light cannon");assert.equal(dorsal.attack.fireFacing,"dorsal");
  assert.match(buildAttackTracePreview(source,target,{scene,selection:{fireFacing:"ventral"}}).error,/ventral/);
  target.document.elevation=-1;
  assert.match(buildAttackTracePreview(source,target,{scene,selection:{fireFacing:"dorsal"}}).error,/dorsal/);
}));
test("a shield-zone choice for another target and a malformed shield value cannot build a legal attack",()=>fixture(({source,target,scene})=>{
  target.actor.type="vehicle";target.document.rotation=0;target.actor.system.shields={fore:2,aft:0};
  const stale=buildAttackTracePreview(source,target,{scene,selection:{defenseZone:"fore",defenseTargetId:"previous target"}});
  assert.match(stale.error,/defence zone/);
  const current=buildAttackTracePreview(source,target,{scene,selection:{defenseZone:"fore",defenseTargetId:target.id}});
  assert.equal(current.error,"");assert.equal(current.pool.setback,2);
  target.actor.system.shields.fore="unknown";
  assert.match(buildAttackTracePreview(source,target,{scene,selection:{defenseZone:"fore"}}).error,/defence zone/);
}));
