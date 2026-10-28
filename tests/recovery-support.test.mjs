import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {resolve} from 'node:path';
import {ownedPath,inspectRecoveryArchive,coreVersionFromPackage,classifyCompatibilityWarning,chooseJoinUser,isCoreAddressRace,joinGame} from '../scripts/recovery-support.mjs';
const manifest={id:'star-wars-ffg',version:'0.2.1',esmodules:['src/main.mjs'],styles:['styles/main.css']};
const files={'system.json':strToU8(JSON.stringify(manifest)),'src/main.mjs':strToU8('export const test=true;'),'styles/main.css':strToU8('body{}')};
test('recovery extraction rejects sibling and parent paths and accepts owned descendants',()=>{
 const root=resolve('test-results','owned');
 for(const path of ['..','../owned-other/file','../file','.'])assert.throws(()=>ownedPath(root,path),/owned directory/);
 assert.equal(ownedPath(root,'Data','worlds'),resolve(root,'Data','worlds'));
});
test('recovery packages require the expected identity and safe complete entrypoints',()=>{
 assert.equal(inspectRecoveryArchive(zipSync(files)).manifest.version,'0.2.1');
 for(const extra of [{'../escape':strToU8('bad')},{'data/private.pdf':strToU8('bad')}])assert.throws(()=>inspectRecoveryArchive(zipSync({...files,...extra})),/release|Forbidden|Unsafe/);
 assert.throws(()=>inspectRecoveryArchive(zipSync({...files,'system.json':strToU8(JSON.stringify({...manifest,id:'other'}))})),/identity/);
 assert.throws(()=>inspectRecoveryArchive(zipSync({'system.json':files['system.json']})),/entrypoint/);
});
test('declared expansion limits are checked before decompression allocation',()=>{
 const archive=zipSync(files),buffer=Buffer.from(archive);
 const central=buffer.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));assert.ok(central>0);
 buffer.writeUInt32LE(300*1024*1024,central+24);
 assert.throws(()=>inspectRecoveryArchive(buffer),/bounded acceptance limit/);
});
test('native harnesses report the installed core build instead of a fixed version',()=>{
 assert.equal(coreVersionFromPackage({version:'14.369.0',release:{generation:14,channel:'stable',build:369}}),'14.369');
 for(const pkg of [{},{release:{generation:14}},{release:{generation:'x',build:369}}])assert.throws(()=>coreVersionFromPackage(pkg),/core version/);
});
test('compatibility warnings are attributed to the system only when its code raised them',()=>{
 const warning=frame=>`Error: The global "renderTemplate" is deprecated.\nDeprecated since Version 13\nBackwards-compatible support will be removed in Version 15\n    at Object.logCompatibilityWarning (http://127.0.0.1:30028/scripts/foundry.mjs:1:1)\n    at ${frame}`;
 assert.deepEqual(classifyCompatibilityWarning(warning('http://127.0.0.1:30028/systems/star-wars-ffg/src/sheets.mjs:4:2')),{message:'Error: The global "renderTemplate" is deprecated.',since:'13',until:'15',fromSystem:true});
 assert.equal(classifyCompatibilityWarning(warning('http://127.0.0.1:30028/modules/dice-so-nice/main.js:9:1')).fromSystem,false);
 assert.equal(classifyCompatibilityWarning('Ordinary warning with no deprecation'),null);
});
test('native joins pick the named user from a select or type it into a text field',async()=>{
 const field=tagName=>{const calls=[];return {calls,evaluate:read=>read({tagName}),selectOption:option=>calls.push(['select',option]),fill:value=>calls.push(['fill',value])};};
 const select=field('SELECT'),input=field('INPUT');
 await chooseJoinUser(select,'Gamemaster');await chooseJoinUser(input,'Gamemaster');
 assert.deepEqual(select.calls,[['select',{label:'Gamemaster'}]]);assert.deepEqual(input.calls,[['fill','Gamemaster']]);
});
const race='[ReleaseData] validation errors: SchemaField#_validateRecursive\n  generation: may not be undefined';
const fakeGame=(outcomes,errors)=>{const page={visits:0,joins:0,url:()=>page.visits===1?'http://127.0.0.1:1/join':'http://127.0.0.1:1/game',
 goto:async()=>{page.visits++;},locator:()=>({evaluate:read=>read({tagName:'SELECT'}),selectOption:async()=>{page.joins++;}}),getByRole:()=>({click:async()=>{}}),
 // The startup race leaves the page loading; other failures time out.
 waitForFunction:async()=>{const outcome=outcomes.shift();if(outcome==='ready')return;errors.push(outcome);if(outcome===race)return new Promise(()=>{});throw Error('Timeout 60000ms exceeded.');}};return page;};
test('only the core 14.369 startup address race is treated as retryable',()=>{
 assert.equal(isCoreAddressRace(race),true);
 assert.equal(isCoreAddressRace('TypeError: actor.system is undefined'),false);
});
test('a first native join retries the core startup race and reports how often',async()=>{
 const errors=['earlier unrelated error'],page=fakeGame([race,'ready'],errors);
 assert.equal(await joinGame(page,'http://127.0.0.1:1/game','Gamemaster',errors,{delay:0,poll:1}),1);
 assert.equal(page.visits,2);assert.equal(page.joins,1);assert.deepEqual(errors,['earlier unrelated error']);
});
test('a slow healthy join keeps the full load timeout',async()=>{
 const errors=[],page=fakeGame(['ready'],errors);let timeout;page.waitForFunction=async(_fn,_arg,options)=>{timeout=options.timeout;};
 assert.equal(await joinGame(page,'u','Gamemaster',errors,{delay:0,poll:1}),0);assert.equal(timeout,60_000);
});
test('native joins never retry other failures and stop after the bounded attempts',async()=>{
 const other=[];await assert.rejects(joinGame(fakeGame(['TypeError: broken sheet'],other),'u','Gamemaster',other,{delay:0,poll:1}),/Timeout/);
 assert.deepEqual(other,['TypeError: broken sheet']);
 const raced=[];await assert.rejects(joinGame(fakeGame([race,race,race],raced),'u','Gamemaster',raced,{delay:0,poll:1,attempts:3}),/startup race/);
});
