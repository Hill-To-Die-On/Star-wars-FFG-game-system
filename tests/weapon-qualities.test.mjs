import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/weapon-qualities.json' with {type:'json'};
import {validateWeaponQualities,parseQualities,qualityCheckEffects,qualityRating,activeQualityOptions} from '../src/weapon-qualities.mjs';
import {automaticCheckPool} from '../src/dice/builder.mjs';

const weapon=(qualities,extra={})=>({type:'weapon',name:'QA blaster',system:{qualities,...extra}});
const wielder=(brawn=2,agility=3)=>({system:{characteristics:{brawn,agility}}});

test('the quality catalogue is complete, cited in all three cores and free of unknown automation',()=>{
 validateWeaponQualities(data);
 assert.equal(data.qualities.length,30);
 const cores=['Edge of The Empire - Core Book','Age of Rebellion - Core Book','Force & Destiny - Core Book'];
 for(const quality of data.qualities){
  const books=quality.sources.map(s=>s.book);
  assert.ok(books.every(book=>cores.includes(book)||/Errata/.test(book)),`${quality.id} cites only core books or errata`);
  assert.deepEqual(cores.filter(book=>books.includes(book)),quality.id==='unwieldy'?['Force & Destiny - Core Book']:cores,`${quality.id} core coverage`);
 }
 assert.throws(()=>validateWeaponQualities({...data,qualities:[...data.qualities,{...data.qualities[0]}]}),/repeated/);
 assert.throws(()=>validateWeaponQualities({...data,qualities:[{...data.qualities[0],automation:{guessed:1}}]}),/automation/);
});

test('weapon quality text parses names, ratings and unknown entries',()=>{
 assert.deepEqual(parseQualities('Accurate 1, Stun setting; Vicious 2, Auto-fire, Mystery 4'),[
  {id:'accurate',name:'Accurate',rating:1},{id:'stun-setting',name:'Stun Setting',rating:null},{id:'vicious',name:'Vicious',rating:2},
  {id:'auto-fire',name:'Auto-fire',rating:null},{id:null,name:'Mystery 4',rating:null}]);
 assert.deepEqual(parseQualities('Autofire, Linked 3, Pierce 2, Breach 1').map(q=>[q.id,q.rating]),[['auto-fire',null],['linked',3],['pierce',2],['breach',1]]);
 assert.deepEqual(parseQualities(''),[]);
 assert.equal(qualityRating(weapon('Vicious 3, Pierce 1'),'vicious'),3);
 assert.equal(qualityRating(weapon('Pierce 1'),'vicious'),0);
});

test('passive qualities adjust the attack pool with cited reasons',()=>{
 const accurate=qualityCheckEffects(weapon('Accurate 2, Superior'),wielder());
 assert.equal(accurate.boost,2);assert.equal(accurate.advantage,1);assert.equal(accurate.difficulty,0);
 assert.match(accurate.reasons.join(' '),/Accurate 2: 2 boost \(EotE 154/);
 const heavy=qualityCheckEffects(weapon('Inaccurate 1, Inferior, Cumbersome 4, Unwieldy 4'),wielder(2,3));
 assert.deepEqual([heavy.setback,heavy.threat,heavy.difficulty],[1,1,3],'Cumbersome 4 with Brawn 2 adds two; Unwieldy 4 with Agility 3 adds one');
 assert.deepEqual(qualityCheckEffects(weapon('Cumbersome 2'),wielder(3)).difficulty,0);
 assert.deepEqual(qualityCheckEffects(null,wielder()),{boost:0,setback:0,difficulty:0,advantage:0,threat:0,reasons:[]});
});

test('the builder applies a quality difficulty increase after range',()=>{
 const base=automaticCheckPool({characteristic:3,rank:1,skill:'rangedLight',rangeBand:'short',combat:true});
 const heavy=automaticCheckPool({characteristic:3,rank:1,skill:'rangedLight',rangeBand:'short',combat:true,difficultyIncrease:2});
 assert.equal(heavy.pool.difficulty,base.pool.difficulty+2);
 assert.match(heavy.reasons.join(' '),/Weapon qualities: 2 difficulty/);
});

test('active qualities become spending options with their advantage costs',()=>{
 const options=activeQualityOptions(weapon('Auto-fire, Blast 4, Knockdown, Linked 2, Sunder, Accurate 1'));
 assert.deepEqual(options.map(o=>[o.id,o.cost.advantage]),[['auto-fire',2],['blast',2],['knockdown',2],['linked',2],['sunder',1]]);
 assert.equal(options.find(o=>o.id==='blast').label,'Activate Blast 4');
 assert.deepEqual(options[0].source,{book:'Edge of The Empire - Core Book',page:'155',verification:'gm-reviewed'});
 assert.match(options.find(o=>o.id==='knockdown').note,/silhouette/i);
});
