/** Sequential, bounded fixture checks. Licensed native Foundry acceptance is a separate command. */
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {runBoundedChild} from './bounded-child.mjs';
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'test-results/browser');
await mkdir(output,{recursive:true});
// Always test the current tracked runtime, never a missing or stale local ZIP.
const built=await runBoundedChild(process.execPath,[resolve(root,'scripts/build.mjs')],{
  cwd:root,env:process.env,timeout:120_000,maxBuffer:8*1024*1024,
});
await writeFile(resolve(output,'package-build.txt'),[built.stdout,built.stderr,built.error,built.cleanupFailure].filter(Boolean).join('\n'));
if(built.status!==0||built.error||built.cleanupFailure)throw Error('Browser checks require a successful current package build; inspect test-results/browser/package-build.txt.');
console.log('PASS current package build');
const fixtures=(await readdir(resolve(root,'tests'))).filter(name=>name.endsWith('-ui.mjs')).sort();
if(!fixtures.length)throw Error('No browser fixtures discovered.');
const results=[];
for(const fixture of fixtures) {
  const name=basename(fixture,'.mjs'),artifacts=resolve(output,name);
  await mkdir(artifacts,{recursive:true});
  const started=Date.now(),result=await runBoundedChild(process.execPath,[resolve(root,'tests',fixture)],{
    cwd:root,env:{...process.env,TEST_ARTIFACTS_DIR:artifacts},timeout:120_000,
    maxBuffer:8*1024*1024,
  });
  const log=[result.stdout,result.stderr,result.error,result.cleanupFailure].filter(Boolean).join('\n');
  await writeFile(resolve(artifacts,'output.txt'),log);
  results.push({fixture,kind:'browser-fixture',passed:result.status===0&&!result.error,
    exitCode:result.status,signal:result.signal,timedOut:result.timedOut,cleanupFailure:result.cleanupFailure,elapsedMs:Date.now()-started});
  console.log(`${results.at(-1).passed?'PASS':'FAIL'} ${fixture} (${results.at(-1).elapsedMs} ms)`);
  if(!results.at(-1).passed)console.error(log);
}
await writeFile(resolve(output,'results.json'),JSON.stringify({kind:'browser-fixture',nativeFoundry:false,results},null,2)+'\n');
if(results.some(result=>!result.passed))process.exitCode=1;
