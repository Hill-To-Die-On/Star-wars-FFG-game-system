import {getDocumentTransactionBroker} from './document-transactions.mjs';
import { SYSTEM_ID, SKILLS } from './config.mjs';
import { escapeHTML as esc } from './mechanics.mjs';
import { ActorTransactionQueue, canSpendXp } from './xp-transactions.mjs';
import { SYMBOLS, remainingSymbols, planActorEffect, planSessionAward, planSlotClaim, planSpend, reviewedSource, snapshotValues, reviewSnapshot, weaponForRecordedRoll } from './tabletop-workflows.mjs';
import { TabletopWorkflowService, workflowAuthority, canProposeSpend } from './tabletop-service.mjs';
import { crewRoster, CREW_ROLES } from './vehicle-crew.mjs';
import { vehicleForActor, crewCheckDialog } from './vehicle-crew-foundry.mjs';
import { readTurnBudget, turnIndicatorHTML, bindTurnControls } from './turn-economy-foundry.mjs';
import { bookAllowed } from './rules.mjs';
import { weaponArcProfile } from './range-overlay/arcs.mjs';
import { watchVehicleDashboard } from './tabletop-dashboard.mjs';
import { assertLocalTabletopAuthority, createMessageProvenance, verifyMessageProvenance } from './tabletop-provenance.mjs';

const flag=(document,key)=>document?.flags?.[SYSTEM_ID]?.[key];
const campaign=()=>game.settings.get(SYSTEM_ID,'campaign');
const uuid=()=>foundry.utils.randomID(24);
const visibleActors=()=>Array.from(game.actors??[]).filter(a=>canSpendXp(a,game.user));
const values=button=>Object.fromEntries(new FormData(button.form));
const numeric=(name,label,value=0,min=0,max=1000000)=>`<label>${esc(label)}<input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${value}" required></label>`;
const options=(rows,selected)=>rows.map(r=>`<option value="${esc(r.id??r.uuid)}" ${(r.id??r.uuid)===selected?'selected':''}>${esc(r.name)}</option>`).join('');
const sourceHTML=(source={})=>`<fieldset><legend>Rule reference / GM decision</legend><label>Book or table decision<input name="book" value="${esc(source.book??'')}" required maxlength="200"></label><label>Page or session reference<input name="page" value="${esc(source.page??'')}" required maxlength="80"></label><label>Verification<select name="verification"><option value="gm-ruling" ${source.verification!=='gm-reviewed'?'selected':''}>Explicit GM ruling</option><option value="gm-reviewed" ${source.verification==='gm-reviewed'?'selected':''}>GM checked the source</option></select></label></fieldset>`;
const sourceFrom=form=>({book:form.book,page:form.page,verification:form.verification});
const dialogDefaults={classes:['star-wars','sf-tabletop-dialog'],window:{resizable:true},position:{width:650,height:650},rejectClose:false};
const prompt=(title,content,label='Review',render)=>foundry.applications.api.DialogV2.prompt({...dialogDefaults,window:{...dialogDefaults.window,title},content:`<div class="sf-tabletop-body">${content}</div>`,render,ok:{label,callback:(_e,b)=>values(b)}});
const handle=work=>Promise.resolve().then(work).catch(error=>{
  console.error('Star Wars tabletop workflow failed:',error);
  ui.notifications.error(error.message);
});
let service;
const provenanceQueue=new ActorTransactionQueue();
async function authenticatedRequester(message,key,creatorId,{requireActive=true}={}) {
  if(creatorId) {
    const receipt=await createMessageProvenance(message,key,creatorId,game.users);
    await provenanceQueue.run('receipts',async()=>{
      const receipts=game.settings.get(SYSTEM_ID,'tabletopProvenance')??{};
      if(!getDocumentTransactionBroker().isAuthority())throw new Error('Transaction authority changed; select the active GM browser.');
      await game.settings.set(SYSTEM_ID,'tabletopProvenance',{...receipts,[message.id]:receipt});
    });
  }
  return verifyMessageProvenance(message,key,(game.settings.get(SYSTEM_ID,'tabletopProvenance')??{})[message.id],game.users,{requireActive});
}
const pending=new Map(),processing=new Set();

