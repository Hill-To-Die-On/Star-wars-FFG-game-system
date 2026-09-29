import test from "node:test";
import assert from "node:assert/strict";
import { elevationInterval, planLevelRay, tokenVolumeIntersection, verticalRelationship } from "../src/range-overlay/spatial.mjs";

const level=(id,bottom,top)=>({id,elevation:{bottom,top}});
const ground=level("ground",0,10),sky=level("sky",10,100),orbit=level("orbit",100,1000);
test("elevation clips rising, falling, horizontal and purely vertical rays",()=>{
  assert.deepEqual(elevationInterval(0,20,5,15),{start:.25,end:.75});
  assert.deepEqual(elevationInterval(20,0,5,15),{start:.25,end:.75});
  assert.deepEqual(elevationInterval(5,5,0,10),{start:0,end:1});
  assert.equal(elevationInterval(15,15,0,10),null);
});
test("ordered native levels test the part of the shot within each level, including intermediate floors",()=>{
  const result=planLevelRay({sourceElevation:0,targetElevation:200,sourceLevel:ground,targetLevel:orbit,levels:[ground,sky,orbit]});
  assert.equal(result.verified,true);
  assert.deepEqual(result.segments.map(({level,start,end})=>[level.id,start,end]),[["ground",0,.05],["sky",.05,.5],["orbit",.5,1]]);
  const reverse=planLevelRay({sourceElevation:200,targetElevation:0,sourceLevel:orbit,targetLevel:ground,levels:[ground,sky,orbit]});
  assert.deepEqual(reverse.segments.map(({level,start,end})=>[level.id,start,end]),[["orbit",0,.5],["sky",.5,.95],["ground",.95,1]]);
});
test("unmodelled gaps, overlapping level volumes and invalid assignments require adjudication",()=>{
  for(const levels of [[ground,orbit],[ground,level("overlap",5,30),sky,orbit]])
    assert.equal(planLevelRay({sourceElevation:1,targetElevation:200,sourceLevel:ground,targetLevel:orbit,levels}).verified,false);
  assert.equal(planLevelRay({sourceElevation:30,targetElevation:50,sourceLevel:ground,targetLevel:sky,levels:[ground,sky]}).verified,false);
});
test("same-level shots do not import walls from unrelated views at the same elevation",()=>{
  const same=planLevelRay({sourceElevation:3,targetElevation:5,sourceLevel:ground,targetLevel:ground,levels:[ground,level("other",0,10)]});
  assert.equal(same.verified,true);assert.deepEqual(same.segments.map(s=>s.level.id),["ground"]);
});
test("the ray must overlap both horizontal footprint and height before an actor blocks it",()=>{
  const volume={x:50,y:0,width:20,height:20,shape:"circle",bottom:0,top:2};
  assert.equal(tokenVolumeIntersection({x:0,y:0,elevation:10},{x:100,y:0,elevation:10},volume),null);
  assert.equal(tokenVolumeIntersection({x:0,y:0,elevation:0},{x:100,y:0,elevation:0},volume).progress,.4);
  assert.equal(tokenVolumeIntersection({x:0,y:0,elevation:0},{x:100,y:0,elevation:10},volume),null);
  const hit=tokenVolumeIntersection({x:0,y:0,elevation:0},{x:100,y:0,elevation:10},{...volume,bottom:5,top:7});
  assert.equal(hit.progress,.5);assert.equal(hit.point.elevation,5);
});
test("vertical rays hit intervening hull volumes and use rotated rectangular hulls",()=>{
  const ship={x:0,y:0,width:20,height:100,shape:"rectangle",rotation:90,bottom:40,top:50};
  const hit=tokenVolumeIntersection({x:40,y:0,elevation:0},{x:40,y:0,elevation:100},ship);
  assert.equal(hit.progress,.4);
  assert.equal(tokenVolumeIntersection({x:0,y:40,elevation:0},{x:0,y:40,elevation:100},ship),null);
});
test("relationships use absolute native elevations without rewriting actor identities",()=>{
  assert.deepEqual(verticalRelationship(4,14),{direction:"above",difference:10});
  assert.deepEqual(verticalRelationship(14,4),{direction:"below",difference:10});
  assert.deepEqual(verticalRelationship(4,4),{direction:"level",difference:0});
});
