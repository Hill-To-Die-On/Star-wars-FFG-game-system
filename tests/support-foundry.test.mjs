import test from "node:test";
import assert from "node:assert/strict";
globalThis.foundry={applications:{api:{ApplicationV2:class {},HandlebarsApplicationMixin:Base=>Base}}};
const allowed={id:"allowed",name:"Visible",system:{advancement:[]},items:[],testUserPermission:()=>true};
const hidden={id:"hidden",name:"PRIVATE",system:{advancement:[{name:"PRIVATE"}]},items:[],testUserPermission:()=>false};
globalThis.game={user:{isGM:false},actors:[allowed,hidden],settings:{get:()=>({bookMode:"all"})},modules:new Map()};
const {SupportWindow,supportApi}=await import("../src/support-foundry.mjs");
test("support window and API exclude inaccessible actors, including a stale selected actor",async()=>{
 const app=new SupportWindow();app.filters.actorId="hidden";
 const context=await app._prepareContext();
 assert.deepEqual(context.actors.map(a=>a.id),["allowed"]);
 assert.equal(context.hasActor,false);
 assert.ok(!JSON.stringify(context).includes("PRIVATE"));
 assert.throws(()=>supportApi.actorCoverage(hidden),/Observer permission/);
 assert.equal(supportApi.actorCoverage(allowed).total,0);
});
test("revoking access after selection immediately removes the actor report",async()=>{
 let permitted=true;
 const actor={...allowed,testUserPermission:()=>permitted};
 game.actors=[actor];
 const app=new SupportWindow();app.filters.actorId="allowed";
 assert.equal((await app._prepareContext()).hasActor,true);
 permitted=false;
 assert.equal((await app._prepareContext()).hasActor,false);
 assert.throws(()=>supportApi.actorCoverage(actor),/Observer permission/);
});

