import test from "node:test";
import assert from "node:assert/strict";
import { recordedSyntheticTarget } from "../src/tabletop-foundry.mjs";

function fixture() {
  const scene={id:"round-scene",tokens:new Map()};
  const token={id:"target",parent:scene,hidden:false};
  const actor={uuid:"Scene.round-scene.Token.target.Actor.base",isToken:true,token};
  token.actor=actor;
  scene.tokens.set(token.id,token);
  const message={isRoll:true,rolls:[{}],speaker:{scene:scene.id},
    flags:{"star-wars-ffg":{targetActorUuid:actor.uuid,outcome:{passed:true}}}};
  return {scene,token,actor,message};
}

test("a recorded synthetic target resolves only to the exact live Actor on the roll's Scene",async()=>{
  const {scene,actor,message}=fixture();
  assert.equal(await recordedSyntheticTarget(message,scene,async uuid=>uuid===actor.uuid?actor:null),actor);
  const sameNameBase={uuid:"Actor.base",isToken:false};
  await assert.rejects(recordedSyntheticTarget(message,scene,async()=>sameNameBase),/recorded token/i);
  await assert.rejects(recordedSyntheticTarget(message,{...scene,id:"other"},async()=>actor),/recorded token/i);
});

test("a hidden, stale, or unrelated actor cannot silently replace the recorded token",async()=>{
  const {scene,actor,token,message}=fixture();
  token.hidden=true;
  await assert.rejects(recordedSyntheticTarget(message,scene,async()=>actor),/recorded token/i);
  token.hidden=false;
  scene.tokens.delete(token.id);
  await assert.rejects(recordedSyntheticTarget(message,scene,async()=>actor),/recorded token/i);
  message.flags["star-wars-ffg"].targetActorUuid="Actor.base";
  assert.equal(await recordedSyntheticTarget(message,scene,async()=>assert.fail("unlinked world path")),undefined);
});
