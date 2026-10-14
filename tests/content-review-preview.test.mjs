import test from 'node:test';
import assert from 'node:assert/strict';
import {readingPreviewModel} from '../scripts/content-review-preview.mjs';

const entry=(text,path='templates/example.hbs')=>({text,category:'Complete interface templates',occurrences:[{path,location:'complete file'}]});

test('template reading previews show translated copy and visible dynamic placeholders without evaluating code',()=>{
 const source='<p>{{localize "SWFFG.Close"}} {{actor.name}} ${actor.system.xp}</p>{{#if permitted}}Owner copy{{else}}Observer copy{{/if}}';
 const preview=readingPreviewModel(entry(source),{'SWFFG.Close':'Close'});
 assert.equal(preview.format,'html');
 assert.match(preview.text,/Close/);assert.match(preview.text,/\[actor\.name\]/);assert.match(preview.text,/\[actor\.system\.xp\]/);
 assert.match(preview.text,/Owner copy/);assert.match(preview.text,/Observer copy/);assert.match(preview.text,/\[#if permitted\]/);
 assert.equal(source,entry(source).text);
});

test('localization values are reading text even when they contain markup',()=>{
 const preview=readingPreviewModel(entry('<button>{{localize "SWFFG.Close"}}</button>'),{'SWFFG.Close':'<img src="https://example.invalid/x">'});
 assert.ok(preview.text.includes('&lt;img'));
 assert.ok(!preview.text.includes('<img'));
});

test('the reading model distinguishes Markdown, inline markup and ordinary interface strings',()=>{
 assert.equal(readingPreviewModel(entry('# Guide\n\nRead **carefully**.','README.md')).format,'markdown');
 assert.equal(readingPreviewModel(entry('<p>Review changes</p>','src/dialog.mjs')).format,'html');
 assert.deepEqual(readingPreviewModel(entry('Review changes','lang/en.json')),{format:'text',text:'Review changes',hasPlaceholders:false});
});
