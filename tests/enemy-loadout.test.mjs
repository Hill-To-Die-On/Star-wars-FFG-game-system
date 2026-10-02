import test from "node:test";
import assert from "node:assert/strict";
import { enemyGearBudget, suggestEnemyLoadout, finalizeEnemyLoadout } from "../src/enemy-loadout.mjs";

const item=(id,name,type,price,encumbrance,skill="")=>({id,name,type,price,encumbrance,skill,restricted:false,source:{book:"Test catalogue",page:"1"}});
const catalogue=[
  item("blaster","Blaster Pistol","weapon",400,1,"rangedLight"),
  item("shock","Shock Baton","weapon",300,0,"melee"),
  item("rifle","Blaster Rifle","weapon",900,4,"rangedHeavy"),
  item("patch","Emergency Repair Patch","gear",20,5),
  item("medpack","Emergency Medpack","gear",100,1),
  item("stim","Stimpack","gear",25,0),
  item("data","Datapad","gear",75,1),
  item("comlink","Comlink (handheld)","gear",25,0),
];
const droid={name:"Damaged Security Droid",type:"minion",system:{species:"Droid",characteristics:{brawn:1},skills:{melee:{rank:0},rangedLight:{rank:0}}}};

test("enemy gear value grows with party XP and enemy threat, while remaining bounded",()=>{
  assert.ok(enemyGearBudget("minion",300)>enemyGearBudget("minion",0));
  assert.ok(enemyGearBudget("rival",100)>enemyGearBudget("minion",100));
  assert.ok(enemyGearBudget("nemesis",100)>enemyGearBudget("rival",100));
  assert.throws(()=>enemyGearBudget("minion",-1),/XP/i);
});

test("damaged security droid receives a suitable weapon and repair supply without medical gear",()=>{
  const result=suggestEnemyLoadout({actor:droid,equipment:catalogue,partyXp:110,combat:"melee",sceneTheme:"Outpost hangar security",random:()=>0.9});
  assert.equal(result.weapon?.id,"shock");
  assert.equal(result.supply?.id,"patch");
  assert.equal(result.loot,null);
  assert.equal(result.credits,0);
  assert.ok(result.totalEncumbrance<=result.capacity);
  assert.ok(result.totalValue<=result.budget);
  assert.ok(result.supplyChoices.every(entry=>!/(?:medpack|stimpack)/i.test(entry.name)));
  assert.ok(result.lootChoices.every(entry=>!/(?:medpack|stimpack)/i.test(entry.name)));
});

test("extra loot is a chance outcome and respects scene, budget, and carrying capacity",()=>{
  const result=suggestEnemyLoadout({actor:droid,equipment:catalogue,partyXp:110,combat:"melee",sceneTheme:"Outpost hangar security",random:()=>0.1});
  assert.equal(result.loot?.id,"data");
  assert.equal(result.credits,0);
  assert.ok(result.totalEncumbrance<=result.capacity);
  assert.ok(result.totalValue<=result.budget);
});

test("medical droids may carry treatment gear, while an ordinary droid is unlikely to carry credits",()=>{
  const medical={...droid,name:"Medical Droid",system:{...droid.system,skills:{medicine:{rank:2}}}};
  const result=suggestEnemyLoadout({actor:medical,equipment:catalogue,partyXp:110,combat:"avoid",sceneTheme:"Field hospital",random:()=>0.9});
  assert.match(result.supply?.name??"",/medpack/i);
  const noCash=suggestEnemyLoadout({actor:droid,equipment:catalogue,partyXp:110,combat:"melee",sceneTheme:"Hangar",random:()=>0.2});
  assert.equal(noCash.credits,0);
});

test("GM selections revalidate catalogue IDs, budget, encumbrance, and role of every item",()=>{
  const budget=enemyGearBudget("minion",110),capacity=6;
  const good=finalizeEnemyLoadout({equipment:catalogue,selection:{weapon:"shock",supply:"patch",loot:"data",credits:0},budget,capacity});
  assert.deepEqual(good.items.map(entry=>entry.id),["shock","patch","data"]);
  assert.throws(()=>finalizeEnemyLoadout({equipment:catalogue,selection:{weapon:"medpack"},budget,capacity}),/weapon/i);
  assert.throws(()=>finalizeEnemyLoadout({equipment:catalogue,selection:{weapon:"rifle"},budget,capacity}),/allowance/i);
  assert.throws(()=>finalizeEnemyLoadout({equipment:catalogue,selection:{weapon:"blaster",supply:"patch",loot:"data"},budget,capacity}),/encumbrance/i);
  assert.throws(()=>finalizeEnemyLoadout({equipment:catalogue,selection:{weapon:"shock",supply:"patch",loot:"patch"},budget,capacity}),/duplicate/i);
});
