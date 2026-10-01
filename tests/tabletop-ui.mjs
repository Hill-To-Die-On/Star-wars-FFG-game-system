/** Real-browser UI journeys with Foundry-shaped document/dialog fixtures.
 * Does not connect to Foundry, install packages into a world, or call AI providers.
 */
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root=resolve(import.meta.dirname,'..'),artifacts=resolve(process.env.TEST_ARTIFACTS_DIR??'test-results/browser/tabletop-ui');
const playtestRun=Number(process.env.PLAYTEST_RUN??0),playtestSeed=Number(process.env.PLAYTEST_SEED??0);
const playtestMetadata=JSON.stringify({run:Number.isSafeInteger(playtestRun)?playtestRun:0,seed:Number.isSafeInteger(playtestSeed)?playtestSeed:0});
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
 assert.equal(await page.evaluate(()=>fixture.hero.system.wounds.value),2,'stale preview must leave wounds unchanged');
 await page.evaluate(()=>fixture.hero.system.soak=2);
 await page.evaluate(()=>{void fixture.openResolution(fixture.hero);});
 await page.locator('[name="amount"]').fill('7');await page.locator('[name="note"]').fill('Reviewed blaster hit');await source();await page.getByRole('button',{name:'Review change',exact:true}).click();
 await page.getByRole('button',{name:'Apply reviewed changes'}).click();await page.waitForFunction(()=>fixture.hero.system.wounds.value===7);
 await page.evaluate(()=>{void fixture.openWorkflowHistory(fixture.hero);});await page.getByRole('button',{name:'Undo this change'}).click();await page.waitForFunction(()=>fixture.hero.system.wounds.value===2);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(()=>{void fixture.openNarrativeSpending(fixture.message);});await page.locator('[name="label"]').fill('Create an opening');await page.locator('[name="advantage"]').fill('2');await source();await page.getByRole('button',{name:'Review decision',exact:true}).click();await page.getByRole('button',{name:'Record GM decision',exact:true}).click();await page.waitForFunction(()=>fixture.message.flags['star-wars-ffg'].spending?.length===1);
 await page.evaluate(()=>{game.user=fixture.player;void fixture.openInitiativeSlots();});
 await page.locator('[name="slotId"]').waitFor();
 assert.deepEqual(await page.locator('[name="slotId"] option').evaluateAll(rows=>rows.map(r=>[r.value,r.textContent])),[['s2','1. pc · available'],['s1','2. pc · available']],'numbered choices must follow initiative order rather than actor insertion order');
 await page.locator('[name="slotId"]').selectOption('s1');await page.getByRole('button',{name:'Claim slot',exact:true}).click();
 // Run the queued document on the separate active GM, as a second Foundry client would.
 await page.waitForFunction(()=>game.messages.some(m=>m.flags?.['star-wars-ffg']?.tabletopRequest?.command==='claim'));
 await page.evaluate(()=>{game.user=fixture.gm;const msg=game.messages.find(m=>m.flags?.['star-wars-ffg']?.tabletopRequest?.command==='claim');Hooks.callAll('createChatMessage',msg,{},msg.author.id);});await page.waitForFunction(()=>game.combat.flags['star-wars-ffg'].slotClaims?.length===1);
 await page.evaluate(()=>{void fixture.openSessionWrapUp();});await page.locator('[name="actor-hero"]').check();await page.locator('[name="xp"]').fill('5');await page.locator('[name="credits"]').fill('100');await page.locator('[name="downtime"]').fill('Repaired and resupplied at port.');await source();await page.getByRole('button',{name:'Preview awards'}).click();await page.getByRole('button',{name:'Award reviewed changes'}).click();await page.waitForFunction(()=>fixture.hero.system.xp.available===10);
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
 assert.deepEqual(await page.evaluate(()=>[fixture.hero.system.wounds.value,fixture.hero.system.xp.available,fixture.hero.system.xp.total,fixture.hero.system.credits,fixture.message.flags['star-wars-ffg'].spending.length,game.combat.flags['star-wars-ffg'].slotClaims.length]),[2,10,25,150,1,1]);
 await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.evaluate(()=>fixture.hookCount()),hooksBeforeDashboard,'closing the dashboard must detach its document hooks');
 assert.deepEqual(await page.evaluate(()=>fixture.playtest),JSON.parse(playtestMetadata),'the runner metadata must reach the fresh browser world');
 assert.deepEqual(errors,[]);console.log('Browser fixture passed: damage preview/apply/undo, narrative spending, player claim through GM authority, session awards, and unplaced-vehicle fail-closed controls. Live Foundry acceptance remains separate.');
} catch(error) {await page?.screenshot({path:resolve(artifacts,'failure.png'),fullPage:true}).catch(()=>{});if(errors.length)console.error('Browser page errors:',errors);throw error;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