/** Requests are authored Foundry documents; player packets cannot claim a GM userId. */
export async function requestTabletop(command,args) {
  assertLocalTabletopAuthority(game.user,getDocumentTransactionBroker());
  const authority=workflowAuthority(game.users);
  if(!authority)throw new Error('An active GM is required for tabletop changes.');
  const operationId=uuid();
  if(args.expected&&typeof args.expected!=='string')args={...args,expected:JSON.stringify(args.expected)};
  const message=await ChatMessage.create({content:`<p>${esc(game.user.name)} requested ${esc(command)}.</p>`,whisper:[...new Set([game.user.id,...Array.from(game.users).filter(u=>u.isGM).map(u=>u.id)])],
    flags:{[SYSTEM_ID]:{tabletopRequest:{command,args,operationId}}}});
  const existing=flag(message,'tabletopResult');
  if(existing){if(existing.ok)return existing.result;throw new Error(existing.error);}
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(message.id);reject(new Error('The GM has not confirmed this operation. Check its request in chat before retrying.'));},20000);
    pending.set(message.id,{resolve,reject,timer});
    // The authority may finish between create() resolving and this waiter being installed.
    settleRequest(message);
  });
}
function settleRequest(message) {
  const result=flag(message,'tabletopResult'),waiter=pending.get(message.id);if(!waiter||!result)return;
  clearTimeout(waiter.timer);pending.delete(message.id);result.ok?waiter.resolve(result.result):waiter.reject(new Error(result.error));
}
async function processRequest(message,creatorId) {
  if(!getDocumentTransactionBroker().isAuthority() || flag(message,'tabletopResult') || processing.has(message.id))return;
  const storedRequest=flag(message,'tabletopRequest');if(!storedRequest)return;
  const request=structuredClone(storedRequest);
  processing.add(message.id);
  try {
    let result;
    try {result={ok:true,result:await service.execute(request.command,request.args,await authenticatedRequester(message,'tabletopRequest',creatorId),request.operationId)};}
    catch(error){result={ok:false,error:error.message};}
    if(!getDocumentTransactionBroker().isAuthority())return;
    await message.update({[`flags.${SYSTEM_ID}.tabletopResult`]:result,
      content:`<p>${esc(request.command)} · ${result.ok?'Confirmed':esc(result.error)}</p>`});
  } finally {processing.delete(message.id);}
}
const reviewHTML=entry=>{
  const plan={...entry,before:snapshotValues(entry.before),after:snapshotValues(entry.after)};
  const changedList=Object.entries(plan.after).find(([path])=>/\.(?:conditions|criticals|vehicleCriticals)$/.test(path));
  let change;
  if(changedList&&Array.isArray(changedList[1])){
    const [path,after]=changedList,before=Array.isArray(plan.before[path])?plan.before[path]:[];
    const added=after.find(row=>!before.some(previous=>previous.id===row.id));
    const removed=before.find(row=>!after.some(next=>next.id===row.id));
    const named=added??removed;
    const skillName=added?.modifier?.skillKey==='any'?'any check':SKILLS[added?.modifier?.skillKey]?.label??added?.modifier?.skillKey;
    change=`<div class="sf-review-change"><strong>${esc(named?.name??plan.kind)}</strong><span>${esc(added?'Added':'Removed')} ${esc(plan.kind)} · ${before.length} before → ${after.length} after</span>${added?.modifier?`<span>Ongoing: ${added.modifier.count} ${esc(added.modifier.die)} on ${esc(skillName)}</span>`:'<span>Record only</span>'}</div>`;
  } else {
    change=`<table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${Object.entries(plan.after).map(([path,value])=>`<tr><td>${esc(path.replace(/^system\./,''))}</td><td>${esc(typeof plan.before[path]==='object'?JSON.stringify(plan.before[path]):plan.before[path])}</td><td>${esc(typeof value==='object'?JSON.stringify(value):value)}</td></tr>`).join('')}</tbody></table>`;
  }
  return `<p><strong>GM decision</strong> · ${esc(plan.label)}</p>${change}${plan.calculation?`<p>Damage ${plan.calculation.amount} · soak/armour ${plan.calculation.soak} · Pierce ${plan.calculation.pierce} · Breach ${plan.calculation.breach} → ${plan.calculation.applied} ${esc(plan.calculation.resource)}.</p>${plan.calculation.exceedsThreshold?'<p>Threshold exceeded. Review incapacitation and critical effects.</p>':''}`:''}${plan.warning?`<p>${esc(plan.warning)}</p>`:''}<p>${esc(plan.source.book)} · ${esc(plan.source.page)} · ${esc(plan.source.verification)}</p>${plan.downtime?`<p>Downtime: ${esc(plan.downtime)}</p>`:''}`;
};
async function confirmPlan(actor,plan) {
  return foundry.applications.api.DialogV2.confirm({...dialogDefaults,window:{...dialogDefaults.window,title:'Review combat change'},content:`<div class="sf-tabletop-body"><section class="sf-tabletop-section"><h2>${esc(actor.name)}</h2>${reviewHTML(plan)}</section></div>`,yes:{label:'Apply reviewed changes'},no:{label:'Back'}});
}

