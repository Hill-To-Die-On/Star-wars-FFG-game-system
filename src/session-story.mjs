import { SYSTEM_ID } from './config.mjs';
import { getPath } from './tabletop-workflows.mjs';

/** Start-of-session story checks, checked against the printed core rules. */
export const STORY_CHECKS = Object.freeze({
  obligation: Object.freeze({label:'Obligation',value:'system.obligation.value',threshold:'system.strain.max',sign:-1,source:Object.freeze({book:'Edge of The Empire - Core Book',page:'41-42'})}),
  duty: Object.freeze({label:'Duty',value:'system.duty.value',threshold:'system.wounds.max',sign:1,source:Object.freeze({book:'Age of Rebellion - Core Book',page:'48-49'})}),
});
const MORALITY_SOURCE = Object.freeze({book:'Force & Destiny - Core Book',page:'51-52'});
const CONTRIBUTION_SOURCE = Object.freeze({book:'Age of Rebellion - Core Book',page:'49-50'});
const reviewed = source => ({...source,verification:'gm-reviewed'});
function integer(value,label,min=0,max=1000000) {
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
function requireGM(user) {if(!user?.isGM)throw new Error('Only the GM can commit or undo mechanical effects.');}
function checkFor(mechanic) {
  const check=STORY_CHECKS[mechanic];if(!check)throw new Error('Choose Obligation or Duty.');
  return check;
}
const history = actor => actor?.flags?.[SYSTEM_ID]?.workflowHistory ?? [];

/** Bands run from the highest value down, as in the books' examples. */
export function storyChart(actors,mechanic) {
  const check=checkFor(mechanic);
  const rows=Array.from(actors??[]).map(actor=>({actorUuid:actor.uuid,name:actor.name,value:integer(Number(getPath(actor,check.value)??0),check.label)}))
    .filter(row=>row.value>0).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  let total=0;
  const bands=rows.map(row=>{const band={...row,low:total+1,high:total+row.value};total=band.high;return band;});
  return {mechanic,total,bands};
}
export function resolveStoryCheck(chart,roll) {
  if(!Number.isSafeInteger(roll)||roll<1||roll>100)throw new Error('Enter a d100 result from 1 to 100.');
  const triggered=roll<=chart.total;
  return {roll,total:chart.total,triggered,doubles:triggered&&roll<100&&roll%11===0,
    band:triggered?chart.bands.find(band=>band.low<=roll&&roll<=band.high)??null:null,overLimit:chart.total>100};
}
/** Every party member is affected; the triggered character's larger change replaces the shared one. */
export function storyThresholdChanges(party,chart,result) {
  if(!result.triggered)return [];
  const check=checkFor(chart.mechanic);
  return Array.from(party??[]).map(actor=>{
    const triggered=actor.uuid===result.band?.actorUuid,magnitude=(triggered?2:1)*(result.doubles?2:1);
    return {actorUuid:actor.uuid,name:actor.name,mechanic:chart.mechanic,path:check.threshold,delta:check.sign*magnitude,triggered};
  });
}
export function planSessionStoryEffect(actor,request,{user,campaign={}}={}) {
  requireGM(user);
  const check=checkFor(request?.mechanic);
  if(!campaign[request.mechanic])throw new Error(`${check.label} is disabled for this campaign.`);
  if(actor?.type!=='character')throw new Error('Session story effects apply to player characters.');
  const delta=Number(request.delta);
  if(![1,2,4].map(n=>n*check.sign).includes(delta))throw new Error('Session threshold changes are one, two or four points.');
  const checkId=String(request.checkId??'').trim();if(!checkId||checkId.length>128)throw new Error('A story check identity is required.');
  const path=check.threshold,current=integer(Number(getPath(actor,path)),'Current threshold',1),next=current+delta;
  if(next<1)throw new Error('This change would take the threshold below 1.');
  const roll=Number.isSafeInteger(request.roll)?request.roll:null;
  return {kind:'session-story',label:`${check.label} check${roll?` · ${roll}`:''}${request.triggered?' · triggered character':''}`,
    source:reviewed(check.source),before:{[path]:current},after:{[path]:next},sessionEffect:{mechanic:request.mechanic,path,delta,checkId},roll};
}
/** An effect stays active until a non-undone end entry names it. */
export function activeSessionEffects(actor) {
  const entries=history(actor),ended=new Set(entries.filter(e=>e.kind==='session-story-end'&&!e.undone).map(e=>e.endsEntryId));
  return entries.filter(e=>e.kind==='session-story'&&!e.undone&&!ended.has(e.id));
}
export function planSessionStoryEnd(actor,request,{user}={}) {
  requireGM(user);
  const entry=history(actor).find(e=>e.id===request?.entryId);
  if(entry?.kind!=='session-story')throw new Error('The session story effect no longer exists.');
  if(!activeSessionEffects(actor).some(e=>e.id===entry.id))throw new Error('This session effect has already ended or was undone.');
  const {path,delta,mechanic}=entry.sessionEffect,current=integer(Number(getPath(actor,path)),'Current threshold',1),next=current-delta;
  if(next<1)throw new Error('Ending this effect would take the threshold below 1. Review the threshold first.');
  return {kind:'session-story-end',label:`End of session · ${checkFor(mechanic).label}`,source:entry.source,before:{[path]:current},after:{[path]:next},endsEntryId:entry.id};
}
function moralityWarnings(before,after) {
  const warnings=[],down=limit=>before>=limit&&after<limit,up=limit=>before<=limit&&after>limit;
  if(down(30))warnings.push('Morality fell below 30: the character becomes a dark side Force user (FaD 52-53).');
  if(down(20))warnings.push('Below 20, a dark side user lowers strain threshold by 1 and raises wound threshold by 1 (FaD 53). Adjust thresholds after review.');
  if(down(10))warnings.push('Below 10, those changes become strain −2 and wounds +2 in total (FaD 53).');
  if(up(70))warnings.push('Morality rose above 70: a light side paragon, and a dark side user is redeemed (FaD 52-53, 325).');
  if(up(80))warnings.push('Above 80, a light side user raises strain threshold by 1 (FaD 53). Adjust thresholds after review.');
  if(up(90))warnings.push('Above 90, that becomes strain threshold +2 in total (FaD 53).');
  return warnings;
}
/** End of session: d10 minus that session's Conflict, doubled for an engaged trigger. */
export function planMoralityResolution(actor,request,{user,campaign={}}={}) {
  requireGM(user);
  if(!campaign.morality)throw new Error('Morality is disabled for this campaign.');
  if(actor?.type!=='character')throw new Error('Morality applies to player characters.');
  const roll=request?.roll;
  if(!Number.isSafeInteger(roll)||roll<1||roll>10)throw new Error('Enter a d10 result from 1 to 10.');
  const conflict=integer(Number(actor.system.morality?.conflict??0),'Conflict'),value=integer(Number(actor.system.morality?.value??50),'Morality');
  let change=roll-conflict;
  if(request.engagedTrigger)change*=2;
  if(request.noIncrease&&change>0)change=0;
  const next=Math.min(100,Math.max(0,value+change)),plan={kind:'morality',label:`Morality · d10 ${roll} − Conflict ${conflict}`,source:reviewed(MORALITY_SOURCE),before:{},after:{},
    calculation:{roll,conflict,change,engagedTrigger:!!request.engagedTrigger,noIncrease:!!request.noIncrease,before:value,after:next}};
  if(next!==value){plan.before['system.morality.value']=value;plan.after['system.morality.value']=next;}
  if(conflict){plan.before['system.morality.conflict']=conflict;plan.after['system.morality.conflict']=0;}
  plan.warnings=moralityWarnings(value,next);
  if(next!==value+change)plan.warnings.push('Morality is kept between 0 and 100.');
  plan.warning=plan.warnings.join(' ')||null;
  return plan;
}
/** Combined Duty past 100: Contribution rank rises and every character's Duty resets. */
export function planDutyContribution(actor,_request,{user,campaign={}}={}) {
  requireGM(user);
  if(!campaign.duty)throw new Error('Duty is disabled for this campaign.');
  if(actor?.type!=='character')throw new Error('Duty applies to player characters.');
  const duty=integer(Number(actor.system.duty?.value??0),'Duty'),rank=integer(Number(actor.system.duty?.contribution??0),'Contribution rank');
  return {kind:'duty-contribution',label:'Duty past 100 · Contribution rank +1',source:reviewed(CONTRIBUTION_SOURCE),
    before:{'system.duty.value':duty,'system.duty.contribution':rank},after:{'system.duty.value':0,'system.duty.contribution':rank+1},
    warning:'Choose the party reward with the GM; its rarity is limited by the Contribution rank (AoR 49-50).'};
}
