import test from "node:test";
import assert from "node:assert/strict";
import { registerDorDamageEffects, syncDorDamageEffect } from "../src/dor-damage-vfx.mjs";

function fixture({wounds=3,species="Droid",prior=null,active=true,authority=true}={}) {
  const calls=[],flags=new Map(prior?[["damageVfx",prior]]:[]),effects=prior?.id?[{id:prior.id}]:[];
  const token={document:{id:"token-a",hidden:false,getFlag:(_system,key)=>flags.get(key),setFlag:async(_system,key,value)=>{flags.set(key,value);},unsetFlag:async(_system,key)=>{flags.delete(key);}},
    actor:{type:"minion",system:{species,metadata:{damageVisual:"auto"},wounds:{value:wounds,max:12}}}};
  const api=active?{visualEffect:async command=>{calls.push(command);if(command.action==="play")return `effect-${calls.length}`;return true;}}:null;
  const scene={id:"scene-a",getFlag:()=>({effects})};
  return {token,api,scene,calls,flags,authority};
}

test("active GM asks DoR for a wound-scaled droid spark effect and stores its ID",async()=>{
  const f=fixture();
  assert.equal(await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:f.authority}),true);
  assert.deepEqual(f.calls[0],{action:"play",preset:"sparks",tokenId:"token-a",loop:true,duration:60000,strength:2});
  assert.equal(f.flags.get("damageVfx").id,"effect-1");
});

test("ordinary damage retires legacy bleed and requests wounded without blood splatter",async()=>{
  const f=fixture({species:"Human",wounds:9,prior:{id:"prior",kind:"blood",severity:1,wounds:3}});
  await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true});
  assert.deepEqual(f.calls.map(call=>[call.action,call.preset??call.id]),[["stop","prior"],["play","wounded"]]);
  assert.equal(f.flags.get("damageVfx").severity,3);
});

test("healing stops the loop; missing DoR or GM authority makes no request",async()=>{
  const healed=fixture({wounds:0,prior:{id:"prior",kind:"sparks",severity:1,wounds:3}});
  await syncDorDamageEffect(healed.token,{api:healed.api,scene:healed.scene,isAuthority:true});
  assert.deepEqual(healed.calls,[{action:"stop",id:"prior"}]);
  assert.equal(healed.flags.has("damageVfx"),false);
  for(const blocked of [fixture({active:false}),fixture({authority:false})]) {
    assert.equal(await syncDorDamageEffect(blocked.token,{api:blocked.api,scene:blocked.scene,isAuthority:blocked.authority}),false);
    assert.deepEqual(blocked.calls,[]);
  }
});

test("damage effects rescan tokens when a GM tab becomes transaction authority",()=>{
  const originalHooks=globalThis.Hooks,events=[];
  globalThis.Hooks={on:name=>events.push(name)};
  try {
    registerDorDamageEffects();
    assert.ok(events.includes("starWarsAuthoritySelected"));
    assert.ok(events.includes("canvasReady"));
    assert.ok(events.includes("updateActor"));
    for(const event of ["createActiveEffect","updateActiveEffect","deleteActiveEffect"])assert.ok(events.includes(event));
  } finally {globalThis.Hooks=originalHooks;}
});


test("unsupported wounded preset removes legacy blood receipt without a misleading fallback",async()=>{
  const f=fixture({species:"Human",prior:{id:"prior",kind:"blood",severity:1,wounds:3}});
  f.api.visualEffect=async command=>{f.calls.push(command);return command.action==="stop"?true:null;};
  assert.equal(await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true}),false);
  assert.deepEqual(f.calls.map(c=>[c.action,c.preset??c.id]),[["stop","prior"],["play","wounded"]]);
  assert.equal(f.flags.has("damageVfx"),false);
});

test("active bleeding loops at zero wounds and unchanged live receipt is reused",async()=>{
  const f=fixture({species:"Human",wounds:0,prior:{id:"prior",kind:"blood",severity:1,wounds:0}});
  f.token.actor.effects=[{statuses:new Set(["bleeding"])}];
  assert.equal(await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true}),true);
  assert.deepEqual(f.calls,[]);
});


test("failed stop never starts a duplicate loop or discards its receipt",async()=>{
  const prior={id:"prior",kind:"blood",severity:1,wounds:3};
  const f=fixture({species:"Human",wounds:9,prior});
  f.api.visualEffect=async command=>{f.calls.push(command);return null;};
  assert.equal(await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true}),false);
  assert.deepEqual(f.calls,[{action:"stop",id:"prior"}]);
  assert.deepEqual(f.flags.get("damageVfx"),prior);
});

test("explicit bleeding alone authorizes splash on increased wounds and stops when suppressed",async()=>{
  const f=fixture({species:"Human",wounds:9,prior:{id:"prior",kind:"blood",severity:3,wounds:8}});
  const effect={statuses:new Set(["bleeding"]),isSuppressed:false};
  f.token.actor.effects=[effect];
  await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true});
  assert.deepEqual(f.calls.map(c=>c.preset),["blood_splatter"]);
  f.calls.length=0; effect.isSuppressed=true;
  await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true});
  assert.deepEqual(f.calls.map(c=>[c.action,c.preset??c.id]),[["stop","prior"],["play","wounded"]]);
});
