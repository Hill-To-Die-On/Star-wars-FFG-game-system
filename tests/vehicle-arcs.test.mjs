import test from "node:test";
import assert from "node:assert/strict";
import { weaponArcProfile, checkWeaponArc } from "../src/range-overlay/arcs.mjs";
test("firing zones start at hull corners and cannot claim the side of a long ship as Fore",()=>{
  const weapon={system:{metadata:{fireArcs:["fore","starboard"]}}},hull={x:0,y:0,width:200,height:1000,rotation:180};
  const check=(point,fireArc)=>checkWeaponArc(weapon,{origin:{x:0,y:0},point,rotation:180,hull,fireArc});
  assert.equal(check({x:350,y:-550},"fore").inArc,false);
  assert.equal(check({x:350,y:-550},"starboard").inArc,true);
  for(const arc of ["fore","starboard"])assert.equal(check({x:200,y:-600},arc).inArc,true);
  assert.equal(check({x:201,y:-600},"fore").inArc,false);
  const wide=checkWeaponArc(weapon,{origin:{x:0,y:0},point:{x:450,y:-150},rotation:180,fireArc:"fore",hull:{...hull,width:1000,height:200}});
  assert.equal(wide.inArc,true);
});

const weapon=(fireArcs,extra={})=>({system:{metadata:{fireArcs,...extra}}});
const check=(w,point,extra={})=>checkWeaponArc(w,{origin:{x:0,y:0},point,rotation:180,...extra});

test("vehicle arcs follow native Foundry bearings: zero south, 180 north, 90 west",()=>{
 const fore=weapon(["fore"]);
 assert.equal(check(fore,{x:0,y:-100}).inArc,true);
 assert.equal(check(fore,{x:0,y:100}).inArc,false);
 assert.equal(check(fore,{x:0,y:100},{rotation:0}).inArc,true);
 assert.equal(check(fore,{x:-100,y:0},{rotation:90}).inArc,true);
 assert.equal(check(fore,{x:100,y:0},{rotation:270}).inArc,true);
 assert.equal(check(weapon(["port"]),{x:-100,y:0}).inArc,true);
 assert.equal(check(weapon(["starboard"]),{x:100,y:0}).inArc,true);
});
test("adjacent weapon arcs share their precise boundary without opening an opposite arc",()=>{
 assert.equal(check(weapon(["fore"]),{x:100,y:-100}).inArc,true);
 assert.equal(check(weapon(["starboard"]),{x:100,y:-100}).inArc,true);
 assert.equal(check(weapon(["port"]),{x:100,y:-100}).inArc,false);
 assert.equal(check(weapon(["fore"]),{x:101,y:-100}).inArc,false);
});
test("source-checked arcs and legacy import labels normalize without guessing unknown arcs",()=>{
 assert.deepEqual(weaponArcProfile(weapon(["fore","aft"])).arcs,["fore","aft"]);
 assert.deepEqual(weaponArcProfile({system:{metadata:{firingArc:"Forward, Port and Starboard"}}}).arcs,["fore","port","starboard"]);
 assert.equal(weaponArcProfile({system:{metadata:{firingArc:"All"}}}).arcs.length,4);
 for(const metadata of [{},{fireArcs:["fore","maybe"]},{firingArc:"Special mount"}]) {
   const result=check({system:{metadata}},{x:0,y:-100});
   assert.equal(result.inArc,null);assert.match(result.error,/recorded|unknown/i);
 }
});
test("dorsal and ventral restrictions use elevation and are not inferred from a side mount",()=>{
 assert.equal(check(weapon(["fore","aft","port","starboard"],{location:"dorsal"}),{x:0,y:-100},{sourceElevation:10,targetElevation:0}).inArc,false);
 assert.equal(check(weapon(["fore","aft","port","starboard"],{location:"ventral"}),{x:0,y:-100},{sourceElevation:0,targetElevation:10}).inArc,false);
 assert.equal(check(weapon(["fore"],{location:"port"}),{x:0,y:-100}).inArc,true);
 assert.equal(check(weapon(["fore"],{location:"dorsal"}),{x:0,y:-100}).inArc,true);
});
test("an explicit sheet override is validated and replaces the recorded horizontal arcs",()=>{
 assert.equal(check(weapon(["fore"],{fireArcOverride:"aft"}),{x:0,y:100}).inArc,true);
 assert.equal(check(weapon(["fore"],{fireArcOverride:"aft"}),{x:0,y:-100}).inArc,false);
 assert.equal(check(weapon(["fore"],{fireArcOverride:"anything"}),{x:0,y:-100}).inArc,null);
});
