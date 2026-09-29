import test from "node:test";
import assert from "node:assert/strict";
import { registerTurnEconomy, rotateToken } from "../src/turn-economy-foundry.mjs";

test("vehicle movement disables Foundry auto-facing before commit without changing position, waypoints or explicit rotation", async()=>{
  const keys=["game","Hooks","canvas"],saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),hooks=new Map();
  globalThis.game={user:{isGM:true},settings:{register:()=>{},get:()=>false}};
  globalThis.canvas={};
  globalThis.Hooks={once:()=>{},on:(name,fn)=>hooks.set(name,[...(hooks.get(name)??[]),fn])};
  try {
    registerTurnEconomy();
    const handlers=hooks.get("preMoveToken");assert.ok(handlers?.length,"exercise the real registered movement path");
    for(const method of ["dragging","keyboard","api","undo"])for(const [x,y]of [[100,0],[-100,0],[0,100],[0,-100],[100,100],[-100,-100]]) {
      const token={rotation:123,actor:{type:"vehicle"}},destination={x,y},waypoints=[destination];
      const move=Object.seal({autoRotate:true,method,origin:{x:0,y:0},destination,passed:{waypoints}});
      for(const handler of handlers)assert.notEqual(handler(token,move,{}),false);
      assert.equal(move.autoRotate,false,`${method} must preserve a vehicle bearing in direction ${x},${y}`);
      assert.equal(token.rotation,123);assert.equal(move.destination,destination);assert.equal(move.passed.waypoints,waypoints);
    }
    for(const type of ["character","minion","rival","nemesis"])for(const autoRotate of [true,false]) {
      const move={autoRotate,method:"dragging"};
      for(const handler of handlers)handler({actor:{type}},move,{});
      assert.equal(move.autoRotate,autoRotate,"personal actors retain the Foundry preference");
    }
    const doc={isOwner:true,rotation:123,actor:{type:"vehicle"},update:async change=>Object.assign(doc,change)};
    await rotateToken(doc,"cw",15);assert.equal(doc.rotation,138);
    await rotateToken(doc,"ccw",45);assert.equal(doc.rotation,93,"manual vehicle rotation remains available");
  }finally{for(const key of keys)globalThis[key]=saved[key];}
});
