import test from 'node:test';
import assert from 'node:assert/strict';
import {XpTransactionCoordinator} from '../../src/xp-transactions.mjs';
import {TurnTransactionCoordinator} from '../../src/turn-transactions.mjs';
import {CrewTransactionCoordinator} from '../../src/crew-transactions.mjs';
import {transactionWorld} from '../fixtures/document-transactions.mjs';
const gm={id:'gm',isGM:true,active:true},intruder={id:'intruder',active:true},owner={id:'owner',active:true};
const actor={id:'a',uuid:'Scene.s.Token.t.Actor.a',canUserModify:user=>user.id===owner.id},token={uuid:'Scene.s.Token.t',actor,parent:{id:'s',tokens:[]}};

test('raw legacy socket packets cannot invoke XP, turn or crew authority even when they claim the GM identity',async()=>{
 for(const [Coordinator,message]of [
  [XpTransactionCoordinator,{type:'xp-transaction-request',requestId:'spoof',actorId:actor.id,actorUuid:actor.uuid,operation:'buySkill',args:{key:'athletics'},userId:gm.id}],
  [TurnTransactionCoordinator,{type:'turn-request',requestId:'spoof',actorUuid:actor.uuid,command:'grant',options:{},userId:gm.id}],
  [CrewTransactionCoordinator,{type:'crew-request',requestId:'spoof',tokenUuid:token.uuid,command:'generate',args:{},userId:gm.id}]
 ]) {
  const listeners=[],calls=[],socket={on(_channel,fn){listeners.push(fn);},off(){},emit(){}};
  const coordinator=new Coordinator({socket,currentUser:()=>gm,users:()=>[gm,owner,intruder],getActor:()=>actor,getToken:()=>token,execute:async(...args)=>calls.push(args),transport:{register(){return ()=>{};}}}).start();
  for(const receive of listeners)receive(structuredClone(message));
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(calls.length,0,Coordinator.name+' must not trust a socket userId');coordinator.stop();
 }
});