export async function openResolution(actor,{message,weapon}={}) {
  if(!game.user.isGM)throw new Error('The GM reviews combat effects.');
  if(!actor){const pick=await prompt('Choose affected actor',`<section class="sf-tabletop-section"><h2>Who is affected?</h2><p class="sf-ruling-status">Confirm the target before recording damage, recovery or a condition.</p><label>Actor<select name="actor">${options(visibleActors().filter(a=>a.type!=='group').map(a=>({id:a.uuid,name:a.name})),flag(message,'targetActorUuid'))}</select></label></section>`,'Choose');if(!pick)return;actor=await fromUuid(pick.actor);}
  const vehicle=actor.type==='vehicle',facts=flag(message,'outcome'),resources=vehicle?['hullTrauma','systemStrain']:['wounds','strain'];
  if(message&&!weapon&&flag(message,'actorUuid')) {
    const attacker=await fromUuid(flag(message,'actorUuid'));
    const weapons=Array.from(attacker?.items??[]).filter(item=>item.type==='weapon');
    const used=weaponForRecordedRoll(attacker,message);
    if(used) {
      const picked=await prompt('Weapon used for this roll',`<section class="sf-tabletop-section"><h2>Attack source</h2><p>Select the actual weapon used for the recorded roll.</p><label>Weapon<select name="weapon"><option value="">Manual / other vehicle mount</option>${options(weapons,used.id)}</select></label></section>`,'Continue');
      if(!picked)return;weapon=weapons.find(w=>w.id===picked.weapon);
    }
  }
  let amount=0;if(weapon&&facts?.passed)try{amount=weapon.damageFor(facts);}catch{}
  const form=await prompt('Combat resolution',`<p class="sf-tabletop-lede"><strong>${esc(actor.name)}</strong> · Review the roll, record the GM decision, then apply the shown changes. Linked decisions appear beneath the roll in chat.</p>
    ${facts?`<section class="sf-tabletop-section"><h2>Roll evidence</h2><div class="sf-roll-context"><span>${facts.success??0} success</span><span>${facts.advantage??0} advantage</span><span>${facts.threat??0} threat</span></div><p>${weapon?esc(weapon.name):'Enter the reviewed damage total if this is a hit.'}</p></section>`:''}
    <section class="sf-tabletop-section"><h2>Effect</h2><label>Resolution<select name="kind"><option value="damage">Damage · calculate soak</option><option value="recover">Recovery</option><option value="critical">Critical</option><option value="condition">Condition</option></select></label>
    <div data-resolution-damage>${numeric('amount','Damage before soak / recovery amount',amount)}<div class="sf-tabletop-grid"><label>Recovery resource<select name="resource">${resources.map(r=>`<option>${r}</option>`).join('')}</select></label><label>Damage scale<select name="scale"><option value="personal" ${vehicle?'':'selected'}>Personal</option><option value="vehicle" ${vehicle?'selected':''}>Vehicle</option></select></label></div><label><input name="strain" type="checkbox"> Inflict strain / system strain</label><label><input name="ignoreSoak" type="checkbox"> Ignore soak / armour (source checked)</label><div class="sf-tabletop-grid">${numeric('pierce','Pierce',0)}${numeric('breach','Breach',0)}</div></div>
    <div data-resolution-condition hidden><label>Critical or condition name<input name="label" maxlength="200"></label><p class="sf-ruling-status">A source-checked modifier can apply automatically to later checks. Leave it at record only when the rule is not encoded.</p><div class="sf-tabletop-grid"><label>Ongoing dice effect<select name="modifierDie"><option value="">Record only</option><option value="boost">Boost</option><option value="setback">Setback</option></select></label>${numeric('modifierCount','Dice per check',1,1,3)}</div><label>Affected skill<select name="modifierSkill"><option value="any">Any check</option>${options(Object.entries(SKILLS).map(([id,skill])=>({id,name:skill.label})))}</select></label></div>
    ${weapon?.system.qualities?`<p>Weapon qualities to review: ${esc(weapon.system.qualities)}</p>`:''}</section>
    <section class="sf-tabletop-section"><h2>GM decision</h2><label>What happened and why?<textarea name="note" maxlength="2000" rows="4" required></textarea></label>${sourceHTML(weapon?.system.source)}</section>`,'Review change',(_event,app)=>{
      const kind=app.element.querySelector('[name="kind"]'),damage=app.element.querySelector('[data-resolution-damage]'),condition=app.element.querySelector('[data-resolution-condition]');
      const refresh=()=>{const isCondition=['critical','condition'].includes(kind.value);condition.hidden=!isCondition;damage.hidden=isCondition;
        for(const input of condition.querySelectorAll('input,select,textarea'))input.disabled=!isCondition;
        for(const input of damage.querySelectorAll('input,select,textarea'))input.disabled=isCondition;};
      kind.addEventListener('change',refresh);refresh();
    });
  if(!form)return;
  const request={...form,amount:Number(form.amount),pierce:Number(form.pierce),breach:Number(form.breach),strain:form.strain==='on',ignoreSoak:form.ignoreSoak==='on',source:sourceFrom(form),entryId:uuid(),sourceRollUuid:message?.uuid??'',
    modifier:['critical','condition'].includes(form.kind)&&form.modifierDie?{die:form.modifierDie,count:Number(form.modifierCount),skillKey:form.modifierSkill}:null};
  const plan=planActorEffect(actor,request,{user:game.user,campaign:campaign()});
  if(await confirmPlan(actor,plan)){
    const result=await requestTabletop('effect',{actorUuid:actor.uuid,request,expected:reviewSnapshot(plan)});
    ui.notifications.info(`Applied to ${actor.name}. Undo is available in Tabletop history.`);
    if(result.linkWarning)ui.notifications.warn(result.linkWarning);
  }
}
export async function openWorkflowHistory(actor) {
  if(!canSpendXp(actor,game.user))throw new Error('Owner permission is required.');
  const entries=Array.from(flag(actor,'workflowHistory')??[]).reverse();
  await foundry.applications.api.DialogV2.wait({...dialogDefaults,window:{...dialogDefaults.window,title:`Change history · ${actor.name}`},content:`<div class="sf-tabletop-body">${entries.map(entry=>`<article><h3>${esc(entry.label)} ${entry.undone?'· undone':''}</h3><small>${esc(entry.at)}</small>${reviewHTML(entry)}${game.user.isGM&&!entry.undone?`<button type="button" data-undo="${esc(entry.id)}">Undo this change</button>`:''}</article>`).join('')||'<p>No tabletop effects or session awards recorded.</p>'}</div>`,buttons:[{action:'close',label:'Close'}],render:(_e,app)=>{
    app.element.addEventListener('click',event=>{const button=event.target.closest('[data-undo]');if(button)void handle(async()=>{await requestTabletop('undo-effect',{actorUuid:actor.uuid,entryId:button.dataset.undo});await app.close();await openWorkflowHistory(actor);});});
  }});
}

