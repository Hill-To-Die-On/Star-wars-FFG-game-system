/** Sequential, bounded fixture checks. Licensed native Foundry acceptance is a separate command. */
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {runBoundedChild} from './bounded-child.mjs';
const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
const option=name=>args.findLast(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const integerOption=(name,fallback,{min=1,max=1000}={})=>{
  const raw=option(name)??process.env[`PLAYTEST_${name.toUpperCase()}`]??fallback;
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(`${name} must be a whole number from ${min} to ${max}.`);
  return value;
};
const runs=integerOption('runs',1,{max:100});
const seed=integerOption('seed',1,{max:0x7fffffff});
const requestedFixture=option('fixture');
const output=resolve(option('output')??process.env.TEST_ARTIFACTS_DIR??'test-results/browser');
await mkdir(output,{recursive:true});
// Always test the current tracked runtime, never a missing or stale local ZIP.
const built=await runBoundedChild(process.execPath,[resolve(root,'scripts/build.mjs')],{
  cwd:root,env:process.env,timeout:120_000,maxBuffer:8*1024*1024,
});
await writeFile(resolve(output,'package-build.txt'),[built.stdout,built.stderr,built.error,built.cleanupFailure].filter(Boolean).join('\n'));
if(built.status!==0||built.error||built.cleanupFailure)throw Error('Browser checks require a successful current package build; inspect test-results/browser/package-build.txt.');
console.log('PASS current package build');
const availableFixtures=(await readdir(resolve(root,'tests'))).filter(name=>name.endsWith('-ui.mjs')).sort();
const fixtures=requestedFixture?[requestedFixture]:availableFixtures;
if(requestedFixture&&!availableFixtures.includes(requestedFixture))throw Error(`Unknown browser fixture ${requestedFixture}. Choose one of: ${availableFixtures.join(', ')}.`);
if(!fixtures.length)throw Error('No browser fixtures discovered.');
const results=[];
for(let run=1;run<=runs;run++) {
  const runSeed=(seed+run-1)%0x7fffffff,runRoot=runs===1?output:resolve(output,`run-${String(run).padStart(3,'0')}`);
  await mkdir(runRoot,{recursive:true});
  for(const fixture of fixtures) {
    const name=basename(fixture,'.mjs'),artifacts=resolve(runRoot,name);
    await mkdir(artifacts,{recursive:true});
    const started=Date.now(),result=await runBoundedChild(process.execPath,[resolve(root,'tests',fixture)],{
      cwd:root,env:{...process.env,TEST_ARTIFACTS_DIR:artifacts,PLAYTEST_RUN:String(run),PLAYTEST_SEED:String(runSeed)},timeout:120_000,
      maxBuffer:8*1024*1024,
    });
    const log=[result.stdout,result.stderr,result.error,result.cleanupFailure].filter(Boolean).join('\n');
    await writeFile(resolve(artifacts,'output.txt'),log);
    results.push({run,seed:runSeed,fixture,kind:'browser-fixture',passed:result.status===0&&!result.error,
      exitCode:result.status,signal:result.signal,timedOut:result.timedOut,cleanupFailure:result.cleanupFailure,elapsedMs:Date.now()-started});
    console.log(`${results.at(-1).passed?'PASS':'FAIL'} run ${run}/${runs} · ${fixture} (${results.at(-1).elapsedMs} ms)`);
    if(!results.at(-1).passed)console.error(log);
  }
}
await writeFile(resolve(output,'results.json'),JSON.stringify({kind:'browser-fixture',nativeFoundry:false,runs,seed,fixtures,results},null,2)+'\n');
if(results.some(result=>!result.passed))process.exitCode=1;
