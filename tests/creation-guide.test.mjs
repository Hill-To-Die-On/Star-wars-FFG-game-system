import test from "node:test";
import assert from "node:assert/strict";
import { creationCandidates, spendCreationXp, creationReadiness, reviewGmCharacterBuild, planEnemy, CREATION_ROLES, validateFreeRanks } from "../src/creation-guide.mjs";
import { enemySpeciesOptions } from "../src/creation-guide-foundry.mjs";
import { readFileSync } from "node:fs";
import { SKILLS } from "../src/config.mjs";
import { DEFAULT_CAMPAIGN } from "../src/rules.mjs";
const source={book:"Edge of The Empire - Core Book",page:"40"};
const species={_id:"human",name:"Human",type:"species",system:{source,metadata:{Playable:true,Brawn:2,Agility:2,Intellect:2,Cunning:2,Willpower:2,Presence:2,Wound_Base:10,Strain_Base:10,XP:110}}};
const career={_id:"explorer",name:"Explorer",type:"career",system:{source,career:"Explorer",careerSkills:["pilotingSpace","astrogation","survival","perception"]}};
const spec={_id:"pilot",name:"Pilot",type:"specialization",system:{source,career:"Explorer",careerSkills:["pilotingSpace","gunnery"]}};
const entries=[species,career,spec];
const base=()=>({phase:"creation",creation:{applied:true,speciesAbilitiesPending:false,pocketMoneyPending:false},incomplete:[],characteristics:{brawn:2,agility:2,intellect:2,cunning:2,willpower:2,presence:2},skills:{pilotingSpace:{rank:1,career:true},gunnery:{rank:0,career:false}},xp:{total:110,available:110},soak:2,wounds:{max:12,value:0},strain:{max:12,value:0},advancement:[]});
test("guide narrows by actual skills and GM sources; no hidden fallback or invented options",()=>{
 const result=creationCandidates(entries,DEFAULT_CAMPAIGN,{role:"pilot",combat:"gunnery",aptitude:"agility",force:"any"});
 assert.deepEqual(result.careers.map(e=>e._id),["explorer"]);
 assert.deepEqual(result.specializations.map(e=>e._id),["pilot"]);
 assert.equal(creationCandidates(entries,DEFAULT_CAMPAIGN,{role:"medic"}).careers.length,0);
 assert.equal(creationCandidates(entries,{...DEFAULT_CAMPAIGN,bookMode:"selected",books:["Other"]},{}).species.length,0);
 assert.throws(()=>creationCandidates(entries,DEFAULT_CAMPAIGN,{role:"unknown"}));
 assert.equal(creationCandidates([...entries,{...career,_id:"unsupported",name:"Unsupported",system:{...career.system,career:"Unsupported"}}],DEFAULT_CAMPAIGN,{}).careers.length,1);
});
test("every guide role uses valid skills and finds published choices in the shipped catalogue",()=>{
 const catalogue=JSON.parse(readFileSync(new URL("../data/reference-library.json",import.meta.url))).documents.Item;
 for(const [role,definition] of Object.entries(CREATION_ROLES)) {
  assert.ok(definition.skills.length>0,role);assert.ok(definition.skills.every(k=>SKILLS[k]),role);
  const matches=creationCandidates(catalogue,DEFAULT_CAMPAIGN,{role});
  assert.ok(matches.species.length>0,role);assert.ok(matches.careers.length>0,role);assert.ok(matches.specializations.length>0,role);
 }
});
test("free ranks require the exact permitted count, with no unknown keys",()=>{
 const choices={career:["gunnery","pilotingSpace"],specialization:["gunnery","astrogation"]},counts={career:1,specialization:2};
 assert.doesNotThrow(()=>validateFreeRanks({"career:gunnery":"on","specialization:gunnery":"on","specialization:astrogation":"on"},choices,counts));
 assert.throws(()=>validateFreeRanks({},choices,counts),/Choose/);
 assert.throws(()=>validateFreeRanks({"career:unknown":"on"},choices,counts),/Unknown/);
});
test("creation XP draft enforces caps and cumulative prices without mutating starting state",()=>{
 const original=base(),result=spendCreationXp(original,{characteristics:{brawn:2},skills:{pilotingSpace:1,gunnery:1}});
 assert.equal(result.characteristics.brawn,4);assert.equal(result.wounds.max,14);assert.equal(result.soak,4);
 assert.equal(result.skills.pilotingSpace.rank,2);assert.equal(result.xp.available,20);
 assert.equal(original.xp.available,110);assert.equal(result.advancement.length,4);
 assert.throws(()=>spendCreationXp(base(),{skills:{pilotingSpace:2}}),/exceed 2/);
 assert.throws(()=>spendCreationXp(base(),{characteristics:{brawn:4}}));
 assert.throws(()=>spendCreationXp(base(),{characteristics:{brawn:3,agility:1}}),/enough/);
 assert.throws(()=>spendCreationXp(base(),{skills:{unknown:1}}),/Unknown/);
 assert.throws(()=>spendCreationXp({...base(),phase:"play"},{}),/creation/);
 assert.throws(()=>spendCreationXp(base(),{characteristics:{brawn:-1}}),/whole/);
});
test("completion requires reviewed source exceptions and starting funds; saved XP is permitted",()=>{
 assert.deepEqual(creationReadiness(base()),[]);
 assert.match(creationReadiness({...base(),creation:{applied:true,speciesAbilitiesPending:true,pocketMoneyPending:true}}).join(" "),/species.*funds/i);
 assert.ok(creationReadiness({...base(),xp:{total:110,available:-1}}).length);
 assert.ok(creationReadiness({...base(),skills:{gunnery:{rank:3}}}).length);
 assert.ok(creationReadiness({...base(),characteristics:{brawn:6}}).length);
});
test("enemy guide creates explicit editable NPC presets and minions use group skills",()=>{
 const data=planEnemy({name:"Patrol",type:"minion",role:"combat",combat:"rangedHeavy",rank:2,count:4},species,DEFAULT_CAMPAIGN);
 assert.equal(data.type,"minion");assert.equal(data.system.groupSize,4);
 assert.equal(data.system.skills.rangedHeavy.group,true);assert.equal(data.system.skills.rangedHeavy.rank,0);
 assert.equal(data.system.xp.total,0);assert.ok(data.system.incomplete.length);
 assert.equal(data.flags["star-wars-ffg"].generatedEnemy.kind,"original-npc-preset");
 assert.throws(()=>planEnemy({type:"character",role:"pilot",rank:2,count:1},species,DEFAULT_CAMPAIGN));
 assert.throws(()=>planEnemy({type:"minion",role:"pilot",rank:2,count:101},species,DEFAULT_CAMPAIGN));
 assert.throws(()=>planEnemy({name:"Damaged Security Droid",type:"minion",role:"combat",combat:"avoid",rank:0,count:1},null,DEFAULT_CAMPAIGN),/species/i);
});
test("enemy species begins unchosen instead of silently assigning Human",()=>{
 const choices=enemySpeciesOptions([{id:"human",name:"Human"},{id:"droid",name:"Droid"}]);
 assert.match(choices,/<option value="" selected disabled>Choose species/);
 assert.doesNotMatch(choices,/<option value="human" selected/);
 assert.doesNotMatch(choices,/<option value="droid" selected/);
});
test("a damaged security droid preset carries its damage into play",()=>{
 const droid={...species,_id:"droid",name:"Droid",system:{...species.system,metadata:{...species.system.metadata,Brawn:1,Agility:1,Intellect:1,Cunning:1,Willpower:1,Presence:1,XP:175}}};
 const data=planEnemy({name:"Damaged Security Droid",type:"minion",role:"combat",combat:"melee",rank:0,count:1},droid,DEFAULT_CAMPAIGN);
 assert.equal(data.system.species,"Droid");
 assert.equal(data.system.wounds.value,Math.floor(data.system.wounds.max/4));
 assert.equal(data.system.metadata.damageImpairment,"scanner");
 assert.equal(data.system.metadata.damageVisual,"auto");
});
test("GM controlled builds may reserve XP and credits after recording why",()=>{
 const current={...base(),credits:375,creation:{...base().creation,startingResources:{encumbrance:3}}};
 assert.equal(creationReadiness(current).length,0);
 const reviewed=reviewGmCharacterBuild(current,{xpIntent:"Saving for an expensive talent.",gearIntent:"Cautious traveller; retains emergency credits."});
 assert.equal(reviewed.gmBuildReview.xpSaved,110);
 assert.equal(reviewed.gmBuildReview.creditsSaved,375);
 assert.throws(()=>reviewGmCharacterBuild(current,{xpIntent:"",gearIntent:"Field kit"}),/XP choice/);
});
