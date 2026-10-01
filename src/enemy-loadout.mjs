import { buildStartingLoadout } from "./creation-resources.mjs";

const THREAT_BASE={minion:450,rival:850,nemesis:1500};
const THREAT_SCALE={minion:0.5,rival:1,nemesis:1.5};
const EXTRA_LOOT_CHANCE={minion:0.25,rival:0.4,nemesis:0.5};
const text=value=>String(value??"").toLowerCase();

export function enemyGearBudget(type,partyXp=0) {
  if(!Object.hasOwn(THREAT_BASE,type))throw new Error("Choose minion, rival or nemesis.");
  const xp=Number(partyXp);
  if(!Number.isSafeInteger(xp)||xp<0)throw new Error("Party XP must be a non-negative whole number.");
  return THREAT_BASE[type]+Math.floor(Math.min(xp,1000)*THREAT_SCALE[type]);
}

function contextFor(actor,sceneTheme) {
  const name=text(actor?.name),species=text(actor?.system?.species),scene=text(sceneTheme);
  return {
    droid:/droid/.test(species),
    medical:/medical|medic|surgical|doctor/.test(name)||Number(actor?.system?.skills?.medicine?.rank)>0,
    damaged:/damaged|broken|worn|malfunction/.test(name),
    security:/security|guard|patrol|police/.test(name),
    technical:/hangar|outpost|station|ship|workshop|factory|laboratory|lab|security|terminal/.test(scene),
    wilderness:/forest|jungle|desert|wilderness|tundra|mountain/.test(scene),
  };
}

function weaponScore(entry,actor,combat,context,budget) {
  const name=text(entry.name),skill=text(entry.skill);
  let score=(skill===combat?100:0)+(actor?.system?.skills?.[entry.skill]?25:0);
  if(context.security&&/shock|stun|baton/.test(name))score+=28;
  if(context.technical&&/blaster|shock|stun/.test(name))score+=8;
  if(context.wilderness&&/bow|spear|rifle/.test(name))score+=8;
  score-=Math.abs(entry.price/budget-(actor.type==="minion"?0.5:0.7))*10;
  score-=entry.encumbrance;
  return score;
}

function gearScore(entry,context,forLoot=false) {
  const name=text(entry.name);
  let score=0;
  if(context.droid&&!context.medical&&/repair patch/.test(name))score+=context.damaged?110:65;
  if(context.medical&&/medpack|medical kit/.test(name))score+=90;
  if(context.technical&&/datapad|comlink|scanner|tool kit|power cell/.test(name))score+=forLoot?45:22;
  if(forLoot&&/datapad|encoded key|access card/.test(name))score+=12;
  if(context.wilderness&&/survival|canteen|scanner|macrobinocular/.test(name))score+=forLoot?35:20;
  if(context.security&&/comlink|datapad|security|scanner/.test(name))score+=forLoot?20:10;
  if(!context.droid&&/stimpack|medpack/.test(name))score+=12;
  return score-entry.encumbrance*0.5-entry.price/1000;
}

const compatible=(entry,context)=>!context.droid||context.medical||!/medpack|stimpack|medicine|first aid/i.test(entry.name);
const affordable=(entry,budget,capacity)=>!entry.restricted&&entry.price>0&&entry.price<=budget&&entry.encumbrance>=0&&entry.encumbrance<=capacity;
const order=(rows,score)=>rows.sort((a,b)=>score(b)-score(a)||a.price-b.price||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));

export function suggestEnemyLoadout({actor,equipment,partyXp=0,combat="any",sceneTheme="",random=Math.random}={}) {
  const budget=enemyGearBudget(actor?.type,partyXp),capacity=5+Number(actor?.system?.characteristics?.brawn??0),context=contextFor(actor,sceneTheme);
  if(!Number.isSafeInteger(capacity)||capacity<0)throw new Error("Enemy carrying capacity is invalid.");
  const rows=Array.from(equipment??[]),
    weaponChoices=order(rows.filter(entry=>entry.type==="weapon"&&affordable(entry,budget,capacity)),entry=>weaponScore(entry,actor,combat,context,budget)).slice(0,12),
    supplyChoices=order(rows.filter(entry=>entry.type==="gear"&&compatible(entry,context)&&affordable(entry,budget,capacity)),entry=>gearScore(entry,context)).slice(0,12);
  const weapon=combat==="avoid"?null:(weaponChoices[0]??null);
  const remainingValue=budget-(weapon?.price??0),remainingCapacity=capacity-(weapon?.encumbrance??0);
  const supply=supplyChoices.find(entry=>affordable(entry,remainingValue,remainingCapacity))??null;
  const lootChoices=order(rows.filter(entry=>entry.type==="gear"&&compatible(entry,context)&&entry.id!==supply?.id&&affordable(entry,remainingValue-(supply?.price??0),remainingCapacity-(supply?.encumbrance??0))),entry=>gearScore(entry,context,true)).slice(0,12);
  const loot=random()<EXTRA_LOOT_CHANCE[actor.type]?(lootChoices[0]??null):null;
  const credits=random()<(context.droid?0.05:0.3)?Math.max(5,Math.floor(budget/20)):0;
  const chosen=[weapon,supply,loot].filter(Boolean);
  return {budget,capacity,weapon,supply,loot,credits,weaponChoices,supplyChoices,lootChoices,
    totalValue:chosen.reduce((sum,entry)=>sum+entry.price,0),totalEncumbrance:chosen.reduce((sum,entry)=>sum+entry.encumbrance,0),
    extraLootChance:EXTRA_LOOT_CHANCE[actor.type],sceneTheme:String(sceneTheme)};
}

export function finalizeEnemyLoadout({equipment,selection={},budget,capacity}={}) {
  const byId=new Map(Array.from(equipment??[],entry=>[entry.id,entry]));
  const ids=["weapon","supply","loot"].map(slot=>String(selection[slot]??"")).filter(Boolean);
  if(ids.length!==new Set(ids).size)throw new Error("Combine duplicate equipment into one entry.");
  for(const [slot,type] of [["weapon","weapon"],["supply","gear"],["loot","gear"]]) {
    const id=String(selection[slot]??"");
    if(id&&byId.get(id)?.type!==type)throw new Error(`Choose a valid ${slot} from the ${type} catalogue.`);
  }
  const credits=Number(selection.credits??0);
  if(!Number.isSafeInteger(credits)||credits<0||credits>Math.floor(budget/4))throw new Error("Enemy credits exceed the reviewed allowance.");
  const loadout=buildStartingLoadout({options:[...byId.values()],selections:ids.map(id=>({id,quantity:1})),cashBudget:budget,encumbranceLimit:capacity});
  return {items:ids.map(id=>byId.get(id)),credits,budget,capacity,value:loadout.cost,encumbrance:loadout.encumbrance};
}
