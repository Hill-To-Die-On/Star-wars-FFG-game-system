import test from 'node:test';
import assert from 'node:assert/strict';
import {registerRangeOverlay,showAttackTrace,getAttackTraceState} from '../src/range-overlay/foundry.mjs';

test('changing reduced motion settles an active targeting animation and teardown leaves no frames or preference listeners',()=>{
  const keys=['canvas','PIXI','game','document','Hooks','requestAnimationFrame','cancelAnimationFrame','matchMedia','innerWidth','innerHeight'];
  const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]])),hooks=new Map(),frames=new Map(),listeners=new Set();let id=0;
  const point=()=>({x:0,y:0,set(x,y=x){this.x=x;this.y=y;}});
  class Container {children=[];position=point();scale=point();width=260;height=160;
    addChild(c){c.parent=this;this.children.push(c);return c;}addChildAt(c){return this.addChild(c);}
    removeChildren(){return this.children.splice(0);}sortChildren(){}on(){}destroy(){this.destroyed=true;}}
  class Graphics extends Container {clear(){return this;}lineStyle(){return this;}beginFill(){return this;}endFill(){return this;}drawCircle(){return this;}drawRoundedRect(){return this;}moveTo(){return this;}lineTo(){return this;}}
  class Text extends Container {constructor(text){super();this.text=text;}anchor=point();}
  const root=new Container();root.worldTransform={applyInverse:p=>p};
  const scene={id:'motion',grid:{type:1,size:100,distance:1,units:'m'},getFlag:()=>({scale:'personal'})};
  const source={id:'source',x:100,y:100,w:100,h:100,center:{x:150,y:150},document:{id:'source',elevation:0,parent:scene},actor:{id:'a',type:'character',name:'A',system:{characteristics:{brawn:2},skills:{}}}};
  const target={...source,id:'target',x:500,center:{x:550,y:150},document:{id:'target',elevation:0,parent:scene},actor:{...source.actor,id:'b',name:'B'}};
  const media={matches:false,addEventListener:(_e,fn)=>listeners.add(fn),removeEventListener:(_e,fn)=>listeners.delete(fn)};
  globalThis.matchMedia=()=>media;globalThis.PIXI={Container,Graphics,Text,TextStyle:class{}};
  globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};globalThis.innerWidth=1200;globalThis.innerHeight=1000;
  globalThis.game={user:{isGM:true,targets:new Set()},settings:{register(){},get:(_id,key)=>key==='rangeOverlayVisible'?false:undefined}};
  globalThis.canvas={ready:true,scene,interface:root,tokens:{controlled:[],placeables:[source,target],get:id=>id===source.id?source:target},app:{renderer:{screen:{width:1200,height:1000}},canvas:{getBoundingClientRect:()=>({left:0,top:0,width:1200,height:1000})}}};
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,[...(hooks.get(name)??[]),fn])};
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const fire=name=>{for(const fn of hooks.get(name)??[])fn();};
  try {
    registerRangeOverlay();fire('canvasReady');assert.equal(listeners.size,1);
    showAttackTrace(source,target);assert.ok(frames.size>0);assert.equal(getAttackTraceState()[0].progress,0);
    fire('canvasPan');assert.ok(frames.size>1,'camera reflow is pending beside the targeting animation');
    media.matches=true;for(const fn of listeners)fn();
    assert.equal(getAttackTraceState()[0].progress,1);assert.equal(getAttackTraceState()[0].labelVisible,true);
    assert.equal(frames.size,0,'preference change cancels all in-flight animation callbacks');
    media.matches=false;for(const fn of listeners)fn();assert.equal(frames.size,0,'enabling motion does not replay finished traces');
    for(let i=0;i<200;i++){showAttackTrace(source,target);fire('canvasTearDown');assert.equal(frames.size,0);assert.equal(listeners.size,0);fire('canvasReady');}
    fire('canvasTearDown');assert.equal(getAttackTraceState().length,0);assert.equal(frames.size,0);assert.equal(listeners.size,0);
  } finally {fire('canvasTearDown');for(const key of keys)globalThis[key]=saved[key];}
});
