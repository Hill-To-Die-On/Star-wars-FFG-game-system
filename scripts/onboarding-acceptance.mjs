/** Opt-in native onboarding acceptance in a fresh, isolated, module-free Foundry world. */
import { mkdir, mkdtemp, copyFile, writeFile, readFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { installRecoveryArchive } from "./recovery-support.mjs";
const args=process.argv.slice(2),arg=name=>args.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const app=arg("foundry-app"),license=arg("license"),port=Number(arg("port")??30028);
if(!app||!license||!Number.isInteger(port)||port<1024||port>65535||port===30002)throw Error("Supply a licensed --foundry-app, private --license and isolated --port (never 30002).");
const probe=createServer();await new Promise((ok,no)=>{probe.once("error",no);probe.listen(port,"127.0.0.1",ok);});await new Promise(ok=>probe.close(ok));
const parent=resolve(arg("output")??".local/onboarding-native");await mkdir(parent,{recursive:true});const output=await mkdtemp(join(parent,"run-"));
for(const dir of ["Config","Data/systems","Data/worlds/onboarding-validation/data","Data/modules"])await mkdir(join(output,dir),{recursive:true});
await copyFile(license,join(output,"Config/license.json"));
await writeFile(join(output,"Config/options.json"),JSON.stringify({port,hostname:"127.0.0.1",upnp:false,world:"onboarding-validation"}));
const installed=await installRecoveryArchive(resolve("dist/star-wars-ffg.zip"),join(output,"Data/systems/star-wars-ffg"));
await writeFile(join(output,"Data/worlds/onboarding-validation/world.json"),JSON.stringify({id:"onboarding-validation",title:"Onboarding validation",system:"star-wars-ffg",systemVersion:installed.version,coreVersion:"14.368",compatibility:{minimum:"14",verified:"14.368"},packs:[]}));
const report={kind:"native-onboarding",version:installed.version,port,checks:[],errors:[]};let child,browser,gm;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function screenshot(name){await gm.screenshot({path:join(output,`${name}.png`)});}
async function joinWorld(page,name){await page.goto(`http://127.0.0.1:${port}/game`);if(page.url().includes("/join")){await page.locator("#join-username").fill(name);await page.getByRole("button",{name:"Join Game Session"}).click();}await page.waitForFunction(()=>globalThis.game?.ready,null,{timeout:60000});}
try {
 const log=createWriteStream(join(output,"server.log"));child=spawn(process.execPath,[resolve(app),`--dataPath=${output}`,`--port=${port}`,"--world=onboarding-validation"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});child.stdout.pipe(log);child.stderr.pipe(log);
 let ready=false;for(let i=0;i<240;i++){if(child.exitCode!==null)throw Error("Isolated Foundry exited; see private server.log.");try{if((await fetch(`http://127.0.0.1:${port}/join`)).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,"Foundry starts within one minute");
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
 const context=await browser.newContext({viewport:{width:1500,height:1000}});gm=await context.newPage();gm.on("pageerror",error=>report.errors.push(error.message));
 await joinWorld(gm,"Gamemaster");await gm.locator('.step-button[data-action="exit"]').waitFor();await gm.locator('.step-button[data-action="exit"]').click();await gm.locator("#star-wars-welcome").waitFor();
 assert.equal(await gm.evaluate(()=>canvas.scene.toObject().levels[0].background.src),'systems/star-wars-ffg/assets/ui/saturn-enceladus-concept.webp');report.checks.push('Fresh-world welcome scene uses the NASA artwork');
 assert.match(await gm.locator("#star-wars-welcome").innerText(),/Do not distribute copyrighted PDFs/);report.welcomeStyle=await gm.locator('#star-wars-welcome').evaluate(root=>{const b=root.querySelector('[data-action="next"]'),css=getComputedStyle(b);return {classes:root.className,matches:b.matches(".sf-themed-window .window-content button"),parent:b.parentElement.parentElement.outerHTML.slice(0,120),button:{background:css.background,color:css.color,opacity:css.opacity,disabled:b.disabled}};});assert.equal(report.welcomeStyle.button.color,"rgb(255, 255, 255)");await screenshot("01-welcome");report.checks.push("Fresh GM sees copyright reminder and setup");
 await gm.getByRole("button",{name:"Choose my books"}).click();
 const first=gm.locator('#star-wars-welcome [name="books"]').first();await first.check();const book=await first.getAttribute("value");
 await screenshot("02-bookshelf");await gm.getByRole("button",{name:"Save books & continue"}).click();await gm.getByRole("button",{name:"Skip tutorial"}).click();await gm.locator("#star-wars-welcome").waitFor({state:"hidden"});
 const saved=await gm.evaluate(()=>({campaign:game.settings.get("star-wars-ffg","campaign"),remembered:JSON.parse(localStorage.getItem("star-wars-ffg.bookshelf.v1")),progress:game.user.getFlag("star-wars-ffg","onboarding")}));
 assert.deepEqual(saved.campaign.books,[book]);assert.equal(saved.campaign.bookMode,"owned");assert.deepEqual(saved.campaign.lines,["edge","age","force"]);assert.deepEqual(saved.remembered.books,[book]);assert.equal(saved.progress.tour,"skipped");
 await gm.reload();await gm.waitForFunction(()=>globalThis.game?.ready);await gm.evaluate(()=>foundry.nue.Tour.activeTour?.exit());assert.equal(await gm.locator("#star-wars-welcome").count(),0);assert.deepEqual(await gm.evaluate(()=>game.settings.get("star-wars-ffg","campaign").books),[book]);report.checks.push("Books and skipped tutorial persist after reload");
 await gm.evaluate(()=>new foundry.applications.settings.SettingsConfig({initialCategory:"system"}).render({force:true}));
 await gm.locator("#settings-config .sf-settings-group").first().waitFor();
 assert.equal(await gm.locator("#settings-config.sf-native-settings").count(),1);assert.equal(await gm.locator("#settings-config.star-wars").count(),0);assert.equal(await gm.locator("#settings-config fieldset.sf-settings-group").count(),6);await screenshot("03-native-settings");
 await gm.getByRole("button",{name:"Choose available books"}).click();await gm.locator("#star-wars-owned-books.sf-native-settings").waitFor();await screenshot("04-owned-books-settings");report.checks.push("All six settings groups and owned-books form keep native styling");
 await gm.evaluate(async()=>{for(const instance of [...foundry.applications.instances.values()])if(instance.rendered && instance.element?.querySelector(":scope > .window-header"))await instance.close();});
 await gm.evaluate(async()=>{await game.settings.set("star-wars-ffg","compactChatDice",false);await game.system.api.onboarding.tour();});await gm.locator(".step-title").getByText("Your Star Wars table",{exact:true}).waitFor();
 await screenshot("05-interface-tour");
 for(let i=0;i<6;i++){await gm.locator('.step-button[data-action="next"]').click();await gm.waitForFunction(index=>foundry.nue.Tour.activeTour?.stepIndex===index,i+1);}
 await gm.locator('.step-button[data-action="next"]').click();await gm.waitForFunction(()=>!foundry.nue.Tour.tourInProgress);await gm.waitForFunction(()=>getComputedStyle(game.tooltip.tooltip).visibility==="hidden");report.checks.push("All seven native tour steps complete, including a hidden-dice-tray fallback");
 await gm.evaluate(async()=>{const journal=await JournalEntry.create({name:"Onboarding style check",pages:[{name:"A table handout",type:"text",text:{content:"<h1>Welcome to the table</h1><p>Original campaign handout. Readable paper, clear headings and native editing controls.</p>"}}]});await journal.sheet.render({force:true});});
 await gm.locator(".sf-journal-window").waitFor();report.tooltipState=await gm.evaluate(()=>{const t=game.tooltip.tooltip;return {classes:t.className,open:t.matches(':popover-open'),display:getComputedStyle(t).display,opacity:getComputedStyle(t).opacity,html:t.outerHTML.slice(0,300)};});await screenshot("06-themed-journal");await gm.evaluate(()=>game.settings.set('star-wars-ffg','interfaceTheme','default'));
 assert.equal(await gm.locator('.journal-sheet.sf-journal-window').count(),0);
 await gm.evaluate(()=>game.settings.set('star-wars-ffg','interfaceTheme','auto'));
 await gm.locator('.sf-journal-window').waitFor();report.checks.push("Journal receives the system presentation and responds to theme opt-out");
 await gm.evaluate(async()=>{for(const instance of [...foundry.applications.instances.values()])if(instance.rendered && instance.element?.querySelector(":scope > .window-header"))await instance.close();await User.create({name:"Onboarding Player",role:1,password:""});});
 // Resize the real ActorSheet without changing viewport size; compactness follows the window.
 await gm.evaluate(async()=>{const actor=await Actor.create({name:"Compact sheet pilot",type:"character",system:{species:"Human",career:"Explorer",phase:"play"}});globalThis.compactActor=actor;await actor.sheet.render({force:true});});
 const sheet=gm.locator('.sf-actor-sheet');await sheet.waitFor();
 await gm.evaluate(()=>compactActor.sheet.setPosition({width:560,height:620,left:30,top:30}));
 await gm.waitForFunction(()=>getComputedStyle(document.querySelector('.sf-actor-sheet .sf-characteristics')).gridTemplateColumns.split(' ').length===6);
 assert.ok(await sheet.locator('.window-resize-handle').count(),'native resize handle');
 await screenshot('07-compact-overview');
 await sheet.locator('[data-tab="skills"]').click();await sheet.locator('.sf-skill-sheet').waitFor();
 await gm.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 assert.ok(Math.abs((await sheet.boundingBox()).height-620)<=2,'switching tabs preserves the chosen sheet height');
 assert.equal(await sheet.locator('.sf-skill-sheet').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
 assert.ok(await sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no sheet horizontal overflow');
 await screenshot('08-compact-skills');
 await sheet.locator('[data-action="skill"]').first().click();await gm.locator('.sf-pool-builder').waitFor();
 assert.equal(await gm.evaluate(()=>game.messages.filter(m=>m.isRoll).length),0,'opening a compact skill does not roll');
 report.checks.push('Character sheet resizes with native handle, compact overview and single-column skills; skill opens a pool without rolling');
 await gm.evaluate(async()=>{for(const instance of [...foundry.applications.instances.values()])if(instance.rendered && instance.element?.querySelector(":scope > .window-header"))await instance.close();});
 const playerContext=await browser.newContext({viewport:{width:1280,height:900}}),player=await playerContext.newPage();player.on("pageerror",error=>report.errors.push(error.message));await joinWorld(player,"Onboarding Player");
 await player.locator("#star-wars-welcome").waitFor();assert.equal(await player.getByRole("button",{name:"Choose my books"}).count(),0);await player.getByRole("button",{name:"Continue",exact:true}).click();await player.getByRole("button",{name:"Skip tutorial"}).click();await player.locator("#star-wars-welcome").waitFor({state:"hidden"});await player.reload();await player.waitForFunction(()=>globalThis.game?.ready);assert.equal(await player.locator("#star-wars-welcome").count(),0);report.checks.push("Player welcome cannot edit campaign books and persists independently");await playerContext.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(error) {report.failure=error.stack;try { await screenshot("failure"); await writeFile(join(output,"failure-dom.html"),await gm.content()); } catch {} throw error;}
finally {
 await writeFile(join(output,"results.json"),JSON.stringify(report,null,2));
 try{await gm?.evaluate(()=>game.shutDown());}catch{}await browser?.close();
 if(child&&child.exitCode===null){const stopped=new Promise(r=>child.once("exit",r));child.kill();await Promise.race([stopped,delay(10000)]);if(child.exitCode===null)child.kill("SIGKILL");}
 console.log(JSON.stringify({passed:report.passed??false,checks:report.checks,output,failure:report.failure??null}));
}
