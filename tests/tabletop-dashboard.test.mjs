import test from 'node:test';
import assert from 'node:assert/strict';
import {watchVehicleDashboard} from '../src/tabletop-dashboard.mjs';
function fixture() {
 const rows=new Map(),scheduled=[];let next=0,refreshes=0;
 const hooks={on(name,callback){const key=++next;rows.set(key,{name,callback});return key;},off(name,key){assert.equal(rows.get(key)?.name,name);rows.delete(key);},emit(name,document){for(const row of rows.values())if(row.name===name)row.callback(document);}};
 const stop=watchVehicleDashboard({hooks,actorUuids:()=>new Set(['Actor.ship','Actor.pilot']),sceneId:()=> 'scene',refresh:()=>refreshes++,schedule:callback=>scheduled.push(callback)});
 return {hooks,rows,scheduled,stop,refreshes:()=>refreshes,flush(){while(scheduled.length)scheduled.shift()();}};
}
test('dashboard updates coalesce relevant actor, embedded, scene and combat events without polling',()=>{
 const f=fixture();
 f.hooks.emit('updateActor',{uuid:'Actor.other'});f.hooks.emit('updateToken',{parent:{id:'elsewhere'}});assert.equal(f.scheduled.length,0);
 f.hooks.emit('updateActor',{uuid:'Actor.pilot'});f.hooks.emit('updateItem',{parent:{uuid:'Actor.ship'}});f.hooks.emit('updateCombat',{});assert.equal(f.scheduled.length,1);
 f.flush();assert.equal(f.refreshes(),1);assert.equal(f.scheduled.length,0,'no recurring timer after paint');
 f.hooks.emit('updateToken',{parent:{id:'scene'}});f.flush();assert.equal(f.refreshes(),2);f.stop();assert.equal(f.rows.size,0);
});
test('closing a dashboard removes every hook and cancels an already queued repaint',()=>{
 const f=fixture();assert.ok(f.rows.size>10,'real document subscriptions were registered');
 f.hooks.emit('updateActor',{uuid:'Actor.ship'});assert.equal(f.scheduled.length,1);f.stop();f.flush();
 assert.equal(f.refreshes(),0);assert.equal(f.rows.size,0);f.hooks.emit('updateCombat',{});assert.equal(f.scheduled.length,0);
});
