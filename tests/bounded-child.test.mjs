import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {runBoundedChild} from '../scripts/bounded-child.mjs';

function running(pid) {
  try {
    process.kill(pid,0);
    if(process.platform==='linux'&&readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1]?.startsWith('Z'))return false;
    return true;
  } catch{return false;}
}
test('fixture timeout stops its owned parent and grandchild without killing another process',async()=>{
  const control=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
  let pids=[];
  try {
    const script=`const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true,detached:true});console.log(JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000);`;
    const result=await runBoundedChild(process.execPath,['-e',script],{timeout:1500});
    pids=JSON.parse(result.stdout.trim());
    assert.equal(pids.length,2);assert.ok(pids.every(Number.isInteger));
    assert.equal(result.timedOut,true);assert.match(result.error??'',/timed.?out/i);
    assert.equal(result.cleanupFailure,null);
    for(let i=0;i<20&&pids.some(running);i++)await new Promise(r=>setTimeout(r,25));
    assert.ok(pids.every(pid=>!running(pid)),'timed-out fixtures must not leave descendant work running');
    assert.ok(running(control.pid),'an unrelated process must remain alive');
  } finally {for(const pid of [...pids,control.pid])try{process.kill(pid);}catch{}}
});
test('bounded fixtures preserve success and failed exit evidence',async()=>{
  const success=await runBoundedChild(process.execPath,['-e',"console.log('ok')"],{timeout:1000});
  assert.equal(success.status,0);assert.equal(success.stdout.trim(),'ok');assert.equal(success.timedOut,false);
  const failure=await runBoundedChild(process.execPath,['-e',"console.error('deliberate');process.exitCode=3"],{timeout:1000});
  assert.equal(failure.status,3);assert.match(failure.stderr,/deliberate/);
});
