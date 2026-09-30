import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_ID } from "../src/config.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
import { crewGenerationDefaults, planCrewGeneration, preparedCrewRows } from "../src/crew-generation.mjs";

const species={_id:"human",name:"Human",type:"species",system:{source:{book:"Edge of the Empire Core Rulebook",page:"1"},metadata:{Playable:true,Brawn:2,Agility:2,Intellect:2,Cunning:2,Willpower:2,Presence:2,Wound_Base:10,Strain_Base:10,XP:110}}};
const vehicle={name:"Test ship",type:"vehicle",system:{crew:"3",passengers:"6"}};
const plan=(recipe={},rows=[],actor=vehicle)=>planCrewGeneration(actor,recipe,{rows,species,campaign:DEFAULT_CAMPAIGN});

test("crew presets fill only vacant crew places and never assume passengers or duplicate a pilot",()=>{
  assert.deepEqual(crewGenerationDefaults(vehicle,[]),{pilot:1,copilot:0,gunner:0,engineer:0,navigator:0,commander:0,support:2,passenger:0});
  const defaults=crewGenerationDefaults(vehicle,[{count:2,seat:"crew",roles:["pilot"]}]);
  assert.equal(defaults.pilot,0);assert.equal(defaults.support,1);assert.equal(defaults.passenger,0);
});
test("generated specialists are editable rivals using catalogue species stats and only selected duty skills",()=>{
  const p=plan({counts:{pilot:1,engineer:1},rank:2});
  assert.equal(p.people,2);assert.equal(p.members.length,2);
  const pilot=p.members[0];assert.equal(pilot.source.type,"rival");assert.deepEqual(pilot.roles,["pilot"]);
  assert.equal(pilot.source.system.characteristics.agility,2);assert.equal(pilot.source.system.wounds.max,12);
  assert.equal(pilot.source.system.skills.pilotingSpace.rank,2);assert.equal(pilot.source.system.skills.pilotingPlanetary.rank,2);
  assert.equal(pilot.source.system.skills.gunnery,undefined);assert.equal(pilot.source.system.xp.total,0);
  assert.ok(pilot.source.system.incomplete.length);assert.equal(pilot.source.flags[SYSTEM_ID].generatedCrew.kind,"generic-npc-preset");
  assert.equal(p.members[1].source.system.skills.mechanics.rank,2);
});
test("large support complements become independent minion groups of at most 100 without invented training",()=>{
  const p=plan({counts:{pilot:1,support:164,passenger:6}},[],{...vehicle,system:{crew:"165",passengers:"600"}});
  assert.equal(p.people,171);assert.deepEqual(p.members.map(m=>m.count),[1,100,64,6]);
  assert.deepEqual(p.members[1].roles,[]);assert.deepEqual(p.members[1].source.system.skills,{});
  assert.equal(p.members[1].source.type,"minion");assert.equal(p.members[1].source.system.groupSize,100);
  assert.equal(p.members[3].seat,"passenger");
});
test("invalid, excessive and stale generation requests fail before producing a plan",()=>{
  assert.throws(()=>plan({counts:{pilot:1},rank:6}),/rank/i);
  assert.throws(()=>plan({counts:{pilot:-1}}),/whole/i);
  assert.throws(()=>plan({counts:{wizard:1}}),/duty/i);
  assert.throws(()=>plan({counts:{pilot:2}}),/pilot/i);
  assert.throws(()=>plan({counts:{pilot:1}},[{count:1,seat:"crew",roles:["pilot"]}]),/pilot/i);
  assert.throws(()=>plan({counts:{engineer:2}},[{count:2,seat:"crew",roles:[]}]),/crew.*capacity/i);
  assert.throws(()=>plan({counts:{passenger:7}}),/passenger.*capacity/i);
  assert.throws(()=>plan({counts:{support:1}},[],{...vehicle,system:{crew:"varies"}}),/exact.*crew/i);
  assert.throws(()=>plan({counts:{support:1001}},[],{...vehicle,system:{crew:"9999"}}),/1,000/i);
  assert.throws(()=>plan({counts:{gunner:51}},[],{...vehicle,system:{crew:"100"}}),/50 NPC/i);
  assert.throws(()=>plan({counts:{}}),/at least one/i);
});
test("species restrictions are enforced and prepared rosters read current actor counts",()=>{
  assert.throws(()=>planCrewGeneration(vehicle,{counts:{pilot:1}},{species,campaign:{...DEFAULT_CAMPAIGN,lines:["force"]}}),/species/i);
  const actor={...vehicle,flags:{[SYSTEM_ID]:{preparedCrew:[{id:"a",actorId:"a",seat:"crew",roles:["pilot"]}]}}};
  const actors=new Map([["a",{id:"a",name:"Changed pilot",type:"minion",system:{groupSize:3,wounds:{value:0,max:5}}}]]);
  const rows=preparedCrewRows(actor,actors);
  assert.equal(rows[0].name,"Changed pilot");assert.equal(rows[0].count,3);
  assert.equal(preparedCrewRows(actor,new Map())[0].missing,true);
});
