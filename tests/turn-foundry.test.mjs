import {transactionWorld} from './fixtures/document-transactions.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { rotateToken, turnIndicatorHTML, tokenIndicatorPosition, tokenLabelPosition, turnIndicatorObstacleBounds, shouldTrackMovement, mayManageTurns, authorizeTurnRequest } from "../src/turn-economy-foundry.mjs";
import { turnBudget } from "../src/turn-economy.mjs";
import { TurnTransactionCoordinator } from "../src/turn-transactions.mjs";
import { chooseTurnIndicatorLayout } from "../src/turn-indicator-layout.mjs";

test("rotation uses native bearings, wraps both ways and never modifies turn spending", async () => {
  const writes=[], token={isOwner:true,rotation:350,lockRotation:false,update:async data=>writes.push(data)};
  await rotateToken(token,"cw"); assert.deepEqual(writes.pop(),{rotation:35});
  token.rotation=5; await rotateToken(token,"ccw",15); assert.deepEqual(writes.pop(),{rotation:350});
  token.isOwner=false; await assert.rejects(rotateToken(token,"cw"),/Owner/);
  token.isOwner=true; token.lockRotation=true; await assert.rejects(rotateToken(token,"cw"),/locked/i);
});
test("sheet/token indicators expose remaining lights, temporary purchases and accessible labels", () => {
  const a={type:"character",system:{},items:[]};
  const html=turnIndicatorHTML(turnBudget(a),{editable:true});
  assert.match(html,/Use action/); assert.match(html,/Use manoeuvre/);
  assert.match(html,/Buy extra manoeuvre/); assert.match(html,/2 strain/);
  assert.doesNotMatch(html,/undefined/);
});
test("selected-token indicator anchor clears the artwork, including a rotated square vehicle", () => {
  const small=tokenIndicatorPosition({x:100,y:200,w:100,h:100,mesh:{width:100,height:100,angle:0}});
  assert.deepEqual(small,{x:150,y:200});
  const rotated=tokenIndicatorPosition({x:100,y:200,w:100,h:100,mesh:{width:100,height:100,angle:45}});
  assert.ok(rotated.y<180);
  assert.ok(tokenLabelPosition({x:100,y:200,w:100,h:100,mesh:{width:100,height:100,angle:45}}).y>320);
});

