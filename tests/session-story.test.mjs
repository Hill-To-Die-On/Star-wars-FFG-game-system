import test from 'node:test';
import assert from 'node:assert/strict';
import {storyChart,resolveStoryCheck,storyThresholdChanges,planSessionStoryEffect,activeSessionEffects,planSessionStoryEnd,planMoralityResolution,planDutyContribution} from '../src/session-story.mjs';

const gm={id:'gm',isGM:true},player={id:'p',isGM:false};
const campaign={obligation:true,duty:true,morality:true};
const pc=(id,name,{obligation=10,duty=0,morality=50,conflict=0,strain=12,wounds=14,history=[]}={})=>({uuid:`Actor.${id}`,id,name,type:'character',
 flags:{'star-wars-ffg':{workflowHistory:history}},system:{obligation:{value:obligation},duty:{value:duty,contribution:1},morality:{value:morality,conflict},strain:{value:0,max:strain},wounds:{value:0,max:wounds}}});

test('story charts stack each character band from highest value and skip characters without that mechanic',()=>{
 const chart=storyChart([pc('b','Bel',{obligation:10}),pc('a','Ash',{obligation:15}),pc('c','Cor',{obligation:0}),pc('d','Dex',{obligation:10})],'obligation');
 assert.equal(chart.total,35);
 assert.deepEqual(chart.bands.map(b=>[b.name,b.low,b.high]),[['Ash',1,15],['Bel',16,25],['Dex',26,35]]);
 assert.throws(()=>storyChart([],'morality'),/Obligation or Duty/);
});

test('a d100 at or below the total triggers the band holding the roll and matching digits double it',()=>{
 const chart=storyChart([pc('a','Ash',{obligation:15}),pc('b','Bel',{obligation:10})],'obligation');
 assert.deepEqual(resolveStoryCheck(chart,22),{roll:22,total:25,triggered:true,doubles:true,band:chart.bands[1],overLimit:false});
 assert.equal(resolveStoryCheck(chart,15).band.name,'Ash');
 assert.equal(resolveStoryCheck(chart,15).doubles,false);
 assert.deepEqual(resolveStoryCheck(chart,26),{roll:26,total:25,triggered:false,doubles:false,band:null,overLimit:false});
 assert.equal(resolveStoryCheck(chart,33).doubles,false,'doubles only matter when the check triggers');
 for(const roll of [0,101,2.5])assert.throws(()=>resolveStoryCheck(chart,roll),/1 to 100/);
});

test('Obligation lowers every strain threshold and Duty raises every wound threshold, more for the triggered character',()=>{
 const party=[pc('a','Ash',{obligation:15,duty:5}),pc('b','Bel',{obligation:10,duty:20}),pc('c','Cor',{obligation:0,duty:0})];
 const obligation=storyChart(party,'obligation');
 assert.deepEqual(storyThresholdChanges(party,obligation,resolveStoryCheck(obligation,20)).map(c=>[c.name,c.path,c.delta,c.triggered]),
  [['Ash','system.strain.max',-1,false],['Bel','system.strain.max',-2,true],['Cor','system.strain.max',-1,false]]);
 assert.deepEqual(storyThresholdChanges(party,obligation,resolveStoryCheck(obligation,22)).map(c=>c.delta),[-2,-4,-2]);
 assert.deepEqual(storyThresholdChanges(party,obligation,resolveStoryCheck(obligation,90)),[]);
 const duty=storyChart(party,'duty');
 assert.deepEqual(storyThresholdChanges(party,duty,resolveStoryCheck(duty,11)).map(c=>[c.name,c.path,c.delta]),
  [['Ash','system.wounds.max',2],['Bel','system.wounds.max',4],['Cor','system.wounds.max',2]]);
 const heavy=storyChart([pc('a','Ash',{obligation:60}),pc('b','Bel',{obligation:50})],'obligation');
 assert.equal(resolveStoryCheck(heavy,99).overLimit,true,'a group total above 100 triggers every session');
});

