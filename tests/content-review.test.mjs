import test from "node:test";
import assert from "node:assert/strict";
import { createContentReview, reviewDecisions } from "../scripts/content-review-policy.mjs";
import { contentReviewPage } from "../scripts/content-review-page.mjs";
import { reviewRecordLane } from '../scripts/content-review-workflow.mjs';

const encode = value => new TextEncoder().encode(value);
const files = {
  "system.json": encode(JSON.stringify({ id: "star-wars-ffg", version: "0.4.2", title: "Star Wars FFG", description: "A system description", languages: [{lang:"en",path:"lang/en.json"}] })),
  "lang/en.json": encode('{"SWFFG.Close":"Close","SWFFG.Warning":"Review the result"}'),
  "templates/dialog.hbs": encode('<p title="A useful hint">Hello {{name}}</p>'),
  "src/dialog.mjs": encode('import x from "./other.mjs"; const labels={name:"A useful label"}; const content=`Hello ${name}, review this.`;'),
  "data/book-play-guidance.json": encode('{"entries":[{"summary":"Use the table ruling.","source":{"book":"Book A","page":"12"}}]}'),
  "README.md": encode("# Original documentation\nRead the guide."),
  "assets/image.png": new Uint8Array([137,80,78,71]),
};

test("review inventory covers locale, template, inline, narrative, documentation and binary provenance", () => {
  const review = createContentReview(files, {archiveSha256:"a".repeat(64)});
  for (const text of ["Close", "Review the result", "A useful label", "Use the table ruling."])
    assert.ok(review.entries.some(entry => entry.text === text), text);
  assert.ok(review.entries.some(entry => entry.text.includes("Hello {{name}}")));
  assert.ok(review.entries.some(entry => entry.text.includes("${name}")));
  assert.ok(review.entries.some(entry => entry.text.includes("# Original documentation")));
  assert.equal(review.files.length, Object.keys(files).length);
  assert.equal(review.files.find(file => file.path === "assets/image.png").review, "asset-provenance");
  assert.ok(!review.entries.some(entry => entry.text === "./other.mjs"));
});

test("approvals bind to the exact archive and changed text cannot reuse an old identity", () => {
  const original = createContentReview(files, {archiveSha256:"a".repeat(64)});
  const changed = createContentReview({...files,"lang/en.json":encode('{"SWFFG.Close":"Dismiss"}')}, {archiveSha256:"b".repeat(64)});
  assert.notEqual(original.entries.find(entry=>entry.text==="Close").id, changed.entries.find(entry=>entry.text==="Dismiss").id);
  assert.throws(()=>reviewDecisions(changed,{archiveSha256:original.archiveSha256,entries:{}}), /archive/i);
});

test("a checkbox or AI-text acceptance cannot masquerade as human authorship evidence", () => {
  const review = createContentReview(files, {archiveSha256:"a".repeat(64)});
  const entry = review.entries.find(entry=>entry.text==="Close");
  const imported={archiveSha256:review.archiveSha256,reviewer:"The User",entries:{[entry.id]:{decision:"human-origin",evidence:""}}};
  assert.throws(()=>reviewDecisions(review,imported), /evidence/i);
  imported.entries[entry.id]={decision:"approve-ai-text",evidence:"Reviewed it"};
  assert.throws(()=>reviewDecisions(review,imported), /decision/i);
  imported.entries[entry.id]={decision:"human-origin",evidence:"Original human-written interface label"};
  assert.equal(reviewDecisions(review,imported).entries[entry.id].decision,"human-origin");
  assert.equal(reviewDecisions(review,imported).submissionReady,false);
});

test("review page keeps embedded hostile text inert and retains it exactly as data", () => {
  const hostile='</script><script>globalThis.compromised=true</script>';
  const review=createContentReview({...files,'lang/en.json':encode(JSON.stringify({warning:hostile}))},{archiveSha256:'c'.repeat(64)});
  const html=contentReviewPage(review);
  assert.ok(!html.includes(hostile));
  const embedded=html.match(/id="review-data">(.*?)<\/script>/s)[1];
  assert.ok(JSON.parse(embedded).entries.some(entry=>entry.text===hostile));
});

test('literal context separates selectors and property access from one-word UI labels', () => {
  const source = 'const ADVANCEMENT_FORMAT="star-wars-ffg-advancement-trees";const field=actor["system"];root.querySelector("button");node.setAttribute("aria-label","Close");const label="Close";const message=`Ready ${name}`;const key="SWFFG.Close";if(kind==="character"){}';
  const inventory = createContentReview({ ...files, 'src/dialog.mjs': encode(source) }, { archiveSha256: 'd'.repeat(64) });
  const entry = text => inventory.entries.find(item => item.category === 'Inline runtime text and code literals' && item.text === text);
  for (const text of ['star-wars-ffg-advancement-trees', 'system', 'button', 'aria-label', 'SWFFG.Close', 'character']) assert.equal(reviewRecordLane(entry(text)), 'maintenance', text);
  for (const text of ['Close', 'Ready ${name}']) assert.equal(reviewRecordLane(entry(text)), 'prepared', text);
});
