import { SKILLS, SYSTEM_ID } from './config.mjs';

const dieNames=new Set(['boost','setback']);
const skillAllowed=key=>key==='any'||Object.hasOwn(SKILLS,key)||/^custom:[a-zA-Z0-9_-]{1,64}$/.test(key);
const available=entry=>!entry?.consumedBy && !entry?.cancelled;
const matching=(entry,skillKey)=>entry?.skillKey==='any'||entry?.skillKey===skillKey;

export function validatePoolModifier(value) {
 if(value==null)return null;
 const die=String(value.die??''),count=Number(value.count),skillKey=String(value.skillKey??'any');
 if(!dieNames.has(die))throw new Error('Choose boost or setback for a future check.');
 if(!Number.isSafeInteger(count)||count<1||count>3)throw new Error('A future modifier must use one to three dice.');
 if(!skillAllowed(skillKey))throw new Error('Choose a valid skill for the future effect.');
 return {die,count,skillKey};
}

export function validateFutureEffect(value) {
 if(value==null)return null;
 const actorUuid=String(value.actorUuid??'').trim();
 if(!actorUuid||actorUuid.length>512)throw new Error('Choose a target actor for the future effect.');
 return {...validatePoolModifier(value),actorUuid};
}

function ongoingEntries(actor) {
 const flags=actor?.flags?.[SYSTEM_ID]??{};
 return [
  ...(flags.conditions??[]),
  ...(flags.vehicleCriticals??[]),
  ...(actor?.system?.criticals??[]),
 ].filter(entry=>entry?.modifier);
}

export function activePoolRulings(actor,skillKey) {
 const pending=(actor?.flags?.[SYSTEM_ID]?.narrativeEffects??[]).filter(entry=>available(entry)&&matching(entry,skillKey));
 const ongoing=ongoingEntries(actor).filter(entry=>matching(entry.modifier,skillKey));
 const all=[...pending.map(entry=>({entry,modifier:entry})),...ongoing.map(entry=>({entry,modifier:entry.modifier}))];
 return {
  boost:all.filter(({modifier})=>modifier.die==='boost').reduce((n,{modifier})=>n+modifier.count,0),
  setback:all.filter(({modifier})=>modifier.die==='setback').reduce((n,{modifier})=>n+modifier.count,0),
  pendingIds:pending.map(entry=>entry.id),
  notes:all.map(({entry,modifier})=>`${entry.label??entry.name??'GM ruling'}: ${modifier.count} ${modifier.die} on ${skillKey} (${pending.includes(entry)?'next check':'ongoing'}).`),
 };
}

export function unspentTalentRemovals(basePool,talentRules) {
 const result={};
 for(const die of dieNames) {
  const added=Number(talentRules?.pool?.add?.[die]??0);
  const removed=Number(talentRules?.pool?.remove?.[die]??0);
  result[die]=Math.max(0,removed-Number(basePool?.[die]??0)-added);
 }
 return result;
}

export function addPoolRulings(pool,rulings,unusedRemovals={}) {
 return {...pool,
  boost:Number(pool.boost??0)+Math.max(0,Number(rulings.boost??0)-Number(unusedRemovals.boost??0)),
  setback:Number(pool.setback??0)+Math.max(0,Number(rulings.setback??0)-Number(unusedRemovals.setback??0))};
}
