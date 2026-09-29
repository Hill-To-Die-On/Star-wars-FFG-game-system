import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_ID } from "../src/config.mjs";
import { crewCapacities, crewRoster, groupCrew, boardingUpdate, departureUpdate, roleUpdate,
  crewStripPosition, occupantCount, resolveCrewCheck, attachedPosition, boardingTargets, crewVacancyPosition, crewBadgeLayout } from "../src/vehicle-crew.mjs";

const owner = { id:"owner" }, gm = { id:"gm", isGM:true };
const ship = () => ({id:"ship",uuid:"Scene.one.Token.ship",x:500,y:600,width:4,height:6,elevation:20,
  parent:{id:"one",grid:{size:100}},actor:{id:"v",type:"vehicle",system:{crew:"2",passengers:"6",handling:-2},canUserModify:u=>u.id==="owner"},flags:{}});
const person = (id="a", type="character") => ({id,uuid:`Scene.one.Token.${id}`,actorId:type==="minion"?"trooper":id,
  name:type==="minion"?"Stormtroopers":id,x:100,y:200,width:1,height:1,rotation:180,elevation:0,
  parent:{id:"one",grid:{size:100}},texture:{src:"portrait.svg"},flags:{},
  actor:{id,type,system:{groupSize:1,wounds:{value:0,max:5}},canUserModify:u=>u.id==="owner"}});
const embark = (p,v,seat="crew") => {const u=boardingUpdate(p,v,[],{user:owner,seat});p.flags[SYSTEM_ID]={aboard:u[`flags.${SYSTEM_ID}.aboard`]};return p;};

test("boarding uses the committed destination while Foundry is still animating the original document",()=>{
  const v=ship(),p=person();
  assert.deepEqual(boardingTargets(p,{destination:{x:600,y:700}},[v],{user:owner}),[v]);
  assert.deepEqual(boardingTargets(p,{destination:{x:0,y:0}},[v],{user:owner}),[]);
});