test("HUD avoidance includes overflowing elevation/rotation controls but ignores hidden palettes",()=>{
  const previous={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle};
  const node=(left,top,right,bottom,visible=true)=>({visible,getBoundingClientRect:()=>({left,top,right,bottom,width:right-left,height:bottom-top})});
  const hud=node(453,521,503,571);
  hud.querySelectorAll=()=>[node(424,483.5,449,501),node(427.75,591,445.25,608.5),node(507,496,532,596),node(536,100,900,617,false)];
  const panel=node(1000,0,1200,700);
  globalThis.document={querySelector:()=>hud,querySelectorAll:()=>[panel]};
  globalThis.getComputedStyle=el=>({display:"block",visibility:el.visible?"visible":"hidden",opacity:"1"});
  try {
    const bounds=turnIndicatorObstacleBounds();
    assert.deepEqual(bounds,[{left:1000,top:0,right:1200,bottom:700},{left:424,top:483.5,right:532,bottom:608.5}]);
    hud.querySelectorAll=()=>[];
    assert.equal(turnIndicatorObstacleBounds()[1].top,521,"positive control: root alone misses the overflowing HUD");
  }finally{for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test("turn indicators avoid rendered elevation and level labels at camera and CSS scales",()=>{
  const keys=["canvas","document","game"],previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
  globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};globalThis.game={user:{isGM:false}};
  try {
    for(const zoom of [.25,1,2])for(const cssScale of [.75,1,1.5]) {
      const left=40,top=20,origin={x:300*zoom,y:300*zoom};
      const label=(text,x,y,width,height,extra={})=>({text,visible:true,getBounds:()=>({x,y,width,height}),...extra});
      const elevation=label("+150 m",origin.x-35*zoom,origin.y-30*zoom,70*zoom,26*zoom);
      const level=label("Upper deck",origin.x-40*zoom,origin.y-55*zoom,80*zoom,22*zoom);
      globalThis.canvas={app:{renderer:{screen:{width:1000,height:800}},canvas:{getBoundingClientRect:()=>({left,top,width:1000*cssScale,height:800*cssScale})}},tokens:{placeables:[
        {visible:true,tooltip:elevation,levelIndicator:level,nameplate:label("",0,0,100,40)},
        {visible:false,tooltip:label("Secret height",0,0,100,40)},
        {visible:true,tooltip:label("Hidden tooltip",0,0,100,40,{visible:false})},
      ]}};
      const occupied=turnIndicatorObstacleBounds();
      assert.equal(occupied.length,2,"only visible, nonempty canvas labels reserve space");
      const expected={left:left+(origin.x-35*zoom)*cssScale,top:top+(origin.y-30*zoom)*cssScale,
        right:left+(origin.x+35*zoom)*cssScale,bottom:top+(origin.y-4*zoom)*cssScale};
      assert.deepEqual(occupied[0],expected,"PIXI renderer bounds must be converted to CSS pixels");
      const layout=chooseTurnIndicatorLayout({anchor:{x:left+origin.x*cssScale,y:top+origin.y*cssScale},size:{width:100,height:35},
        viewport:{left:0,top:0,right:1600,bottom:1400},occupied});
      for(const b of occupied)assert.ok(layout.bottom<=b.top-8 || layout.top>=b.bottom+8 || layout.right<=b.left-8 || layout.left>=b.right+8,
        `elevation/level label covered at zoom ${zoom}, CSS scale ${cssScale}`);
      elevation.visible=false;level.visible=false;assert.equal(turnIndicatorObstacleBounds().length,0);
    }
  }finally{for(const key of keys)globalThis[key]=previous[key];}
});
test("GM world policy guards manual changes at the authority, while automatic spending remains available", () => {
  const actor={canUserModify: user=>user.id === "owner"}, owner={id:"owner"}, other={id:"other"}, gm={id:"gm",isGM:true};
  assert.equal(mayManageTurns(actor,owner,"gm"),false);
  assert.equal(mayManageTurns(actor,owner,"players"),true);
  assert.equal(mayManageTurns(actor,other,"players"),false);
  assert.equal(mayManageTurns(actor,gm,"gm"),true);
  for(const command of ["buyManeuver","tradeManeuver","grant","undo","reset"])
    assert.throws(()=>authorizeTurnRequest(actor,command,{automatic:"roll"},owner,"gm"),/GM/);
  assert.doesNotThrow(()=>authorizeTurnRequest(actor,"action",{automatic:"roll"},owner,"gm"));
  assert.doesNotThrow(()=>authorizeTurnRequest(actor,"maneuver",{automatic:"move"},owner,"gm"));
  assert.throws(()=>authorizeTurnRequest(actor,"action",{},owner,"gm"),/GM/);
  assert.doesNotThrow(()=>authorizeTurnRequest(actor,"reset",{},owner,"players"));
  assert.throws(()=>authorizeTurnRequest(actor,"reset",{},other,"players"),/Owner/);
  assert.throws(()=>authorizeTurnRequest(actor,"activate",{},owner,"players"),/GM/);
});
test("only committed voluntary drags in combat trigger movement spending", () => {
  const doc={actor:{type:"character"}}, move={method:"dragging",origin:{x:0,y:0},destination:{x:10,y:0},id:"move"};
  assert.equal(shouldTrackMovement(doc,move,{},true),true);
  for(const method of ["api","config","hud","undo","paste","keyboard"])
    assert.equal(shouldTrackMovement(doc,{...move,method},{},true),false);
  assert.equal(shouldTrackMovement(doc,{...move,planned:true},{},true),false);
  assert.equal(shouldTrackMovement(doc,move,{starWarsFreeMovement:true},true),false);
  assert.equal(shouldTrackMovement(doc,move,{},false),false);
  assert.equal(shouldTrackMovement(doc,{...move,destination:move.origin},{},true),false);
});
test("concurrent owners cannot spend the same action and unlinked UUIDs remain distinct",async () => {
  const listeners=new Set(), socket={on:(_c,f)=>listeners.add(f),off:(_c,f)=>listeners.delete(f),
    emit:(_c,m)=>queueMicrotask(()=>{for(const f of listeners) f(structuredClone(m));})};
  const gm={id:"gm",isGM:true,active:true}, player={id:"player",active:true}, users=[gm,player];
  const actor={id:"same",uuid:"Scene.one.Token.a.Actor.same",isOwner:true,canUserModify:()=>true,remaining:1};
  const other={...actor,uuid:"Scene.one.Token.b.Actor.same"};
  const resolve=uuid=>[actor,other].find(a=>a.uuid===uuid);
  const execute=async a=>{if(!a.remaining) throw new Error("No action remaining"); a.remaining--;return a.remaining;};
  const world=transactionWorld(users);
  const make=user=>new TurnTransactionCoordinator({transport:world.client(user).transport,currentUser:()=>user,users:()=>users,getActor:resolve,execute}).start();
  const g=make(gm),p=make(player);
  try {
    const results=await Promise.allSettled([p.request(actor,"action"),p.request(actor,"action")]);
    assert.deepEqual(results.map(r=>r.status).sort(),["fulfilled","rejected"]);
    assert.equal(await p.request(other,"action"),0);
  } finally {p.stop();g.stop();world.stop();}
});