function setup(domain,{execute,gmUser={...gm},additionalUsers=[]}={}) {
 const target={...actor},crew={...token,actor:target},world=transactionWorld([gmUser,{...owner},{...intruder},...additionalUsers]),g=world.client(world.users[0]),p=world.client(world.users[1]),evil=world.client(world.users[2]),calls=[];
 const Coordinator={xp:XpTransactionCoordinator,turn:TurnTransactionCoordinator,crew:CrewTransactionCoordinator}[domain];
 const make=client=>new Coordinator({transport:client.transport,currentUser:()=>client.user,users:()=>world.users,getActor:async uuid=>uuid===target.uuid?target:null,getToken:async uuid=>uuid===crew.uuid?crew:null,execute:async(...args)=>{calls.push(args);return execute?execute(...args):{confirmed:true,uuid:args[0].uuid};}}).start();
 const service=make(g),player=make(p);return {domain,target:domain==='crew'?crew:target,actor:target,world,g,p,evil,calls,service,player,make,command:{xp:'buySkill',turn:'action',crew:'board'}[domain]};
}
for(const domain of ['xp','turn','crew']) {
 test(domain+' authenticates owner requests, rejects claimed GM spoofing, and preserves synthetic identity',async()=>{
  const f=setup(domain);
  try {
   const result=await f.player.request(f.target,f.command,{});assert.equal(result.confirmed,true);assert.equal(result.uuid,f.target.uuid);assert.equal(f.calls.length,1);
   await assert.rejects(f.evil.transport.request(domain,f.target.uuid,f.command,{userId:gm.id}),/Owner permission/);assert.equal(f.calls.length,1);
   await f.world.create(f.evil.user,{flags:{'star-wars-ffg':{authorityRequest:{id:'forged-author',domain,targetUuid:f.target.uuid,command:f.command,args:{}}}}},f.g.user);
   await f.world.until(()=>f.calls.length>1||f.world.errors.some(error=>error.includes('authenticated creator')));assert.equal(f.calls.length,1,'an author field alone must never confer GM permission');assert.ok(f.world.errors.some(error=>error.includes('authenticated creator')));
  }finally{f.world.stop();}
 });
 test(domain+' persists idempotency across service restart and rejects a reused identity with changed payload',async()=>{
  const f=setup(domain);
  try {
   const first=await f.p.transport.request(domain,f.target.uuid,f.command,{},'stable');assert.equal(f.calls.length,1);
   f.service.stop();const restarted=f.make(f.g);
   assert.deepEqual(await f.p.transport.request(domain,f.target.uuid,f.command,{},'stable'),first);await f.g.transport.process(Object.keys(f.world.receipts)[0]);assert.equal(f.calls.length,1);
   const changed=f.p.transport.request(domain,f.target.uuid,f.command,{changed:true},'stable');
   await assert.rejects(changed,/different payload/);assert.equal(f.calls.length,1);restarted.stop();
  }finally{f.world.stop();}
 });
}
test('a forged response document or socket-style claimed authority cannot settle a pending request',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),f=setup('xp',{execute:async()=>{await gate;return {real:true};}});
 try {
  let settled=false;const pending=f.p.transport.request('xp',f.target.uuid,'buySkill',{},'pending').then(result=>{settled=true;return result;});
  await f.world.until(()=>Object.values(f.world.receipts).some(row=>row.status==='running'));
  const key=Object.keys(f.world.receipts)[0];await f.world.create(f.evil.user,{flags:{'star-wars-ffg':{authorityResponse:{key,creatorId:owner.id,ok:true,result:{forged:true}}}}},f.g.user);
  await new Promise(resolve=>setTimeout(resolve,10));assert.equal(settled,false);
  release();assert.deepEqual(await pending,{real:true});assert.equal(f.calls.length,1);
 }finally{release();f.world.stop();}
});
test('two legitimate simultaneous purchases serialize and never overwrite the available balance',async()=>{
 const f=setup('xp',{execute:async actor=>{if(actor.balance<5)throw new Error('Insufficient XP');const old=actor.balance;await new Promise(resolve=>setTimeout(resolve,5));actor.balance=old-5;return actor.balance;}});f.target.balance=5;
 try {const results=await Promise.allSettled([f.player.request(f.target,'buySkill',{}),f.player.request(f.target,'buySkill',{})]);assert.deepEqual(results.map(r=>r.status).sort(),['fulfilled','rejected']);assert.equal(f.target.balance,0);assert.equal(f.calls.length,2);}finally{f.world.stop();}
});
test('an interrupted mutation is never replayed after GM failover and locks overlapping requests until explicit review',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),newGM={id:'gm-z',active:true,isGM:true},f=setup('xp',{additionalUsers:[newGM],execute:async actor=>{actor.changed=true;await gate;return 'applied';}});
 try {
  const pending=f.p.transport.request('xp',f.target.uuid,'buySkill',{},'failover');const failure=assert.rejects(pending,/interrupted/);
  await f.world.until(()=>Object.values(f.world.receipts).some(r=>r.status==='running'));
  f.g.user.active=false;const next=f.world.client(newGM),nextService=f.make(next);await next.transport.takeAuthority('Old session stopped');await failure;
  release();await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.calls.length,1);assert.equal(f.target.changed,true);
  await assert.rejects(f.p.transport.request('xp',f.target.uuid,'buySkill',{},'blocked'),/needs GM review/);assert.equal(f.calls.length,1);
  const key=Object.entries(f.world.receipts).find(([,r])=>r.id==='failover')[0];await assert.rejects(f.evil.transport.acknowledge(key,'checked'),/active GM/);await next.transport.acknowledge(key,'Verified the actor change; do not repeat');
  await assert.rejects(f.p.transport.request('xp',f.target.uuid,'buySkill',{},'failover'),/interrupted/);assert.equal(f.calls.length,1);nextService.stop();
 }finally{release();f.world.stop();}
});