test("capacities use exact database counts, explicit overrides, and never guess a prose crew complement",()=>{
  const v=ship();assert.deepEqual(crewCapacities(v),{crew:2,passenger:6});
  v.actor.system.crew="165";assert.equal(crewCapacities(v).crew,165);
  v.actor.system.crew="one pilot and two gunners";assert.equal(crewCapacities(v).crew,null);
  v.actor.flags={[SYSTEM_ID]:{seating:{crew:3,passenger:0}}};assert.deepEqual(crewCapacities(v),{crew:3,passenger:0});
});
test("boarding checks ownership, scene, duplicate membership and remaining capacity before any write",()=>{
  const v=ship(),a=embark(person(),v),b=embark(person("b"),v);
  assert.throws(()=>boardingUpdate(person("c"),v,[a,b],{user:owner}),/full/i);
  assert.doesNotThrow(()=>boardingUpdate(person("c"),v,[a,b],{user:owner,seat:"passenger"}));
  assert.throws(()=>boardingUpdate(a,v,[a],{user:owner}),/already/i);
  assert.throws(()=>boardingUpdate(person(),v,[],{user:{id:"outsider"}}),/permission/i);
  const remote=person();remote.parent.id="two";assert.throws(()=>boardingUpdate(remote,v,[],{user:gm}),/same scene/i);
  const linked=person("linked","minion");linked.flags[SYSTEM_ID]={minionGroupId:"group"};
  assert.throws(()=>boardingUpdate(linked,v,[],{user:gm}),/linked combat group/);
});
test("boarded tokens retain their physical dimensions; travel moves their vision origin and departure restores bearing",()=>{
  const v=ship(),p=person(),u=boardingUpdate(p,v,[],{user:owner});
  assert.equal(u.width,undefined);assert.equal(u.hidden,undefined);assert.equal(u.elevation,20);
  assert.deepEqual(attachedPosition(p,v),{x:650,y:850,elevation:20});
  p.flags[SYSTEM_ID]={aboard:u[`flags.${SYSTEM_ID}.aboard`]};v.x=900;
  const leave=departureUpdate(p,v,{user:owner});assert.equal(leave.rotation,180);assert.equal(leave.elevation,20);
  assert.equal(leave[`flags.${SYSTEM_ID}.aboard`],null);assert.ok(leave.x>=1300);assert.equal(leave.width,undefined);
});
test("role lights are explicit, passengers cannot operate a station, and the pilot seat is exclusive",()=>{
  const v=ship(),a=embark(person(),v),b=embark(person("b"),v);
  const update=roleUpdate(a,v,[a,b],"pilot",{user:owner});a.flags[SYSTEM_ID].aboard.roles=update[`flags.${SYSTEM_ID}.aboard.roles`];
  assert.throws(()=>roleUpdate(b,v,[a,b],"pilot",{user:owner}),/already assigned/i);
  assert.deepEqual(roleUpdate(a,v,[a,b],"pilot",{user:owner})[`flags.${SYSTEM_ID}.aboard.roles`],[]);
  const c=embark(person("c"),v,"passenger");assert.throws(()=>roleUpdate(c,v,[c],"gunner",{user:owner}),/passenger/i);
  assert.throws(()=>roleUpdate(b,v,[b],"invented",{user:owner}),/Unknown/);
});
test("identical minions stack visually without merging documents or changing group skill ranks",()=>{
  const v=ship(),a=embark(person("a","minion"),v,"passenger"),b=embark(person("b","minion"),v,"passenger");
  a.actor.system.groupSize=3;b.actor.system.groupSize=2;
  let groups=groupCrew(crewRoster(v,[a,b]));assert.equal(groups.length,1);assert.equal(groups[0].count,5);
  assert.equal(groups[0].members.length,2);assert.equal(a.actor.system.groupSize,3);
  a.actor.system.wounds.value=6;assert.equal(occupantCount(a),2);
  groups=groupCrew(crewRoster(v,[a,b]));assert.equal(groups[0].count,4);
  b.flags[SYSTEM_ID].aboard.roles=["gunner"];assert.equal(groupCrew(crewRoster(v,[a,b])).length,2);
});
test("hidden occupants are absent from player-facing rosters and PC duplicates stay individually selectable",()=>{
  const v=ship(),a=embark(person(),v),b=embark(person("b"),v);b.hidden=true;
  assert.equal(crewRoster(v,[a,b],{user:owner,visibleOnly:true}).length,1);
  assert.equal(crewRoster(v,[a,b],{user:gm,visibleOnly:true}).length,2);
  b.hidden=false;b.actorId=a.actorId;b.name=a.name;
  assert.equal(groupCrew(crewRoster(v,[a,b])).length,2);
});
test("crew strips flip above a vehicle, clamp horizontally, and disappear when the hull is off screen",()=>{
  const viewport={left:10,top:60,right:900,bottom:700};
  assert.equal(crewStripPosition({left:300,right:500,top:150,bottom:350},200,80,viewport).side,"bottom");
  assert.equal(crewStripPosition({left:300,right:500,top:580,bottom:900},200,80,viewport).side,"top");
  assert.equal(crewStripPosition({left:800,right:1000,top:100,bottom:200},200,80,viewport).left,700);
  assert.equal(crewStripPosition({left:1000,right:1200,top:100,bottom:200},200,80,viewport),null);
});
test("the small vacancy badge sits inside the right corner and uses the top corner when the lower edge is off screen",()=>{
  const vp={left:10,top:60,right:900,bottom:700},rect={left:100,right:500,top:100,bottom:500};
  const lower=crewVacancyPosition(rect,24,vp);
  assert.equal(lower.side,"bottom");assert.ok(lower.left+24<rect.right);assert.ok(lower.top+24<rect.bottom);
  assert.equal(crewVacancyPosition({...rect,bottom:800},24,vp).side,"top");
  assert.ok(crewVacancyPosition({...rect,right:1200},24,vp).left+24<=vp.right);
  const pair=crewVacancyPosition({...rect,right:1200},24,vp,52);
  assert.ok(pair.left+52<=vp.right);
  assert.equal(crewVacancyPosition({...rect,left:1000,right:1300},24,vp,52),null);
});
test("the paired crew badges remain inside a rotated hull rather than its empty bounding-box corner",()=>{
  const rect={left:100,right:500,top:100,bottom:500,corners:[{x:300,y:100},{x:500,y:300},{x:300,y:500},{x:100,y:300}]};
  const pos=crewVacancyPosition(rect,24,{left:0,top:0,right:800,bottom:700},52);
  for(const x of [pos.left,pos.left+52])for(const y of [pos.top,pos.top+24])
    assert.ok(Math.abs(x-300)+Math.abs(y-300)<=200.01,`badge corner ${x}, ${y} falls outside the hull`);
});
test("zoomed crew controls scale with tiny vehicles and never escape their hull during horizontal panning",()=>{
  const vp={left:80,top:60,right:900,bottom:700};
  for(const extent of [1,2,4,8,16,32,80,300])for(const left of [60,78,80,85,100,860,895,905]) {
    const rect={left,right:left+extent,top:200,bottom:200+extent},layout=crewBadgeLayout(rect,vp);
    if(!layout)continue;
    assert.ok(layout.size*2+layout.gap<=extent);
    assert.ok(layout.left>=rect.left-0.001 && layout.left+layout.width<=rect.right+0.001);
    assert.ok(layout.top>=rect.top-0.001 && layout.top+layout.size<=rect.bottom+0.001);
    assert.ok(layout.left>=vp.left-0.001 && layout.left+layout.width<=vp.right+0.001);
  }
  assert.ok(crewBadgeLayout({left:100,right:108,top:100,bottom:108},vp).size<4);
  assert.equal(crewBadgeLayout({left:10,right:79,top:100,bottom:169},vp),null);
});
test("checks resolve the actual assigned character, refuse an ambiguous gunner and apply handling only to piloting",()=>{
  const v=ship(),a=embark(person(),v),b=embark(person("b"),v);
  a.flags[SYSTEM_ID].aboard.roles=["pilot","gunner"];b.flags[SYSTEM_ID].aboard.roles=["gunner"];
  assert.equal(resolveCrewCheck(v,[a,b],"pilotingSpace").actor,a.actor);
  assert.equal(resolveCrewCheck(v,[a,b],"pilotingSpace").setback,2);
  assert.throws(()=>resolveCrewCheck(v,[a,b],"gunnery"),/choose/i);
  assert.equal(resolveCrewCheck(v,[a,b],"gunnery",b.id).actor,b.actor);
  assert.equal(resolveCrewCheck(v,[a,b],"gunnery",b.id).setback,0);
  assert.throws(()=>resolveCrewCheck(v,[a,b],"mechanics"),/assigned/i);
  b.flags[SYSTEM_ID].aboard.roles.push("copilot");
  assert.throws(()=>resolveCrewCheck(v,[a,b],"pilotingSpace"),/choose/i);
  assert.equal(resolveCrewCheck(v,[a,b],"pilotingSpace",b.id).actor,b.actor);
});
