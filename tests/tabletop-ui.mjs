/** Real-browser UI journeys with Foundry-shaped document/dialog fixtures.
 * Does not connect to Foundry, install packages into a world, or call AI providers.
 */
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root=resolve('.');
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(`<html><head><link rel="stylesheet" href="/styles/tabletop.css"><style>body{background:#13232c;color:#eee;font:16px system-ui}.application{background:#223944;border:1px solid #b8c8cf;max-width:740px;margin:15px auto;padding:14px;max-height:90vh;display:flex;flex-direction:column}h2{font-size:22px}input,select,textarea,button{font:inherit;padding:5px;color:#13232c;background:#f4f0e4;border:1px solid #afbab9}footer{display:flex;gap:12px;padding-top:12px}.window-content{min-height:0}form{max-height:80vh}table{width:100%}article{padding:8px}</style></head><body><script type="module" src="/tests/fixtures/tabletop-browser.mjs"></script></body></html>`);}
  const path=resolve(root,decodeURIComponent(req.url).slice(1));if(!path.startsWith(root+sep)||!/^\/(src|styles|tests\/fixtures)\//.test(req.url))throw new Error('Outside fixture');
  res.setHeader('Content-Type',path.endsWith('.mjs')?'text/javascript':'text/css');res.end(await readFile(path));
 }catch{res.statusCode=404;res.end('Missing fixture');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1100,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>globalThis.fixture);
 const source=async()=>{await page.locator('[name="book"]').fill('Table adjudication');await page.locator('[name="page"]').fill('Session QA');};
 await page.evaluate(()=>{void fixture.openResolution(fixture.hero);});
 await page.locator('[name="amount"]').fill('7');await page.locator('[name="note"]').fill('Reviewed blaster hit');await source();await page.getByRole('button',{name:'Review',exact:true}).click();
 await page.getByRole('button',{name:'Apply reviewed changes'}).click();await page.waitForFunction(()=>fixture.hero.system.wounds.value===7);
 await page.evaluate(()=>{void fixture.openWorkflowHistory(fixture.hero);});await page.getByRole('button',{name:'Undo this change'}).click();await page.waitForFunction(()=>fixture.hero.system.wounds.value===2);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(()=>{void fixture.openNarrativeSpending(fixture.message);});await page.locator('[name="label"]').fill('Create an opening');await page.locator('[name="advantage"]').fill('2');await source();await page.getByRole('button',{name:'Review',exact:true}).click();await page.getByRole('button',{name:'Yes',exact:true}).click();await page.waitForFunction(()=>fixture.message.flags['star-wars-ffg'].spending?.length===1);
 await page.evaluate(()=>{game.user=fixture.player;void fixture.openInitiativeSlots();});
 await page.locator('[name="slotId"]').waitFor();
 assert.deepEqual(await page.locator('[name="slotId"] option').evaluateAll(rows=>rows.map(r=>[r.value,r.textContent])),[['s2','1. pc · available'],['s1','2. pc · available']],'numbered choices must follow initiative order rather than actor insertion order');
 await page.locator('[name="slotId"]').selectOption('s1');await page.getByRole('button',{name:'Claim slot',exact:true}).click();
 // Run the queued document on the separate active GM, as a second Foundry client would.
 await page.waitForFunction(()=>game.messages.some(m=>m.flags?.['star-wars-ffg']?.tabletopRequest?.command==='claim'));
 await page.evaluate(()=>{game.user=fixture.gm;const msg=game.messages.find(m=>m.flags?.['star-wars-ffg']?.tabletopRequest?.command==='claim');Hooks.callAll('createChatMessage',msg,{},msg.author.id);});await page.waitForFunction(()=>game.combat.flags['star-wars-ffg'].slotClaims?.length===1);
 await page.evaluate(()=>{void fixture.openSessionWrapUp();});await page.locator('[name="actor-hero"]').check();await page.locator('[name="xp"]').fill('5');await page.locator('[name="credits"]').fill('100');await page.locator('[name="downtime"]').fill('Repaired and resupplied at port.');await source();await page.getByRole('button',{name:'Preview awards'}).click();await page.getByRole('button',{name:'Award reviewed changes'}).click();await page.waitForFunction(()=>fixture.hero.system.xp.available===10);
 await page.evaluate(()=>{void fixture.openVehicleDashboard(fixture.ship);});await page.getByRole('heading',{name:'Vehicle combat · Test Freighter'}).waitFor();assert.equal(await page.getByRole('button',{name:'Build assigned gunner pool'}).isDisabled(),true);
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByRole('heading',{name:'Vehicle combat · Test Freighter'}).waitFor();assert.equal(await page.locator('.application').count(),1,'refresh replaces the dashboard instead of nesting windows');
 await mkdir('.local/tabletop',{recursive:true});await page.screenshot({path:'.local/tabletop/vehicle-dashboard-fixture.png',fullPage:true});
 assert.deepEqual(await page.evaluate(()=>[fixture.hero.system.wounds.value,fixture.hero.system.xp.available,fixture.hero.system.xp.total,fixture.hero.system.credits,fixture.message.flags['star-wars-ffg'].spending.length,game.combat.flags['star-wars-ffg'].slotClaims.length]),[2,10,25,150,1,1]);
 assert.deepEqual(errors,[]);console.log('Browser fixture passed: damage preview/apply/undo, narrative spending, player claim through GM authority, session awards, and unplaced-vehicle fail-closed controls. Live Foundry acceptance remains separate.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
