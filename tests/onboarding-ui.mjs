import {createServer} from "node:http";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,sep,extname} from "node:path";
import assert from "node:assert/strict";
import Handlebars from "handlebars";
import {chromium} from "@playwright/test";
const root=resolve("."),compiled=Handlebars.precompile(await readFile("templates/welcome.hbs","utf8"));
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/styles/star-wars.css"><link rel="stylesheet" href="/styles/onboarding.css"><link rel="stylesheet" href="/styles/window-presentation.css"><style>body{font:16px system-ui;background:#182b36;margin:20px}.application{width:min(730px,calc(100vw - 40px));margin:auto;max-height:90vh;display:flex;flex-direction:column;border:1px solid #53656a;border-radius:10px;overflow:hidden}.window-header{padding:10px}.window-content{min-height:0;overflow:auto}button,input,select{font:inherit}button{cursor:pointer}.sf-native-settings{background:#ddd;color:#222}</style></head><body class="system-star-wars-ffg" data-star-wars-theme="frontier"><script src="/handlebars.js"></script><script>Handlebars.registerHelper('checked',v=>v?'checked':'');Handlebars.templates={welcome:Handlebars.template(${compiled})};</script><script type="module" src="/tests/fixtures/onboarding-browser.mjs"></script></body></html>`;
const server=createServer(async(req,res)=>{
 try {
  let name=new URL(req.url,"http://localhost").pathname;
  if(name==="/"){res.setHeader("Content-Type","text/html");return res.end(html);}
  if(name==="/handlebars.js"){res.setHeader("Content-Type","text/javascript");return res.end(await readFile("node_modules/handlebars/dist/handlebars.runtime.min.js"));}
  name=name.replace(/^\/systems\/star-wars-ffg\//,"/");
  const file=resolve(root,decodeURIComponent(name).slice(1));
  if(!file.startsWith(root+sep)||!/^\/(src|styles|assets|data|tests\/fixtures)\//.test(name))throw Error("Outside fixture");
  res.setHeader("Content-Type",({".mjs":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml"})[extname(file)]??"application/octet-stream");res.end(await readFile(file));
 }catch{res.statusCode=404;res.end("Missing");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1024,height:960}}),errors=[];page.on("pageerror",error=>errors.push(error.message));const url=`http://127.0.0.1:${server.address().port}`;
 await page.goto(url);await page.getByRole("button",{name:"Choose my books"}).click();
 const first=page.locator('[name="books"]').first();await first.check();const selected=await first.getAttribute("value");
 await page.getByRole("searchbox",{name:"Find a book"}).fill("zzzz-no-match");assert.equal(await page.locator('.sf-book-choice:visible').count(),0);
 await page.getByRole("button",{name:"Save books & continue"}).click();await page.getByRole("button",{name:"Skip tutorial"}).click();await page.locator("#star-wars-welcome").waitFor({state:"hidden"});
 assert.deepEqual(await page.evaluate(()=>fixture.state.books),[selected]);await page.reload();await page.waitForFunction(()=>globalThis.fixture?.ready);assert.equal(await page.locator("#star-wars-welcome").count(),0);
 // A future world starts with its own defaults; the browser bookshelf is only offered for explicit reuse.
 await page.evaluate(()=>{localStorage.removeItem('fixture-campaign');localStorage.removeItem('fixture-progress');});await page.reload();await page.getByRole("button",{name:"Choose my books"}).click();
 assert.equal(await page.locator('[name="books"]:checked').count(),0);await page.getByRole("button",{name:"Use remembered selection"}).click();assert.equal(await page.locator('[name="books"]:checked').count(),1);
 await page.getByRole("button",{name:"Forget remembered books"}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('star-wars-ffg.bookshelf.v1')),null);
 await page.getByRole("button",{name:"Save books & continue"}).click();await page.getByRole("button",{name:"Skip tutorial"}).click();await page.locator("#star-wars-welcome").waitFor({state:"hidden"});
 // Players have an independent welcome and cannot submit the GM-only mutation even if invoked directly.
 await page.evaluate(()=>localStorage.removeItem('fixture-progress'));await page.goto(url+'/?player=1');await page.getByRole("button",{name:"Continue",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Choose my books"}).count(),0);
 assert.match(await page.evaluate(async()=>{try{await fixture.WelcomeWizard.saveBooks.call(fixture.app);return 'unexpected';}catch(error){return error.message;}}),/Only the GM/);
 await page.setViewportSize({width:420,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const artifacts=process.env.TEST_ARTIFACTS_DIR??".local/onboarding-fixture";await mkdir(artifacts,{recursive:true});await page.screenshot({path:resolve(artifacts,"player-welcome-narrow.png")});
 const grouping=await page.evaluate(()=>{
  game.i18n={localize:key=>key === "SWFFG.Settings.Groups.CampaignSetup" ? "Configuration de la campagne" : key};
  const root=document.createElement('form');root.id='settings-config';root.className='application star-wars';root.innerHTML='<div data-category="system"><div class="form-group"><label>Tray</label><input name="star-wars-ffg.compactChatDice" type="checkbox"></div><div class="form-group"><label>Books</label><button data-key="star-wars-ffg.ownedBooksMenu">Books</button></div></div>';document.body.append(root);
  const input=root.querySelector('input');let calls=0;input.addEventListener('change',()=>calls++);
  fixture.presentation.styleSystemWindow({constructor:{name:'SettingsConfig'}},root);fixture.presentation.groupSystemSettings(root);fixture.presentation.groupSystemSettings(root);input.checked=true;input.dispatchEvent(new Event('change'));
  const sidebar=document.createElement('section');sidebar.id='journal';fixture.presentation.styleSystemWindow({constructor:{name:'JournalDirectory'}},sidebar);
  const journal=document.createElement('section');journal.className='application journal-sheet';document.body.append(journal);
  fixture.presentation.styleSystemWindow({constructor:{name:'JournalEntrySheet'}},journal);const journalThemed=journal.classList.contains('sf-journal-window');
  delete document.body.dataset.starWarsTheme;fixture.presentation.styleSystemWindow({constructor:{name:'JournalEntrySheet'}},journal);
  const journalOptOut=!journal.classList.contains('star-wars')&&!journal.dataset.theme;
  return {journalThemed,journalOptOut,groups:root.querySelectorAll('.sf-settings-group').length,first:root.querySelector('legend').textContent,native:root.classList.contains('sf-native-settings'),themed:root.classList.contains('star-wars'),same:input===root.querySelector('input'),calls,sidebarThemed:sidebar.classList.contains('sf-themed-window')};
 });
 assert.deepEqual(grouping,{journalThemed:true,journalOptOut:true,groups:2,first:'Configuration de la campagne',native:true,themed:false,same:true,calls:1,sidebarThemed:false});assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>fixture.errors),[]);
 console.log('Onboarding browser fixture passed: search preserves selection, reload, explicit future-world reuse, forget, player permissions, narrow layout, native settings input identity and sidebar isolation.');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
