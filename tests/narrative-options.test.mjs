import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/narrative-options.json' with {type:'json'};
import {validateNarrativeOptions,bundledSpendingOptions} from '../src/narrative-options.mjs';

const all={bookMode:'all'},owned=books=>({bookMode:'owned',books});

test('the bundled spending catalogue covers the four core combat tables',()=>{
 validateNarrativeOptions(data);
 assert.deepEqual(data.tables.map(t=>t.id),['personal-advantage','personal-threat','vehicle-advantage','vehicle-threat']);
 assert.equal(data.options.length,55);
 assert.throws(()=>validateNarrativeOptions({...data,options:[{...data.options[0],cost:0}]}),/cost/);
 assert.throws(()=>validateNarrativeOptions({...data,options:[{...data.options[0],table:'unknown'}]}),/table/);
});

test('only options for symbols left on the roll are offered, each with a reviewed core page',()=>{
 const options=bundledSpendingOptions({symbols:['advantage'],campaign:all});
 assert.ok(options.length>0&&options.every(o=>Object.keys(o.cost).join()==='advantage'));
 const strain=options.find(o=>o.id==='personal-adv-recover-strain');
 assert.deepEqual(strain.cost,{advantage:1});assert.equal(strain.group,'Personal combat');
 assert.deepEqual(strain.source,{book:'Edge of The Empire - Core Book',page:'206',verification:'gm-reviewed'});
 assert.match(options.find(o=>o.id==='personal-adv-critical-injury').note,/Critical rating/);
 assert.ok(bundledSpendingOptions({symbols:['despair'],campaign:all}).every(o=>o.cost.despair>0));
 assert.deepEqual(bundledSpendingOptions({symbols:[],campaign:all}),[]);
});

test('the campaign book filter chooses an owned core page and hides rows from unowned books',()=>{
 const force=bundledSpendingOptions({symbols:['advantage','triumph'],campaign:owned(['Force & Destiny - Core Book'])});
 assert.ok(force.every(o=>o.source.book==='Force & Destiny - Core Book'));
 assert.equal(force.find(o=>o.id==='personal-adv-recover-strain').source.page,'212');
 assert.ok(force.some(o=>o.id==='personal-tri-destroy-lightsaber'));
 const edge=bundledSpendingOptions({symbols:['advantage','triumph'],campaign:owned(['Edge of The Empire - Core Book'])});
 assert.ok(!edge.some(o=>o.id==='personal-tri-destroy-lightsaber'),'the lightsaber option is printed only in Force and Destiny');
 assert.deepEqual(bundledSpendingOptions({symbols:['advantage'],campaign:owned(['Age of Rebellion - Cyphers & Masks'])}),[]);
});
