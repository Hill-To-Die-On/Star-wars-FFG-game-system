import test from "node:test";
import assert from "node:assert/strict";
import { measureTokenRange, buildAttackTracePreview } from "../src/range-overlay/foundry.mjs";
import { segmentEllipseIntersection } from "../src/range-overlay/core.mjs";

const scene={id:"sight-scene",grid:{type:1,size:100,distance:1,units:"m"},getFlag:()=>({scale:"personal"})};
function token(id,x,y,w,h,type="character") {
 return {id,center:{x,y},w,h,visible:true,document:{id,parent:scene,rotation:0},actor:{id,type,name:id}};
}
function fixture(run) {
 const saved=Object.fromEntries(["canvas","game","CONFIG"].map(k=>[k,globalThis[k]]));
 const source=token("attacker",0,0,100,100),target=token("large target",800,0,200,800,"vehicle"),blocker=token("guard",400,0,100,100);
 let calls=0;
 globalThis.CONFIG={Canvas:{polygonBackends:{sight:{testCollision:()=>{calls++;return null;}}}}};
 globalThis.canvas={scene,dimensions:scene.grid,tokens:{placeables:[source,target,blocker]}};globalThis.game={user:{isGM:true}};
 try {run({source,target,blocker,calls:()=>calls});}
 finally{for(const [k,v] of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
}
const measure=(s,t)=>measureTokenRange(s,t,{scene});

test("live measurement passes the attacker's rectangular hull into firing validation",()=>fixture(({source,target,blocker})=>{
 source.actor.type="vehicle";source.center={x:0,y:0};source.w=200;source.h=1000;source.document.rotation=180;
 target.center={x:450,y:-550};target.w=100;target.h=100;blocker.center.y=3000;
 const weapon={system:{metadata:{fireArcs:["fore","starboard"]}}};
 assert.match(measureTokenRange(source,target,{scene,weapon,fireArc:"fore"}).arcError,/firing arcs/);
 const side=measureTokenRange(source,target,{scene,weapon,fireArc:"starboard"});
 assert.equal(side.arcError,"");assert.equal(side.lineOfSight,"clear");assert.equal(side.firingArc,"starboard");
}));
test("a firing-arc boundary can reach an exact defensive hull corner",()=>fixture(({source,target,blocker})=>{
 source.actor.type="vehicle";source.center={x:1400,y:1000};source.w=400;source.h=400;source.document.rotation=180;
 target.center={x:2000,y:1500};target.w=400;target.h=200;target.document.rotation=180;blocker.center.y=3000;
 const result=measureTokenRange(source,target,{scene,weapon:{system:{metadata:{fireArcs:["starboard"]}}},fireArc:"starboard",defenseZone:"fore"});
 assert.equal(result.arcError,"");assert.equal(result.lineOfSight,"clear");
 assert.ok(Math.abs(result.traceTarget.x-1800)<.01);assert.ok(Math.abs(result.traceTarget.y-1400)<.01);
}));
test("defensive faces require a clear ray approaching from outside that face",()=>fixture(({source,target,blocker})=>{
 blocker.center.y=1000;target.document.rotation=0;
 const side=measureTokenRange(source,target,{scene,defenseZone:"starboard"});
 assert.equal(side.lineOfSight,"clear");assert.equal(side.arcError,"");
 const fore=measureTokenRange(source,target,{scene,defenseZone:"fore"});
 assert.match(fore.arcError,/defensive zone/);
 source.center.y=600;
 const exposedFore=measureTokenRange(source,target,{scene,defenseZone:"fore"});
 assert.equal(exposedFore.lineOfSight,"clear");assert.equal(exposedFore.arcError,"");
 assert.ok(Math.abs(exposedFore.traceTarget.y-400)<.01);
 const farSide=measureTokenRange(source,target,{scene,defenseZone:"port"});
 assert.match(farSide.arcError,/defensive zone/i);
}));
test("reaching the far Aft/Port corner from above-left cannot count as hitting the hidden Port face",()=>fixture(({source,target,blocker})=>{
 blocker.center.y=3000;source.center={x:400,y:-800};target.center={x:1000,y:0};target.w=400;target.h=1000;
 const aft=measureTokenRange(source,target,{scene,defenseZone:"aft"});
 assert.equal(aft.arcError,"");assert.equal(aft.lineOfSight,"clear");
 const port=measureTokenRange(source,target,{scene,defenseZone:"port"});
 assert.match(port.arcError,/defensive zone/);
 // Positive control: the same Port face becomes legal after crossing to its exterior.
 source.center.x=1400;
 const exposed=measureTokenRange(source,target,{scene,defenseZone:"port"});
 assert.equal(exposed.arcError,"");assert.equal(exposed.lineOfSight,"clear");
}));
test("a broadside point cannot count as Fore merely because it lies inside a centre-based cone",()=>fixture(({source,target,blocker})=>{
 blocker.center.y=3000;source.actor.type="vehicle";source.center={x:1400,y:1000};source.w=400;source.h=400;source.document.rotation=180;
 target.center={x:2000,y:1200};target.w=400;target.h=1000;
 const weapon={system:{metadata:{fireArcs:["starboard"]}}};
 const side=measureTokenRange(source,target,{scene,weapon,fireArc:"starboard",defenseZone:"starboard"});
 assert.equal(side.arcError,"");assert.equal(side.lineOfSight,"clear");
 const fore=measureTokenRange(source,target,{scene,weapon,fireArc:"starboard",defenseZone:"fore"});
 assert.match(fore.arcError,/defensive zone/);
}));
const wall=(a,b,yMin,yMax)=>{
 const p=(400-a.x)/(b.x-a.x),y=a.y+(b.y-a.y)*p;
 return p>=0&&p<=1&&y>=yMin&&y<=yMax?{x:400,y}:null;
};
test("a clear part of a large target remains attackable behind an intervening actor",()=>fixture(({source,target,blocker,calls})=>{
 const result=measure(source,target);
 assert.equal(result.lineOfSight,"clear");assert.equal(result.lineOfSightBlocked,false);
 assert.equal(result.sightPath,"alternate");assert.equal(result.partiallyObscured,true);assert.equal(result.obstruction,null);
 assert.equal(result.nearestSceneDistance,6.5);assert.equal(result.band,"medium");
 assert.equal(result.distanceBasis,"clear-shot");
 assert.ok(result.sceneDistance>6.5);
 assert.ok(Math.abs(result.sceneDistance-Math.hypot(result.traceTarget.x-result.traceSource.x,result.traceTarget.y-result.traceSource.y)/100)<1e-7);
 assert.deepEqual(result.targetEdge,{x:700,y:0});assert.notDeepEqual(result.traceTarget,result.targetEdge);
 assert.ok(Math.abs(result.traceTarget.x-700)<1e-5);
 assert.equal(segmentEllipseIntersection(result.traceSource,result.traceTarget,{...blocker.center,radiusX:46,radiusY:46}),null);
 assert.ok(calls()>1&&calls()<=64);
}));
test("clear nearest path stays unchanged and uses only one wall query",()=>fixture(({source,target,blocker,calls})=>{
 blocker.center.y=1000;
 const result=measure(source,target);assert.equal(result.sightPath,"nearest");assert.equal(result.partiallyObscured,false);
 assert.deepEqual(result.traceSource,result.sourceEdge);assert.deepEqual(result.traceTarget,result.targetEdge);assert.equal(calls(),1);
}));
test("walls are checked on every alternate ray and a full screen remains blocked",()=>fixture(({source,target,blocker})=>{
 blocker.center.y=1000;
 CONFIG.Canvas.polygonBackends.sight.testCollision=(a,b)=>wall(a,b,-60,60);
 const partial=measure(source,target);assert.equal(partial.lineOfSight,"clear");assert.equal(partial.sightPath,"alternate");
 assert.equal(wall(partial.traceSource,partial.traceTarget,-60,60),null);
 CONFIG.Canvas.polygonBackends.sight.testCollision=(a,b)=>wall(a,b,-1000,1000);
 const full=measure(source,target);assert.equal(full.lineOfSight,"blocked");assert.equal(full.obstruction.kind,"wall");
 assert.deepEqual(full.traceTarget,full.targetEdge);assert.equal(full.sightPath,"nearest");
}));
test("a wide blocking actor cannot be bypassed, including a rotated target",()=>fixture(({source,target,blocker})=>{
 target.document.rotation=45;blocker.h=1800;
 const result=measure(source,target);assert.equal(result.lineOfSight,"blocked");assert.equal(result.obstruction.tokenId,blocker.id);
 blocker.h=100;const open=measure(source,target);assert.equal(open.lineOfSight,"clear");
 assert.equal(open.sceneDistance,result.sceneDistance);assert.equal(open.band,result.band);
}));
test("different walls and actors cannot each clear a different ray to produce a false clear result",()=>fixture(({source,target,blocker})=>{
 blocker.center.y=-150;blocker.h=500;
 CONFIG.Canvas.polygonBackends.sight.testCollision=(a,b)=>wall(a,b,0,1000);
 assert.equal(measure(source,target).lineOfSight,"blocked");
}));
test("player-visible sight results do not disclose hidden blockers or their effect on candidate selection",()=>fixture(({source,target,blocker})=>{
 game.user.isGM=false;blocker.document.hidden=true;
 const hidden=measure(source,target);assert.equal(hidden.sightPath,"nearest");assert.equal(hidden.partiallyObscured,false);
 canvas.tokens.placeables=[source,target];assert.deepEqual(measure(source,target),hidden);
 canvas.tokens.placeables=[source,target,blocker];blocker.document.hidden=false;blocker.visible=false;
 assert.deepEqual(measure(source,target),hidden);
}));
test("unavailable wall checks never become a claimed clear alternate path",()=>fixture(({source,target})=>{
 CONFIG.Canvas.polygonBackends.sight.testCollision=()=>{throw Error("backend unavailable");};
 assert.notEqual(measure(source,target).lineOfSight,"clear");
}));
test("alternate sight preserves automatic range difficulty and adds no invented cover dice",()=>fixture(({source,target})=>{
 source.actor={id:"attacker",name:"Attacker",type:"character",system:{characteristics:{agility:3},skills:{rangedHeavy:{rank:2}}},items:[],skillRank:()=>2};
 // A large creature avoids the separate vehicle shield-zone choice in this pool assertion.
 target.actor.type="nemesis";target.actor.system={defense:{ranged:0,melee:0}};target.actor.items=[];
 const preview=buildAttackTracePreview(source,target,{scene,selection:{skillKey:"rangedHeavy"}});
 assert.equal(preview.range.lineOfSight,"clear");assert.equal(preview.error,"");
 assert.equal(preview.pool.difficulty,2);assert.equal(preview.pool.setback,0);
}));

test("the usable shot can cross a range boundary and increase the automatic difficulty",()=>fixture(({source,target,blocker})=>{
 source.actor={id:"attacker",name:"Attacker",type:"character",system:{characteristics:{agility:3},skills:{rangedHeavy:{rank:2}}},items:[],skillRank:()=>2};
 target.center.x=750;target.actor.type="nemesis";target.actor.system={defense:{ranged:0,melee:0}};target.actor.items=[];
 blocker.w=150;blocker.h=250;blocker.center.x=300;
 const preview=buildAttackTracePreview(source,target,{scene,selection:{skillKey:"rangedHeavy"}});
 assert.equal(preview.range.lineOfSight,"clear");assert.equal(preview.error,"");
 assert.equal(preview.range.nearestSceneDistance,6);assert.ok(preview.range.sceneDistance>6);
 assert.equal(preview.range.band,"medium");assert.equal(preview.pool.difficulty,2);
 assert.equal(preview.pool.setback,0);
 canvas.tokens.placeables=[source,target];
 const direct=buildAttackTracePreview(source,target,{scene,selection:{skillKey:"rangedHeavy"}});
 assert.equal(direct.range.band,"short");assert.equal(direct.pool.difficulty,1);
}));

test("the clear ray is refined near the obstruction instead of choosing a distant hull corner",()=>fixture(({source,target,blocker,calls})=>{
 blocker.center.y=1000;
 CONFIG.Canvas.polygonBackends.sight.testCollision=(a,b)=>wall(a,b,-60,100);
 const result=measure(source,target);
 // The closer upper route just clears the wall's y=-60 end at x=400.
 const shortest=Math.hypot(700,700*60/400)-50;
 assert.ok(result.traceTarget.y<0);assert.ok(Math.abs(result.horizontalDistancePx-shortest)<0.02);
 assert.equal(wall(result.traceSource,result.traceTarget,-60,100),null);
}));

test("a clear shot retains elevation while nearest-edge distance remains available separately",()=>fixture(({source,target})=>{
 target.document.elevation=12;
 const result=measure(source,target);
 assert.equal(result.verticalDistancePx,1200);
 assert.equal(result.nearestSceneDistance,Math.hypot(6.5,12));
 assert.equal(result.sceneDistance,Math.hypot(result.horizontalDistancePx/100,12));
 assert.ok(result.sceneDistance>result.nearestSceneDistance);
}));

test("vehicle targeting skips a clear nearest point outside the selected weapon arc",()=>fixture(({source,target,blocker})=>{
 source.actor.type="vehicle";source.document.rotation=180;blocker.center.y=2000;
 target.center={x:500,y:-300};target.w=300;target.h=800;
 const weapon={system:{metadata:{fireArcs:["fore"]}}};
 const result=measureTokenRange(source,target,{scene,weapon});
 assert.equal(result.lineOfSight,"clear");assert.equal(result.firingArc,"fore");assert.equal(result.arcError,"");
 assert.equal(result.sightPath,"alternate");assert.equal(result.partiallyObscured,false);
 assert.ok(result.traceTarget.y<=-result.traceTarget.x+1e-4);
 assert.ok(result.distancePx>result.nearestDistancePx);
}));
test("blocked legal arcs cannot be replaced with a clear illegal arc",()=>fixture(({source,target,blocker})=>{
 source.actor.type="vehicle";source.document.rotation=180;blocker.center.y=2000;
 target.center={x:500,y:-300};target.w=300;target.h=800;
 CONFIG.Canvas.polygonBackends.sight.testCollision=(a,b)=>b.y<=-b.x+1e-4 ? {x:(a.x+b.x)/2,y:(a.y+b.y)/2} : null;
 const result=measureTokenRange(source,target,{scene,weapon:{system:{metadata:{fireArcs:["fore"]}}}});
 assert.ok(result.arcError);assert.equal(result.arcValid,false);
}));
test("automatic vehicle weapon selection chooses a usable arc but preserves an explicit weapon choice",()=>fixture(({source,target,blocker})=>{
 source.actor.type="vehicle";source.document.rotation=180;blocker.center.y=2000;
 const mount=(id,arcs)=>({id,name:id,type:"weapon",system:{equipped:true,skill:"gunnery",range:"close",metadata:{fireArcs:arcs}}});
 source.actor.items=[mount("fore cannon",["fore"]),mount("starboard cannon",["starboard"])];
 target.center={x:800,y:0};target.h=100;
 const automatic=buildAttackTracePreview(source,target,{scene});
 assert.equal(automatic.attack.itemId,"starboard cannon");assert.equal(automatic.range.firingArc,"starboard");
 const manual=buildAttackTracePreview(source,target,{scene,selection:{itemId:"fore cannon"}});
 assert.equal(manual.attack.itemId,"fore cannon");assert.ok(manual.range.arcError);
}));