function spendingOptions() {return (game.settings.get(SYSTEM_ID,'narrativeSpendingOptions')??[]).filter(o=>o.source?.verification==='gm-ruling'||bookAllowed(o.source?.book,campaign()));}
export async function openNarrativeSpending(message) {
  const actor=flag(message,'actorUuid')?await fromUuid(flag(message,'actorUuid')):null;
  if(!canProposeSpend(message,actor,game.user))throw new Error('Only the rolling actor owner or GM can propose spending.');
  const facts=flag(message,'outcome'),entries=flag(message,'spending')??[],left=remainingSymbols(facts,entries),presets=spendingOptions(),actors=visibleActors().filter(a=>a.type!=='group');
  const history=entries.map(e=>{
    const target=actors.find(a=>a.uuid===e.futureEffect?.actorUuid),effect=target?.flags?.[SYSTEM_ID]?.narrativeEffects?.find(row=>row.id===e.id),status=e.undone?'Undone':effect?.consumedBy?'Used on a later check':e.futureEffect?'Ready for next matching check':'Narrative ruling';
    return `<article class="sf-decision-record"><strong>${esc(e.label)}</strong><small>${SYMBOLS.filter(s=>e.cost[s]).map(s=>`${e.cost[s]} ${s}`).join(' · ')} · ${esc(status)}</small>${e.note?`<p>${esc(e.note)}</p>`:''}${e.futureEffect?`<p>${esc(target?.name??'Actor')}: ${e.futureEffect.count} ${esc(e.futureEffect.die)} on ${esc(e.futureEffect.skillKey==='any'?'next check':`next ${SKILLS[e.futureEffect.skillKey]?.label??e.futureEffect.skillKey} check`)}</p>`:''}<small>${esc(e.source?.book)} · ${esc(e.source?.page)} · ${esc(e.at??'')}</small>${game.user.isGM&&!e.undone&&!effect?.consumedBy?`<button type="button" data-refund="${esc(e.id)}">Undo spending</button>`:''}</article>`;
  }).join('')||'<p>No GM decisions have been recorded for this roll.</p>';
  const form=await prompt('Spend narrative symbols',`<p class="sf-tabletop-lede">Spend the uncancelled symbols on this roll. Record the GM decision so later checks can apply any granted dice automatically.</p>
    <section class="sf-tabletop-section"><h2>Available symbols</h2><div class="sf-roll-context">${SYMBOLS.map(s=>`<span>${left[s]} ${s}</span>`).join('')}</div><label>Reviewed option<select name="preset"><option value="">Custom GM ruling</option>${presets.map((p,i)=>`<option value="${i}">${esc(p.label)} · ${esc(p.source.book)} p. ${esc(p.source.page)}</option>`).join('')}</select></label><div class="sf-symbol-grid">${SYMBOLS.map(s=>numeric(s,s,0,0,left[s])).join('')}</div></section>
    <section class="sf-tabletop-section"><h2>GM decision</h2><label>Outcome<input name="label" required maxlength="500" placeholder="What changes in the story?"></label><label>What happened and why?<textarea name="note" maxlength="2000" rows="4" placeholder="Record the interpretation, timing and prerequisites."></textarea></label>${sourceHTML()}</section>
    <section class="sf-tabletop-section"><h2>Next check <small>optional mechanical effect</small></h2><p class="sf-ruling-status">Choose an actor and skill if this ruling grants or imposes dice on a later check. The effect is used once.</p><label>Dice effect<select name="futureDie"><option value="">No future dice</option><option value="boost">Boost</option><option value="setback">Setback</option></select></label><div data-future-fields hidden><div class="sf-tabletop-grid">${numeric('futureCount','Dice',1,1,3)}<label>Actor<select name="futureActorUuid">${options(actors.map(a=>({id:a.uuid,name:a.name})),actor?.uuid)}</select></label></div><label>Applicable skill<select name="futureSkillKey"><option value="any">Next check of any skill</option>${options(Object.entries(SKILLS).map(([id,skill])=>({id,name:skill.label})))}</select></label></div></section>
    ${game.user.isGM?'<label><input name="saveOption" type="checkbox"> Save this as a reusable GM option</label>':'<p>The GM must approve this proposal before symbols or future effects are committed.</p>'}
    <section class="sf-tabletop-section"><h2>Decisions on this roll</h2>${history}</section>`,'Review decision',(_event,app)=>{
      app.element.querySelector('[name="futureDie"]').addEventListener('change',event=>{app.element.querySelector('[data-future-fields]').hidden=!event.target.value;});
      app.element.querySelector('[name="preset"]').addEventListener('change',event=>{if(event.target.value==='')return;const p=presets[Number(event.target.value)];for(const [name,value]of Object.entries({label:p.label,note:p.note,...p.cost,...p.source})){const input=app.element.querySelector(`[name="${name}"]`);if(input)input.value=value??'';}});
      app.element.addEventListener('click',event=>{const b=event.target.closest('[data-refund]');if(b)void handle(async()=>{await requestTabletop('undo-spend',{messageUuid:message.uuid,entryId:b.dataset.refund});await app.close();await openNarrativeSpending(message);});});
    });
  if(!form)return;
  const request={label:form.label,note:form.note,cost:Object.fromEntries(SYMBOLS.map(s=>[s,Number(form[s])])),source:sourceFrom(form),futureEffect:form.futureDie?{die:form.futureDie,count:Number(form.futureCount),actorUuid:form.futureActorUuid,skillKey:form.futureSkillKey}:null};
  planSpend(facts,entries,request,{campaign:campaign()});
  if(game.user.isGM) {
    if(!await foundry.applications.api.DialogV2.confirm({...dialogDefaults,window:{title:'Confirm narrative spending'},content:`<div class="sf-tabletop-body"><section class="sf-tabletop-section"><h2>${esc(request.label)}</h2><p>${esc(request.note)}</p><p>${SYMBOLS.filter(s=>request.cost[s]).map(s=>`${request.cost[s]} ${s}`).join(' · ')}</p>${request.futureEffect?`<p>Next check: ${request.futureEffect.count} ${esc(request.futureEffect.die)} for ${esc(actors.find(a=>a.uuid===request.futureEffect.actorUuid)?.name??'actor')} · ${esc(request.futureEffect.skillKey)}</p>`:''}<small>${esc(request.source.book)} · ${esc(request.source.page)}</small></section></div>`,yes:{label:'Record GM decision'}}))return;
    await requestTabletop('spend',{messageUuid:message.uuid,request});
    if(form.saveOption==='on') {
      reviewedSource(request.source,campaign());
      const stored=game.settings.get(SYSTEM_ID,'narrativeSpendingOptions')??[];
      await game.settings.set(SYSTEM_ID,'narrativeSpendingOptions',[...stored.filter(o=>o.label!==request.label),request]);
    }
  } else {
    await ChatMessage.create({content:`<p>Proposed: ${esc(request.label)}</p><p>${SYMBOLS.filter(s=>request.cost[s]).map(s=>`${request.cost[s]} ${s}`).join(' · ')}</p><p>${esc(request.note)}</p>`,whisper:[game.user.id,...Array.from(game.users).filter(u=>u.isGM).map(u=>u.id)],flags:{[SYSTEM_ID]:{spendingProposal:{messageUuid:message.uuid,request}}}});
    ui.notifications.info('Proposal sent to the GM. Symbols have not been spent.');
  }
}

