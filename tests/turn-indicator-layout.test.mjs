import test from "node:test";
import assert from "node:assert/strict";
import { chooseTurnIndicatorLayout } from "../src/turn-indicator-layout.mjs";

const viewport={left:0,top:0,right:1756,bottom:1292},size={width:165,height:35};
const hud={left:424,top:483.5,right:532,bottom:608.5};
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

test("Act/Man clears the overflowing HUD controls from the reported screenshot",()=>{
  const anchor={x:478,y:521};
  const normal=chooseTurnIndicatorLayout({anchor,size,viewport});
  assert.ok(overlaps(normal,hud),"positive control: artwork-only placement reproduces the overlap");
  const placed=chooseTurnIndicatorLayout({anchor,size,viewport,occupied:[hud]});
  assert.ok(placed.bottom<=hud.top-8);assert.equal(placed.left,normal.left);
  assert.deepEqual(chooseTurnIndicatorLayout({anchor,size,viewport}),normal,"closing HUD restores the normal anchor");
});

test("top-edge HUD falls back to a clear on-screen position",()=>{
  const occupied=[{left:100,top:0,right:290,bottom:145}];
  const layout=chooseTurnIndicatorLayout({anchor:{x:180,y:35},size,viewport:{left:0,top:0,right:350,bottom:300},occupied});
  assert.ok(layout.top>=153);assert.ok(layout.bottom<=292);
  assert.ok(layout.left>=8&&layout.right<=342);assert.ok(!overlaps(layout,occupied[0]));
});

test("windows and previously placed indicators are avoided with deterministic placement",()=>{
  const occupied=[hud,{left:340,top:320,right:630,bottom:480},{left:540,top:470,right:750,bottom:530}];
  const args={anchor:{x:478,y:521},size,viewport,occupied};
  const layout=chooseTurnIndicatorLayout(args);
  assert.ok(occupied.every(r=>!overlaps(layout,r)));
  assert.deepEqual(chooseTurnIndicatorLayout(args),layout);
  const second=chooseTurnIndicatorLayout({...args,occupied:[...occupied,layout]});
  assert.ok(!overlaps(layout,second));assert.ok(occupied.every(r=>!overlaps(second,r)));
});

test("HUD scaling and viewport resize preserve clearance; a crowded screen remains bounded",()=>{
  for(const scale of [.25,.5,1,2]) {
    const bounds={left:300-75*scale,right:300+75*scale,top:300-60*scale,bottom:300+80*scale};
    const layout=chooseTurnIndicatorLayout({anchor:{x:300,y:300},size,viewport,occupied:[bounds]});
    assert.ok(!overlaps(layout,bounds));assert.ok(layout.bottom<=bounds.top-8);
  }
  const small={left:0,top:0,right:220,bottom:130};
  const layout=chooseTurnIndicatorLayout({anchor:{x:900,y:-400},size,viewport:small,occupied:[small]});
  assert.ok(layout.left>=8&&layout.right<=212&&layout.top>=8&&layout.bottom<=122);
});
