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

test("damage increase replaces effect and requests a blood splatter only for bleeding actors",async()=>{
  const f=fixture({species:"Human",wounds:9,prior:{id:"prior",kind:"blood",severity:1,wounds:3}});
  await syncDorDamageEffect(f.token,{api:f.api,scene:f.scene,isAuthority:true});
  assert.deepEqual(f.calls.map(call=>[call.action,call.preset??call.id]),[["stop","prior"],["play","bleed"],["play","blood_splatter"]]);
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
  } finally {globalThis.Hooks=originalHooks;}
});
