/** Opt-in licensed native acceptance. Creates disposable data directories; never modifies a supplied world. */
import {mkdir,mkdtemp,readFile,writeFile,copyFile,cp} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {installRecoveryArchive,ownedPath} from './recovery-support.mjs';

const args=process.argv.slice(2),arg=name=>args.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const foundryApp=arg('foundry-app'),license=arg('license');
if(!foundryApp||!license)throw Error('Supply --foundry-app=<licensed main.js> and --license=<private license.json>; see docs/backup-recovery.md.');
const port=Number(arg('port')??30026);
if(!Number.isInteger(port)||port<1024||port>65535||port===30002)throw Error('Choose an isolated non-production port.');
const checkPort=createServer();await new Promise((ok,no)=>{checkPort.once('error',no);checkPort.listen(port,'127.0.0.1',ok);});await new Promise(ok=>checkPort.close(ok));
const parent=resolve(arg('output')??'.local/recovery');await mkdir(parent,{recursive:true});
const output=await mkdtemp(join(parent,'run-')),archive=resolve(arg('archive')??'dist/star-wars-ffg.zip');
const baselines=args.filter(v=>v.startsWith('--baseline=')).map(v=>resolve(v.slice(11)));
const worldId='recovery-acceptance',coreVersion=arg('core-version')??'14.368';
const report={kind:'native-packaged-install-upgrade-recovery',coreVersion,port,scenarios:[]};
let child,browser,page;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function prepare(name,zip,worldCopy) {
  const dataPath=ownedPath(output,name);await mkdir(dataPath);
  for(const dir of ['Config','Data/systems','Data/worlds','Data/modules'])await mkdir(ownedPath(dataPath,dir),{recursive:true});
  await copyFile(license,ownedPath(dataPath,'Config/license.json'));
  await writeFile(ownedPath(dataPath,'Config/options.json'),JSON.stringify({port,hostname:'127.0.0.1',upnp:false,world:worldId}));
  const installed=await installRecoveryArchive(zip,ownedPath(dataPath,'Data/systems/star-wars-ffg'));
  const world=ownedPath(dataPath,'Data/worlds',worldId);
  if(worldCopy)await cp(worldCopy,world,{recursive:true,errorOnExist:true,force:false});
  else {
    await mkdir(world);await mkdir(join(world,'data'));await mkdir(join(world,'scenes'));
    await writeFile(join(world,'world.json'),JSON.stringify({id:worldId,title:'Recovery acceptance',system:'star-wars-ffg',systemVersion:installed.version,coreVersion,compatibility:{minimum:'14',verified:coreVersion},packs:[]}));
  }
  return {dataPath,world,...installed};
}
async function start(stage) {
  const log=createWriteStream(join(stage.dataPath,'server.log'));
  child=spawn(process.execPath,[resolve(foundryApp),`--dataPath=${stage.dataPath}`,`--port=${port}`,`--world=${worldId}`],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log);child.stderr.pipe(log);
  const deadline=Date.now()+60_000;
  while(Date.now()<deadline) {
    if(child.exitCode!==null)throw Error('Isolated Foundry exited; inspect its private server.log.');
    try{const response=await fetch(`http://127.0.0.1:${port}/join`);if(response.ok)break;}catch{}
    await wait(250);
  }
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  page=await browser.newPage({viewport:{width:1200,height:900}});stage.errors=[];page.on('pageerror',e=>stage.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/game`);
  if(page.url().includes('/join')){await page.locator('#join-username').fill('Gamemaster');await page.getByRole('button',{name:'Join Game Session'}).click();}
  await page.waitForFunction(()=>globalThis.game?.ready,null,{timeout:60_000});
  await page.waitForFunction(()=>canvas.initialized&&!canvas.loading,null,{timeout:60_000});
  stage.runtime=await page.evaluate(()=>({core:game.version,system:game.system.version,activeModules:[...game.modules.values()].filter(m=>m.active).map(m=>m.id)}));
  assert.equal(stage.runtime.system,stage.version);assert.deepEqual(stage.runtime.activeModules,[]);
}
async function bounded(promise,ms) {
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bounded cleanup timed out.')),ms);})]);}
  finally{clearTimeout(timer);}
}
async function stop({requireClean=true}={}) {
  let shutdownFailure;
  if(page)try{await bounded(page.evaluate(()=>game.shutDown()),10_000);}catch(error){shutdownFailure=error;}
  try{await browser?.close();}catch(error){shutdownFailure??=error;}finally{browser=page=null;}
  if(child){
    const processToStop=child;
    if(processToStop.exitCode===null&&processToStop.signalCode===null){
      const exited=new Promise(resolve=>processToStop.once('exit',resolve));processToStop.kill();
      try{await bounded(exited,10_000);}catch{processToStop.kill('SIGKILL');await bounded(exited,5_000);}
    }
    child=null;
  }
  // A stopped process alone is insufficient evidence that a database backup is clean.
  if(requireClean&&shutdownFailure)throw Error(`World shutdown failed; refusing to copy its database: ${shutdownFailure.message}`);
}
async function seed() {
  const ids=await page.evaluate(async()=>{
    const actors=[];
    for(const type of ['character','minion','rival','nemesis','vehicle','group']) {
      const system=type==='character'?{species:'Human',career:'Explorer',xp:{available:15,total:45},credits:70,wounds:{value:2,max:12},strain:{value:3,max:10},soak:2}:type==='vehicle'?{model:'Recovery hull',manufacturer:'Test yard',silhouette:3,hullTrauma:{value:1,max:20},systemStrain:{value:2,max:15},armor:2}:{};
      actors.push(await Actor.create({name:`Recovery ${type}`,type,img:'icons/svg/anchor.svg',system,flags:{'star-wars-ffg':{recoveryFixture:true,retained:{custom:'preserve this'}}},ownership:{default:0}}));
    }
    const hero=actors[0];await hero.createEmbeddedDocuments('Item',[{name:'Recovery gear',type:'gear',system:{quantity:2},flags:{'star-wars-ffg':{recoveryFixture:true}}}]);
    const scene=await Scene.create({name:'Recovery scene',width:2000,height:1500,padding:0,grid:{type:1,size:100,distance:1,units:'m'},tokenVision:false});
    const linked=await hero.getTokenDocument({x:300,y:300,actorLink:true,rotation:45,texture:{src:'icons/svg/anchor.svg'}});
    const unlinked=await actors[1].getTokenDocument({x:600,y:300,actorLink:false,rotation:90,texture:{src:'icons/svg/anchor.svg'}});
    const vehicle=await actors[4].getTokenDocument({x:900,y:300,actorLink:true,rotation:135,width:2,height:3,texture:{src:'icons/svg/anchor.svg'}});
    await scene.createEmbeddedDocuments('Token',[linked.toObject(),unlinked.toObject(),vehicle.toObject()]);await scene.activate();
    await JournalEntry.create({name:'Recovery private note',ownership:{default:0},pages:[{name:'Synthetic reference',type:'text',text:{content:'Original recovery fixture, no book material.',format:1}}]});
    const pack=await CompendiumCollection.createCompendium({name:'recovery-items',label:'Recovery items',type:'Item',system:game.system.id});
    await Item.create({name:'Recovery compendium gear',type:'gear',system:{quantity:1}},{pack:pack.collection});
    await ChatMessage.create({content:'Recovery fixture: preserve this message.',flags:{'star-wars-ffg':{recoveryFixture:true}}});
    return actors.map(a=>a.id);
  });
  await page.waitForFunction(()=>!canvas.loading,null,{timeout:60_000});
  await page.evaluate(()=>game.scenes.active.view());
  await page.waitForFunction(()=>canvas.ready&&canvas.scene?.id===game.scenes.active?.id,null,{timeout:60_000});
  return ids;
}
async function snapshot() {
  return page.evaluate(async()=>({
    actors:game.actors.contents.filter(a=>a.getFlag('star-wars-ffg','recoveryFixture')).map(a=>({id:a.id,name:a.name,type:a.type,img:a.img,ownership:a.ownership,retained:a.getFlag('star-wars-ffg','retained'),
      identity:a.type==='character'?{species:a.system.species,career:a.system.career,xp:a.system.xp,credits:a.system.credits,wounds:a.system.wounds,strain:a.system.strain}:a.type==='vehicle'?{model:a.system.model,manufacturer:a.system.manufacturer,hullTrauma:a.system.hullTrauma,systemStrain:a.system.systemStrain}:null,
      items:a.items.contents.map(i=>({id:i.id,name:i.name,type:i.type,quantity:i.system.quantity}))})).sort((a,b)=>a.id.localeCompare(b.id)),
    scenes:game.scenes.contents.map(s=>({id:s.id,name:s.name,grid:{size:s.grid.size,distance:s.grid.distance,units:s.grid.units},tokens:s.tokens.contents.map(t=>({id:t.id,actorId:t.actorId,actorLink:t.actorLink,rotation:t.rotation,x:t.x,y:t.y,width:t.width,height:t.height,texture:t.texture.src}))})),
    privateNote:game.journal.contents.filter(j=>j.name==='Recovery private note').map(j=>({id:j.id,ownership:j.ownership,pages:j.pages.contents.map(p=>({id:p.id,text:p.text.content}))})),
    messages:game.messages.contents.filter(m=>m.getFlag('star-wars-ffg','recoveryFixture')).map(m=>({id:m.id,content:m.content})),
    pack:(await game.packs.get('world.recovery-items').getDocuments()).map(i=>({id:i.id,name:i.name,quantity:i.system.quantity})),
  }));
}
async function exerciseRecovery() {
  return page.evaluate(async()=>{
    const a=game.actors.find(a=>a.type==='character'&&a.getFlag('star-wars-ffg','recoveryFixture'));
    const api=game.system.api.tabletop,initial=a.system.wounds.value;
    const entry=await api.request('effect',{actorUuid:a.uuid,request:{kind:'damage',amount:5,scale:'personal',source:{book:'Acceptance fixture',page:'1',verification:'gm-ruling'}}});
    const after=a.system.wounds.value;if(!(after>initial))throw Error('Effect did not commit');
    await api.request('undo-effect',{actorUuid:a.uuid,entryId:entry.id});
    if(a.system.wounds.value!==initial)throw Error('Undo did not restore the value');
    return {initial,after,restored:a.system.wounds.value,history:a.getFlag('star-wars-ffg','workflowHistory').length};
  });
}
try {
  const fresh=await prepare('fresh',archive);await start(fresh);await seed();
  const before=await snapshot(),recovery=await exerciseRecovery();await page.reload();await page.waitForFunction(()=>game.ready,null,{timeout:60_000});assert.deepEqual(await snapshot(),before);
  await page.evaluate(()=>foundry.nue.Tour.activeTour?.exit());
  await page.screenshot({path:join(output,'fresh-install.png')});await stop();
  report.scenarios.push({scenario:'fresh',package:fresh.sha256,runtime:fresh.runtime,recovery,persistedAfterReload:true,pageErrors:fresh.errors});
  for(const [index,baseline]of baselines.entries()) {
    const original=await prepare(`baseline-${index}`,baseline);await start(original);await seed();const expected=await snapshot();await stop();
    const backup=ownedPath(output,`backup-${index}`);await cp(original.world,backup,{recursive:true,errorOnExist:true,force:false});
    const candidate=await prepare(`upgrade-${index}`,archive,backup);await start(candidate);assert.deepEqual(await snapshot(),expected);const result=await exerciseRecovery();await page.reload();await page.waitForFunction(()=>game.ready,null,{timeout:60_000});assert.deepEqual(await snapshot(),expected);await stop();
    const restored=await prepare(`restored-${index}`,baseline,backup);await start(restored);assert.deepEqual(await snapshot(),expected);await stop();
    report.scenarios.push({scenario:`upgrade-from-${original.version}`,baseline:original.sha256,candidate:candidate.sha256,runtime:candidate.runtime,recovery:result,restoredBaseline:true,pageErrors:[...original.errors,...candidate.errors,...restored.errors]});
  }
  assert.ok(report.scenarios.every(s=>s.pageErrors.length===0),'Native page errors require review');report.passed=true;
} catch(error) {report.passed=false;report.failure=error.message;await page?.screenshot({path:join(output,'failure.png')}).catch(()=>{});throw error;}
finally {
  try{await stop({requireClean:false});}catch(error){report.passed=false;report.cleanupFailure=error.message;process.exitCode=1;}
  await writeFile(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');console.log(`Private recovery evidence: ${output}`);
}
console.log(JSON.stringify(report));
