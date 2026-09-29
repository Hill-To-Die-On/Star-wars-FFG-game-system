import {SYSTEM_ID} from './config.mjs';
import {ActorTransactionQueue} from './transaction-queue.mjs';
const REQUEST='authorityRequest',RESPONSE='authorityResponse',SETTING='authorityReceipts',SESSION='authoritySession';
const clone=value=>JSON.parse(JSON.stringify(value??null));
const flag=(message,key)=>message?.flags?.[SYSTEM_ID]?.[key];
const byId=(users,id)=>Array.from(users??[]).find(user=>user.id===id);
const authorId=message=>message?.author?.id??message?.user?.id??message?.author??message?.user;
export const documentAuthority=users=>Array.from(users??[]).filter(user=>user.active&&user.isGM).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];
export async function transactionDigest(value) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
function validatePayload(request) {
 if(!request||!['xp','turn','crew'].includes(request.domain)||typeof request.id!=='string'||!request.id||request.id.length>128||typeof request.targetUuid!=='string'||request.targetUuid.length>512||!request.targetUuid)throw new Error('Invalid transaction identity.');
 if(JSON.stringify(request).length>12000)throw new Error('Transaction request is too large.');
}
/** Authenticated document transport. Socket payloads are deliberately never consumed. */
export class DocumentTransactionBroker {
 #handlers=new Map();#hooks=[];#pending=new Map();#jobs=new Map();#metadata=new ActorTransactionQueue();#execution=new ActorTransactionQueue();
 constructor(environment){Object.assign(this,environment);this.timeoutMs??=30000;this.randomId??=()=>crypto.randomUUID();this.sessionId??=crypto.randomUUID();this.onError??=error=>console.warn('Star Wars FFG | Transaction',error.message);}
 authority(){return documentAuthority(this.users());}
 isAuthority(){const selected=this.readSession();return this.currentUser()?.id===this.authority()?.id&&selected?.userId===this.currentUser()?.id&&selected?.sessionId===this.sessionId;}
 async takeAuthority(note){
  if(!this.currentUser()?.isGM||this.currentUser().id!==this.authority()?.id)throw new Error('Only the elected active GM may select the transaction browser.');
  if(typeof note!=='string'||!note.trim())throw new Error('Confirm that other transaction tabs are closed and pending state has been checked.');
  await this.writeSession({userId:this.currentUser().id,sessionId:this.sessionId,selectedAt:Date.now()});
  if(!this.isAuthority())throw new Error('Another GM browser was selected. Do not make simultaneous authority changes.');
  await this.resume();this.onAuthoritySelected?.();return {selected:true};
 }
 start(){
  if(this.#hooks.length)return this;
  this.#hooks=[['createChatMessage',(message,_options,creatorId)=>{void this.receive(message,creatorId).catch(this.onError);}],['updateSetting',()=>{void this.settle().catch(this.onError);}],['updateUser',()=>{void this.resume().catch(this.onError);}]].map(([name,fn])=>[name,this.hooks.on(name,fn)]);
  return this;
 }
 stop(){for(const [name,handle]of this.#hooks)this.hooks.off(name,handle);this.#hooks=[];for(const p of this.#pending.values()){clearTimeout(p.timer);p.reject(new Error('Transaction service stopped.'));}this.#pending.clear();}
 register(domain,handler){this.#handlers.set(domain,handler);this.start();queueMicrotask(()=>{void this.resume().catch(this.onError);});return ()=>{if(this.#handlers.get(domain)===handler)this.#handlers.delete(domain);};}
 async request(domain,targetUuid,command,args={},id=this.randomId()) {
  this.start();
  if(!this.authority())throw new Error('An active GM is required to confirm this transaction.');
  if(!this.readSession()?.sessionId)throw new Error('The GM must select Transaction authority in Settings before making changes.');
  const request=clone({id,domain,targetUuid,command,args});validatePayload(request);
  const user=this.currentUser(),key=await transactionDigest([user.id,id]),fingerprint=await transactionDigest(request);
  const existing=this.readReceipts()[key];if(existing&&existing.fingerprint!==fingerprint)throw new Error('Request identity was reused with a different payload.');
  if(this.#pending.has(key))throw new Error('This request is already pending.');
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const timer=setTimeout(()=>{this.#pending.delete(key);reject(new Error('Transaction confirmation timed out. The GM should open Settings > Transaction authority, then inspect the request and actor before retrying.'));},this.timeoutMs);
  this.#pending.set(key,{resolve,reject,timer,fingerprint});
  try {await this.createMessage({content:'<p>Game transaction submitted for GM authority.</p>',whisper:[...new Set([user.id,...Array.from(this.users()).filter(u=>u.isGM).map(u=>u.id)])],flags:{[SYSTEM_ID]:{[REQUEST]:request}}});await this.settle();}
  catch(error){clearTimeout(timer);this.#pending.delete(key);reject(error);}
  return promise;
 }
 async receive(message,creatorId) {
  if(flag(message,RESPONSE)){await this.settle();return;}
  const request=clone(flag(message,REQUEST));if(!request||!this.isAuthority())return;
  validatePayload(request);
  const user=byId(this.users(),creatorId);
  // creatorId is supplied by Foundry's server-backed create hook, never by packet data.
  if(!user?.active||authorId(message)!==creatorId)throw new Error('Transaction author does not match the authenticated creator.');
  const key=await transactionDigest([user.id,request.id]),fingerprint=await transactionDigest(request);
  await this.#metadata.run('receipts',async()=>{
   if(!this.isAuthority())return;
   const records=clone(this.readReceipts()),existing=records[key];
   if(existing){if(existing.creatorId!==user.id||existing.fingerprint!==fingerprint)throw new Error('Request identity was reused with a different payload.');return;}
   records[key]={creatorId:user.id,id:request.id,domain:request.domain,requestUuid:message.uuid,fingerprint,status:'queued',at:Date.now()};await this.writeReceipts(records);
  });
  await this.process(key);
 }
 async #write(key,change){return this.#metadata.run('receipts',async()=>{if(!this.isAuthority())throw new Error('GM authority changed; inspect the pending transaction.');const records=clone(this.readReceipts());records[key]={...records[key],...change};await this.writeReceipts(records);return records[key];});}
 async process(key){
  if(this.#jobs.has(key))return this.#jobs.get(key);
  const job=this.#execution.run('authority',()=>this.#process(key));this.#jobs.set(key,job);
  try{return await job;}finally{this.#jobs.delete(key);}
 }
 async #process(key){
  if(!this.isAuthority())return;
  const receipt=this.readReceipts()[key];if(!receipt||receipt.status!=='queued')return;
  const handler=this.#handlers.get(receipt.domain);if(!handler)return;
  let request,target,user,locks;
  try {
   const message=await this.resolveMessage(receipt.requestUuid);request=clone(flag(message,REQUEST));validatePayload(request);
   if(authorId(message)!==receipt.creatorId||await transactionDigest(request)!==receipt.fingerprint)throw new Error('Transaction changed after authenticated submission.');
   user=byId(this.users(),receipt.creatorId);if(!user?.active)throw new Error('The requester is no longer active.');
   target=await handler.resolve(request.targetUuid);if(!target||target.uuid!==request.targetUuid)throw new Error('The exact transaction target no longer exists.');
   await handler.validate(target,request.command,request.args,user);
   locks=await Promise.all(handler.lockKeys(target).map(transactionDigest));
   if(Object.entries(this.readReceipts()).some(([id,other])=>id!==key&&['running','review'].includes(other.status)&&other.locks?.some(lock=>locks.includes(lock))))throw new Error('A previous transaction for this actor or scene needs GM review before new changes.');
  } catch(error){await this.finish(key,{ok:false,error:error.message},'rejected');return;}
  const executionId=crypto.randomUUID();
  await this.#write(key,{status:'running',authorityId:this.currentUser().id,authoritySession:this.sessionId,executionId,locks});
  if(!this.isAuthority())return;
  try {
   const result=await handler.execute(target,request.command,clone(request.args),user,request.id,()=>{if(!this.mayComplete(key,executionId))throw new Error('Transaction authority changed before execution.');});
   if(this.mayComplete(key,executionId))await this.finish(key,{ok:true,result:clone(result)},'complete');
  } catch(error){if(this.mayComplete(key,executionId))await this.finish(key,{ok:false,error:error.message+' The GM must inspect and acknowledge this request before retrying.'},'review');}
 }
 mayComplete(key,executionId){const row=this.readReceipts()[key];return this.isAuthority()&&row?.status==='running'&&row.executionId===executionId&&row.authoritySession===this.sessionId;}
 async finish(key,response,status){
  if(!this.isAuthority())return;
  const receipt=this.readReceipts()[key];
  const payload={key,requestId:receipt.id,creatorId:receipt.creatorId,...response};
  const message=await this.createMessage({content:response.ok?'<p>Game transaction confirmed.</p>':'<p>Game transaction was not confirmed. The GM can inspect its receipt.</p>',whisper:[...new Set([receipt.creatorId,...Array.from(this.users()).filter(u=>u.isGM).map(u=>u.id)])],flags:{[SYSTEM_ID]:{[RESPONSE]:payload}}});
  await this.#write(key,{status,responseUuid:message.uuid,responseFingerprint:await transactionDigest(payload),finishedAt:Date.now()});if(!response.ok)await this.refreshMessage?.(message);await this.settle();
 }
 async settle(){
  for(const [key,pending]of this.#pending){
   const receipt=this.readReceipts()[key];if(!receipt||!receipt.responseUuid||!['complete','rejected','review','reviewed'].includes(receipt.status))continue;
   if(receipt.creatorId!==this.currentUser()?.id||receipt.fingerprint!==pending.fingerprint)continue;
   const message=await this.resolveMessage(receipt.responseUuid),response=flag(message,RESPONSE);
   if(!byId(this.users(),authorId(message))?.isGM||!response||response.key!==key||response.creatorId!==receipt.creatorId||await transactionDigest(response)!==receipt.responseFingerprint)continue;
   if(this.#pending.get(key)!==pending)continue;clearTimeout(pending.timer);this.#pending.delete(key);
   response.ok?pending.resolve(clone(response.result)):pending.reject(new Error(response.error));
  }
 }
 async resume(){
  if(!this.isAuthority())return;
  for(const [key,receipt]of Object.entries(this.readReceipts())) {
   if(this.#jobs.has(key)||!this.#handlers.has(receipt.domain))continue;
   if(receipt.status==='queued')await this.process(key);
   else if(receipt.status==='running')await this.#execution.run('authority',async()=>{if(this.isAuthority()&&this.readReceipts()[key]?.status==='running')await this.finish(key,{ok:false,error:'The previous execution was interrupted. The GM must inspect the actor or crew; it will not be replayed automatically.'},'review');});
  }
 }
 async acknowledge(key,note){
  if(!this.isAuthority()||!this.currentUser()?.isGM)throw new Error('Only the active GM authority can acknowledge an interrupted transaction.');
  if(!['running','review'].includes(this.readReceipts()[key]?.status)||(this.readReceipts()[key]?.status==='running'&&this.#jobs.has(key)))throw new Error('This request is not awaiting review, or is still running.');
  if(typeof note!=='string'||!note.trim())throw new Error('Record what was checked before releasing the transaction lock.');
  const review={key,note:note.trim().slice(0,500)};
  const message=await this.createMessage({content:'<p>GM transaction-state review recorded.</p>',whisper:Array.from(this.users()).filter(user=>user.isGM).map(user=>user.id),flags:{[SYSTEM_ID]:{authorityReview:review}}});
  await this.#write(key,{status:'reviewed',reviewedBy:this.currentUser().id,reviewedAt:Date.now(),reviewUuid:message.uuid,reviewFingerprint:await transactionDigest(review)});
 }
}
/** Keep durable protocol documents without filling ordinary play chat. */
export function renderTransactionMessage(message,html,broker){
 const root=html?.querySelector?html:html?.[0]??html;if(!root)return;
 const response=flag(message,RESPONSE);
 if(flag(message,REQUEST)||response?.ok===true){root.hidden=true;root.style.display='none';return;}
 const receipt=response&&broker.readReceipts()[response.key];
 if(!broker.isAuthority()||!['review','running'].includes(receipt?.status)||receipt.responseUuid!==message.uuid)return;
 if(root.querySelector('[data-authority-review]'))return;
 const explanation=document.createElement('p');explanation.textContent=response.error;root.querySelector('.message-content')?.append(explanation);
 const button=document.createElement('button');button.type='button';button.dataset.authorityReview='true';button.textContent='Review interrupted transaction';
 button.addEventListener('click',()=>{void (async()=>{
  const note=await foundry.applications.api.DialogV2.prompt({window:{title:'Review interrupted transaction'},content:'<p>Check the actor and crew state before releasing this lock. This does not apply, undo or repeat the request. Submit a fresh request only after reconciling the state.</p><label>What did you verify?<textarea name="note" required maxlength="500"></textarea></label>',ok:{label:'I checked the state - release lock',callback:(_event,b)=>new FormData(b.form).get('note')},rejectClose:false});
  if(note){await broker.acknowledge(response.key,note);button.remove();ui.notifications.info('Review recorded. The original request will not run again.');}
 })().catch(error=>ui.notifications.error(error.message));});root.querySelector('.message-content')?.append(button);
}
export async function selectTransactionAuthority(){
 const broker=getDocumentTransactionBroker();
 const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Transaction authority'},content:'<p>Use this GM tab to process XP, turn, crew and tabletop changes?</p><p>Close other GM transaction tabs and wait for their work to stop before continuing. After a reload or handover, interrupted requests stay locked until their actor or crew state is reviewed. Do not select authority simultaneously in two tabs.</p>',yes:{label:'Other tabs stopped - use this tab'},no:{label:'Cancel'}});
 if(confirmed){await broker.takeAuthority('GM confirmed other transaction tabs stopped and will review pending state.');ui.notifications.info('This tab now processes XP, turn, crew and tabletop transactions.');}
}
let nativeBroker;
export function getDocumentTransactionBroker(){
 if(nativeBroker)return nativeBroker;
 if(!globalThis.game?.settings||!globalThis.ChatMessage)throw new Error('The authenticated transaction service is not ready.');
 game.settings.register(SYSTEM_ID,SETTING,{scope:'world',config:false,type:Object,default:{}});
 game.settings.register(SYSTEM_ID,SESSION,{scope:'world',config:false,type:Object,default:{}});
 nativeBroker=new DocumentTransactionBroker({hooks:Hooks,currentUser:()=>game.user,users:()=>game.users,
  readSession:()=>game.settings.get(SYSTEM_ID,SESSION),writeSession:value=>game.settings.set(SYSTEM_ID,SESSION,value),
  readReceipts:()=>game.settings.get(SYSTEM_ID,SETTING)??{},writeReceipts:records=>game.settings.set(SYSTEM_ID,SETTING,records),
  createMessage:data=>ChatMessage.create(data),resolveMessage:uuid=>fromUuid(uuid),refreshMessage:message=>ui.chat?.updateMessage?.(message,{notify:false}),onAuthoritySelected:()=>Hooks.callAll('starWarsAuthoritySelected')}).start();
 Hooks.on('renderChatMessageHTML',(message,html)=>renderTransactionMessage(message,html,nativeBroker));
 const refreshVisibleCards=()=>{for(const element of globalThis.document?.querySelectorAll('.message[data-message-id]')??[]){const message=game.messages?.get(element.dataset.messageId);if(message)renderTransactionMessage(message,element,nativeBroker);}};
 Hooks.on('renderChatLog',refreshVisibleCards);queueMicrotask(refreshVisibleCards);
 Hooks.on('renderSettings',(_app,html)=>{
  const root=html?.querySelector?html:html?.[0];if(!game.user.isGM||!root||root.querySelector('[data-transaction-authority]'))return;
  const button=document.createElement('button');button.type='button';button.dataset.transactionAuthority='true';button.textContent='Transaction authority';
  button.addEventListener('click',()=>void selectTransactionAuthority().catch(error=>ui.notifications.error(error.message)));
  (root.querySelector('#settings-game')??root).append(button);
 });
 if(game.user.isGM)ui.notifications?.warn?.('Select Transaction authority in Settings for this GM tab. Other tabs can view without processing changes.');
 return nativeBroker;
}
