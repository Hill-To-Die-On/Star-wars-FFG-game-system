import test from "node:test";
import assert from "node:assert/strict";
import { AltitudeShadowRenderer, shadowArtworkGeometry } from "../src/altitude-shadows-foundry.mjs";

const doc=()=>({id:"ship",x:100,y:200,elevation:40,level:"sky",alpha:1,rotation:90,
  actor:{type:"vehicle",img:"ship.svg",statuses:new Set()},texture:{src:"ship.svg",fit:"fill",scaleX:1,scaleY:1},getSize:()=>({width:100,height:200})});
function fixture(){
  const ground={id:"ground",isVisible:true,elevation:{base:0}},deck={id:"deck",isVisible:true,elevation:{base:20}};
  const token=doc(),children=[],baked=[],sprites=[];
  const canvas={ready:true,level:ground,scene:{tokens:[token],levels:[ground,deck],grid:{size:100,distance:5}},
    primary:{addChild(sprite){children.push(sprite);sprite.parent=this;},removeChild(sprite){children.splice(children.indexOf(sprite),1);}}};
  const texture={width:100,height:200,baseTexture:{resource:{source:{}}}},game={settings:{get:()=>true}};
  const renderer=new AltitudeShadowRenderer({environment:()=>({canvas,game}),loadTexture:async()=>texture,
    bake:(_s,g,p)=>{const record={texture:{destroy(){this.destroyed=true;}},plan:{width:100,height:200,artWidth:100,artHeight:200,padding:0,worldWidth:g.width,worldHeight:g.height}};baked.push(record);return record;},
    createSprite:texture=>{const sprite={texture,position:{set(x,y){Object.assign(this,{x,y});}},anchor:{set(){}},scale:{x:1,y:1},destroy(){this.destroyed=true;this.texture.destroy();}};sprites.push(sprite);return sprite;}});
  return {canvas,game,renderer,children,baked,sprites,texture,token};
}

test("off-level ship projects to each visible surface, updates without rerastering on movement, and releases owned textures",async()=>{
  const saved=[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame],frames=new Map();let id=0;
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const flush=()=>{const work=[...frames.values()];frames.clear();work.forEach(fn=>fn());};
  const f=fixture();
  try{
    f.renderer.refresh();await Promise.resolve();assert.equal(frames.size,1);flush();
    assert.equal(f.children.length,2);assert.equal(f.baked.length,2);
    assert.deepEqual(f.children.map(s=>s.elevation),[0,20]);assert.ok(f.children[0].position.x>f.children[1].position.x);
    assert.equal(f.children[0].angle,270);assert.equal(f.children[0].eventMode,"none");assert.equal(f.children[0].sortLayer,650);
    const x=f.children[0].position.x;f.token.x+=50;f.renderer.schedule();f.renderer.schedule();assert.equal(frames.size,1);flush();
    assert.equal(f.children[0].position.x,x+50);assert.equal(f.baked.length,2,"position changes reuse baked softness");assert.equal(frames.size,0,"no idle animation loop");
    f.token.elevation=60;f.renderer.refresh();assert.equal(f.baked.length,4);assert.equal(f.baked[0].texture.destroyed,true);
    f.token.hidden=true;f.renderer.refresh();assert.equal(f.children.length,0,"concealing a source removes all its projections");
    f.token.hidden=false;f.renderer.refresh();await Promise.resolve();flush();assert.equal(f.children.length,2);
    f.game.settings.get=()=>false;f.renderer.refresh();assert.equal(f.children.length,0);assert.equal(frames.size,0);
    assert.equal(f.texture.destroyed,undefined,"shared Foundry artwork is never destroyed");
  }finally{f.renderer.clear();[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame]=saved;}
});

test("pending cross-level texture completion cannot resurrect shadows after teardown",async()=>{
  const f=fixture();let resolve;
  f.renderer.loadTexture=()=>new Promise(r=>{resolve=r;});f.renderer.refresh();f.renderer.clear();
  resolve(f.texture);await Promise.resolve();assert.equal(f.renderer.entries.size,0);assert.equal(f.children.length,0);
});

test("higher ships shade lower token artwork with a shared alpha mask above the receiving token",async()=>{
  const saved=[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame];
  globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  const f=fixture();
  const lower={...doc(),id:"lower",elevation:0,depth:1,sort:8};
  const mesh={texture:f.texture,position:{x:300,y:450},width:100,height:200,angle:30,anchor:{x:.5,y:.5},scale:{x:1,y:1},zIndex:2};
  const target={document:lower,mesh,visible:true};lower.object=target;f.canvas.tokens={placeables:[target]};
  try{
    f.renderer.refresh();await Promise.resolve();f.renderer.refresh();
    const pair=f.renderer.entries.get("ship:token:lower");
    assert.ok(pair?.sprite?.mask,"shadow is clipped by the receiver's alpha, not a rectangle");
    assert.equal(pair.sprite.elevation,0);assert.equal(pair.sprite.sortLayer,700);assert.equal(pair.sprite.sort,8);assert.ok(pair.sprite.zIndex>2);
    assert.equal(pair.sprite.mask.angle,30);assert.equal(f.renderer.masks.size,1);
    const baked=f.baked.length;mesh.position.x+=1;f.renderer.refresh();assert.equal(f.baked.length,baked,"moving a receiver updates the mask without rerastering");
    const former=pair.sprite;mesh.position.x+=10000;f.renderer.refresh();
    assert.equal(former.destroyed,true,"leaving the projected area releases the unused raster");
    assert.equal(pair.sprite,undefined);assert.equal(f.renderer.masks.size,0);
    mesh.position.x-=10000;f.renderer.refresh();assert.ok(pair.sprite.mask,"returning to the shadow needs no texture reload");
    lower.elevation=100;f.renderer.refresh();assert.equal(f.renderer.entries.has("ship:token:lower"),false,"lower ships cannot shade higher ones");
    assert.equal(f.renderer.masks.size,0,"unused masks are released");
    lower.elevation=0;lower.hidden=true;f.renderer.refresh();assert.equal(f.renderer.entries.has("ship:token:lower"),false);
  }finally{f.renderer.clear();[globalThis.requestAnimationFrame,globalThis.cancelAnimationFrame]=saved;}
});

test("geometry uses animated mesh transforms and preserves off-level portrait facing, scaling and locks",()=>{
  const token=doc(),texture={width:200,height:100};
  const g=shadowArtworkGeometry(token,texture);assert.equal(g.width,100);assert.equal(g.height,200);assert.equal(g.angle,270);
  token.lockRotation=true;assert.equal(shadowArtworkGeometry(token,texture).angle,0);
  token.texture.fit="contain";token.texture.scaleX=-2;const fitted=shadowArtworkGeometry(token,texture);
  assert.equal(fitted.width,200);assert.equal(fitted.height,50);assert.equal(fitted.flipX,true);
  const mesh={position:{x:123,y:345},width:170,height:250,angle:45,anchor:{x:.25,y:.7},scale:{x:1,y:-1}};
  assert.deepEqual(shadowArtworkGeometry(token,texture,{mesh}),{x:123,y:345,width:170,height:250,angle:45,anchorX:.25,anchorY:.7,flipX:false,flipY:true});
});
