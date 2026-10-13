import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createContentReview} from '../scripts/content-review-policy.mjs';
import {contentReviewPage} from '../scripts/content-review-page.mjs';

const encode=value=>new TextEncoder().encode(value);
const template='<p>{{localize "SWFFG.Close"}} {{actor.name}}</p>{{#if permitted}}Owner copy{{else}}Observer copy{{/if}}<button onclick="globalThis.previewCompromised=true">Confirm copy</button><script>globalThis.previewCompromised=true</script><img src="https://example.invalid/image" onerror="globalThis.previewCompromised=true" alt="Portrait"><iframe src="https://example.invalid/frame"></iframe><a href="https://example.invalid/link">Source link</a><svg onload="globalThis.previewCompromised=true"><text>Injected SVG</text></svg>';
const review=createContentReview({
 'system.json':encode(JSON.stringify({id:'star-wars-ffg',version:'0.4.2',title:'Review test',description:'Review test',languages:[{lang:'en',path:'lang/en.json'}]})),
 'lang/en.json':encode('{"SWFFG.Close":"Close"}'),
 'CHANGELOG.md':encode('# Changelog\n\nTechnical implementation history.'),
 'src/selector.mjs':encode('root.querySelector(".sf-control");'),
 'src/format.mjs':encode('export const ADVANCEMENT_FORMAT="star-wars-ffg-advancement-trees";'),
 'data/advancement-trees.json':encode(JSON.stringify({format:'star-wars-ffg-advancement-trees',items:[{_id:'14b710c863b5df75',name:'Investigator',description:'Choose a route.'}]})),
 'templates/example.hbs':encode(template),
 'README.md':encode('# Review guide\n\nRead **carefully** with `source` beside the preview.\n\n- First item\n- Second item\n\n| Label | Detail |\n| --- | --- |\n| Row | Row detail |\n\n```html\n<button>Example copy</button>\n```'),
},{archiveSha256:'f'.repeat(64)});
const html=contentReviewPage(review),server=createServer((request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
const errors=[],externalRequests=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{if(route.request().url().startsWith(url))return route.continue();externalRequests.push(route.request().url());return route.abort();});
 await page.goto(url);await page.locator('#category').selectOption('Complete interface templates');
 assert.match(await page.locator('h1').first().innerText(),/Foundry Beta/);
 await page.locator('#review-lane').selectOption('prepared');
 assert.equal(await page.locator('#entries > article[data-review-lane="maintenance"]').count(),0);
 await page.locator('#category').selectOption('English interface');
 assert.equal(await page.locator('#review-lane').inputValue(),'prepared','category selection must not silently widen the review purpose');
 const metadataScope=JSON.stringify(['data/advancement-trees.json','Reference data and source metadata']);
 assert.equal(await page.locator('#scope option').evaluateAll((options,id)=>options.filter(option=>option.value===id).length,metadataScope),0,'technical/reference source is absent from the prepared-copy selector');
 await page.locator('#review-lane').selectOption('rights');await page.locator('#scope').selectOption(metadataScope);
 assert.equal(await page.locator('#review-lane').inputValue(),'rights','source selection must preserve the permission view');
 assert.ok(await page.locator('#entries > article[data-review-mode="source-index"]').count()>0);
 assert.equal(await page.locator('#entries select[aria-label^="Decision for "]').count(),0,'permissions are recorded per source, not per metadata value');
 await page.getByRole('button',{name:'Inspect source records',exact:true}).click();
 for(const text of ['star-wars-ffg-advancement-trees','14b710c863b5df75'])assert.ok(await page.locator('#entries .source-pane pre').filter({hasText:text}).count()>0);
 assert.equal(await page.locator('#entries select[aria-label^="Decision for "]').count(),0);
 assert.equal(await page.locator('#entries textarea[aria-label^="Evidence for "]').count(),0);
 assert.equal(await page.locator('#entries textarea[aria-label^="Replacement for "]').count(),0);
 const metadataOutput=resolve(process.env.TEST_ARTIFACTS_DIR??'test-results/content-review-ui');await mkdir(metadataOutput,{recursive:true});
 await page.locator('#entries').screenshot({path:join(metadataOutput,'metadata-audit-read-only.png')});
 await page.locator('#review-lane').selectOption('maintenance');
 assert.ok(await page.getByText('# Changelog\n\nTechnical implementation history.',{exact:true}).count()>0);
 assert.ok(await page.getByText('.sf-control',{exact:true}).count()>0);
 await page.locator('#review-lane').selectOption('prepared');await page.locator('#category').selectOption('Complete interface templates');
 const source=page.locator('.source-pane'),preview=page.locator('.reading-preview');
 assert.equal(await source.locator('pre').textContent(),template);
 assert.match(await preview.innerText(),/Close \[actor\.name\]/);assert.match(await preview.innerText(),/Owner copy/);assert.match(await preview.innerText(),/Observer copy/);
 assert.equal(await preview.locator('button').textContent(),'Confirm copy');assert.equal(await preview.locator('button').isDisabled(),true);
 assert.equal(await preview.locator('script,img,iframe,svg,[onclick],[onerror],[src],[href],[style]').count(),0);
 assert.equal(await page.evaluate(()=>globalThis.previewCompromised),undefined);
 assert.deepEqual(externalRequests,[]);
 await preview.getByText('Source link',{exact:true}).click();assert.ok(page.url().startsWith(url));
 const left=await source.boundingBox(),right=await page.locator('.reading-preview-pane').boundingBox();assert.ok(right.x>left.x+left.width,'desktop panes are side by side');
 await page.locator('#view-mode').selectOption('rendered');assert.equal(await source.isVisible(),false);assert.equal(await preview.isVisible(),true);
 await page.locator('#view-mode').selectOption('source');assert.equal(await source.isVisible(),true);assert.equal(await preview.isVisible(),false);
 await page.locator('#view-mode').selectOption('both');
 await page.locator('#review-lane').selectOption('maintenance');await page.locator('#category').selectOption('Documentation');
 await page.locator('#search').fill('README.md');
 assert.equal(await preview.locator('h1').innerText(),'Review guide');assert.equal(await preview.locator('strong').innerText(),'carefully');
 assert.equal(await preview.locator('li').count(),2);assert.equal(await preview.locator('tbody td').last().innerText(),'Row detail');
 assert.equal(await preview.getByRole('button',{name:'Example copy'}).isDisabled(),true);
 await page.locator('#search').fill('');
 await page.locator('#review-lane').selectOption('prepared');await page.locator('#category').selectOption('English interface');assert.equal(await preview.innerText(),'Close');
 await page.locator('#category').selectOption('Complete interface templates');
 await page.setViewportSize({width:520,height:900});
  await page.addStyleTag({content:'body{font-family:monospace}'});
 const above=await source.boundingBox(),below=await page.locator('.reading-preview-pane').boundingBox();assert.ok(below.y>=above.y+above.height,'narrow panes stack');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 // Reproduce a legacy draft that the old export rejected. The same storage key must survive.
 const word=review.entries.find(entry=>entry.category==='English interface');
 const changelog=review.entries.find(entry=>entry.occurrences.some(source=>source.path==='CHANGELOG.md'));
 const legacy={schemaVersion:1,archiveSha256:review.archiveSha256,reviewer:'The User',listingText:'Human-written listing saved before the export fix.',
   entries:{[word.id]:{decision:'human-origin',evidence:'',replacement:'Original unfinished replacement'},[changelog.id]:{decision:'human-origin',evidence:'',replacement:''},...Object.fromEntries(review.entries.filter(entry=>['star-wars-ffg-advancement-trees','14b710c863b5df75','Investigator'].includes(entry.text)).map(entry=>[entry.id,{decision:'human-origin',evidence:'',replacement:'Legacy metadata answer retained'}]))},
   humanGates:Object.fromEntries(review.humanGates.map(gate=>[gate.id,gate.id==='maintainability'?'correct':'complete'])),submissionReady:true};
 await page.evaluate(draft=>localStorage.setItem('star-wars-ffg.review.'+draft.archiveSha256,JSON.stringify(draft)),legacy);
 await page.reload();
 assert.equal(await page.locator('#reviewer').inputValue(),legacy.reviewer);
 assert.equal(await page.locator('#listing').inputValue(),legacy.listingText);
 for(const gate of review.humanGates)assert.equal(await page.getByLabel(gate.title,{exact:true}).inputValue(),legacy.humanGates[gate.id]);
 const download=async name=>{const event=page.waitForEvent('download');await page.locator('#export').click();const file=await event;
   const path=resolve(process.env.TEST_ARTIFACTS_DIR??'test-results/content-review-ui',name);await mkdir(resolve(path,'..'),{recursive:true});await file.saveAs(path);
   return JSON.parse(await (await import('node:fs/promises')).readFile(path,'utf8'));};
 const draft=await download('unfinished-draft.json');
 assert.equal(draft.submissionReady,false);assert.equal(draft.exportKind,'draft');assert.equal(draft.releasePhase,'Beta');assert.equal(draft.listingText,legacy.listingText);
 assert.deepEqual(draft.humanGates,legacy.humanGates);assert.deepEqual(draft.entries,legacy.entries);
 assert.equal(draft.reviewIssues.length,1,'changelog does not require prepared-copy authorship evidence');assert.equal(draft.reviewIssues[0].entryId,word.id);assert.match(draft.reviewIssues[0].message,/lang\/en\.json.*evidence/);
 await page.getByRole('button',{name:'Show affected record',exact:true}).click();
 assert.equal(await page.locator('#entries > article').count(),1);assert.equal(await page.getByLabel('Decision for '+word.id,{exact:true}).inputValue(),'human-origin');
 const scope=JSON.stringify(['lang/en.json','English interface']);
 await page.locator('#scope').selectOption(scope);await page.locator('#scope-evidence').fill('Original human-authored catalogue retained in contributor history; this source note covers its interface labels.');
 await page.locator('#record-scope').click();await page.locator('#check-review').click();
 assert.match(await page.locator('#issues').innerText(),/No incomplete changed decisions/);
 const shared=await download('shared-source-evidence.json');
 assert.deepEqual(shared.entries,legacy.entries,'source evidence does not overwrite individual decisions or replacements');
 assert.equal(shared.scopeReviews[scope].state,'evidence-recorded');assert.equal(shared.reviewIssues.length,0);assert.equal(shared.submissionReady,false);
 await page.locator('#import').setInputFiles({name:'different-archive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...draft,archiveSha256:'e'.repeat(64)}))});
 await page.locator('#message').filter({hasText:/different archive/}).waitFor();
 assert.match(await page.locator('#message').innerText(),/different archive/);assert.equal(await page.locator('#listing').inputValue(),legacy.listingText);
 await page.locator('#import').setInputFiles({name:'unfinished-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(draft))});
 await page.locator('#message').filter({hasText:/Matching draft imported/}).waitFor();
 assert.match(await page.locator('#message').innerText(),/Matching draft imported/);
 assert.ok(await page.evaluate(hash=>localStorage.getItem('star-wars-ffg.review.'+hash+'.before-import'),review.archiveSha256));
 await page.reload();assert.equal(await page.locator('#listing').inputValue(),legacy.listingText);
 await page.locator('#reviewer').fill('');const anonymous=await download('draft-without-reviewer.json');
 assert.match(anonymous.reviewIssues[0].message,/reviewer identity/);assert.equal(anonymous.entries[word.id].replacement,legacy.entries[word.id].replacement);
 await page.locator('#category').selectOption('Complete interface templates');
 assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
 const output=resolve(process.env.TEST_ARTIFACTS_DIR??'test-results/content-review-ui');await mkdir(output,{recursive:true});
 await page.setViewportSize({width:1440,height:1000});await page.locator('.review-views').screenshot({path:join(output,'source-and-rendered.png')});
 await writeFile(join(output,'results.json'),JSON.stringify({passed:true,checks:['exact source preserved','translated template labels','visible dynamic placeholders and both conditional branches','inert markup without network requests','source/rendered/both controls','Markdown headings/emphasis/lists/tables/code examples','plain interface text','responsive stacked panes','legacy draft answers and unfinished decisions survive reload','draft export without per-record evidence or reviewer','actionable missing-evidence links','shared source evidence preserves per-entry exceptions','wrong archive rejected without data loss','unfinished draft import and previous-draft backup','zero page errors']},null,2)+'\n');
 console.log('Content review passed inert previews, legacy draft export, missing-evidence navigation, shared source evidence and import preservation.');
} finally {await browser.close();await new Promise(ok=>server.close(ok));}