export async function openInitiativeSlots(combat=game.combat) {
  if(!combat?.started)throw new Error('Start a combat before claiming initiative slots.');
  const rows=Array.from(combat.combatants??[]),slots=Array.from(combat.turns??rows),owned=rows.filter(c=>c.actor?.type!=='vehicle'&&!c.defeated&&canSpendXp(c.actor,game.user));
  const claims=flag(combat,'slotClaims')??[],current=claims.filter(c=>c.round===combat.round);
  const form=await prompt(`Initiative · Round ${combat.round}`,`<p>Claim one slot on the character's side. Original combatants remain intact; each participant or minion group can claim only once per round.</p>
    <label>Acting character<select name="actorUuid">${options(owned.map(c=>({id:c.actor.uuid,name:c.name??c.actor.name})))}</select></label>
    <label>Slot<select name="slotId">${slots.map((c,i)=>{const claim=current.find(r=>r.slotId===c.id);const owner=rows.find(r=>r.actor?.uuid===claim?.actorUuid);return `<option value="${esc(c.id)}">${i+1}. ${esc(flag(c,'slotSide')??(c.actor?.hasPlayerOwner?'pc':'npc'))} · ${claim?esc(owner?.actor?.name??'claimed'):'available'}</option>`;}).join('')}</select></label>
    ${game.user.isGM?'<label><input type="checkbox" name="reassign"> Reassign this slot (GM)</label>':''}`,'Claim slot');
  if(!form)return;
  const args={...form,combatUuid:combat.uuid,round:combat.round,reassign:form.reassign==='on'},actor=await fromUuid(form.actorUuid);
  planSlotClaim(combat,actor,args,{user:game.user});await requestTabletop('claim',args);ui.combat?.render({force:true});
}

