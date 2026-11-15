import test from "node:test";
import assert from "node:assert/strict";
import { characterConditions } from "../src/character-conditions.mjs";

test("wounds alone do not create a mechanical condition", () => {
  assert.deepEqual(characterConditions({system:{wounds:{value:10,max:12}}}), []);
});

test("lists active effects and explains recorded changes without guessing other penalties", () => {
  const actor = {system:{}, allApplicableEffects:function* () {
    yield {name:"EFFECT.StatusBleeding",statuses:new Set(["bleeding"]),active:true};
    yield {name:"Slowed",description:"While in the field.",changes:[{mode:2,key:"system.defense.melee",value:"-1"}]};
    yield {name:"Disabled",disabled:true,changes:[{mode:5,key:"system.wounds.max",value:"0"}]};
    yield {name:"Suppressed",isSuppressed:true};
    yield {name:"Inactive",active:false};
  }};
  const entries = characterConditions(actor, {localize:key=>key==="EFFECT.StatusBleeding"?"Bleeding":key});
  assert.deepEqual(entries.map(entry=>entry.name), ["Bleeding","Slowed"]);
  assert.equal(entries[0].markerOnly,true);
  assert.deepEqual(entries[1].changes,[{operation:"Add",value:"-1",field:"Defense · melee"}]);
  assert.equal(entries[1].description,"While in the field.");
  assert.equal(entries[1].markerOnly,false);
});

test("shows source-cited record-only critical injuries and excludes healed entries", () => {
  const [entry] = characterConditions({system:{criticals:[
    {name:"Test injury",source:{book:"Owned test adventure",page:"17"},automation:"record-only"},
    {name:"Resolved injury",healed:true}
  ]}});
  assert.deepEqual(entry,{name:"Test injury",description:"",source:"Owned test adventure, p. 17",changes:[],markerOnly:false,injury:true,recordOnly:true});
});

test("shows the native ongoing dice modifier and marks explicit GM records",()=>{
  const records={flags:{"star-wars-ffg":{conditions:[
    {name:"Distracted",automation:"pool-modifier",modifier:{count:1,die:"setback",skillKey:"athletics"}},
    {name:"Bruised",automation:"record-only",source:{book:"Owned test guide",page:"12"}}
  ]}}};
  const [distracted,bruised]=characterConditions(records);
  assert.deepEqual(distracted.changes,[{operation:"Add",value:"1 Setback",field:"Athletics"}]);
  assert.equal(distracted.recordOnly,false);
  assert.equal(bruised.recordOnly,true);
  assert.equal(bruised.injury,false);
});
