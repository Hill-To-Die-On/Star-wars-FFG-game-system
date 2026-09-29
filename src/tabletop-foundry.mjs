import {getDocumentTransactionBroker} from './document-transactions.mjs';
import { SYSTEM_ID, SKILLS } from './config.mjs';
import { escapeHTML as esc } from './mechanics.mjs';
import { ActorTransactionQueue, canSpendXp } from './xp-transactions.mjs';
import { SYMBOLS, remainingSymbols, planActorEffect, planSessionAward, planSlotClaim, reviewedSource, snapshotValues, reviewSnapshot } from './tabletop-workflows.mjs';
import { TabletopWorkflowService, workflowAuthority, canProposeSpend } from './tabletop-service.mjs';
import { crewRoster, CREW_ROLES } from './vehicle-crew.mjs';
import { vehicleForActor, crewCheckDialog } from './vehicle-crew-foundry.mjs';
import { readTurnBudget, turnIndicatorHTML, bindTurnControls } from './turn-economy-foundry.mjs';
import { bookAllowed } from './rules.mjs';
import { weaponArcProfile } from './range-overlay/arcs.mjs';
import { watchVehicleDashboard } from './tabletop-dashboard.mjs';
import { createMessageProvenance, verifyMessageProvenance } from './tabletop-provenance.mjs';

const flag=(document,key)=>document?.flags?.[SYSTEM_ID]?.[key];
const campaign=()=>game.settings.get(SYSTEM_ID,'campaign');
const uuid=()=>foundry.utils.randomID(24);
const visibleActors=()=>Array.from(game.actors??[]).filter(a=>canSpendXp(a,game.user));
const values=button=>Object.fromEntries(new FormData(button.form));
const numeric=(name,label,value=0,min=0,max=1000000)=>`<label>${esc(label)}<input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${value}" required></label>`;
const options=(rows,selected)=>rows.map(r=>`<option value="${esc(r.id??r.uuid)}" ${(r.id??r.uuid)===selected?'selected':''}>${esc(r.name)}</option>`).join('');
const sourceHTML=(source={})=>`<fieldset><legend>Rule reference / GM decision</legend><label>Book or table decision<input name="book" value="${esc(source.book??'')}" required maxlength="200"></label><label>Page or session reference<input name="page" value="${esc(source.page??'')}" required maxlength="80"></label><label>Verification<select name="verification"><option value="gm-ruling" ${source.verification!=='gm-reviewed'?'selected':''}>Explicit GM ruling</option><option value="gm-reviewed" ${source.verification==='gm-reviewed'?'selected':''}>GM checked the source</option></select></label></fieldset>`;
const sourceFrom=form=>({book:form.book,page:form.page,verification:form.verification});
const dialogDefaults={classes:['sf-tabletop-dialog'],window:{resizable:true},position:{width:650,height:650},rejectClose:false};
const prompt=(title,content,label='Review',render)=>foundry.applications.api.DialogV2.prompt({...dialogDefaults,window:{...dialogDefaults.window,title},content:`<div class="sf-tabletop-body">${content}</div>`,render,ok:{label,callback:(_e,b)=>values(b)}});
const handle=work=>Promise.resolve().then(work).catch(error=>ui.notifications.error(error.message));
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
const reviewHTML=entry=>{const plan={...entry,before:snapshotValues(entry.before),after:snapshotValues(entry.after)};return `<p><strong>${esc(plan.label)}</strong></p><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${Object.entries(plan.after).map(([path,value])=>`<tr><td>${esc(path.replace(/^system\./,''))}</td><td>${esc(typeof plan.before[path]==='object'?JSON.stringify(plan.before[path]):plan.before[path])}</td><td>${esc(typeof value==='object'?JSON.stringify(value):value)}</td></tr>`).join('')}</tbody></table>${plan.calculation?`<p>Damage ${plan.calculation.amount} · soak/armour ${plan.calculation.soak} · Pierce ${plan.calculation.pierce} · Breach ${plan.calculation.breach} → ${plan.calculation.applied} ${esc(plan.calculation.resource)}.</p>${plan.calculation.exceedsThreshold?'<p>Threshold exceeded. Review incapacitation and critical effects.</p>':''}`:''}${plan.warning?`<p>${esc(plan.warning)}</p>`:''}<p>${esc(plan.source.book)} · ${esc(plan.source.page)} · ${esc(plan.source.verification)}</p>${plan.downtime?`<p>Downtime: ${esc(plan.downtime)}</p>`:''}`;};
async function confirmPlan(actor,plan) {
  return foundry.applications.api.DialogV2.confirm({...dialogDefaults,window:{...dialogDefaults.window,title:`Apply changes · ${actor.name}`},content:reviewHTML(plan),yes:{label:'Apply reviewed changes'},no:{label:'Back'}});
}