test('session story effects change a threshold reversibly and end with the session',()=>{
 const actor=pc('a','Ash');
 const plan=planSessionStoryEffect(actor,{mechanic:'obligation',delta:-2,checkId:'check-1',roll:22,triggered:true},{user:gm,campaign});
 assert.equal(plan.kind,'session-story');assert.deepEqual(plan.after,{'system.strain.max':10});assert.deepEqual(plan.before,{'system.strain.max':12});
 assert.deepEqual(plan.sessionEffect,{mechanic:'obligation',path:'system.strain.max',delta:-2,checkId:'check-1'});
 assert.deepEqual(plan.source,{book:'Edge of The Empire - Core Book',page:'41-42',verification:'gm-reviewed'});
 assert.throws(()=>planSessionStoryEffect(actor,{mechanic:'obligation',delta:-2,checkId:'c'},{user:player,campaign}),/GM/);
 assert.throws(()=>planSessionStoryEffect(actor,{mechanic:'duty',delta:1,checkId:'c'},{user:gm,campaign:{obligation:true}}),/disabled/);
 assert.throws(()=>planSessionStoryEffect(actor,{mechanic:'obligation',delta:-3,checkId:'c'},{user:gm,campaign}),/one, two or four/);
 assert.throws(()=>planSessionStoryEffect(pc('t','Tiny',{strain:2}),{mechanic:'obligation',delta:-2,checkId:'c'},{user:gm,campaign}),/below 1/);
 const recorded={...plan,id:'effect-1',before:JSON.stringify(plan.before),after:JSON.stringify(plan.after)};
 actor.system.strain.max=10;actor.flags['star-wars-ffg'].workflowHistory=[recorded];
 assert.deepEqual(activeSessionEffects(actor).map(e=>e.id),['effect-1']);
 const end=planSessionStoryEnd(actor,{entryId:'effect-1'},{user:gm,campaign});
 assert.equal(end.kind,'session-story-end');assert.equal(end.endsEntryId,'effect-1');assert.deepEqual(end.after,{'system.strain.max':12});
 actor.flags['star-wars-ffg'].workflowHistory.push({...end,id:'end-1'});
 assert.deepEqual(activeSessionEffects(actor),[]);
 assert.throws(()=>planSessionStoryEnd(actor,{entryId:'effect-1'},{user:gm,campaign}),/already ended/);
 actor.flags['star-wars-ffg'].workflowHistory[1].undone=true;
 assert.deepEqual(activeSessionEffects(actor).map(e=>e.id),['effect-1'],'undoing the end reactivates the effect');
 actor.flags['star-wars-ffg'].workflowHistory[0].undone=true;
 assert.deepEqual(activeSessionEffects(actor),[]);
});

test('Morality moves by the d10 minus session Conflict, then Conflict resets',()=>{
 const resolve=(options,state)=>planMoralityResolution(pc('a','Ash',state),options,{user:gm,campaign});
 const rise=resolve({roll:6},{morality:50,conflict:3});
 assert.deepEqual(rise.after,{'system.morality.value':53,'system.morality.conflict':0});assert.equal(rise.calculation.change,3);
 assert.deepEqual(resolve({roll:1},{morality:50,conflict:3}).after['system.morality.value'],48);
 assert.deepEqual(resolve({roll:4},{morality:50,conflict:4}).after,{'system.morality.conflict':0});
 assert.equal(resolve({roll:6,engagedTrigger:true},{morality:50,conflict:3}).after['system.morality.value'],56);
 assert.equal(resolve({roll:6,noIncrease:true},{morality:50,conflict:3}).after['system.morality.value'],undefined);
 assert.equal(resolve({roll:1,noIncrease:true},{morality:50,conflict:3}).after['system.morality.value'],48,'a blocked increase does not cancel a loss');
 assert.equal(resolve({roll:10},{morality:96,conflict:0}).after['system.morality.value'],100);
 assert.match(resolve({roll:1},{morality:31,conflict:6}).warnings.join(' '),/dark side/);
 assert.match(resolve({roll:10},{morality:68,conflict:0}).warnings.join(' '),/above 70/);
 assert.deepEqual(resolve({roll:6},{morality:50,conflict:3}).source,{book:'Force & Destiny - Core Book',page:'51-52',verification:'gm-reviewed'});
 for(const roll of [0,11,1.5])assert.throws(()=>resolve({roll},{}),/1 to 10/);
 assert.throws(()=>planMoralityResolution(pc('a','Ash'),{roll:5},{user:gm,campaign:{morality:false}}),/disabled/);
});

test('Duty past 100 raises Contribution rank and resets Duty',()=>{
 const plan=planDutyContribution(pc('a','Ash',{duty:55}),{},{user:gm,campaign});
 assert.deepEqual(plan.after,{'system.duty.value':0,'system.duty.contribution':2});
 assert.equal(plan.source.page,'49-50');
 assert.throws(()=>planDutyContribution(pc('a','Ash'),{},{user:player,campaign}),/GM/);
});
