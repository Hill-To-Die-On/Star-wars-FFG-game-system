import test from 'node:test';
import assert from 'node:assert/strict';
import {TabletopWorkflowService} from '../src/tabletop-service.mjs';
import {planActorEffect} from '../src/tabletop-workflows.mjs';

const systemId='star-wars-ffg',gm={id:'gm',isGM:true,active:true};
const source={book:'Recovery fixture',page:'1',verification:'gm-ruling'};
const request={kind:'damage',amount:7,scale:'personal',source};
function actor() {
  return {uuid:'Actor.recovery',type:'character',flags:{},system:{wounds:{value:2,max:10},soak:2},
    async update(changes) {
      if(this.failure==='before')throw Error('simulated write rejected');
      for(const [path,value]of Object.entries(changes)) {
        const keys=path.split('.');let node=this;
        for(const key of keys.slice(0,-1))node=node[key]??={};
        node[keys.at(-1)]=structuredClone(value);
      }
      if(this.failure==='after')throw Error('simulated acknowledgement lost');
    }};
}
const service=a=>new TabletopWorkflowService({resolve:()=>a});
const snapshot=plan=>JSON.stringify({version:1,before:plan.before,after:plan.after,calculation:plan.calculation??null,source:plan.source,warning:plan.warning??null,downtime:plan.downtime??null});

test('reviewed damage refuses changed soak or threshold even when current wounds did not change',async()=>{
  for(const change of [a=>a.system.soak=4,a=>a.system.wounds.max=6]) {
    const a=actor(),expected=snapshot(planActorEffect(a,request,{user:gm}));
    change(a);
    await assert.rejects(service(a).execute('effect',{actorUuid:a.uuid,request,expected},gm,'reviewed'),/preview/);
    assert.equal(a.system.wounds.value,2);assert.equal(a.flags[systemId],undefined);
  }
  const a=actor(),expected=snapshot(planActorEffect(a,request,{user:gm}));
  await service(a).execute('effect',{actorUuid:a.uuid,request,expected},gm,'positive');
  assert.equal(a.system.wounds.value,7,'unchanged reviewed preview remains usable');
});

test('a rejected atomic write leaves no history and can be retried after restart',async()=>{
  const a=actor(),args={actorUuid:a.uuid,request};a.failure='before';
  await assert.rejects(service(a).execute('effect',args,gm,'failed-write'),/rejected/);
  assert.equal(a.system.wounds.value,2);assert.equal(a.flags[systemId],undefined);
  a.failure=null;await service(a).execute('effect',args,gm,'failed-write');
  assert.equal(a.system.wounds.value,7);assert.equal(a.flags[systemId].workflowHistory.length,1);
});

test('lost effect and undo acknowledgements recover from persisted history without applying twice',async()=>{
  const a=actor(),args={actorUuid:a.uuid,request};a.failure='after';
  await assert.rejects(service(a).execute('effect',args,gm,'committed'),/acknowledgement/);
  a.failure=null;await service(a).execute('effect',args,gm,'committed');
  assert.equal(a.system.wounds.value,7);assert.equal(a.flags[systemId].workflowHistory.length,1);
  a.failure='after';await assert.rejects(service(a).execute('undo-effect',{actorUuid:a.uuid,entryId:'committed'},gm,'undo'),/acknowledgement/);
  a.failure=null;await service(a).execute('undo-effect',{actorUuid:a.uuid,entryId:'committed'},gm,'undo-retry');
  assert.equal(a.system.wounds.value,2);assert.equal(a.flags[systemId].workflowHistory[0].undone,true);
  await service(a).execute('effect',args,gm,'committed');
  assert.equal(a.system.wounds.value,2,'replay of an undone operation does not reapply it');
});

test('restored serialized history can undo while later conflicting edits remain protected',async()=>{
  const a=actor();await service(a).execute('effect',{actorUuid:a.uuid,request},gm,'backed-up');
  const restored=Object.assign(actor(),JSON.parse(JSON.stringify({system:a.system,flags:a.flags})));
  restored.system.wounds.value=8;
  await assert.rejects(service(restored).execute('undo-effect',{actorUuid:restored.uuid,entryId:'backed-up'},gm,'conflict'),/changed/);
  assert.equal(restored.system.wounds.value,8);assert.ok(!restored.flags[systemId].workflowHistory[0].undone);
  restored.system.wounds.value=7;
  await service(restored).execute('undo-effect',{actorUuid:restored.uuid,entryId:'backed-up'},gm,'restore');
  assert.equal(restored.system.wounds.value,2);
});
