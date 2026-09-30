import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import assert from "node:assert/strict";
import Handlebars from "handlebars";
import { chromium } from "@playwright/test";
const root=resolve(".");
const compiled=Handlebars.precompile(await readFile("templates/support.hbs","utf8"));
const html=`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/styles/support.css"><style>body{font:16px system-ui;background:#14242e;color:#13232c;margin:20px}.application{max-width:920px;margin:auto;background:#f3f0e6;max-height:90vh;display:flex;flex-direction:column;border:2px solid #526568;border-radius:12px}.window-content{min-height:0;display:flex;flex-direction:column}button,input,select{font:inherit}a{color:#264f68}</style></head><body><script src="/handlebars.js"></script><script>Handlebars.templates={support:Handlebars.template(${compiled})};</script><script type="module" src="/tests/fixtures/support-browser.mjs"></script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://localhost");
  if(url.pathname==="/"){res.setHeader("Content-Type","text/html");return res.end(html);}
  if(url.pathname==="/handlebars.js"){res.setHeader("Content-Type","text/javascript");return res.end(await readFile("node_modules/handlebars/dist/handlebars.runtime.min.js"));}
  const path=resolve(root,decodeURIComponent(url.pathname).slice(1));
  if(!path.startsWith(root+sep)||!/^\/(src|styles|tests\/fixtures)\//.test(url.pathname))throw Error("Outside fixture");
  res.setHeader("Content-Type",path.endsWith(".mjs")?"text/javascript":"text/css");res.end(await readFile(path));
 }catch{res.statusCode=404;res.end("Missing");}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1040,height:1100}}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole("heading",{name:"Start here"}).waitFor();
 assert.equal(await page.locator('[name="actorId"] option').count(),2);
 assert.equal(await page.getByText("Secret actor",{exact:true}).count(),0);
 await page.getByLabel("Actor",{exact:true}).selectOption("hero");
 await page.getByRole("heading",{name:/Leadership focus/}).waitFor();
 await page.getByLabel("Find an effect").fill("situational");
 await page.getByLabel("Find an effect").press("Enter");
 await page.getByRole("heading",{name:/Situational ability/}).waitFor();
 assert.equal(await page.getByRole("heading",{name:/Leadership focus/}).count(),0);
 await page.getByLabel("Find an effect").fill("");
 await page.getByRole("button",{name:"Refresh coverage"}).click();
 await page.getByLabel("Status",{exact:true}).selectOption("choice");
 await page.getByRole("heading",{name:/Chosen modifier/}).waitFor();
 assert.equal(await page.getByRole("heading",{name:/Situational ability/}).count(),0);
 await page.getByLabel("Status",{exact:true}).selectOption("");
 await page.getByRole("heading",{name:/Leadership focus/}).waitFor();
 const [download]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:"Download diagnostic JSON"}).click()]);
 assert.equal(download.suggestedFilename(),"star-wars-ffg-diagnostics.json");
 const stream=await download.createReadStream();let json="";for await(const chunk of stream)json+=chunk;
 const diagnostic=JSON.parse(json);assert.equal(diagnostic.counts.actors,2);assert.ok(!json.includes("Mira"));
 await page.evaluate(async()=>{fixture.actor.name='<img src=x onerror="window.injected=true">';await fixture.app.render();});
 assert.equal(await page.locator("img").count(),0);assert.equal(await page.evaluate(()=>globalThis.injected),undefined);
 await page.evaluate(async()=>{fixture.actor.name="Mira";await fixture.app.render();});
 await page.setViewportSize({width:560,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator(".sf-support-content").evaluate(el=>el.scrollTop=0);
 const artifacts=process.env.TEST_ARTIFACTS_DIR || ".local/support";
 await mkdir(artifacts,{recursive:true});
 await page.screenshot({path:resolve(artifacts,"help-coverage.png")});
 await page.setViewportSize({width:1040,height:900});
 await page.getByRole("heading",{name:"Learned talent and signature effects",exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(artifacts,"learned-effects.png")});
 assert.deepEqual(errors,[]);
 console.log("Support browser fixture passed: actor privacy, keyboard search, status filtering, diagnostic download, escaped content and narrow layout. Native Foundry remains a separate acceptance gate.");
}finally{await browser?.close();await new Promise(r=>server.close(r));}
