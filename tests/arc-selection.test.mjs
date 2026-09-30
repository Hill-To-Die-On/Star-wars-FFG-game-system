import test from "node:test";
import assert from "node:assert/strict";
import { ArcSelection, ARC_SECTIONS, arcSectionSelection, arcSectorPolygon } from "../src/range-overlay/arc-selection.mjs";

test("six attacker sections distinguish vertical mounts from horizontal arcs",()=>{
  assert.equal(ARC_SECTIONS.length,6);
  assert.deepEqual(arcSectionSelection({fireArc:"fore"},"attack","dorsal","target"),{fireArc:"",fireFacing:"dorsal"});
  assert.deepEqual(arcSectionSelection({fireFacing:"dorsal"},"attack","port","target"),{fireFacing:"",fireArc:"port"});
  assert.equal(arcSectionSelection({},"defence","ventral","target"),null);
});
test("both selectors anchor rectangular hull sectors at the actual corners",()=>{
  const points=arcSectorPolygon("fore",400,100);
  const edge=points.filter(p=>Math.abs(p.y)<1e-7).map(p=>p.x);
  assert.ok(edge.includes(0));assert.ok(edge.includes(100));
  for(const p of points){const x=(p.x-50)*4,y=p.y-50;assert.ok(y+50<=200-Math.abs(x)+1e-7);}
  assert.equal(arcSectorPolygon("dorsal",400,100).length,0);
});
const valid=selection=>({pool:{ability:2},range:{lineOfSight:"clear",arcError:""},error:selection.defenseZone?"":"Choose the target's agreed defence zone in Choose attack or the vehicle check builder."});
test("hover previews without committing, click locks attack then defence and cancellation restores the original",()=>{
  const commits=[],previews=[];let cancelled=0;
  const picker=new ArcSelection({sourceVehicle:true,targetVehicle:true,targetId:"target",selection:{},
    preview:s=>{previews.push(s);return valid(s);},commit:s=>commits.push(s),cancel:()=>cancelled++});
  picker.hover("port");assert.deepEqual(picker.selection,{});assert.equal(commits.length,0);
  assert.equal(picker.select("starboard"),true);assert.equal(picker.stage,"defence");assert.equal(commits.length,0);
  picker.hover("aft");assert.equal(picker.selection.defenseZone,"");
  assert.equal(picker.select("fore"),true);assert.equal(picker.stage,"done");assert.equal(commits.length,1);
  assert.deepEqual(commits[0],{fireArc:"starboard",fireFacing:"",defenseZone:"fore",defenseTargetId:"target"});
  const other=new ArcSelection({sourceVehicle:true,targetVehicle:true,targetId:"target",selection:{fireArc:"aft"},preview:valid,commit:s=>commits.push(s),cancel:()=>cancelled++});
  other.hover("fore");other.cancel();assert.equal(cancelled,1);assert.equal(commits.length,1);
  assert.ok(previews.length>=4);
});
test("blocked sections do not advance, Auto clears the explicit attack and Back returns to the ship",()=>{
  const picker=new ArcSelection({sourceVehicle:true,targetVehicle:true,targetId:"t",selection:{itemId:"gun",crewTokenId:"crew"},
    preview:s=>s.fireArc==="aft"?{pool:{},range:{lineOfSight:"blocked"},error:"Blocked"}:valid(s),commit:()=>{},cancel:()=>{}});
  assert.equal(picker.select("aft"),false);assert.equal(picker.stage,"attack");
  picker.auto();assert.equal(picker.stage,"defence");assert.equal(picker.selection.itemId,undefined);
  picker.back();assert.equal(picker.stage,"attack");
});