function dashboardTurnHTML(actor) {const budget=readTurnBudget(actor);return `<div class="sf-turn-panel sf-tabletop-turn-compact"><small>${esc(budget.roundLabel)}</small>${turnIndicatorHTML(budget,{compact:true,actor})}</div>`;}
function vehicleDashboardContent(actor) {
  const vehicle=vehicleForActor(actor),rows=vehicle?crewRoster(vehicle,vehicle.parent.tokens,{visibleOnly:true,user:game.user}):[],s=actor.system;
  const weapons=Array.from(actor.items??[]).filter(i=>i.type==='weapon');
  return {vehicle,rows,html:`<div class="sf-tabletop-body sf-vehicle-dashboard">
    <p>Speed ${s.speed.value}/${s.speed.max} · Handling ${s.handling} · Armour ${s.armor} · Silhouette ${s.silhouette}</p>
    <p>Hull ${s.hullTrauma.value}/${s.hullTrauma.max} · System strain ${s.systemStrain.value}/${s.systemStrain.max}</p>
    <div class="sf-tabletop-grid">${Object.entries(s.shields).map(([zone,n])=>`<span><strong>${esc(zone)}</strong> ${n}</span>`).join('')}</div>
    ${dashboardTurnHTML(actor)}<h3>Crew duties</h3>${vehicle?'':'<p>Place and select this vehicle on the active scene to use assigned crew.</p>'}
    ${rows.map(r=>`<article><strong>${esc(r.name)}</strong> · ${r.roles.map(role=>esc(CREW_ROLES[role]?.label??role)).join(', ')||esc(r.seat)}<p>${r.roles.flatMap(role=>CREW_ROLES[role]?.skills??[]).filter((key,i,all)=>all.indexOf(key)===i).map(key=>`${esc(SKILLS[key]?.label??key)} ${r.actor?.skillRank?.(key)??0}`).join(' · ')}</p>${dashboardTurnHTML(r.actor)}</article>`).join('')||'<p>No assigned crew.</p>'}
    <div class="sf-tabletop-grid">${['pilotingSpace','pilotingPlanetary','astrogation','mechanics','leadership'].map(key=>`<button type="button" data-duty="${key}" ${vehicle?'':'disabled'}>${esc(SKILLS[key].label)}</button>`).join('')}</div>
    <h3>Weapons and targeting</h3>${weapons.map(w=>`<article><strong>${esc(w.name)}</strong><p>Damage ${esc(w.system.damage)} · Critical ${w.system.critical} · ${esc(w.system.range)} · ${esc(weaponArcProfile(w).error || [...weaponArcProfile(w).arcs,weaponArcProfile(w).vertical].filter(Boolean).join(' / '))}</p><button type="button" data-weapon="${esc(w.id)}" ${vehicle?'':'disabled'}>Build assigned gunner pool</button></article>`).join('')||'<p>No verified weapons installed.</p>'}
    <p>Select the vehicle and target a token on the canvas to use its firing arcs, shields and measured attack trajectory.</p>
    <div class="sf-tabletop-grid"><button type="button" data-dashboard="target" ${vehicle?'':'disabled'}>Targeted attack and arcs</button><button type="button" data-dashboard="crew" ${vehicle?'':'disabled'}>Manage crew</button><button type="button" data-dashboard="history">Change history</button>${game.user.isGM?'<button type="button" data-dashboard="state">Adjust speed / shields</button><button type="button" data-dashboard="resolve">Damage / recovery</button>':''}</div>
    </div>`};
}
export async function openVehicleDashboard(actor) {
  if(actor?.type!=='vehicle'||!canSpendXp(actor,game.user))throw new Error('Choose an owned vehicle.');
  let state=vehicleDashboardContent(actor),cleanup=()=>{},result;
  try {
    result=await foundry.applications.api.DialogV2.wait({...dialogDefaults,position:{width:800,height:850},window:{...dialogDefaults.window,title:`Vehicle combat · ${actor.name}`},content:state.html,
    buttons:[{action:'refresh',label:'Refresh',callback:()=> 'refresh'},{action:'close',label:'Close'}],render:(_e,app)=>{
      cleanup();
      const root=app.element;
      const paint=()=>{
        if(!canSpendXp(actor,game.user)){void app.close();return;}
        state=vehicleDashboardContent(actor);
        const container=root.querySelector('.dialog-content'),scroll=container.scrollTop;
        container.innerHTML=state.html;container.scrollTop=scroll;
        const panels=root.querySelectorAll('.sf-turn-panel');if(panels[0])bindTurnControls(panels[0],actor);
        state.rows.forEach((row,i)=>panels[i+1]&&bindTurnControls(panels[i+1],row.actor));
      };
      paint();
      const onClick=event=>{const b=event.target.closest('[data-duty],[data-weapon],[data-dashboard]');if(!b)return;void handle(async()=>{
        const {vehicle}=state,s=actor.system;
        if(b.dataset.duty)return crewCheckDialog(vehicle,b.dataset.duty);
        if(b.dataset.weapon)return crewCheckDialog(vehicle,'gunnery',actor.items.get(b.dataset.weapon));
        if(b.dataset.dashboard==='history')return openWorkflowHistory(actor);
        if(b.dataset.dashboard==='resolve')return openResolution(actor);
        if(b.dataset.dashboard==='crew'){actor.sheet.activeTab='crew';return actor.sheet.render({force:true});}
        if(b.dataset.dashboard==='target') {const target=Array.from(game.user.targets??[])[0];if(!target)throw new Error('Target a token on the canvas first.');return game.system.api.range.chooseAttackArcs(vehicle.object??vehicle,target);}
        if(b.dataset.dashboard==='state') {
          const form=await prompt(`Vehicle state · ${actor.name}`,`${numeric('speed','Speed',s.speed.value,0,s.speed.max)}${Object.entries(s.shields).map(([z,n])=>numeric(z,`${z} shields`,n,0,4)).join('')}${sourceHTML()}`);if(!form)return;
          const request={kind:'vehicle-state',speed:Number(form.speed),shields:Object.fromEntries(Object.keys(s.shields).map(z=>[z,Number(form[z])])),source:sourceFrom(form),note:'Reviewed speed / shields adjustment'};
          const plan=planActorEffect(actor,request,{user:game.user,campaign:campaign()});if(await confirmPlan(actor,plan))await requestTabletop('effect',{actorUuid:actor.uuid,request,expected:reviewSnapshot(plan)});
        }
      });};
      root.addEventListener('click',onClick);
      const stop=watchVehicleDashboard({hooks:Hooks,actorUuids:()=>new Set([actor.uuid,...state.rows.map(row=>row.actor?.uuid)]),sceneId:()=>state.vehicle?.parent?.id,refresh:paint});
      cleanup=()=>{stop();root.removeEventListener('click',onClick);};
    }});
  } finally {cleanup();}
  if(result==='refresh')return openVehicleDashboard(actor);
}

