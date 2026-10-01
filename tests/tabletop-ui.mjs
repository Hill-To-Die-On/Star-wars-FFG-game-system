/** Real-browser UI journeys with Foundry-shaped document/dialog fixtures.
 * Does not connect to Foundry, install packages into a world, or call AI providers.
 */
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root=resolve(import.meta.dirname,'..'),artifacts=resolve(process.env.TEST_ARTIFACTS_DIR??'test-results/browser/tabletop-ui');
const playtestRun=Number(process.env.PLAYTEST_RUN??0),playtestSeed=Number(process.env.PLAYTEST_SEED??0);
let carriedState=null;
if(process.env.PLAYTEST_STATE_PATH){
 try { carriedState=JSON.parse(await readFile(process.env.PLAYTEST_STATE_PATH,'utf8')); }
 catch(error) { throw new Error(`Unable to restore the previous playtest state: ${error.message}`); }
}
const playtestMetadata=JSON.stringify({run:Number.isSafeInteger(playtestRun)?playtestRun:0,seed:Number.isSafeInteger(playtestSeed)?playtestSeed:0,state:carriedState}).replace(/</g,'\\u003c');
await mkdir(artifacts,{recursive:true});
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(`<html><head><link rel="stylesheet" href="/styles/tabletop.css"><style>body{background:#13232c;color:#eee;font:16px system-ui}.application{background:#223944;border:1px solid #b8c8cf;max-width:740px;margin:15px auto;padding:14px;max-height:90vh;display:flex;flex-direction:column}h2{font-size:22px}input,select,textarea,button{font:inherit;padding:5px;color:#13232c;background:#f4f0e4;border:1px solid #afbab9}footer{display:flex;gap:12px;padding-top:12px}.window-content{min-height:0}form{max-height:80vh}table{width:100%}article{padding:8px}</style></head><body><script>globalThis.__playtest=${playtestMetadata};</script><script type="module" src="/tests/fixtures/tabletop-browser.mjs"></script></body></html>`);}
  const path=resolve(root,decodeURIComponent(req.url).slice(1));if(!path.startsWith(root+sep)||!/^\/(src|styles|tests\/fixtures|data)\//.test(req.url))throw new Error('Outside fixture');
  res.setHeader('Content-Type',path.endsWith('.mjs')?'text/javascript':path.endsWith('.json')?'application/json':'text/css');res.end(await readFile(path));
 }catch{res.statusCode=404;res.end('Missing fixture');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser,page;const errors=[];
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 page=await browser.newPage({viewport:{width:1100,height:1100}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>globalThis.fixture,{},{timeout:10000});
 const initialState=await page.evaluate(()=>fixture.snapshotPlaytestState()),restoredState=await page.evaluate(()=>fixture.playtest.state??null);
 if(restoredState){
   assert.equal(restoredState.version,1,'state snapshots use a known schema');
   assert.equal(restoredState.stage,playtestRun-1,'the previous stage is restored before the next journey');
   assert.deepEqual(initialState.settings,restoredState.settings,'world settings survive the next browser process');
   assert.deepEqual(initialState.scene,restoredState.scene,'the active scene survives the next browser process');
   assert.equal(initialState.message.spending.length,restoredState.message.spending.length,'previous narrative decisions survive the next browser process');
 }
 const initialWounds=Number(initialState.hero.system.wounds.value),initialXp=Number(initialState.hero.system.xp.available),initialTotalXp=Number(initialState.hero.system.xp.total),initialCredits=Number(initialState.hero.system.credits),initialSpending=initialState.message.spending.length;
 assert.deepEqual(await page.evaluate(()=>({players:fixture.party.length,allies:fixture.allies.length})),{players:6,allies:2},'the journey includes a six-player roster and two GM allies');
 const staleAuthority=await page.evaluate(async()=>{
   const broker=(await import('/src/document-transactions.mjs')).getDocumentTransactionBroker();
   const before=game.messages.length;
   await game.settings.set('star-wars-ffg','authoritySession',{userId:game.user.id,sessionId:'stale-browser'});
   let error='';
   try {await fixture.requestTabletop('effect',{actorUuid:fixture.hero.uuid});}catch(caught){error=caught.message;}
   const after=game.messages.length;
   await broker.takeAuthority('Fixture GM reselects this tab');
   return {before,after,error};
 });
 assert.match(staleAuthority.error,/Transaction authority/i,'stale GM tab receives a clear instruction');
 assert.equal(staleAuthority.after,staleAuthority.before,'stale GM tab must not queue a request that will fail provenance');
 const source=async()=>{await page.locator('[name="book"]').fill('Table adjudication');await page.locator('[name="page"]').fill('Session QA');};
 await page.evaluate(()=>{fixture.reviewResult=null;void fixture.openResolution(fixture.hero).then(()=>fixture.reviewResult='unexpected success',error=>fixture.reviewResult=error.message);});
 await page.locator('[name="amount"]').fill('7');await page.locator('[name="note"]').fill('Preview this hit');await source();await page.getByRole('button',{name:'Review change',exact:true}).click();
 await page.evaluate(()=>fixture.hero.system.soak=4);
 await page.getByRole('button',{name:'Apply reviewed changes'}).click();
 await page.waitForFunction(()=>fixture.reviewResult);
 assert.match(await page.evaluate(()=>fixture.reviewResult),/changed after the preview/);
 assert.equal(await page.evaluate(()=>fixture.hero.system.wounds.value),initialWounds,'stale preview must leave wounds unchanged');
 await page.evaluate(()=>fixture.hero.system.soak=2);
 await page.evaluate(()=>{void fixture.openResolution(fixture.hero);});
 await page.locator('[name="amount"]').fill('7');await page.locator('[name="note"]').fill('Reviewed blaster hit');await source();await page.getByRole('button',{name:'Review change',exact:true}).click();
 await page.getByRole('button',{name:'Apply reviewed changes'}).click();await page.waitForFunction(expected=>fixture.hero.system.wounds.value===expected,7);
 await page.evaluate(()=>{void fixture.openWorkflowHistory(fixture.hero);});assert.match(await page.getByRole('article').first().innerText(),/Reviewed blaster hit/,'the newest damage history entry is selected before undo');await page.locator('[data-undo]').first().click();await page.waitForFunction(expected=>fixture.hero.system.wounds.value===expected,initialWounds);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(()=>{void fixture.openNarrativeSpending(fixture.message);});await page.locator('[name="label"]').fill('Create an opening');await page.locator('[name="advantage"]').fill('2');await source();await page.getByRole('button',{name:'Review decision',exact:true}).click();await page.getByRole('button',{name:'Record GM decision',exact:true}).click();await page.waitForFunction(expected=>fixture.message.flags['star-wars-ffg'].spending?.length===expected,initialSpending+1);
 await page.evaluate(()=>{game.user=fixture.player;void fixture.openInitiativeSlots();});
 await page.locator('[name="slotId"]').waitFor();
 assert.deepEqual((await page.locator('[name="slotId"] option').evaluateAll(rows=>rows.map(r=>[r.value,r.textContent]))).slice(0,6),[['s2','1. pc · available'],['s1','2. pc · available'],['s3','3. pc · available'],['s4','4. pc · available'],['s5','5. pc · available'],['s6','6. pc · available']],'numbered choices must follow initiative order for a six-player party');
 assert.equal(await page.locator('[name="slotId"] option').count(),8,'GM allies also occupy initiative slots');
 await page.locator('[name="slotId"]').selectOption('s1');await page.getByRole('button',{name:'Claim slot',exact:true}).click();
 // Run the queued document on the separate active GM, as a second Foundry client would.
 await page.waitForFunction(()=>game.messages.some(m=>m.flags?.['star-wars-ffg']?.tabletopRequest?.command==='claim'));
 await page.evaluate(()=>{game.user=fixture.gm;const msg=game.messages.find(m=>m.flags?.['star-wars-ffg']?.tabletopRequest?.command==='claim');Hooks.callAll('createChatMessage',msg,{},msg.author.id);});await page.waitForFunction(()=>game.combat.flags['star-wars-ffg'].slotClaims?.length===1);
 await page.evaluate(()=>{void fixture.openSessionWrapUp();});await page.locator('[name="actor-hero"]').check();await page.locator('[name="xp"]').fill('5');await page.locator('[name="credits"]').fill('100');await page.locator('[name="downtime"]').fill('Repaired and resupplied at port.');await source();await page.getByRole('button',{name:'Preview awards'}).click();await page.getByRole('button',{name:'Award reviewed changes'}).click();await page.waitForFunction(expected=>fixture.hero.system.xp.available===expected,initialXp+5);
 const hooksBeforeDashboard=await page.evaluate(()=>fixture.hookCount());
 await page.evaluate(()=>{void fixture.openVehicleDashboard(fixture.ship);});await page.getByRole('heading',{name:'Vehicle combat · Test Freighter'}).waitFor();assert.equal(await page.getByRole('button',{name:'Build assigned gunner pool'}).isDisabled(),true);
 await page.locator('.sf-vehicle-dashboard [data-sf-turn="maneuver"]').first().click();
 await page.waitForFunction(()=>fixture.ship.flags['star-wars-ffg']?.turnEconomy?.rounds?.some(r=>r.entries.length===1));
 await page.locator('.sf-vehicle-dashboard [data-sf-turn="maneuver"].spent').waitFor({timeout:2000});
 await page.evaluate(()=>fixture.ship.update({'system.hullTrauma.value':4}));
 await page.waitForFunction(()=>document.querySelector('.sf-vehicle-dashboard')?.textContent.includes('Hull 4/20'),{},{timeout:2000});
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByRole('heading',{name:'Vehicle combat · Test Freighter'}).waitFor();assert.equal(await page.locator('.application').count(),1,'refresh replaces the dashboard instead of nesting windows');
 await page.screenshot({path:resolve(artifacts,'vehicle-dashboard-fixture.png'),fullPage:true});
 const battleMatrix=await page.evaluate(async()=>{
   const [{createRangeProfile,classifyRangeDistance},{planActorEffect,planSpend,remainingSymbols},{automaticCheckPool},{resolveFaces}]=await Promise.all([import('/src/range-overlay/core.mjs'),import('/src/tabletop-workflows.mjs'),import('/src/dice/builder.mjs'),import('/src/dice/core.mjs')]);
   const source={book:'GM battle matrix',page:`run-${fixture.playtest.run}`,verification:'gm-ruling'},setPath=(target,path,value)=>{const keys=path.split('.');let cursor=target;for(const key of keys.slice(0,-1))cursor=cursor[key]??={};cursor[keys.at(-1)]=structuredClone(value);};
   const apply=(target,changes)=>{for(const [path,value]of Object.entries(changes))setPath(target,path,value);};
   const character=(id,type='character')=>({id,uuid:`Actor.matrix-${id}`,name:id,type,hasPlayerOwner:true,system:{wounds:{value:0,max:12},strain:{value:0,max:10},soak:2,xp:{available:0,total:0},credits:0,forceRating:type==='character'?2:0,committedForce:0,morality:{value:50,conflict:0}},flags:{}});
   const minion=(size)=>({id:`minion-${size}`,uuid:`Actor.matrix-minion-${size}`,name:`Security group ${size}`,type:'minion',hasPlayerOwner:false,system:{groupSize:size,wounds:{value:0,max:5},strain:{value:0,max:5},soak:1},flags:{}});
   const vehicle=(id,silhouette,armor)=>({id,uuid:`Actor.matrix-${id}`,name:id,type:'vehicle',hasPlayerOwner:false,system:{silhouette,hullTrauma:{value:0,max:30},systemStrain:{value:0,max:20},armor, speed:{value:2,max:4},shields:{fore:1,aft:1,port:1,starboard:1}},flags:{}});
   const partySizes=[1,4,6],personalProfile=createRangeProfile({scale:'personal',grid:{type:1,size:100,distance:1,units:'m'}}),planetaryProfile=createRangeProfile({scale:'planetary',grid:{type:1,size:100,distance:1,units:'km'}}),spaceProfile=createRangeProfile({scale:'space',grid:{type:1,size:100,distance:1,units:'km'}}),scenarios=[];
   for(const partySize of partySizes){
     const party=Array.from({length:partySize},(_,index)=>character(`pc-${partySize}-${index+1}`)),group=minion(partySize*2),personalPlan=planActorEffect(group,{kind:'damage',amount:7,pierce:0,breach:0,scale:'personal',note:`Small-arms battle for ${partySize} player${partySize===1?'':'s'}.`,source},{user:fixture.gm});
     apply(group,personalPlan.after);
     scenarios.push({name:`personal-${partySize}`,sceneScale:'personal',battleScale:'personal',partySize,actors:party.length,rangeBand:classifyRangeDistance(6000,personalProfile).band,minionGroup:partySize*2,minionRemaining:personalPlan.calculation.minions.remaining,damageResource:personalPlan.calculation.resource});
     const ground=vehicle(`ground-${partySize}`,partySize===6?6:3,2),groundPlan=planActorEffect(ground,{kind:'damage',amount:10,pierce:0,breach:0,scale:'vehicle',note:`Planetary vehicle engagement for ${partySize} player${partySize===1?'':'s'}.`,source},{user:fixture.gm});
     apply(ground,groundPlan.after);
     scenarios.push({name:`planetary-${partySize}`,sceneScale:'planetary',battleScale:'planetary',partySize,actors:party.length,rangeBand:classifyRangeDistance(20000,planetaryProfile).band,silhouette:ground.system.silhouette,damage:ground.system.hullTrauma.value,damageResource:groundPlan.calculation.resource});
     const ship=vehicle(`space-${partySize}`,partySize===6?8:4,partySize===6?4:2),spacePlan=planActorEffect(ship,{kind:'damage',amount:12,pierce:0,breach:0,scale:'vehicle',note:`Space battle for ${partySize} player${partySize===1?'':'s'}.`,source},{user:fixture.gm});
     apply(ship,spacePlan.after);
     scenarios.push({name:`space-${partySize}`,sceneScale:'space',battleScale:'space',partySize,actors:party.length,rangeBand:classifyRangeDistance(30000,spaceProfile).band,silhouette:ship.system.silhouette,damage:ship.system.hullTrauma.value,damageResource:spacePlan.calculation.resource});
   }
   const forceBattles=[];
   for(const scale of ['planetary','space'])for(const partySize of partySizes){
     const forceUser=character(`force-user-${scale}-${partySize}`),target=character(`force-${scale}-${partySize}`,'rival'),outcome={advantage:0,threat:0,triumph:0,despair:0,light:2,dark:1},spend=planSpend(outcome,[],{label:'Force opening',note:`The Force user creates an opening during the ${scale} battle.`,cost:{light:1},source}),condition=planActorEffect(target,{kind:'condition',label:'Force stagger',entryId:`force-${scale}-${partySize}`,note:'The GM rules the Force effect imposes one setback on the target discipline check.',source,modifier:{die:'setback',count:1,skillKey:'discipline'}},{user:fixture.gm});
     apply(target,condition.after);
     const remaining=remainingSymbols(outcome,[spend]);forceBattles.push({scale,partySize,forceRating:forceUser.system.forceRating,spentLight:spend.cost.light,lightRemaining:remaining.light,darkRemaining:remaining.dark,condition:target.flags['star-wars-ffg'].conditions[0].name});
   }
   const warParty=Array.from({length:6},(_,index)=>character(`war-pc-${index+1}`)),warTactics=[
     {id:'espionage',skill:'computers',characteristic:3,rank:2,difficulty:2,lead:0,assists:[1]},
     {id:'politics',skill:'negotiation',characteristic:3,rank:2,difficulty:2,lead:1,assists:[2]},
     {id:'combat',skill:'gunnery',characteristic:3,rank:2,difficulty:2,lead:2,assists:[3]},
     {id:'force',skill:'discipline',characteristic:3,rank:2,difficulty:2,lead:3,assists:[4]},
     {id:'smuggling',skill:'streetwise',characteristic:3,rank:2,difficulty:2,lead:4,assists:[5]},
     {id:'stealth',skill:'stealth',characteristic:3,rank:2,difficulty:2,lead:5,assists:[0]},
     {id:'intelligence',skill:'warfare',characteristic:3,rank:3,difficulty:3,lead:0,assists:[1,2]},
   ];
   const forceTalentRules={pool:{add:{ability:0,proficiency:0,boost:0,difficulty:0,challenge:0,setback:0,force:1},remove:{ability:0,proficiency:0,boost:0,difficulty:0,challenge:0,setback:0,force:0}},reasons:['Force affinity: +1 Force die'],contributions:[],automaticResults:{},decisions:[]};
   const deterministicFaces=pool=>Object.entries(pool).flatMap(([die,count])=>Array.from({length:count},()=>({die,result:die==='proficiency'?12:die==='boost'?4:die==='force'?8:die==='ability'?2:1})));
   const tacticChecks=warTactics.map(tactic=>{
     const automatic=automaticCheckPool({characteristic:tactic.characteristic,rank:tactic.rank,skill:tactic.skill,difficulty:tactic.difficulty,boost:tactic.assists.length,talentRules:tactic.id==='force'?forceTalentRules:undefined,...(tactic.id==='combat'?{weaponRange:'long',rangeBand:'long',vehicleAttack:true,attackerSilhouette:6,targetSilhouette:8}: {})});
     const outcome=resolveFaces(deterministicFaces(automatic.pool));
     return {id:tactic.id,lead:warParty[tactic.lead].id,assists:tactic.assists.map(index=>warParty[index].id),skill:tactic.skill,pool:automatic.pool,error:automatic.error,passed:outcome.passed,netSuccess:outcome.netSuccess,triumph:outcome.triumph,light:outcome.light,rangeBand:tactic.id==='combat'?'long':null};
   });
   const strategicOutcome=resolveFaces(tacticChecks.flatMap(check=>deterministicFaces(check.pool))),strategicSpend=planSpend(strategicOutcome,[],{label:'Break the siege line',note:'The GM rules that the coordinated player tactics open a safe corridor for the planetary assault.',cost:{triumph:1},source}),fortress=vehicle('planetary-fortress',8,4),fortressPlan=planActorEffect(fortress,{kind:'damage',amount:36,pierce:0,breach:0,scale:'vehicle',note:'Long-range planetary weapon resolves the strategic opening against the fortress.',source},{user:fixture.gm});
   apply(fortress,fortressPlan.after);
   const strategicWar={scale:'planetary',size:'massive',partySize:warParty.length,playerIds:warParty.map(actor=>actor.id),rangeBand:classifyRangeDistance(18000,planetaryProfile).band,weapon:{name:'Long-range planetary battery',scale:'vehicle',range:'long',damage:36},vehicles:{attackingSilhouette:6,targetSilhouette:fortress.system.silhouette,targetHullAfter:fortress.system.hullTrauma.value},tactics:tacticChecks,outcome:{netSuccess:strategicOutcome.netSuccess,triumph:strategicOutcome.triumph,advantage:strategicOutcome.advantage},spent:strategicSpend.cost,resolution:{status:fortressPlan.calculation.exceedsThreshold?'resolved':'unresolved',text:'The siege line breaks and the allied force secures the relay.'}};
   return {partySizes,scenarios,forceBattles,strategicWar};
 });
 assert.equal(battleMatrix.scenarios.length,9,'three party sizes run through personal, planetary and space battles');
 assert.deepEqual(battleMatrix.partySizes,[1,4,6]);
 for(const scale of ['personal','planetary','space'])assert.deepEqual(battleMatrix.scenarios.filter(row=>row.battleScale===scale).map(row=>row.partySize),[1,4,6],`${scale} scale covers small, medium and large parties`);
 assert.ok(battleMatrix.scenarios.some(row=>row.battleScale==='planetary'&&row.rangeBand==='long'),'planetary range bands reach long range');
 assert.ok(battleMatrix.scenarios.some(row=>row.battleScale==='space'&&row.rangeBand==='medium'),'space range bands reach medium range');
 assert.equal(battleMatrix.forceBattles.length,6,'Force battles cover both planetary and space scenes for every party size');
 assert.ok(battleMatrix.forceBattles.every(row=>row.lightRemaining===1&&row.darkRemaining===1&&row.condition==='Force stagger'),'Force pips remain separate and the GM condition is recorded');
 assert.equal(battleMatrix.strategicWar.rangeBand,'long','massive planetary war uses long range');
 assert.equal(battleMatrix.strategicWar.partySize,6,'massive war uses the full player party');
 assert.deepEqual(battleMatrix.strategicWar.tactics.map(row=>row.id),['espionage','politics','combat','force','smuggling','stealth','intelligence']);
 assert.ok(battleMatrix.strategicWar.tactics.every(row=>row.passed&&row.assists.length&&row.pool.boost>=1&&row.error===''),'every war tactic passes with player assistance');
 assert.equal(battleMatrix.strategicWar.tactics.find(row=>row.id==='combat').rangeBand,'long','combat tactic uses a long-range planetary weapon');
 assert.ok(battleMatrix.strategicWar.tactics.find(row=>row.id==='force').pool.force>=1,'Force tactic includes a Force die');
 assert.equal(battleMatrix.strategicWar.resolution.status,'resolved','coordinated tactics resolve the massive battle');
 await writeFile(resolve(artifacts,'battle-matrix.json'),JSON.stringify(battleMatrix,null,2)+'\n');
 const durable=await page.evaluate(async()=>{
   const run=fixture.playtest.run,pool=game.settings.get('star-wars-ffg','destiny')??{};
   await game.settings.set('star-wars-ffg','destiny',{light:Number(pool.light??0)+1,dark:Number(pool.dark??0)+(run%2===0?1:0)});
   const nextScene=['hangar','relay','chase'][run%3];
   const scene=fixture.travelScene(nextScene);
   await fixture.recordGroupResource(run,scene);
   return fixture.snapshotPlaytestState();
 });
 assert.equal(durable.stage,playtestRun,'the snapshot records the completed run number');
 assert.equal(durable.settings.destiny.light,initialState.settings.destiny.light+1,'each run advances the shared Destiny pool');
 assert.ok(durable.group.system.resourceLedger[`credit${playtestRun}`],'each run records a group credit ledger entry');
 assert.ok(durable.group.system.resourceLedger[`gear${playtestRun}`],'each run records a group gear ledger entry');
 assert.deepEqual(await page.evaluate(()=>[fixture.hero.system.wounds.value,fixture.hero.system.xp.available,fixture.hero.system.xp.total,fixture.hero.system.credits,fixture.message.flags['star-wars-ffg'].spending.length,game.combat.flags['star-wars-ffg'].slotClaims.length]),[initialWounds,initialXp+5,initialTotalXp+5,initialCredits+100,initialSpending+1,1]);
 await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.hookCount()),hooksBeforeDashboard,'closing the dashboard must detach its document hooks');
 assert.deepEqual(await page.evaluate(()=>fixture.playtest),JSON.parse(playtestMetadata),'the runner metadata must reach the fresh browser world');
 if(process.env.PLAYTEST_STATE_OUT)await writeFile(process.env.PLAYTEST_STATE_OUT,JSON.stringify(durable,null,2)+'\n');
 assert.deepEqual(errors,[]);console.log('Browser fixture passed: damage preview/apply/undo, Force and narrative spending, player claim through GM authority, six-player initiative, session awards, personal/planetary/space battle matrix, assisted massive planetary war, and vehicle controls. Live Foundry acceptance remains separate.');
} catch(error) {await page?.screenshot({path:resolve(artifacts,'failure.png'),fullPage:true}).catch(()=>{});if(errors.length)console.error('Browser page errors:',errors);throw error;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
