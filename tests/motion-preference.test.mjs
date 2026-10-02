import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionPreference} from '../src/ui/motion-preference.mjs';

test('motion preference uses one listener, responds live and releases it with the final subscriber',()=>{
  const callbacks=new Set(),media={matches:false,addEventListener(_type,fn){callbacks.add(fn);},removeEventListener(_type,fn){callbacks.delete(fn);}};
  const preference=createMotionPreference(()=>media),values=[];
  const stop=preference.subscribe(value=>values.push(value)),other=preference.subscribe(()=>{});
  assert.equal(callbacks.size,1);assert.deepEqual(values,[false]);
  media.matches=true;for(const fn of callbacks)fn({matches:true});
  assert.equal(preference.reduced(),true);assert.deepEqual(values,[false,true]);
  stop();assert.equal(callbacks.size,1);other();assert.equal(callbacks.size,0);
  media.matches=false;const again=preference.subscribe(value=>values.push(value));
  assert.deepEqual(values,[false,true,false]);again();again();assert.equal(callbacks.size,0);
});

test('unavailable preference API is static and safe without polling',()=>{
  const preference=createMotionPreference(()=>undefined),values=[];
  const stop=preference.subscribe(value=>values.push(value));
  assert.equal(preference.reduced(),false);assert.deepEqual(values,[false]);stop();
});
