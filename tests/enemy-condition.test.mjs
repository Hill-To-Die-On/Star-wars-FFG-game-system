import test from "node:test";
import assert from "node:assert/strict";
import { suggestEnemyCondition, validateEnemyCondition, impairmentForCheck, damageVisualState } from "../src/enemy-condition.mjs";

test("damaged security droid starts wounded with an impaired scanner",()=>{
  assert.deepEqual(suggestEnemyCondition("Damaged Security Droid",12),{wounds:3,impairment:"scanner"});
  assert.deepEqual(suggestEnemyCondition("Security Droid",12),{wounds:0,impairment:"none"});
  assert.throws(()=>validateEnemyCondition({wounds:12,impairment:"scanner"},12),/active enemy/);
});

test("selected impairment affects its actual check and explains the extra setback",()=>{
  const actor={system:{metadata:{damageImpairment:"scanner"}}};
  assert.equal(impairmentForCheck(actor,"perception").setback,1);
  assert.equal(impairmentForCheck(actor,"vigilance").setback,1);
  assert.equal(impairmentForCheck(actor,"melee").setback,0);
  assert.match(impairmentForCheck(actor,"perception").note,/scanner/i);
});

test("wounds determine DoR effect strength and only bleeding actors get blood",()=>{
  const droid={type:"minion",system:{species:"Droid",metadata:{damageVisual:"auto"},wounds:{value:3,max:12}}};
  assert.deepEqual(damageVisualState(droid),{kind:"sparks",severity:1,preset:"sparks"});
  assert.deepEqual(damageVisualState({...droid,system:{...droid.system,wounds:{value:9,max:12}}}),{kind:"sparks",severity:3,preset:"sparks"});
  const organic={type:"character",system:{species:"Human",metadata:{damageVisual:"auto"},wounds:{value:5,max:12}}};
  assert.equal(damageVisualState(organic).preset,"bleed");
  assert.equal(damageVisualState({...organic,system:{...organic.system,metadata:{damageVisual:"none"}}}).kind,"none");
  assert.equal(damageVisualState({...organic,system:{...organic.system,wounds:{value:0,max:12}}}).kind,"none");
});
