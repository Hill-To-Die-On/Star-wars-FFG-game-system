import test from 'node:test';
import assert from 'node:assert/strict';
import { listVehicleAttackTargets, targetVehicleForAttack } from '../src/vehicle-targets.mjs';

test('vehicle attack picker offers visible opposing ships when canvas targeting is cleared', () => {
  const source={id:'wayfarer',actor:{type:'vehicle'},object:{visible:true}};
  const tie={id:'tie',name:'Patrol TIE/LN',actor:{type:'vehicle'},object:{visible:true}};
  const obscured={id:'obscured',name:'Hidden gunship',actor:{type:'vehicle'},object:{visible:false}};
  const aboard={id:'crew',name:'Boarded crew',actor:{type:'character'},object:{visible:true}};
  const vehicle={...source,parent:{tokens:[source,tie,obscured,aboard]}};
  assert.deepEqual(listVehicleAttackTargets(vehicle,{isGM:false}).map(target=>target.id),['tie']);
  assert.deepEqual(listVehicleAttackTargets(vehicle,{isGM:true}).map(target=>target.id),['tie','obscured']);
});

test('choosing a dashboard target also establishes Foundry targeting for the attack trace', () => {
  const calls=[],user={id:'pilot'},target={id:'tie',object:{setTarget:(value,options)=>calls.push([value,options])}};
  assert.equal(targetVehicleForAttack(target,user),target.object);
  assert.deepEqual(calls,[[true,{user,releaseOthers:true}]]);
});
