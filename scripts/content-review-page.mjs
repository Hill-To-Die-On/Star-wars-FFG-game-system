import {readingPreviewModel,appendReadingPreview} from './content-review-preview.mjs';
import {reviewScopes,normalizeReviewDraft,reviewDraftIssues,reviewRecordLane,isTechnicalReviewField,isShortInterfaceLabel,reviewLabelGroup,hasIndividualLabelException,restoreStoredReviewDraft,reviewTextGroups,reviewGroupState,reviewEntryAnswer} from './content-review-workflow.mjs';

/** Self-contained local review UI. Previews copy only inert reading elements. */
export function contentReviewPage(review) {
  const phase=['Alpha','Beta'].includes(review.releasePhase)?review.releasePhase:'Beta';
  const data=JSON.stringify(review).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${phase} content review</title>
<style>body{font:16px/1.5 system-ui;max-width:1150px;margin:32px auto;padding:0 20px;color:#172337;background:#f4f6fa}h1{font-size:30px}section,article{background:white;border:1px solid #cad3e0;padding:20px;margin:16px 0;border-radius:8px}label{display:block;font-weight:600;margin:12px 0 4px}input,select,textarea,button{font:inherit;padding:8px;max-width:100%;box-sizing:border-box}input,textarea{width:100%}textarea{min-height:70px}button{cursor:pointer;margin:5px;border:1px solid #66788f;background:#eaf0f8;border-radius:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6fa;padding:12px;font:14px/1.5 ui-monospace,monospace;max-height:500px;overflow:auto}code{overflow-wrap:anywhere}summary{cursor:pointer}small{color:#45566f}.toolbar{position:sticky;top:0;background:#f4f6fa;padding:12px 0;z-index:2}.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.row>*{flex:1}#message{color:#9d251f;font-weight:600}.muted{color:#45566f}</style>
<style>body{max-width:1380px;overflow-wrap:anywhere}.toolbar .row>*{flex:1 1 200px;min-width:0}.review-views{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:16px}.review-views>div{min-width:0}.review-views h4{margin:0 0 8px;font-size:15px}.review-views pre{margin:0;max-height:480px}.reading-preview{border:1px solid #cad3e0;border-radius:4px;padding:16px;background:#fff;max-height:480px;overflow:auto;overflow-wrap:anywhere;box-sizing:border-box}.reading-preview h1{font-size:26px}.reading-preview h2{font-size:22px}.reading-preview h3{font-size:19px}.reading-preview :first-child{margin-top:0}.reading-preview p{margin:8px 0}.reading-preview a{color:#245b99;text-decoration:underline}.reading-preview input,.reading-preview textarea,.reading-preview select,.reading-preview button{margin:4px;max-width:100%;opacity:1;color:#172337}.reading-preview input[type=checkbox],.reading-preview input[type=radio]{width:auto}.reading-preview table{border-collapse:collapse;width:100%;margin:12px 0}.reading-preview th,.reading-preview td{border:1px solid #cad3e0;text-align:left;padding:7px}.reading-preview blockquote{margin:8px 0;padding:8px 12px;border-left:3px solid #8295ad}.reading-preview fieldset{min-width:0;margin:8px 0;border:1px solid #cad3e0}.reading-preview details{margin:8px 0}.reading-preview pre{margin:8px 0}.reading-plain{white-space:pre-wrap}.reading-condition{display:block;margin:6px 0;padding:3px 7px;background:#edf1f6;border-left:2px solid #8295ad}.reading-example{padding:12px;border:1px dashed #8295ad;margin:10px 0}.reading-example>small{display:block;margin-bottom:8px}.preview-note{display:block;margin-top:8px}.view-source .reading-preview-pane,.view-rendered .source-pane{display:none}.view-source .review-views,.view-rendered .review-views{grid-template-columns:minmax(0,1fr)}@media(max-width:800px){.review-views{grid-template-columns:minmax(0,1fr)}} </style>
<h1>Foundry ${phase}: human review packet</h1><p id="phase-note" class="muted"></p>
<p id="identity"></p><p><strong>This inventory is not a row-by-row approval checklist.</strong> Single- and two-word interface labels share one review statement below. Record source evidence for other copy, then use individual decisions for exceptions or replacements. Ordinary code and configuration fall under the code-maintenance attestation. A review cannot turn AI-origin prepared copy into human-authored copy. Read the <a href="https://foundryvtt.com/article/ai-policy/">current Foundry policy</a>.</p>
<p>The default authorship queue contains prepared in-module and listing text. Code, configuration, the changelog and technical package documentation follow the maintenance attestation in section 4.4 of the policy; they do not require prepared-copy authorship assessment. Reference metadata and licences have a separate rights review. Promotional copy remains prepared content wherever it is used. The complete ZIP inventory stays available, including every file hash, source occurrence and previous answer.</p>
<section><h2>Reviewer and final listing</h2><label for="reviewer">Reviewer</label><input id="reviewer" placeholder="Name or accountable identity"><label for="listing">Human-written Foundry listing description</label><textarea id="listing" placeholder="The User writes the final description here. No generated listing copy is supplied."></textarea><p class="muted">Facts to cover: free ${phase}; Foundry 14 (tested 14.368); English only; backups required; GM adjudication remains necessary; books are required; independent and unofficial; optional modules are separate. The current public release is 0.3.0 until a reviewed candidate is published.</p><h2>Human gates</h2><div id="gates"></div><button id="export">Export review JSON</button><button id="check-review">Check recorded decisions</button><label for="import">Import an earlier review JSON for this exact ZIP</label><input id="import" type="file" accept="application/json"><p id="message" role="status"></p><div id="issues" aria-live="polite"></div><small>Export saves an unfinished draft, including every answer and any missing-evidence notes. Pending inventory records do not block export. Work is saved locally in this browser when storage is available; nothing is uploaded. submissionReady remains false until a separate release review.</small></section>
<section><h2>Shared evidence by source</h2><p>One evidence note can cover a source file and category. For example, record the permission for a reference dataset once, or identify the original human-written interface catalogue. Individual exceptions remain unchanged. This records an account of the source; it does not mark every contained string human-authored or certify submission readiness.</p><label for="scope">Source file and category</label><select id="scope"><option value="">All inventory records — choose a source to record shared evidence</option></select><p id="scope-help" class="muted"></p><label for="scope-evidence">Authorship, permission or maintenance evidence for this source</label><textarea id="scope-evidence" disabled></textarea><button id="record-scope" disabled>Record source evidence</button><p id="scope-status"></p></section>
<section id="short-label-review"><h2>Single- and two-word interface labels</h2><p id="short-label-count"></p><p>Record one shared statement of the human source or creation history for the listed labels. Existing individual decisions and replacements are retained. The statement covers this exact list; it does not approve longer text or establish human authorship through review alone.</p><label for="short-label-evidence">Shared review statement for these labels</label><textarea id="short-label-evidence" placeholder="Record the human source or creation history for the included labels, and note any exceptions."></textarea><button id="record-short-labels">Record shared label review</button><p id="short-label-status" role="status"></p><details id="short-label-members"><summary>Inspect the included labels and their sources</summary><label for="short-label-search">Search included labels and sources</label><input id="short-label-search" type="search"><p id="short-label-list-count"></p><button id="short-label-previous">Previous 40 labels</button><button id="short-label-next">Next 40 labels</button><div id="short-label-list"></div></details></section>
<p><strong>Scan and flag exceptions.</strong> Human-origin is preselected for text without a saved decision. Change a questionable entry to <strong>Needs review</strong>; existing flags and replacements stay unchanged. A default selection is not completed sign-off. Identical wording appears once, with all source locations retained. Source and rendered views remain available.</p>
<div class="toolbar"><div class="row"><select id="review-lane" aria-label="Review purpose"><option value="prepared">Prepared in-module and listing text</option><option value="maintenance">Code, docs and machine metadata — audit</option><option value="rights">Dataset and asset permissions — by source</option><option value="all">Complete audit inventory</option></select><input id="search" type="search" aria-label="Search text and source paths" placeholder="Search exact text, path or location"><select id="category" aria-label="Category"><option value="">All categories</option></select><select id="state" aria-label="Review state"><option value="">All review states</option><option value="pending">Needs review</option><option>human-origin</option><option>third-party-rights</option><option>technical-only</option><option>rewrite-required</option></select><select id="view-mode" aria-label="Source and rendered view"><option value="both">Source and rendered</option><option value="rendered" selected>Rendered only</option><option value="source">Source only</option></select></div><label><input id="show-label-records" type="checkbox" style="width:auto"> Show individual short labels for exceptions</label><p id="counts" aria-live="polite"></p><button id="previous">Previous 40</button><button id="next">Next 40</button></div><main id="entries" class="view-rendered"></main><section><h2>Complete file coverage</h2><details><summary id="file-count"></summary><pre id="files"></pre></details></section>
<script type="application/json" id="review-data">${data}</script><script>
const readingPreviewModel=${readingPreviewModel.toString()};
const appendReadingPreview=${appendReadingPreview.toString()};
const reviewScopes=${reviewScopes.toString()};
const normalizeReviewDraft=${normalizeReviewDraft.toString()};
const reviewDraftIssues=${reviewDraftIssues.toString()};
const reviewRecordLane=${reviewRecordLane.toString()};
const isTechnicalReviewField=${isTechnicalReviewField.toString()};
const isShortInterfaceLabel=${isShortInterfaceLabel.toString()};
const reviewLabelGroup=${reviewLabelGroup.toString()};
const hasIndividualLabelException=${hasIndividualLabelException.toString()};
const restoreStoredReviewDraft=${restoreStoredReviewDraft.toString()};
const reviewTextGroups=${reviewTextGroups.toString()};
const reviewGroupState=${reviewGroupState.toString()};
const reviewEntryAnswer=${reviewEntryAnswer.toString()};
const review=JSON.parse(document.getElementById('review-data').textContent),key='star-wars-ffg.review.'+review.archiveSha256,$=id=>document.getElementById(id),allowed=new Set(['pending','human-origin','third-party-rights','technical-only','rewrite-required']);
const scopes=reviewScopes(review),scopeMap=new Map(scopes.map(scope=>[scope.id,scope]));
const lanes=new Map(review.entries.map(entry=>[entry.id,reviewRecordLane(entry)]));
const labelGroup=reviewLabelGroup(review),labelIds=new Set(labelGroup.entryIds),labelEntries=review.entries.filter(entry=>labelIds.has(entry.id));
const textGroups=reviewTextGroups(review.entries),textGroupByEntry=new Map(textGroups.flatMap(group=>group.entryIds.map(id=>[id,group]))),labelTextGroups=reviewTextGroups(labelEntries);
const localizations={};for(const entry of review.entries.filter(entry=>entry.category==='English interface'))for(const occurrence of entry.occurrences)if(occurrence.path==='lang/en.json')localizations[occurrence.location.slice(1).replace(/~1/g,'/').replace(/~0/g,'~')]=entry.text;
let saved={schemaVersion:1,archiveSha256:review.archiveSha256,reviewer:'',listingText:'',entries:{},scopeReviews:{},humanGates:{},labelReview:{state:'pending',reviewer:'',evidence:'',entryIds:labelGroup.entryIds},defaultDecision:'human-origin',defaultSelectionIsSignOff:false,submissionReady:false},offset=0,labelOffset=0,filtered=[],focusEntry=null,individualEntry=null;
try{const previous=localStorage.getItem(key);if(previous){const restored=restoreStoredReviewDraft(review,JSON.parse(previous));saved=restored.draft;if(restored.coverageChanged){try{localStorage.setItem(key+'.before-label-bundle-update',previous);}catch{}$('message').textContent='The short-label list expanded. Existing answers and the earlier statement were retained; inspect the expanded list and record the shared statement again. Its evidence remains a draft until then.';}}}catch(error){$('message').textContent=error.message;}
function save(){saved.reviewer=$('reviewer').value;saved.listingText=$('listing').value;saved.submissionReady=false;try{localStorage.setItem(key,JSON.stringify(saved));}catch{$('message').textContent='Browser storage unavailable. Export review JSON to retain decisions.';}}
function node(tag,text,parent){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(parent)parent.append(element);return element;}
function appendViews(article,entry){const views=node('div',undefined,article);views.className='review-views';const source=node('div',undefined,views);source.className='source-pane';node('h4','Source',source);node('pre',entry.text,source);const pane=node('div',undefined,views);pane.className='reading-preview-pane';node('h4','Rendered reading view',pane);const preview=node('div',undefined,pane);preview.className='reading-preview';appendReadingPreview(preview,entry,localizations);if(preview.dataset.placeholders)node('small','Brackets mark dynamic values. Conditional branches are shown together.',pane).className='preview-note';}
function setup(){ $('reviewer').value=saved.reviewer||'';$('listing').value=saved.listingText||'';$('gates').replaceChildren();for(const gate of review.humanGates){const label=node('label',gate.title,$('gates'));const input=node('textarea',undefined,$('gates'));input.setAttribute('aria-label',gate.title);input.placeholder='Pending: record the human reviewer, evidence and conclusion.';input.value=saved.humanGates?.[gate.id]||'';input.oninput=()=>{saved.humanGates??={};saved.humanGates[gate.id]=input.value;save();};}setupLabelReview();showScope();render();}
function showLabelEntry(id){
  $('review-lane').value='prepared';$('category').value='';$('scope').value='';$('state').value='';$('search').value='';if(labelIds.has(id))$('show-label-records').checked=true;
  refreshFilters();focusEntry=id;individualEntry=id;offset=0;showScope();render();$('entries').scrollIntoView();
}
function showLabelStatus(){
  const value=saved.labelReview,exceptions=labelEntries.filter(entry=>hasIndividualLabelException(saved.entries[entry.id])).length;
  $('short-label-count').textContent=labelTextGroups.length+' unique label wordings ('+labelEntries.length+' source records) share this statement. '+exceptions+' individual exceptions remain in the main queue. Longer copy remains separate.';
  $('short-label-status').textContent=value?.state==='evidence-recorded'?'Shared statement recorded by '+value.reviewer+'. Existing individual answers remain unchanged.':value?.evidence?'Shared label statement saved as an unfinished draft.':'Shared label statement pending.';
}
function renderLabelMembers(){
  const query=$('short-label-search').value.toLowerCase(),members=labelTextGroups.filter(entry=>(entry.text+' '+entry.occurrences.map(source=>source.path+' '+source.location).join(' ')).toLowerCase().includes(query));
  labelOffset=Math.min(labelOffset,Math.max(0,Math.floor((members.length-1)/40)*40));
  $('short-label-list-count').textContent='Showing '+(members.length?labelOffset+1:0)+'–'+Math.min(labelOffset+40,members.length)+' of '+members.length+' matching labels.';
  $('short-label-previous').disabled=labelOffset===0;$('short-label-next').disabled=labelOffset+40>=members.length;$('short-label-list').replaceChildren();
  for(const group of members.slice(labelOffset,labelOffset+40)){
    const details=node('details',undefined,$('short-label-list'));node('summary',group.text,details).className='label-wording';
    node('p',group.entries.length+' source records; '+group.occurrences.length+' source occurrences.',details);
    node('pre',group.occurrences.map(source=>source.category+' — '+source.path+' — '+source.location).join(String.fromCharCode(10)),details);
    for(const entry of group.entries){
      node('p',entry.category+' — '+entry.occurrences[0].path,details);
      const previous=saved.entries[entry.id];if(previous)node('pre','Previously saved answer: '+JSON.stringify(previous,null,2),details);
      const button=node('button','Edit individual exception',details);button.setAttribute('aria-label','Edit individual exception for '+entry.id);button.onclick=()=>showLabelEntry(entry.id);
    }
  }
}
function setupLabelReview(){
  $('short-label-review').hidden=!labelEntries.length;$('short-label-evidence').value=saved.labelReview?.evidence||'';showLabelStatus();renderLabelMembers();
}
function showScope(){
  const scope=scopeMap.get($('scope').value),value=saved.scopeReviews?.[scope?.id];
  const prepared=scope?scope.entryIds.filter(id=>lanes.get(id)==='prepared').length:0,rights=scope?.entryIds.some(id=>lanes.get(id)==='rights');
  const canRecord=scope&&$('review-lane').value!=='maintenance'&&(prepared||rights);
  $('scope-evidence').disabled=!canRecord;$('record-scope').disabled=!canRecord;$('scope-evidence').value=value?.evidence||'';
  $('scope-help').textContent=!scope?'Optional source-level detail. The human gates above can cover a whole dataset.':prepared?prepared+' candidate copy records in this source. Code and machine metadata are excluded from individual authorship review.':rights?'Record permission for this source or dataset once; individual IDs and names are not separate review tasks.':'Technical source audit only. No individual authorship review is requested; use the maintenance gate above.';
  $('scope-status').textContent=value?.state==='evidence-recorded'?'Source evidence recorded by '+value.reviewer+'. Previous answers remain unchanged.':value?.evidence?'Source note retained as a draft.':'';
}
function refreshFilters(){
  const lane=$('review-lane').value,category=$('category').value,source=$('scope').value;
  const visible=review.entries.filter(entry=>lane==='all'||lanes.get(entry.id)===lane),ids=new Set(visible.map(entry=>entry.id));
  $('category').replaceChildren();node('option','All categories for this view',$('category')).value='';
  for(const name of [...new Set(visible.map(entry=>entry.category))])node('option',name,$('category')).value=name;
  $('category').value=[...$('category').options].some(option=>option.value===category)?category:'';
  $('scope').replaceChildren();node('option','All sources for this view',$('scope')).value='';
  for(const scope of scopes){const count=scope.entryIds.filter(id=>ids.has(id)).length;if(count)node('option',scope.path+' — '+scope.category+' ('+count+' values in this view)',$('scope')).value=scope.id;}
  $('scope').value=[...$('scope').options].some(option=>option.value===source)?source:'';
  $('state').disabled=lane!=='prepared';
}
function appendIndividualReview(article,entry){
  if(labelIds.has(entry.id)&&!$('show-label-records').checked&&focusEntry!==entry.id&&!hasIndividualLabelException(saved.entries[entry.id])){
    article.dataset.reviewMode='grouped-label';node('p','Included in the shared single- and two-word label statement above.',article).className='muted';
    const previous=saved.entries[entry.id];if(previous){const details=node('details',undefined,article);node('summary','Previously saved answer — retained in the export',details);node('pre',JSON.stringify(previous,null,2),details);}
    const edit=node('button','Edit individual exception',article);edit.onclick=()=>showLabelEntry(entry.id);return;
  }
  if(lanes.get(entry.id)!=='prepared'){
    node('p','Audit only. No individual authorship decision or replacement is required for this record.',article).className='muted';
    const previous=saved.entries[entry.id];
    if(previous){const details=node('details',undefined,article);node('summary','Previously saved answer — retained in the export',details);node('pre',JSON.stringify(previous,null,2),details);}
    return;
  }
  appendReviewForm(article,entry,reviewEntryAnswer(entry.id,saved.entries),[entry.id]);
}
function appendReviewForm(article,entry,value,targetIds){
  node('label',targetIds.length>1?'Decision for these identical prepared copies':'Decision — change to Needs review to flag an exception',article);const select=node('select',undefined,article);
  select.setAttribute('aria-label','Decision for '+entry.id);
  for(const option of allowed)node('option',option==='pending'?'Needs review':option,select).value=option;
  select.value=value.decision;
  const notes=node('details',undefined,article);notes.className='review-notes';notes.open=value.decision!=='human-origin'||Boolean(value.replacement.trim());node('summary','Review notes or replacement (optional)',notes);
  node('label','Shared provenance or exception note',notes);const evidence=node('textarea',undefined,notes);
  evidence.value=value.evidence;evidence.setAttribute('aria-label','Evidence for '+entry.id);
  node('label','Independently human-written replacement, if needed',notes);const replacement=node('textarea',undefined,notes);
  replacement.value=value.replacement;replacement.setAttribute('aria-label','Replacement for '+entry.id);
  const change=()=>{for(const id of targetIds)saved.entries[id]={decision:select.value,evidence:evidence.value,replacement:replacement.value};if(select.value!=='human-origin'||replacement.value.trim())notes.open=true;save();showLabelStatus();};
  select.onchange=change;evidence.oninput=change;replacement.oninput=change;
}
function appendGroupedReview(article,group){
  const lane=$('review-lane').value;
  const prepared=(lane==='prepared'||lane==='all')?group.entries.filter(entry=>lanes.get(entry.id)==='prepared'&&(!individualEntry||entry.id===individualEntry)&&(!labelIds.has(entry.id)||$('show-label-records').checked||focusEntry===entry.id||hasIndividualLabelException(saved.entries[entry.id]))):[];
  const readonly=group.entries.filter(entry=>lanes.get(entry.id)!=='prepared');
  if(readonly.some(entry=>saved.entries[entry.id])){
    const history=node('details',undefined,article);node('summary','Saved answers for audit-only sources — retained unchanged',history);
    for(const entry of readonly)if(saved.entries[entry.id])node('pre',entry.category+' — '+entry.occurrences[0].path+String.fromCharCode(10)+JSON.stringify(saved.entries[entry.id],null,2),history);
  }
  if(!prepared.length){
    node('p',group.entries.some(entry=>labelIds.has(entry.id))?'This wording is included in the shared short-label statement above.':'Audit only. No individual authorship decision is requested.',article).className='muted';
    for(const entry of group.entries)if(saved.entries[entry.id]&&lanes.get(entry.id)==='prepared'){
      const history=node('details',undefined,article);node('summary','Saved answer — '+entry.category,history);node('pre',JSON.stringify(saved.entries[entry.id],null,2),history);
    }
    return;
  }
  if(prepared.length===1){appendIndividualReview(article,prepared[0]);}
  else{
    const state=reviewGroupState({...group,entries:prepared},saved.entries);
    if(state.targetIds.length){
      node('p','Shared changes apply to '+state.targetIds.length+' identical prepared source records. Original IDs are retained; audit-only sources are not changed.',article).className='muted';
      appendReviewForm(article,prepared.find(entry=>entry.id===state.targetIds[0]),state.value,state.targetIds);
    }
    if(state.conflicts.length){
      article.dataset.reviewConflicts='true';node('p','Saved answers differ or include individual flags. These source exceptions are retained separately.',article);
      const exceptions=node('details',undefined,article);exceptions.open=true;node('summary','Existing source exceptions ('+state.conflicts.length+')',exceptions);
      for(const entry of state.conflicts){const section=node('section',undefined,exceptions);node('h4',entry.category+' — '+entry.occurrences[0].path,section);appendReviewForm(section,entry,reviewEntryAnswer(entry.id,saved.entries),[entry.id]);}
    }
  }
  if(group.entries.filter(entry=>lanes.get(entry.id)==='prepared').length>1){
    const exceptions=node('details',undefined,article);node('summary','Edit one source as an individual exception',exceptions);
    for(const entry of group.entries.filter(entry=>lanes.get(entry.id)==='prepared')){const button=node('button',entry.category+' — '+entry.occurrences[0].path,exceptions);button.setAttribute('aria-label','Edit source exception for '+entry.id);button.onclick=()=>showLabelEntry(entry.id);}
  }
}
function render(){
  const query=$('search').value.toLowerCase(),lane=$('review-lane').value,scope=scopeMap.get($('scope').value),scopeIds=scope?new Set(scope.entryIds):null;
  filtered=review.entries.filter(entry=>(lane==='all'||lanes.get(entry.id)===lane)&&(!focusEntry||entry.id===focusEntry)&&(!scopeIds||scopeIds.has(entry.id))&&(!$('category').value||entry.category===$('category').value)&&(!$('state').value||(lanes.get(entry.id)==='prepared'&&reviewEntryAnswer(entry.id,saved.entries).decision===$('state').value))&&(lane!=='prepared'||!labelIds.has(entry.id)||$('show-label-records').checked||focusEntry===entry.id||hasIndividualLabelException(saved.entries[entry.id]))&&(!query||(entry.text+' '+entry.occurrences.map(source=>source.path+' '+source.location).join(' ')).toLowerCase().includes(query)));
  const matchingIds=new Set(filtered.map(entry=>entry.id)),groups=lane==='rights'?scopes.filter(source=>source.entryIds.some(id=>matchingIds.has(id))):textGroups.filter(group=>group.entryIds.some(id=>matchingIds.has(id))),items=groups;
  offset=Math.min(offset,Math.max(0,Math.floor((items.length-1)/40)*40));
  const description=lane==='rights'?'Permissions by source: '+groups.length+' sources. Use the data/asset gates above or optional source evidence; individual values are not authorship tasks.':lane==='maintenance'?'Technical audit: '+groups.length+' unique texts from '+filtered.length+' matching records. No individual authorship review is required.':lane==='all'?'Complete audit inventory: '+groups.length+' unique texts. Original records and source locations remain intact.':'Scan review: '+groups.length+' unique texts from '+filtered.length+' matching records. Human-origin is preselected; change exceptions to Needs review.';
  $('counts').textContent=description+' Showing '+(items.length?offset+1:0)+'–'+Math.min(offset+40,items.length)+' of '+items.length+'.';
  $('previous').disabled=offset===0;$('next').disabled=offset+40>=items.length;$('entries').replaceChildren();
  if(lane==='rights'){
    for(const source of groups.slice(offset,offset+40)){
      const article=node('article',undefined,$('entries'));article.dataset.reviewMode='source-index';
      node('h3',source.path,article);node('p',source.category,article);
      node('p',source.entryIds.filter(id=>matchingIds.has(id)).length+' indexed values. Permissions are handled once for this source or dataset, not separately for each name or ID.',article);
      const inspect=node('button','Inspect source records',article);inspect.onclick=()=>{
        $('review-lane').value='all';$('category').value='';$('scope').value='';$('state').value='';$('search').value='';focusEntry=null;individualEntry=null;offset=0;
        refreshFilters();$('scope').value=source.id;showScope();render();
      };
      const evidence=node('button','Add optional source evidence',article);evidence.onclick=()=>{$('scope').value=source.id;showScope();$('scope-evidence').focus();};
    }
    return;
  }
  for(const group of items.slice(offset,offset+40)){
    const matching=group.entries.filter(entry=>matchingIds.has(entry.id)),activeLane=matching.some(entry=>lanes.get(entry.id)==='prepared')?'prepared':lanes.get(matching[0].id);
    const article=node('article',undefined,$('entries'));article.dataset.reviewLane=activeLane;article.dataset.reviewMode=activeLane==='prepared'?'authorship':'audit';article.dataset.entryCount=group.entries.length;article.dataset.textSha256=group.sha256;
    node('small',group.entries.length+' source record(s) — '+group.categories.join(' / '),article);
    appendViews(article,group);const details=node('details',undefined,article);node('summary',group.occurrences.length+' source occurrence(s) across '+group.entries.length+' original records',details);
    node('pre',group.occurrences.map(source=>source.category+' — '+source.path+' — '+source.location+' — '+source.entryId).join(String.fromCharCode(10)),details);appendGroupedReview(article,group);
  }
}
function showIssues(){
  const issues=reviewDraftIssues(review,saved);$('issues').replaceChildren();
  if(!issues.length){node('p','No incomplete changed decisions found. Pending inventory records are allowed; this is not a submission approval.',$('issues'));return issues;}
  const groups=new Map();for(const issue of issues){const id=issue.entryId?textGroupByEntry.get(issue.entryId).id:issue.groupId||issue.scopeId;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(issue);}
  node('p',groups.size+' review group(s) contain '+issues.length+' source record(s) needing reviewer identity or evidence. All answers can still be exported as a draft.',$('issues'));
  const list=node('ul',undefined,$('issues'));
  for(const related of [...groups.values()].slice(0,20)){
    const issue=related[0];
    const item=node('li',issue.message,list),button=node('button',issue.groupId?'Show shared label statement':'Show affected '+(issue.entryId?'record':'source'),item);
    if(related.length>1){const details=node('details',undefined,item);node('summary',related.length+' affected source records for this exact text',details);for(const original of related)node('p',original.message,details);}
    button.onclick=()=>{
      if(issue.groupId){$('short-label-review').scrollIntoView();$('short-label-evidence').focus();return;}
      if(issue.entryId&&labelIds.has(issue.entryId)){showLabelEntry(issue.entryId);return;}
      $('review-lane').value=issue.entryId?'prepared':scopeMap.get(issue.scopeId).entryIds.some(id=>lanes.get(id)==='prepared')?'prepared':'rights';
      refreshFilters();$('scope').value=issue.scopeId||'';$('category').value='';$('search').value='';$('state').value='';focusEntry=issue.entryId||null;individualEntry=null;offset=0;showScope();render();$('entries').scrollIntoView();
    };
  }
  if(groups.size>20)node('p','The complete issue list is included in the JSON export.',$('issues'));return issues;
}
$('identity').textContent='System '+review.systemId+' '+review.version+'; archive SHA-256 '+review.archiveSha256+'; locales '+review.advertisedLocales.join(', ')+'.';$('file-count').textContent=review.files.length+' packaged files and their hashes';$('files').textContent=review.files.map(f=>f.path+' | '+f.sha256+' | '+f.review).join('\\n');
$('phase-note').textContent=review.archivePhase&&review.archivePhase.toLowerCase()!=='${phase.toLowerCase()}'?'The planned listing is ${phase}. This page preserves the earlier '+review.archivePhase+'-labelled ZIP and saved answers; release-document changes will be reconciled before publication.':'${phase} candidate for broader user testing. Publication and final acceptance remain separate.';
$('short-label-evidence').oninput=()=>{saved.labelReview={state:'pending',reviewer:'',evidence:$('short-label-evidence').value,entryIds:labelGroup.entryIds};save();showLabelStatus();};
$('record-short-labels').onclick=()=>{
  save();const evidence=$('short-label-evidence').value;
  if(!saved.reviewer.trim()||!evidence.trim()){$('message').textContent='Recording the shared label statement needs reviewer identity and one source/provenance note. Draft export remains available.';return;}
  saved.labelReview={state:'evidence-recorded',reviewer:saved.reviewer,evidence,entryIds:labelGroup.entryIds};save();showLabelStatus();renderLabelMembers();render();
  $('message').textContent='One shared label statement recorded. Existing individual decisions, exceptions and replacements were preserved.';
};
$('short-label-search').oninput=()=>{labelOffset=0;renderLabelMembers();};$('short-label-previous').onclick=()=>{labelOffset-=40;renderLabelMembers();};$('short-label-next').onclick=()=>{labelOffset+=40;renderLabelMembers();};
$('show-label-records').onchange=()=>{focusEntry=null;individualEntry=null;offset=0;render();};
$('review-lane').onchange=()=>{focusEntry=null;individualEntry=null;offset=0;$('scope').value='';$('category').value='';$('search').value='';$('state').value='';refreshFilters();showScope();render();};

$('scope').onchange=()=>{focusEntry=null;individualEntry=null;offset=0;$('category').value='';$('state').value='';$('search').value='';showScope();render();};
$('scope-evidence').oninput=()=>{const id=$('scope').value;if(!scopeMap.has(id))return;saved.scopeReviews??={};saved.scopeReviews[id]={state:'pending',reviewer:'',evidence:$('scope-evidence').value};save();$('scope-status').textContent='Source note saved as a draft.';};
$('record-scope').onclick=()=>{save();const id=$('scope').value,evidence=$('scope-evidence').value;if(!scopeMap.has(id))return;if(!saved.reviewer.trim()||!evidence.trim()){$('message').textContent='Recording source evidence needs reviewer identity and a source evidence note. Export remains available for unfinished work.';return;}saved.scopeReviews??={};saved.scopeReviews[id]={state:'evidence-recorded',reviewer:saved.reviewer,evidence};save();showScope();render();$('message').textContent='Source evidence recorded. Individual decisions and replacements were preserved.';};
$('view-mode').onchange=()=>{$('entries').className='view-'+$('view-mode').value;};for(const id of ['search','category','state'])$(id).oninput=()=>{focusEntry=null;individualEntry=null;if(id==='category'){$('scope').value='';showScope();}offset=0;render();};$('reviewer').oninput=save;$('listing').oninput=save;$('previous').onclick=()=>{offset-=40;render();};$('next').onclick=()=>{offset+=40;render();};$('check-review').onclick=()=>{save();showIssues();};
$('export').onclick=()=>{save();try{const draft=normalizeReviewDraft(review,saved),issues=showIssues();const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify({...draft,exportKind:'draft',reviewIssues:issues},null,2)],{type:'application/json'}));link.download='${phase.toLowerCase()}-'+review.version+'-human-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);$('message').textContent='Draft exported with all answers. '+issues.length+' changed decision(s) need evidence; pending inventory records are allowed. Submission still requires a release review.';}catch(error){$('message').textContent=error.message;}};
$('import').onchange=async()=>{try{const file=$('import').files[0];if(!file)return;const incoming=normalizeReviewDraft(review,JSON.parse(await file.text()));try{localStorage.setItem(key+'.before-import',JSON.stringify(saved));}catch{}saved=incoming;focusEntry=null;individualEntry=null;setup();save();showIssues();$('message').textContent='Matching draft imported, including unfinished answers. Previous browser draft backed up when storage is available.';}catch(error){$('message').textContent=error.message;}};refreshFilters();setup();
</script></html>`;
}