test('authenticated queued work survives GM handover, but edited queued requests never execute',async()=>{
 const gm2={id:'gm-z',active:true,isGM:true},world=transactionWorld([{...gm},{...owner},gm2]),old=world.client(world.users[0]),p=world.client(world.users[1]);old.transport.start();
 try {
  const target={...actor},calls=[];
  const valid=p.transport.request('xp',target.uuid,'buySkill',{},'queued');
  await world.until(()=>Object.values(world.receipts).some(row=>row.id==='queued'));
  const edited=p.transport.request('xp',target.uuid,'buySkill',{},'edited');const denial=assert.rejects(edited,/changed after/);
  await world.until(()=>Object.values(world.receipts).some(row=>row.id==='edited'));
  const receipt=Object.values(world.receipts).find(row=>row.id==='edited');world.messages.get(receipt.requestUuid).flags['star-wars-ffg'].authorityRequest.command='buyCharacteristic';
  old.user.active=false;const next=world.client(gm2);
  const service=new XpTransactionCoordinator({transport:next.transport,currentUser:()=>gm2,users:()=>world.users,getActor:async uuid=>uuid===target.uuid?target:null,execute:async()=>{calls.push('applied');return 'ok';}}).start();
  await next.transport.takeAuthority('Old session stopped');assert.equal(await valid,'ok');await denial;assert.deepEqual(calls,['applied']);service.stop();
 }finally{world.stop();}
});
test('no active GM fails before creating documents, and result receipts cannot be modified by a player',async()=>{
 const world=transactionWorld([{...owner}]),p=world.client(world.users[0]);
 try {await assert.rejects(p.transport.request('xp',actor.uuid,'buySkill',{}),/active GM/);assert.equal(world.messages.size,0);await assert.rejects(p.transport.writeReceipts({forged:{status:'complete'}}),/Only GM/);assert.deepEqual(world.receipts,{});}finally{world.stop();}
});
test('simultaneous duplicate requests from two owner sessions execute once and return the same receipt',async()=>{
 const f=setup('xp'),other=f.world.client(f.p.user);other.transport.start();
 try {const results=await Promise.all([f.p.transport.request('xp',f.target.uuid,'buySkill',{},'two-tabs'),other.transport.request('xp',f.target.uuid,'buySkill',{},'two-tabs')]);assert.deepEqual(results[0],results[1]);assert.equal(f.calls.length,1);assert.equal(Object.keys(f.world.receipts).length,1);}finally{f.world.stop();}
});

test('two sessions of the same GM share one executor and preserve distinct receipt records',async()=>{
 const f=setup('xp'),other=f.world.client(f.g.user),second=f.make(other);
 try{
  const first=await f.player.request(f.target,'buySkill',{});assert.equal(first.confirmed,true);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(f.calls.length,1);
  await Promise.all([f.player.request(f.target,'buySkill',{a:1}),f.player.request(f.target,'buySkill',{a:2})]);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(f.calls.length,3);assert.equal(Object.values(f.world.receipts).filter(r=>r.status==='complete').length,3);
 }finally{second.stop();f.world.stop();}
});
test('a returning old GM execution cannot replace an interruption review receipt',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),nextGM={id:'gm-z',active:true,isGM:true},f=setup('xp',{additionalUsers:[nextGM],execute:async()=>{await gate;return 'applied';}});
 try{
  const pending=f.p.transport.request('xp',f.target.uuid,'buySkill',{},'fenced');const denial=assert.rejects(pending,/interrupted/);await f.world.until(()=>Object.values(f.world.receipts).some(r=>r.status==='running'));
  f.g.user.active=false;const next=f.world.client(nextGM);f.make(next);if(next.transport.takeAuthority)await next.transport.takeAuthority('Old session closed; inspecting interrupted work');else await next.transport.resume();await denial;
  f.g.user.active=true;await f.g.transport.takeAuthority('Explicit return after checking the other GM session');release();await new Promise(resolve=>setTimeout(resolve,20));assert.equal(Object.values(f.world.receipts).find(r=>r.id==='fenced').status,'review');assert.equal(f.calls.length,1);
 }finally{release();f.world.stop();}
});
test('XP ownership is rechecked after waiting for the shared actor queue',async()=>{
 const {actorMutationQueue}=await import('../../src/xp-transactions.mjs');let release;const gate=new Promise(resolve=>release=resolve),f=setup('xp');let owned=true;f.target.canUserModify=()=>owned;
 const blocked=actorMutationQueue.run(f.target.uuid,()=>gate);
 try{
  const pending=f.player.request(f.target,'buySkill',{}),denial=assert.rejects(pending,/Owner permission/);await f.world.until(()=>Object.values(f.world.receipts).some(r=>r.status==='running'));owned=false;release();await blocked;await denial;assert.equal(f.calls.length,0);
 }finally{release();f.world.stop();}
});