export async function openSessionWrapUp() {
  if(!game.user.isGM)throw new Error('The GM manages session awards.');
  const actors=visibleActors().filter(a=>a.type==='character'),c=campaign();
  const form=await prompt('Session wrap-up',`<label>Session title<input name="label" required maxlength="200" value="Session wrap-up"></label><fieldset><legend>Recipients</legend>${actors.map(a=>`<label><input name="actor-${esc(a.id)}" type="checkbox"> ${esc(a.name)} · ${a.system.xp.available} available XP · ${a.system.credits} credits</label>`).join('')}</fieldset>
    <p>Amounts below apply to each checked character. Use separate awards where outcomes differ. Story changes are explicit GM decisions; no session trigger or downtime reward is inferred.</p>
    ${numeric('xp','XP per character',0,0,100000)}${numeric('credits','Credits per character',0,0,1000000000)}
    ${['obligation','duty','morality','conflict'].filter(k=>c[k==='conflict'?'morality':k]).map(k=>numeric(k,`${k} adjustment`,0,-100,100)).join('')}
    <label>Downtime record<textarea name="downtime" maxlength="2000"></textarea></label>${sourceHTML()}`,'Preview awards');
  if(!form)return;
  const selected=actors.filter(a=>form[`actor-${a.id}`]==='on');if(!selected.length)throw new Error('Choose at least one recipient.');
  const request={label:form.label,xp:Number(form.xp),credits:Number(form.credits),downtime:form.downtime,source:sourceFrom(form),story:Object.fromEntries(['obligation','duty','morality','conflict'].filter(k=>form[k]!==undefined).map(k=>[k,Number(form[k])]))};
  const plans=selected.map(actor=>({actor,plan:planSessionAward(actor,request,{user:game.user,campaign:c})}));
  if(!await foundry.applications.api.DialogV2.confirm({...dialogDefaults,window:{...dialogDefaults.window,title:'Review session awards'},content:`<div class="sf-tabletop-body">${plans.map(({actor,plan})=>`<h2>${esc(actor.name)}</h2>${reviewHTML(plan)}`).join('')}</div>`,yes:{label:'Award reviewed changes'}}))return;
  const completed=[];
  try {for(const {actor,plan}of plans){await requestTabletop('award',{actorUuid:actor.uuid,request,expected:reviewSnapshot(plan)});completed.push(actor.name);}}
  catch(error){throw new Error(`${error.message} Confirmed recipients: ${completed.join(', ')||'none'}. Review history before retrying; each recipient is committed independently.`);}
  ui.notifications.info(`Session awards saved for ${completed.length} characters. Their histories include the before/after values and downtime.`);
}
export async function openTabletopTools() {
  const form=await prompt('Star Wars · Tabletop tools',`<label>Actor<select name="actor">${options(visibleActors().filter(a=>a.type!=='group').map(a=>({id:a.uuid,name:a.name})))}</select></label><label>Tool<select name="tool"><option value="history">Change history</option><option value="initiative">Initiative slots</option><option value="vehicle">Vehicle combat dashboard</option>${game.user.isGM?'<option value="resolution">Combat resolution</option><option value="session">Session wrap-up</option>':''}</select></label>`,'Open');
  if(!form)return;const actor=await fromUuid(form.actor);
  return {history:()=>openWorkflowHistory(actor),initiative:()=>openInitiativeSlots(),vehicle:()=>openVehicleDashboard(actor),resolution:()=>openResolution(actor),session:()=>openSessionWrapUp()}[form.tool]();
}
function addButton(root,selector,label,callback,key) {
  if(!root?.querySelector || root.querySelector(`[data-tabletop-button="${key}"]`))return;
  const anchor=root.querySelector(selector);if(!anchor)return;
  const button=document.createElement('button');button.type='button';button.dataset.tabletopButton=key;button.textContent=label;button.addEventListener('click',()=>void handle(callback));anchor.append(button);
}
export function registerTabletopWorkflows() {
  game.settings.register(SYSTEM_ID,'tabletopProvenance',{scope:'world',config:false,type:Object,default:{}});
  // TODO: preload narrative options only after their rule sources are reviewed.
  game.settings.register(SYSTEM_ID,'narrativeSpendingOptions',{scope:'world',config:false,type:Array,default:[]});
  Hooks.once('ready',()=>{
    service=new TabletopWorkflowService({assertAuthority:()=>{if(!getDocumentTransactionBroker().isAuthority())throw new Error('Transaction authority changed; inspect the request before retrying.');},resolve:uuid=>fromUuid(uuid),campaign,verifyProposal:message=>authenticatedRequester(message,'spendingProposal',undefined,{requireActive:false})});
    for(const message of game.messages??[])if(flag(message,'tabletopRequest')&&!flag(message,'tabletopResult'))void handle(()=>processRequest(message));
  });
  Hooks.on('starWarsAuthoritySelected',()=>{for(const message of game.messages??[])if(flag(message,'tabletopRequest')&&!flag(message,'tabletopResult'))void handle(()=>processRequest(message));});
  Hooks.on('createChatMessage',(message,_options,creatorId)=>{
    if(!service || !getDocumentTransactionBroker().isAuthority())return;
    if(flag(message,'tabletopRequest'))void handle(()=>processRequest(message,creatorId));
    if(flag(message,'spendingProposal'))void handle(async()=>{await authenticatedRequester(message,'spendingProposal',creatorId);await message.update({[`flags.${SYSTEM_ID}.proposalReady`]:true});});
  });
  Hooks.on('updateChatMessage',message=>settleRequest(message));
  const renderMessage=(message,html)=>{
    const root=html?.querySelector?html:html?.[0];if(!root||message.isContentVisible===false)return;
    const facts=flag(message,'outcome');
    if(facts&&message.rolls?.length){
      addButton(root,'.message-content','Spend narrative symbols',()=>openNarrativeSpending(message),'spend');
      if(game.user.isGM)addButton(root,'.message-content','Combat resolution',()=>openResolution(null,{message}),'resolve');
      const entries=flag(message,'spending')??[],actors=Array.from(game.actors??[]),resolutions=actors.flatMap(actor=>(flag(actor,'workflowHistory')??[]).filter(entry=>entry.sourceRollUuid===message.uuid).map(entry=>({actor,entry})));
      if((entries.length||resolutions.length)&&!root.querySelector('.sf-spending-summary')){
        const summary=document.createElement('section');summary.className='sf-spending-summary';
        const remaining=Object.entries(remainingSymbols(facts,entries)).map(([k,v])=>`${v} ${k}`).join(' · ');
        summary.innerHTML=`<strong>GM decisions on this roll</strong>${entries.map(entry=>`<p>${esc(entry.label)} · ${SYMBOLS.filter(s=>entry.cost[s]).map(s=>`${entry.cost[s]} ${s}`).join(' · ')}${entry.undone?' · undone':''}${entry.note?`<br>${esc(entry.note)}`:''}${entry.futureEffect?`<br>Next check: ${entry.futureEffect.count} ${esc(entry.futureEffect.die)} for ${esc(actors.find(a=>a.uuid===entry.futureEffect.actorUuid)?.name??'actor')} (${esc(entry.futureEffect.skillKey)})`:''}</p>`).join('')}${resolutions.map(({actor,entry})=>`<p>${esc(actor.name)} · ${esc(entry.kind)}${entry.undone?' · undone':''}: ${esc(entry.label)}${entry.calculation?` · ${entry.calculation.applied} ${esc(entry.calculation.resource)}`:''}</p>`).join('')}<small>Remaining: ${remaining}</small>`;
        root.querySelector('.message-content')?.append(summary);
      }
    }
    const proposal=flag(message,'spendingProposal');
    if(proposal&&game.user.isGM&&!flag(message,'proposalResolved'))addButton(root,'.message-content','Review spending proposal',async()=>{
      const native=await fromUuid(proposal.messageUuid),actor=flag(native,'actorUuid')?await fromUuid(flag(native,'actorUuid')):null,author=await authenticatedRequester(message,'spendingProposal',undefined,{requireActive:false});
      if(!canProposeSpend(native,actor,author))throw new Error('The proposer does not own the rolling actor.');
      const futureTarget=proposal.request.futureEffect?await fromUuid(proposal.request.futureEffect.actorUuid):null;
      if(await foundry.applications.api.DialogV2.confirm({...dialogDefaults,window:{...dialogDefaults.window,title:'Approve narrative spending'},content:`<div class="sf-tabletop-body"><section class="sf-tabletop-section"><h2>${esc(proposal.request.label)}</h2><div class="sf-roll-context">${Object.entries(proposal.request.cost).filter(([,n])=>n).map(([s,n])=>`<span>${n} ${esc(s)}</span>`).join('')}</div><p>${esc(proposal.request.note)}</p>${proposal.request.futureEffect?`<p>Next check: ${proposal.request.futureEffect.count} ${esc(proposal.request.futureEffect.die)} for ${esc(futureTarget?.name??'Missing actor')} · ${esc(proposal.request.futureEffect.skillKey)}</p>`:''}<small>${esc(proposal.request.source.book)} · ${esc(proposal.request.source.page)}. Confirm the source, cost, timing and prerequisites.</small></section></div>`,yes:{label:'Approve GM decision'}})){
        await requestTabletop('spend',{messageUuid:proposal.messageUuid,proposalUuid:message.uuid,request:proposal.request});await message.update({[`flags.${SYSTEM_ID}.proposalResolved`]:true});
      }
    },'proposal');
  };
  Hooks.on('renderChatMessageHTML',renderMessage);
  Hooks.on('updateActor',(_actor,change)=>{if(change?.flags?.[SYSTEM_ID]?.workflowHistory)ui.chat?.render?.(false);});
  Hooks.on('renderActorDirectory',(_app,html)=>addButton(html,'.directory-footer','Star Wars · Tabletop tools',openTabletopTools,'tools'));
  Hooks.on('renderCombatTracker',(_app,html)=>{
    const root=html?.querySelector?html:html?.[0];addButton(root,'.combat-controls, .directory-footer','Choose initiative slot',()=>openInitiativeSlots(),'slots');
    const combat=game.combat;if(!combat)return;
    for(const claim of (flag(combat,'slotClaims')??[]).filter(c=>c.round===combat.round)) {
      const row=root?.querySelector(`[data-combatant-id="${claim.slotId}"] .token-name, [data-combatant-id="${claim.slotId}"] .combatant-name`);
      if(row&&!row.querySelector('.sf-slot-claim')){const text=document.createElement('span');text.className='sf-slot-claim';text.textContent=`Acting: ${combat.combatants.find(c=>c.actor?.uuid===claim.actorUuid)?.actor?.name??'Unavailable'}`;row.append(text);}
    }
  });
  Hooks.on('renderApplicationV2',(app,html)=>{
    if(!app.actor || !canSpendXp(app.actor,game.user))return;
    const root=html?.querySelector?html:app.element;
    addButton(root,'.window-header','Tabletop history',()=>openWorkflowHistory(app.actor),'history');
    if(app.actor.type==='vehicle')addButton(root,'.window-header','Combat dashboard',()=>openVehicleDashboard(app.actor),'vehicle');
  });
}
export const tabletopApi=Object.freeze({open:openTabletopTools,resolve:openResolution,spend:openNarrativeSpending,initiative:openInitiativeSlots,vehicle:openVehicleDashboard,session:openSessionWrapUp,history:openWorkflowHistory,request:requestTabletop});
