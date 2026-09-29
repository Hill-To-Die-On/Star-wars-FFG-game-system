/** Bounded real-browser fixture; no live world or AI service is contacted. */
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import assert from 'node:assert/strict';
import Handlebars from 'handlebars';
import {chromium} from '@playwright/test';
const root=resolve('.'),template=await readFile('templates/actor.hbs','utf8');
const artifacts=process.env.TEST_ARTIFACTS_DIR||'.local/accessibility';
Handlebars.registerHelper('selectOptions',()=>new Handlebars.SafeString(''));
const header=Handlebars.compile(template.slice(template.indexOf('<header'),template.indexOf('</header>')+9));
const entries=['Human','Twi’lek','Wookiee','Zabrak'].map((name,i)=>({id:String(i),name,source:{book:'Reference',page:i+1}}));
const shipEntries=['YT-1300','Lambda shuttle','Patrol skiff'].map((name,i)=>({id:String(i),name,source:{book:'Reference',page:i+1}}));
const headings=header({portraitSrc:'/assets/character.svg',themeKey:'edge',isCharacter:true,originEditable:true,homebrewAllowed:true,system:{species:'Human',career:'Explorer'},actor:{name:'Keyboard pilot'},speciesOptions:entries,careerOptions:entries})+
header({portraitSrc:'/assets/vehicle.svg',themeKey:'edge',isVehicle:true,vehicleIdentityEditable:true,homebrewAllowed:true,system:{model:'YT-1300'},actor:{name:'Test freighter'},modelOptions:shipEntries,manufacturerOptions:entries});
const server=createServer(async(req,res)=>{
  try {
    if(req.url==='/')return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Star Wars accessibility fixture</title><link rel="stylesheet" href="/styles/star-wars.css"><style>body{margin:24px;background:#142a34}.star-wars{max-width:1000px;margin:auto}.sf-header{margin-bottom:24px}.sf-header-meta{display:grid;grid-template-columns:1fr 1fr;gap:24px}.sf-origin-menu{max-height:240px}button,input{font:inherit}#results,#crew{color:white}.sf-arc-picker-help{top:40px;left:40px}</style></head><body><main class="star-wars"><div class="sf-shell" data-theme="edge">${headings}</div><button id="after">Continue</button><button id="arcs">Choose arcs</button><div id="crew"></div><div id="results" role="status"></div><svg class="sf-minion-links"><path class="sf-minion-link" d="M10 10 L100 10"/></svg></main><script type="module" src="/tests/fixtures/accessibility-browser.mjs"></script></body></html>`);
    const pathname=decodeURIComponent(req.url.split('?')[0]),path=resolve(root,pathname.slice(1));
    if(!path.startsWith(root+sep)||!/^\/(src|styles|assets|tests\/fixtures)\//.test(pathname))throw Error('Outside fixture');
    res.setHeader('Content-Type',path.endsWith('.mjs')?'text/javascript':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.woff2')?'font/woff2':'text/css');res.end(await readFile(path));
  } catch {res.statusCode=404;res.end('Missing fixture');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>globalThis.a11yFixture?.ready);
  for(const kind of ['species','career','model','manufacturer']) {
    const input=page.locator(`[data-origin-picker="${kind}"] input[data-origin-search]`);
    await input.focus();await input.press('ArrowDown');await input.press('ArrowDown');
    assert.equal(await input.evaluate(el=>document.activeElement===el),true,'combobox retains typing focus');
    const active=await input.getAttribute('aria-activedescendant');assert.ok(active);
    assert.equal(await page.locator(`[id="${active}"]`).getAttribute('aria-selected'),'true');
    await input.press('Enter');assert.equal(await input.getAttribute('aria-expanded'),'false');
  }
  const species=page.getByRole('combobox',{name:'Species',exact:true});
  await species.fill('wke');await species.press('ArrowDown');await species.press('Enter');
  assert.equal(await page.evaluate(()=>a11yFixture.choices.at(-1).id),'2');
  await species.fill('custom culture');await species.press('ArrowDown');await species.press('Enter');
  assert.equal(await page.evaluate(()=>a11yFixture.choices.at(-1).homebrew),true);
  await species.fill('unfinished');await species.press('Escape');
  assert.equal(await species.evaluate(el=>document.activeElement===el),true);assert.equal(await species.getAttribute('aria-expanded'),'false');
  await species.press('ArrowDown');await species.press('Tab');assert.equal(await species.getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'Choose arcs',exact:true}).click();
  await page.getByRole('button',{name:'Choose firing arc: Fore',exact:true}).press('Enter');
  await page.getByRole('button',{name:'Choose defensive zone: Port',exact:true}).press('Enter');
  assert.equal(await page.evaluate(()=>a11yFixture.committed.defenseZone),'port');
  assert.equal(await page.locator('#arcs').evaluate(el=>document.activeElement===el),true);
  await page.locator('#arcs').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sf-arc-picker').count(),0);assert.equal(await page.locator('#arcs').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-crew-sheet]').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>a11yFixture.sheetOpens),1);
  await page.evaluate(()=>a11yFixture.denyCrew(true));await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>a11yFixture.sheetOpens),1,'keyboard cannot bypass crew sheet permissions');
  await page.evaluate(()=>a11yFixture.denyCrew(false));
  await page.evaluate(()=>a11yFixture.repeatSheetRender());assert.equal(await page.evaluate(()=>a11yFixture.drops),1,'200 real sheet rerenders still process one drop once');
  await page.evaluate(()=>{document.querySelector('[data-crew-token="all"]').dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:30,clientY:30,bubbles:true}));document.dispatchEvent(new PointerEvent('pointermove',{clientX:100,clientY:100}));});
  assert.equal(await page.locator('.sf-crew-drag-ghost').count(),1);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.sf-crew-drag-ghost').count(),0,'Escape removes the drag ghost');
  await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointermove',{clientX:150,clientY:150})));
  assert.equal(await page.locator('.sf-crew-drag-ghost').count(),0,'drag listeners are removed after cancellation');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>a11yFixture.motionValues.at(-1)===true);
  assert.equal(await page.locator('.sf-minion-link').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>a11yFixture.motionValues.at(-1)===false);
  assert.equal(await page.locator('.sf-minion-link').evaluate(el=>getComputedStyle(el).animationName),'sf-minion-march');
  await mkdir(artifacts,{recursive:true});
  await species.focus();await species.press('ArrowDown');
  await page.screenshot({path:resolve(artifacts,'keyboard-selectors.png')});
  await page.locator('#arcs').focus();await page.keyboard.press('Enter');await page.screenshot({path:resolve(artifacts,'arc-alternatives.png')});await page.keyboard.press('Escape');
  const counts=await page.evaluate(async()=>{
    const start=performance.now();for(let i=0;i<250;i++)a11yFixture.bind();
    const input=document.querySelector('[data-origin-search]');input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    return {elapsedMs:performance.now()-start,selections:a11yFixture.choices.length};
  });
  assert.equal(counts.selections,7,'rebinding cannot multiply selection actions');
  await page.setViewportSize({width:600,height:500});await page.locator('#arcs').click();
  assert.equal(await page.getByRole('button',{name:'Choose firing arc: Fore',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}),true);
  await page.getByRole('button',{name:'Cancel · Esc',exact:true}).click();await page.setViewportSize({width:1200,height:1000});
  const sustained=await page.evaluate(async()=>{
    const start=performance.now(),longTasks=[],durations=[];
    const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration)));
    observer.observe({type:'longtask',buffered:false});
    for(let i=0;i<60;i++){
      const began=performance.now();a11yFixture.bind();
      const input=document.querySelector('[data-origin-search]');input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      document.querySelector('#arcs').click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      durations.push(performance.now()-began);await new Promise(resolve=>setTimeout(resolve,500));
    }
    observer.disconnect();return {durationMs:performance.now()-start,cycles:60,maxInteractionMs:Math.max(...durations),longTasks,remainingArcPanels:document.querySelectorAll('.sf-arc-picker,.sf-arc-picker-help').length,remainingGhosts:document.querySelectorAll('.sf-crew-drag-ghost').length};
  });
  assert.equal(sustained.remainingArcPanels,0);assert.equal(sustained.remainingGhosts,0);
  assert.deepEqual(errors,[]);
  const evidence={checks:17,errors,...counts,sustained,fixture:true,measuredAt:new Date().toISOString()};
  await writeFile(resolve(artifacts,'browser-results.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
} finally {await browser?.close();await new Promise(done=>server.close(done));}