export async function openResolution(actor,{message,weapon}={}) {
  if(!game.user.isGM)throw new Error('The GM reviews combat effects.');
  if(!actor){const pick=await prompt('Choose affected actor',`<label>Actor<select name="actor">${options(visibleActors().filter(a=>a.type!=='group').map(a=>({id:a.uuid,name:a.name})))}</select></label>`,'Choose');if(!pick)return;actor=await fromUuid(pick.actor);}
  const vehicle=actor.type==='vehicle',facts=flag(message,'outcome'),resources=vehicle?['hullTrauma','systemStrain']:['wounds','strain'];
  if(message&&!weapon&&flag(message,'actorUuid')) {
    const attacker=await fromUuid(flag(message,'actorUuid'));
    const weapons=Array.from(attacker?.items??[]).filter(item=>item.type==='weapon');
    if(weapons.length) {
      const picked=await prompt('Weapon used for this roll',`<p>Select the actual weapon used. The roll does not identify a weapon automatically.</p><label>Weapon<select name="weapon"><option value="">Manual / other vehicle mount</option>${options(weapons)}</select></label>`,'Continue');
      if(!picked)return;weapon=weapons.find(w=>w.id===picked.weapon);
    }
  }
  let amount=0;if(weapon&&facts?.passed)try{amount=weapon.damageFor(facts);}catch{}
  const form=await prompt(`Combat resolution · ${actor.name}`,`<p>Preview damage after soak, recovery, or a source-checked critical/condition. Criticals and conditions are recorded for adjudication; their unencoded modifiers require the pool's manual controls.</p>
    ${facts?`<p>Native roll: ${facts.success??0} success · ${facts.advantage??0} advantage · ${facts.threat??0} threat. ${weapon?esc(weapon.name):'Choose the total damage from the weapon and successful roll.'}</p>`:''}
    <label>Effect<select name="kind"><option value="damage">Damage</option><option value="recover">Recovery</option><option value="critical">Record critical</option><option value="condition">Record condition</option></select></label>
    ${numeric('amount','Damage / recovery amount',amount)}<label>Recovery resource<select name="resource">${resources.map(r=>`<option>${r}</option>`).join('')}</select></label>
    <label><input name="strain" type="checkbox"> Inflict strain / system strain</label><label><input name="ignoreSoak" type="checkbox"> Ignore soak / armour (review source)</label>
    ${numeric('pierce','Pierce',0)}${numeric('breach','Breach',0)}<label>Damage scale<select name="scale"><option value="personal" ${vehicle?'':'selected'}>Personal</option><option value="vehicle" ${vehicle?'selected':''}>Vehicle</option></select></label>
    <label>Critical / condition name<input name="label" maxlength="200"></label><label>Reason and prerequisites<textarea name="note" maxlength="2000"></textarea></label>${weapon?.system.qualities?`<p>Weapon qualities (review prerequisites before using): ${esc(weapon.system.qualities)}</p>`:''}${sourceHTML(weapon?.system.source)}`);
  if(!form)return;
  const request={...form,amount:Number(form.amount),pierce:Number(form.pierce),breach:Number(form.breach),strain:form.strain==='on',ignoreSoak:form.ignoreSoak==='on',source:sourceFrom(form),entryId:uuid()};
  const plan=planActorEffect(actor,request,{user:game.user,campaign:campaign()});
  if(await confirmPlan(actor,plan)){await requestTabletop('effect',{actorUuid:actor.uuid,request,expected:reviewSnapshot(plan)});ui.notifications.info(`Applied to ${actor.name}. Undo is available in Tabletop history.`);}
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
  const entries=flag(message,'spending')??[],left=remainingSymbols(flag(message,'outcome'),entries),presets=spendingOptions();
  const form=await prompt('Spend narrative symbols',`<p>${SYMBOLS.map(s=>`${left[s]} ${s}`).join(' · ')} remain. Success/failure stays unchanged. Narrative decisions are recorded separately from mechanical effects.</p>
    <label>Reviewed options<select name="preset"><option value="">Custom suggestion / GM ruling</option>${presets.map((p,i)=>`<option value="${i}">${esc(p.label)} · ${esc(p.source.book)} p. ${esc(p.source.page)}</option>`).join('')}</select></label>
    <label>Outcome<input name="label" required maxlength="500"></label><div class="sf-tabletop-grid">${SYMBOLS.map(s=>numeric(s,s,0,0,left[s])).join('')}</div>
    <label>Narrative / prerequisites<textarea name="note" maxlength="2000"></textarea></label>${sourceHTML()}
    ${game.user.isGM?'<label><input name="saveOption" type="checkbox"> Save as a reusable, GM-reviewed option</label>':'<p>The GM must approve this proposal before any symbols are spent.</p>'}
    <h3>Committed choices</h3>${entries.map(e=>`<p>${esc(e.label)} · ${SYMBOLS.filter(s=>e.cost[s]).map(s=>`${e.cost[s]} ${s}`).join(', ')} ${e.undone?'(undone)':''}${game.user.isGM&&!e.undone?` <button type="button" data-refund="${esc(e.id)}">Undo spending</button>`:''}</p>`).join('')||'<p>None yet.</p>'}`,'Review',(_event,app)=>{
      app.element.querySelector('[name="preset"]').addEventListener('change',event=>{if(event.target.value==='')return;const p=presets[Number(event.target.value)];for(const [name,value]of Object.entries({label:p.label,note:p.note,...p.cost,...p.source})){const input=app.element.querySelector(`[name="${name}"]`);if(input)input.value=value??'';}});
      app.element.addEventListener('click',event=>{const b=event.target.closest('[data-refund]');if(b)void handle(async()=>{await requestTabletop('undo-spend',{messageUuid:message.uuid,entryId:b.dataset.refund});await app.close();await openNarrativeSpending(message);});});
    });
  if(!form)return;
  const request={label:form.label,note:form.note,cost:Object.fromEntries(SYMBOLS.map(s=>[s,Number(form[s])])),source:sourceFrom(form)};
  if(game.user.isGM) {
    if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Confirm narrative spending'},content:`<p>${esc(request.label)} · ${SYMBOLS.filter(s=>request.cost[s]).map(s=>`${request.cost[s]} ${s}`).join(' · ')}</p><p>Confirm the source, timing and prerequisites. Apply any mechanical effects separately through Combat resolution.</p>`}))return;
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

function dashboardTurnHTML(actor) {const budget=readTurnBudget(actor);return `<div class="sf-turn-panel sf-tabletop-turn-compact"><small>${esc(budget.roundLabel)}</small>${turnIndicatorHTML(budget,{compact:true})}</div>`;}
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
      const entries=flag(message,'spending')??[];if(entries.length&&!root.querySelector('.sf-spending-summary')){
        const summary=document.createElement('p');summary.className='sf-spending-summary';summary.textContent=`Remaining: ${Object.entries(remainingSymbols(facts,entries)).map(([k,v])=>`${v} ${k}`).join(' · ')}`;root.querySelector('.message-content')?.append(summary);
      }
    }
    const proposal=flag(message,'spendingProposal');
    if(proposal&&game.user.isGM&&!flag(message,'proposalResolved'))addButton(root,'.message-content','Review spending proposal',async()=>{
      const native=await fromUuid(proposal.messageUuid),actor=flag(native,'actorUuid')?await fromUuid(flag(native,'actorUuid')):null,author=await authenticatedRequester(message,'spendingProposal',undefined,{requireActive:false});
      if(!canProposeSpend(native,actor,author))throw new Error('The proposer does not own the rolling actor.');
      if(await foundry.applications.api.DialogV2.confirm({window:{title:'Approve narrative spending'},content:`<p>${esc(proposal.request.label)}</p><p>${esc(proposal.request.note)}</p><p>${Object.entries(proposal.request.cost).map(([s,n])=>`${n} ${esc(s)}`).join(' · ')}</p><p>${esc(proposal.request.source.book)} · ${esc(proposal.request.source.page)}. Confirm the source, cost, timing and prerequisites.</p>`})){
        await requestTabletop('spend',{messageUuid:proposal.messageUuid,proposalUuid:message.uuid,request:proposal.request});await message.update({[`flags.${SYSTEM_ID}.proposalResolved`]:true});
      }
    },'proposal');
  };
  Hooks.on('renderChatMessageHTML',renderMessage);
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
