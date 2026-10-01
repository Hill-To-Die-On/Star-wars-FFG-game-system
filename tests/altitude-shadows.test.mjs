import test from "node:test";
import assert from "node:assert/strict";
import { shadowSettings, projectAltitudeShadow, shadowReceivers, canCastAltitudeShadow, shadowRasterPlan } from "../src/altitude-shadows.mjs";

test("altitude shadows use the receiving surface height and scene units",()=>{
  const options={elevation:30,surface:10,pixelsPerUnit:20,direction:0,sunElevation:45,softness:.04,opacity:.3,heightScale:"linear"};
  const low=projectAltitudeShadow(options),high=projectAltitudeShadow({...options,elevation:50});
  assert.equal(low.gap,20);assert.ok(Math.abs(low.dx-400)<1e-8);assert.equal(low.dy,0);
  assert.ok(high.dx>low.dx && high.blur>low.blur);
  assert.deepEqual(projectAltitudeShadow({...options,elevation:0}),null);
  assert.equal(projectAltitudeShadow({...options,elevation:10}),null);
  assert.equal(projectAltitudeShadow({...options,pixelsPerUnit:0}),null);
  assert.equal(projectAltitudeShadow({...options,elevation:NaN}),null);
  assert.ok(Math.abs(projectAltitudeShadow({...options,direction:90}).dy-400)<1e-8);
  assert.ok(projectAltitudeShadow({...options,sunElevation:90}).dx<1e-8);
});

test("logarithmic altitude keeps orbital shadows usable with diminishing offset and feather growth",()=>{
  const base={surface:0,pixelsPerUnit:20,direction:0,sunElevation:45,heightReference:50};
  const a=projectAltitudeShadow({...base,elevation:50}),b=projectAltitudeShadow({...base,elevation:100}),c=projectAltitudeShadow({...base,elevation:150});
  assert.ok(a.dx<b.dx && b.dx<c.dx && c.dx-b.dx<b.dx-a.dx);
  assert.ok(a.blur<b.blur && b.blur<c.blur && c.blur-b.blur<b.blur-a.blur);
  assert.ok(Math.abs(a.visualHeight-50*Math.log(2))<1e-8);
  const orbit=projectAltitudeShadow({...base,elevation:100000});
  assert.equal(orbit.gap,100000,"real altitude is retained");assert.ok(orbit.visualHeight<400);
  const deck=projectAltitudeShadow({...base,elevation:150,surface:100});
  assert.equal(deck.dx,a.dx,"compression uses distance above the receiving surface");
  assert.ok(projectAltitudeShadow({...base,elevation:100000,heightScale:"linear"}).dx>orbit.dx*100);
});

test("receivers are visible native level planes, including ground below an unseen sky level",()=>{
  const ground={id:"ground",isVisible:true,elevation:{base:0}},deck={id:"deck",isVisible:true,elevation:{base:20}},sky={id:"sky",isVisible:false,elevation:{base:100}};
  const scene={levels:[ground,deck,sky]};
  assert.deepEqual(shadowReceivers(scene,ground).map(r=>[r.id,r.elevation]),[["ground",0],["deck",20]]);
  deck.flags={"star-wars-ffg":{shadowSurface:{enabled:false}}};
  assert.deepEqual(shadowReceivers(scene,ground).map(r=>r.id),["ground"]);
  ground.flags={"star-wars-ffg":{shadowSurface:{elevation:-5}}};
  assert.equal(shadowReceivers(scene,ground)[0].elevation,-5);
  assert.equal(shadowReceivers({levels:[]},null)[0].elevation,0);
});

test("cross-level casting does not require a rendered token and never casts concealed or embarked actors",()=>{
  const token={actor:{type:"vehicle",statuses:new Set()},level:"sky",hidden:false,alpha:1,texture:{src:"ship.svg"}};
  assert.equal(canCastAltitudeShadow(token),true);
  assert.equal(canCastAltitudeShadow({...token,object:{visible:false}}),true,"an off-level token may cast onto the ground");
  for(const patch of [{hidden:true},{alpha:0},{actor:{type:"group"}},{actor:{type:"vehicle",statuses:new Set(["invisible"])}},{flags:{"star-wars-ffg":{aboard:{vehicleId:"ship"}}}}])
    assert.equal(canCastAltitudeShadow({...token,...patch}),false);
});

test("shadow raster allocation is bounded, preserves aspect ratio and reserves feathering padding",()=>{
  for(const [width,height,blur] of [[100,100,2],[300,900,60],[10000,35000,2000],[100,100,10000]]){
    const p=shadowRasterPlan(width,height,blur);
    assert.ok(p.width<=512 && p.height<=512 && p.width>0 && p.height>0);
    assert.ok(p.padding>=p.blur*3);
    assert.ok(Math.abs(p.artWidth/p.artHeight-width/height)<1e-8);
    assert.ok(p.worldWidth>=width+blur*6);
  }
});

test("scene shadow configuration rejects invalid data and keeps numeric settings bounded",()=>{
  const p=shadowSettings({direction:450,sunElevation:-1,softness:Infinity,opacity:5});
  assert.equal(p.direction,90);assert.equal(p.sunElevation,5);assert.equal(p.opacity,.7);
  assert.ok(Number.isFinite(p.softness));assert.equal(shadowSettings({enabled:false}).enabled,false);
});
