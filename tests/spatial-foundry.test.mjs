import test from "node:test";
import assert from "node:assert/strict";
import { nativeSightResult, spatialTokenVisible, planFlightMove } from "../src/range-overlay/spatial-foundry.mjs";
const ground={id:"ground",name:"Ground",elevation:{bottom:0,top:10}},sky={id:"sky",name:"Sky",elevation:{bottom:10,top:100}};
const scene=()=>({grid:{type:1,size:100,distance:1,units:"m"},levels:[ground,sky],testSurfaceCollision:()=>null});
const point=(x,elevation)=>({x,y:0,elevation});
const token=(id,level,elevation)=>({id,document:{id,level,elevation,depth:1},visible:true});
test("runtime adapter clips walls to their actual native levels and includes surfaces",()=>{
  const calls=[],map=scene(),backend={testCollision:(a,b,options)=>{calls.push(options);return null;}};
  const result=nativeSightResult({source:token("a","ground",0),target:token("b","sky",20),start:point(0,0),end:point(100,20),scene:map,backend});
  assert.equal(result.lineOfSight,"clear");assert.equal(result.sightBasis,"native-levels");
  assert.deepEqual(calls.map(c=>[c.level.id,c.tMin,c.tMax]),[["ground",0,.5],["sky",.5,1]]);
  map.testSurfaceCollision=(_a,_b,{level})=>level===ground?point(25,5):null;
  const blocked=nativeSightResult({source:token("a","ground",0),target:token("b","sky",20),start:point(0,0),end:point(100,20),scene:map,backend});
  assert.equal(blocked.lineOfSight,"blocked");assert.equal(blocked.obstruction.kind,"surface");assert.equal(blocked.obstruction.progress,.25);
});
test("missing or failing surface support never clears a layered shot",()=>{
  for(const testSurfaceCollision of [undefined,()=>{throw Error("failed");},()=>Promise.resolve(null)]) {
    const map={...scene(),testSurfaceCollision},backend={testCollision:()=>null};
    const result=nativeSightResult({source:token("a","ground",0),target:token("b","sky",20),start:point(0,0),end:point(100,20),scene:map,backend});
    assert.equal(result.lineOfSight,"unavailable");assert.equal(result.requiresGmRuling,true);
  }
});
test("a directly vertical surface hit gets a progress from elevation and never divides by zero",()=>{
  const map=scene();map.testSurfaceCollision=()=>point(0,10);
  const result=nativeSightResult({source:token("a","ground",0),target:token("b","sky",20),start:point(0,0),end:point(0,20),scene:map,backend:{testCollision:()=>null}});
  assert.equal(result.obstruction.progress,.5);
});
test("players cannot inspect hidden or nonvisible target tokens, even by direct API ID",()=>{
  const target=token("secret","sky",20),player={isGM:false};
  assert.equal(spatialTokenVisible(target,player),true);
  target.visible=false;assert.equal(spatialTokenVisible(target,player),false);
  target.visible=true;target.document.hidden=true;assert.equal(spatialTokenVisible(target,player),false);
  assert.equal(spatialTokenVisible(target,{isGM:true}),true);
  assert.equal(spatialTokenVisible({document:target.document},player),false);
});
test("flight moves retain document identity, require permission, and reject invalid heights",()=>{
  const doc={id:"ship",x:10,y:20,elevation:2,level:"ground",parent:scene(),canUserModify:()=>true};
  assert.deepEqual(planFlightMove(doc,{level:"sky",elevation:30},{isGM:true}),{x:10,y:20,elevation:30,level:"sky"});
  assert.throws(()=>planFlightMove(doc,{level:"sky",elevation:200},{isGM:true}),/bounds/);
  assert.throws(()=>planFlightMove(doc,{level:"sky",elevation:NaN},{isGM:true}),/finite/);
  assert.throws(()=>planFlightMove(doc,{level:"ground",elevation:8},{isGM:false},{paused:true}),/paused/);
  doc.canUserModify=()=>false;assert.throws(()=>planFlightMove(doc,{level:"sky",elevation:20},{isGM:false}),/permission/);
});
