import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {resolve} from 'node:path';
import {ownedPath,inspectRecoveryArchive} from '../scripts/recovery-support.mjs';
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
