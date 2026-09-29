import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {DocumentTransactionBroker,transactionDigest} from '../src/document-transactions.mjs';
import {createMessageProvenance,verifyMessageProvenance} from '../src/tabletop-provenance.mjs';
import {applyVehicleLoadout,stampVehicleMount} from '../src/vehicle-loadouts.mjs';
import {transactionWorld} from './fixtures/document-transactions.mjs';
import {XpTransactionCoordinator} from '../src/xp-transactions.mjs';
const insecureCrypto={getRandomValues:array=>webcrypto.getRandomValues(array)};
async function onHttp(action){const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{configurable:true,value:insecureCrypto});try{return await action();}finally{Object.defineProperty(globalThis,'crypto',descriptor);}}

test('HTTP LAN clients can initialize the broker and retain the same SHA256 transaction fingerprint',()=>onHttp(async()=>{
 const broker=new DocumentTransactionBroker({});assert.match(broker.sessionId,/^[a-f0-9]{32}$/);
 const payload={actor:'Scene.s.Token.t.Actor.a',note:'Pilot 海 🌌'};
 assert.equal(await transactionDigest(payload),createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
}));
test('SHA256 fallback matches known vectors, padding boundaries and multiblock Unicode',async()=>{
 const {sha256Text}=await import('../src/browser-crypto.mjs');
 const known=[['','e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],['abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad']];
 for(const [text,expected]of known)assert.equal(await sha256Text(text,insecureCrypto),expected);
 for(const text of [55,56,63,64,65,127,128,129].map(n=>'a'.repeat(n)).concat(['海 🌌 e\u0301\r\n'.repeat(4000),'x'.repeat(100000)]))assert.equal(await sha256Text(text,insecureCrypto),createHash('sha256').update(text).digest('hex'));
 assert.equal(await sha256Text('native',webcrypto),await sha256Text('native',insecureCrypto));
});
test('secure identifiers use 128 random bits without requiring randomUUID and fail without a secure generator',async()=>{
 const {secureRandomId}=await import('../src/browser-crypto.mjs');let requested=0;
 const id=secureRandomId({getRandomValues:bytes=>{requested=bytes.length;bytes.set(Array.from({length:16},(_,i)=>i));return bytes;}});
 assert.equal(requested,16);assert.equal(id,'000102030405060708090a0b0c0d0e0f');
 assert.notEqual(secureRandomId(insecureCrypto),secureRandomId(insecureCrypto));assert.throws(()=>secureRandomId({}),/secure random/);
});
test('HTTP workflow provenance still authenticates a real creator and rejects altered payloads',()=>onHttp(async()=>{
 const player={id:'p',active:true},message={uuid:'ChatMessage.http',author:player,flags:{'star-wars-ffg':{tabletopRequest:{command:'claim',args:{actorUuid:'Actor.a'}}}}};
 const receipt=await createMessageProvenance(message,'tabletopRequest',player.id,[player]);assert.equal(await verifyMessageProvenance(message,'tabletopRequest',receipt,[player]),player);
 message.flags['star-wars-ffg'].tabletopRequest.args.actorUuid='Actor.changed';await assert.rejects(verifyMessageProvenance(message,'tabletopRequest',receipt,[player]),/changed/);
}));
test('HTTP vehicle loadouts keep their batch identity and idempotency',()=>onHttp(async()=>{
 const mount=stampVehicleMount({name:'HTTP QA mount',type:'weapon',system:{damage:'6'},flags:{'star-wars-ffg':{vehicleMount:{vehicleId:'v',mountId:'m'}}}}),actor={items:[],async createEmbeddedDocuments(_type,rows){const saved=rows.map((row,i)=>({...row,_id:'gun'+i}));this.items.push(...saved);return saved;},async deleteEmbeddedDocuments(_type,ids){this.items=this.items.filter(item=>!ids.includes(item._id));}};
 await applyVehicleLoadout(actor,{items:[mount]});await applyVehicleLoadout(actor,{items:[mount]});assert.equal(actor.items.length,1);assert.match(actor.items[0].flags['star-wars-ffg'].vehicleLoadoutBatch,/^[a-f0-9]{32}$/);
}));
test('HTTP authenticated owner request and recorded replay execute only once',()=>onHttp(async()=>{
 const gm={id:'gm',active:true,isGM:true},owner={id:'owner',active:true},world=transactionWorld([gm,owner]);let calls=0;
 const actor={uuid:'Scene.s.Token.http.Actor.a',canUserModify:u=>u.id===owner.id},g=world.client(gm),p=world.client(owner);
 const make=client=>new XpTransactionCoordinator({transport:client.transport,currentUser:()=>client.user,users:()=>world.users,getActor:async()=>actor,execute:async()=>({calls:++calls})}).start();make(g);make(p);
 try{const first=await p.transport.request('xp',actor.uuid,'buySkill',{key:'athletics'},'http-stable');assert.deepEqual(first,{calls:1});assert.deepEqual(await p.transport.request('xp',actor.uuid,'buySkill',{key:'athletics'},'http-stable'),first);await g.transport.process(Object.keys(world.receipts)[0]);assert.equal(calls,1);assert.deepEqual(world.errors,[]);}finally{world.stop();}
}));
