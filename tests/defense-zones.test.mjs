import test from "node:test";
import assert from "node:assert/strict";
import { hullZonePolygon as defenseZonePolygon, defenseZoneContains, defenseZoneBoundaryPoints, firingZoneContains, firingZoneRays, defenseZoneExposed } from "../src/range-overlay/hull-zones.mjs";

const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
test("long hull defence starts at the front/rear corners, with 45-degree joins and no side plating in Fore/Aft",()=>{
  const fore=defenseZonePolygon("fore",400,1000),aft=defenseZonePolygon("aft",400,1000);
  assert.deepEqual(new Set(fore.map(p=>`${p.x},${p.y}`)),new Set(["0,0","100,0","50,20"]));
  assert.deepEqual(new Set(aft.map(p=>`${p.x},${p.y}`)),new Set(["0,100","100,100","50,80"]));
  assert.equal(area(fore),1000);
  const hull={x:0,y:0,width:400,height:1000,rotation:180};
  assert.equal(defenseZoneContains(hull,"fore",{x:200,y:-400}),false);
  assert.equal(defenseZoneContains(hull,"starboard",{x:200,y:-400}),true);
  assert.equal(defenseZoneContains(hull,"fore",{x:150,y:-500}),true);
});

test("corner rays match the rendered hull zones and both adjacent firing sectors after rotation",()=>{
  for(const rotation of [0,37,90,180,270]) {
    const hull={x:800,y:400,width:200,height:1000,rotation};
    const rays=firingZoneRays(hull,["fore"]);assert.equal(rays.length,3);
    for(const [i,ray]of rays.entries()) {
      const point={x:ray.origin.x+500*Math.cos(ray.direction),y:ray.origin.y+500*Math.sin(ray.direction)};
      assert.equal(firingZoneContains(hull,"fore",point),true);
      assert.equal(firingZoneContains(hull,"aft",point),false);
      if(i!==1)assert.equal(firingZoneContains(hull,i===0?"port":"starboard",point),true);
    }
  }
});

test("defensive regions partition square, wide and narrow hulls completely",()=>{
  for(const [width,height]of [[400,1000],[1000,400],[400,400],[1,10000]]) {
    const polygons=["fore","aft","port","starboard"].map(zone=>defenseZonePolygon(zone,width,height));
    assert.ok(Math.abs(polygons.reduce((sum,p)=>sum+area(p),0)-10000)<1e-7);
    for(const polygon of polygons)for(const p of polygon)assert.ok(p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100);
  }
  assert.deepEqual(defenseZonePolygon("dorsal",400,1000),[]);
  assert.deepEqual(defenseZonePolygon("fore",0,1000),[]);
});

test("native rotation moves hull faces and shared corners without accepting a far-side/interior endpoint",()=>{
  for(const rotation of [0,37,90,180,270]) {
    const hull={x:900,y:800,width:400,height:1000,rotation},angle=(rotation-180)*Math.PI/180;
    const world=(x,y)=>({x:hull.x+x*Math.cos(angle)-y*Math.sin(angle),y:hull.y+x*Math.sin(angle)+y*Math.cos(angle)});
    assert.equal(defenseZoneContains(hull,"fore",world(0,-500)),true);
    assert.equal(defenseZoneContains(hull,"aft",world(0,-500)),false);
    assert.equal(defenseZoneContains(hull,"fore",world(200,-500)),true);
    assert.equal(defenseZoneContains(hull,"starboard",world(200,-500)),true);
    assert.equal(defenseZoneContains(hull,"fore",world(0,0)),false);
    assert.equal(defenseZoneContains(hull,"fore",world(0,-510)),false);
    assert.equal(defenseZoneExposed(hull,"starboard",world(200,-500),world(-400,-800)),false);
    assert.equal(defenseZoneExposed(hull,"fore",world(200,-500),world(-400,-800)),true);
    assert.equal(defenseZoneExposed(hull,"starboard",world(200,-500),world(400,-800)),true);
    assert.equal(defenseZoneExposed(hull,"starboard",world(200,-500),world(200,-800)),false);
    const points=defenseZoneBoundaryPoints(hull,"fore",world(130,-700));
    assert.equal(points.length,3);
    assert.ok(points.some(p=>Math.hypot(p.x-world(130,-500).x,p.y-world(130,-500).y)<1e-7));
    for(const p of points)assert.equal(defenseZoneContains(hull,"fore",p),true);
  }
});
