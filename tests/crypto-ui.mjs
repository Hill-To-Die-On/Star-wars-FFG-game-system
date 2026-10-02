/** Packaged-browser HTTP compatibility; no licensed Foundry instance or AI provider. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {chromium} from '@playwright/test';
const archive=unzipSync(await readFile('dist/star-wars-ffg.zip')),requested=new Set(),errors=[];
for(const file of ['sha256.js','_md.js','_assert.js','utils.js','crypto.js','LICENSE.txt'])assert.ok(archive['src/vendor/noble-hashes/'+file]?.length,'Vendored release file missing: '+file);
assert.match(new TextDecoder().decode(archive['src/vendor/noble-hashes/LICENSE.txt']),/Copyright \(c\) 2022 Paul Miller/);
const fixture=(await readFile('tests/fixtures/document-transactions.mjs','utf8')).replaceAll('../../src/','/systems/star-wars-ffg/src/');
const server=createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>HTTP transaction compatibility</title><p>Isolated package compatibility fixture</p>');}
 if(req.url==='/fixture.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(fixture);}
 const prefix='/systems/star-wars-ffg/',name=req.url?.startsWith(prefix)?req.url.slice(prefix.length):'';
 if(!name||!archive[name]){res.statusCode=404;return res.end('Missing fixture resource');}
 requested.add(name);res.setHeader('Content-Type',/\.(mjs|js)$/.test(name)?'text/javascript':'text/plain');res.end(archive[name]);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP foundry-lan.test 127.0.0.1','--no-proxy-server'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://foundry-lan.test:${server.address().port}/`);
 const result=await page.evaluate(async()=>{
  const base='/systems/star-wars-ffg/src/',{sha256Text,secureRandomId}=await import(base+'browser-crypto.mjs'),{createMessageProvenance,verifyMessageProvenance}=await import(base+'tabletop-provenance.mjs'),{transactionWorld}=await import('/fixture.mjs'),{XpTransactionCoordinator}=await import(base+'xp-transactions.mjs'),{applyVehicleLoadout,stampVehicleMount}=await import(base+'vehicle-loadouts.mjs');
  const capabilities={secure:isSecureContext,subtle:typeof crypto.subtle,randomUUID:typeof crypto.randomUUID,getRandomValues:typeof crypto.getRandomValues};
  const gm={id:'gm',active:true,isGM:true},owner={id:'owner',active:true},world=transactionWorld([gm,owner]),g=world.client(gm),p=world.client(owner),actor={uuid:'Scene.http.Token.a.Actor.b',canUserModify:u=>u.id===owner.id};let count=0;
  for(const client of [g,p])new XpTransactionCoordinator({transport:client.transport,currentUser:()=>client.user,users:()=>world.users,getActor:async()=>actor,execute:async()=>({count:++count})}).start();
  try{
   const first=await p.transport.request('xp',actor.uuid,'buySkill',{key:'athletics'},'http-id'),replay=await p.transport.request('xp',actor.uuid,'buySkill',{key:'athletics'},'http-id');await g.transport.process(Object.keys(world.receipts)[0]);
   const message={uuid:'ChatMessage.http',author:owner,flags:{'star-wars-ffg':{tabletopRequest:{command:'claim'}}}},receipt=await createMessageProvenance(message,'tabletopRequest',owner.id,world.users);const authenticated=(await verifyMessageProvenance(message,'tabletopRequest',receipt,world.users)).id;message.flags['star-wars-ffg'].tabletopRequest.command='changed';let changedRejected=false;try{await verifyMessageProvenance(message,'tabletopRequest',receipt,world.users);}catch{changedRejected=true;}
   const mount=stampVehicleMount({name:'Test mount',type:'weapon',system:{damage:'6'},flags:{'star-wars-ffg':{vehicleMount:{vehicleId:'v',mountId:'m'}}}}),vehicle={items:[],async createEmbeddedDocuments(_type,rows){const saved=rows.map((row,i)=>({...row,_id:'gun'+i}));this.items.push(...saved);return saved;},async deleteEmbeddedDocuments(_type,ids){this.items=this.items.filter(item=>!ids.includes(item._id));}};await applyVehicleLoadout(vehicle,{items:[mount]});await applyVehicleLoadout(vehicle,{items:[mount]});
   return {capabilities,id:secureRandomId(),hash:await sha256Text('海 🌌 '.repeat(3000)),first,replay,count,authenticated,changedRejected,weapons:vehicle.items.length,errors:world.errors};
  }finally{world.stop();}
 });
 assert.deepEqual(result.capabilities,{secure:false,subtle:'undefined',randomUUID:'undefined',getRandomValues:'function'});
 assert.match(result.id,/^[a-f0-9]{32}$/);assert.equal(result.hash,createHash('sha256').update('海 🌌 '.repeat(3000)).digest('hex'));assert.deepEqual(result.first,{count:1});assert.deepEqual(result.replay,result.first);assert.equal(result.count,1);assert.equal(result.authenticated,'owner');assert.equal(result.changedRejected,true);assert.equal(result.weapons,1);assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);
 assert.ok(requested.has('src/vendor/noble-hashes/sha256.js'));assert.ok(requested.has('src/vendor/noble-hashes/crypto.js'));
 console.log('Packaged HTTP browser passed: insecure context, secure IDs, SHA-256, owner transaction/replay, unchanged provenance boundary, vehicle loadout idempotency; zero page errors.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
