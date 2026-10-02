import {transactionWorld} from './fixtures/document-transactions.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {TabletopWorkflowService,workflowRequestAuthor,workflowAuthority,canProposeSpend} from '../src/tabletop-service.mjs';
const id='star-wars-ffg',gm={id:'gm',isGM:true,active:true},p={id:'p',active:true};
const set=(object,path,value)=>{const keys=path.split('.');let target=object;for(const k of keys.slice(0,-1))target=target[k]??={};target[keys.at(-1)]=structuredClone(value);};
function doc(data){return {...data,async update(changes){await new Promise(r=>setTimeout(r,1));for(const [path,value]of Object.entries(changes))set(this,path,value);}};}
const source={book:'Table decision',page:'Session 1',verification:'gm-ruling'};
const actor=()=>doc({id:'a',uuid:'Actor.a',name:'A',type:'character',hasPlayerOwner:true,flags:{},system:{wounds:{value:0,max:10},soak:2,xp:{available:1,total:1},credits:0},testUserPermission:u=>u.id==='p'});
test('authoritative queue serializes concurrent damage and persisted IDs survive service restart',async()=>{
 const a=actor(),service=new TabletopWorkflowService({resolve:()=>a}),args={actorUuid:a.uuid,request:{kind:'damage',amount:4,scale:'personal',source}};
 await Promise.all([service.execute('effect',args,gm,'one'),service.execute('effect',args,gm,'two')]);assert.equal(a.system.wounds.value,4);assert.equal(a.flags[id].workflowHistory.length,2);
 await new TabletopWorkflowService({resolve:()=>a}).execute('effect',args,gm,'one');assert.equal(a.system.wounds.value,4);
 await service.execute('undo-effect',{actorUuid:a.uuid,entryId:'two'},gm,'undo');assert.equal(a.system.wounds.value,2);
});
test('stale previews and player effects reject without mutation',async()=>{
 const a=actor(),service=new TabletopWorkflowService({resolve:()=>a}),args={actorUuid:a.uuid,request:{kind:'damage',amount:4,scale:'personal',source},expected:{'system.wounds.value':9}};
 await assert.rejects(service.execute('effect',args,gm,'stale'),/preview/);await assert.rejects(service.execute('effect',args,p,'player'),/GM/);assert.equal(a.system.wounds.value,0);
});
test('a roll-linked GM condition refreshes its source card when applied and undone',async()=>{
 const a=actor(),message=doc({uuid:'ChatMessage.condition',flags:{}}),docs={[a.uuid]:a,[message.uuid]:message};
 const service=new TabletopWorkflowService({resolve:key=>docs[key]});
 const request={kind:'condition',label:'Optic sensor feedback',note:'The service port surge disrupts the droid optics.',entryId:'condition-1',source,sourceRollUuid:message.uuid,modifier:{die:'setback',count:1,skillKey:'perception'}};
 const applied=await service.execute('effect',{actorUuid:a.uuid,request},gm,'apply-linked');
 assert.equal(applied.linkWarning,undefined);
 assert.equal(message.flags[id].linkedDecisionRevision,'apply-linked');
 assert.equal(a.flags[id].conditions[0].modifier.skillKey,'perception');
 await service.execute('undo-effect',{actorUuid:a.uuid,entryId:'apply-linked'},gm,'undo-linked');
 assert.equal(message.flags[id].linkedDecisionRevision,'undo-linked');
});
test('competing initiative claims have one winner and never replace combatant actor identities',async()=>{
 const a=actor(),b=actor();b.id='b';b.uuid='Actor.b';
 const combat=doc({uuid:'Combat.c',started:true,round:1,flags:{},combatants:[{id:'s1',actor:a,tokenId:'t1',flags:{[id]:{slotSide:'pc'}}},{id:'s2',actor:b,tokenId:'t2',flags:{[id]:{slotSide:'pc'}}}]});
 const docs={[a.uuid]:a,[b.uuid]:b,[combat.uuid]:combat},service=new TabletopWorkflowService({resolve:uuid=>docs[uuid]});
 const results=await Promise.allSettled([a,b].map((actor,i)=>service.execute('claim',{combatUuid:combat.uuid,actorUuid:actor.uuid,slotId:'s1',round:1},p,`claim-${i}`)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(combat.combatants[0].actor,a);assert.equal(combat.flags[id].slotClaims.length,1);
});
test('concurrent spending cannot overspend and undo preserves separate Triumph',async()=>{
 const facts={advantage:2,threat:0,triumph:1,despair:0},message=doc({uuid:'ChatMessage.m',flags:{[id]:{outcome:facts}},rolls:[{options:{starWars:{outcome:facts}}}]}),service=new TabletopWorkflowService({resolve:()=>message});
 const args={messageUuid:message.uuid,request:{cost:{advantage:2},label:'Opening',source}};
 const results=await Promise.allSettled(['s1','s2'].map(n=>service.execute('spend',args,gm,n)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await service.execute('undo-spend',{messageUuid:message.uuid,entryId:'s1'},gm,'undo');
 await service.execute('spend',args,gm,'s3');assert.equal(message.flags[id].spending.length,2);
});
test('GM spending records a next-check boost and the owning actor consumes it once',async()=>{
 const a=actor(),facts={advantage:2,threat:0,triumph:0,despair:0};
 const message=doc({uuid:'ChatMessage.future',flags:{[id]:{actorUuid:a.uuid,outcome:facts}},rolls:[{options:{starWars:{outcome:facts}}}]});
 const docs={[message.uuid]:message,[a.uuid]:a},service=new TabletopWorkflowService({resolve:key=>docs[key]});
 const request={label:'Found a clear route',note:'The GM grants a boost on the next Computers check.',cost:{advantage:2},source,
  futureEffect:{die:'boost',count:1,actorUuid:a.uuid,skillKey:'computers'}};
 await service.execute('spend',{messageUuid:message.uuid,request},gm,'boost-1');
 assert.equal(message.flags[id].spending[0].futureEffect.actorUuid,a.uuid);
 assert.equal(a.flags[id].narrativeEffects[0].id,'boost-1');
 assert.equal(a.flags[id].narrativeEffects[0].note,request.note);
 await service.execute('consume-future-effect',{actorUuid:a.uuid,entryIds:['boost-1'],skillKey:'computers',rollId:'roll-1'},p,'consume-1');
 assert.equal(a.flags[id].narrativeEffects[0].consumedBy,'roll-1');
 await assert.rejects(service.execute('consume-future-effect',{actorUuid:a.uuid,entryIds:['boost-1'],skillKey:'computers',rollId:'roll-2'},p,'consume-2'),/already used/);
 await assert.rejects(service.execute('undo-spend',{messageUuid:message.uuid,entryId:'boost-1'},gm,'undo-boost'),/already used/);
});
test('forged narrative headings cannot be spent and document authorship controls authorization',async()=>{
 const service=new TabletopWorkflowService({resolve:()=>doc({flags:{[id]:{outcome:{advantage:3}}},rolls:[]})});
 await assert.rejects(service.execute('spend',{messageUuid:'fake',request:{}},gm,'fake'),/native/);
 assert.equal(workflowRequestAuthor({author:p,user:gm,flags:{userId:'gm'}},[p,gm]),p);
 assert.equal(workflowAuthority([{...gm,id:'z'},gm,p]),gm);
});
test('two GM approvals of one proposal spend only once, and an altered proposal fails review',async()=>{
 const a=actor(),facts={advantage:4,threat:0,triumph:0,despair:0};
 const native=doc({uuid:'ChatMessage.roll',flags:{[id]:{actorUuid:a.uuid,outcome:facts}},rolls:[{options:{starWars:{outcome:facts}}}]});
 const request={label:'Opening',cost:{advantage:2},source};
 const proposal=doc({uuid:'ChatMessage.proposal',author:p,flags:{[id]:{spendingProposal:{messageUuid:native.uuid,request}}}});
 const docs={[native.uuid]:native,[proposal.uuid]:proposal,[a.uuid]:a},service=new TabletopWorkflowService({resolve:key=>docs[key],verifyProposal:async()=>p});
 const args={messageUuid:native.uuid,proposalUuid:proposal.uuid,request};
 await Promise.all([service.execute('spend',args,gm,'approval-1'),service.execute('spend',args,{...gm,id:'other-gm'},'approval-2')]);assert.equal(native.flags[id].spending.length,1);
 const other=doc({...proposal,uuid:'ChatMessage.other',flags:{[id]:{spendingProposal:{messageUuid:native.uuid,request}}}});docs[other.uuid]=other;
 await assert.rejects(service.execute('spend',{...args,proposalUuid:other.uuid,request:{...request,label:'Changed'}},gm,'altered'),/changed after review/);
});
test('session awards share the purchase critical section and cannot overwrite a simultaneous talent cost',async()=>{
 const {XpTransactionCoordinator}=await import('../src/xp-transactions.mjs');
 const a=actor();a.system.xp={available:10,total:30};const world=transactionWorld([gm]);let started;const begun=new Promise(resolve=>started=resolve);
 const service=new TabletopWorkflowService({resolve:()=>a});
 const xp=new XpTransactionCoordinator({transport:world.client(gm).transport,currentUser:()=>gm,users:()=>[gm],getActor:()=>a,execute:async actor=>{started();const old=actor.system.xp.available;await new Promise(resolve=>setTimeout(resolve,15));assert.ok(old>=10);await actor.update({'system.xp.available':old-10});}});
 await Promise.all([xp.request(a,'buyTalent',{}),begun.then(()=>service.execute('award',{actorUuid:a.uuid,request:{xp:5,source}},gm,'award-concurrent'))]);
 assert.equal(a.system.xp.available,5);assert.equal(a.system.xp.total,35);assert.equal(JSON.parse(a.flags[id].workflowHistory[0].before)['system.xp.available'],0);world.stop();
});
test('recovery shares the turn critical section and cannot erase a concurrently bought manoeuvre strain cost',async()=>{
 const {TurnTransactionCoordinator}=await import('../src/turn-transactions.mjs');
 const a=actor();a.system.strain={value:3,max:10};const world=transactionWorld([gm]);let started;const begun=new Promise(resolve=>started=resolve);
 const turn=new TurnTransactionCoordinator({transport:world.client(gm).transport,currentUser:()=>gm,users:()=>[gm],getActor:()=>a,execute:async actor=>{started();const old=actor.system.strain.value;await new Promise(resolve=>setTimeout(resolve,15));await actor.update({'system.strain.value':old+2});}});
 const service=new TabletopWorkflowService({resolve:()=>a});
 await Promise.all([turn.request(a,'buyManeuver'),begun.then(()=>service.execute('effect',{actorUuid:a.uuid,request:{kind:'recover',resource:'strain',amount:1,source}},gm,'recovery-concurrent'))]);
 assert.equal(a.system.strain.value,4);assert.equal(JSON.parse(a.flags[id].workflowHistory[0].before)['system.strain.value'],5);world.stop();
});
test('replayed claim IDs require current ownership and the same requester and payload',async()=>{
 const a=actor(),combat=doc({uuid:'Combat.replay',started:true,round:1,flags:{},combatants:[{id:'slot',actor:a,flags:{[id]:{slotSide:'pc'}}}]});
 const service=new TabletopWorkflowService({resolve:key=>key===a.uuid?a:combat});
 const args={combatUuid:combat.uuid,actorUuid:a.uuid,slotId:'slot',round:1};
 await service.execute('claim',args,p,'claimed');
 await assert.rejects(service.execute('claim',{...args,round:2},p,'claimed'),/different claim/);
 await assert.rejects(service.execute('claim',args,{id:'intruder',active:true},'claimed'),/Owner/);
 await assert.rejects(service.execute('claim',args,gm,'claimed'),/different claim/);
});
test('document transport preserves dotted snapshot paths as strings for preview and undo',async()=>{
 const a=actor(),service=new TabletopWorkflowService({resolve:()=>a});
 await service.execute('effect',{actorUuid:a.uuid,request:{kind:'damage',amount:5,scale:'personal',source},expected:JSON.stringify({'system.wounds.value':0})},gm,'encoded-snapshot');
 const entry=a.flags[id].workflowHistory[0];assert.equal(typeof entry.before,'string');assert.equal(typeof entry.after,'string');assert.deepEqual(JSON.parse(entry.before),{'system.wounds.value':0});
 await service.execute('undo-effect',{actorUuid:a.uuid,entryId:entry.id},gm,'encoded-undo');assert.equal(a.system.wounds.value,0);
});

test('GM approval checks narrative visibility for the requester, including blind author and whisper recipients',async()=>{
 const previousGame=globalThis.game;globalThis.game={user:gm};
 try {
  const a=actor(),facts={advantage:4,threat:0,triumph:0,despair:0};
  const native=doc({uuid:'ChatMessage.private',author:p,blind:true,whisper:[gm.id],get isContentVisible(){return globalThis.game.user.isGM;},flags:{[id]:{actorUuid:a.uuid,outcome:facts}},rolls:[{options:{starWars:{outcome:facts}}}]});
  const request={label:'Opening',cost:{advantage:1},source};
  const proposal=doc({uuid:'ChatMessage.privateProposal',author:p,flags:{[id]:{spendingProposal:{messageUuid:native.uuid,request}}}});
  const docs={[native.uuid]:native,[proposal.uuid]:proposal,[a.uuid]:a};
  const service=new TabletopWorkflowService({resolve:key=>docs[key],verifyProposal:async()=>p});
  const args={messageUuid:native.uuid,proposalUuid:proposal.uuid,request};
  assert.equal(native.isContentVisible,true,'GM can read the native roll');
  assert.equal(canProposeSpend(native,a,p),false,'blind author cannot read dice despite owning actor');
  await assert.rejects(service.execute('spend',args,gm,'blind'),/proposer/);
  native.author=gm;native.blind=false;
  assert.equal(canProposeSpend(native,a,p),false,'owner is not a private-roll recipient');
  await assert.rejects(service.execute('spend',args,gm,'nonrecipient'),/proposer/);
  assert.equal(native.flags[id].spending,undefined,'denied approval does not reserve or spend symbols');
  native.whisper=[p.id];
  assert.equal(canProposeSpend(native,a,p),true,'recipient can read and propose');
  await service.execute('spend',args,gm,'recipient');assert.equal(native.flags[id].spending.length,1);
  native.whisper=[];
  assert.equal(canProposeSpend(native,a,p),true,'public rolls are readable');
  assert.equal(canProposeSpend(native,a,{id:'other',active:true}),false,'visibility does not grant actor ownership');
  native.author=p;native.whisper=[gm.id];
  assert.equal(canProposeSpend(native,a,p),true,'non-blind author can read own GM whisper');
 } finally {globalThis.game=previousGame;}
});

// Positive and revocation checks exercise the real shared actor queue.
test('tabletop writes honor the selected GM session after waiting for an actor resource lock',async()=>{
 const {actorMutationQueue}=await import('../src/xp-transactions.mjs');
 let release;const gate=new Promise(resolve=>release=resolve);let selected=true,writes=0;
 const actor={uuid:'Actor.session-fence',type:'character',name:'Session fence QA',system:{xp:{available:5,total:5},credits:0},flags:{},update:async()=>{writes++;}};
 const service=new TabletopWorkflowService({resolve:async()=>actor,assertAuthority:()=>{if(!selected)throw new Error('GM browser changed');}});
 const block=actorMutationQueue.run(actor.uuid,()=>gate);
 const request={xp:5,credits:0,note:'Award',source:{book:'Table ruling',page:'Session',verification:'gm-ruling'}};
 const pending=service.execute('award',{actorUuid:actor.uuid,request},gm,'session-fence');
 await new Promise(resolve=>setTimeout(resolve,5));selected=false;release();await block;
 await assert.rejects(pending,/GM browser changed/);assert.equal(writes,0);
 selected=true;await service.execute('award',{actorUuid:actor.uuid,request},gm,'session-fence-positive');assert.equal(writes,1);
});
