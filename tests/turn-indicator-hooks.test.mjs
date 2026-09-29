import test from "node:test";
import assert from "node:assert/strict";
import { registerTurnEconomy } from "../src/turn-economy-foundry.mjs";

test("HUD open, parent pan/zoom and close reflow after Foundry layout, coalesce, and stop when idle",()=>{
  const keys=["game","Hooks","canvas","document","getComputedStyle","requestAnimationFrame","cancelAnimationFrame","MutationObserver","ResizeObserver","innerWidth","innerHeight"];
  const previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
  const hooks=new Map(),frames=new Map(),observers=[];let next=0,indicator,hudVisible=false,hudTop=170;
  const parent={id:"hud"},hud={parentElement:parent,querySelector:()=>null,querySelectorAll:()=>[],
    getBoundingClientRect:()=>({left:75,right:225,top:hudTop,bottom:330,width:150,height:330-hudTop})};
  const fire=(name,...args)=>{for(const fn of hooks.get(name)??[])fn(...args);};
  const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
  globalThis.game={user:{isGM:true},settings:{register:()=>{},get:()=>undefined}};
  globalThis.Hooks={once:()=>{},on:(key,fn)=>hooks.set(key,[...(hooks.get(key)??[]),fn]),callAll:()=>{}};
  globalThis.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.MutationObserver=class{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(node){this.targets.push(node);}disconnect(){this.disconnected=true;}};
  globalThis.ResizeObserver=undefined;
  globalThis.innerWidth=800;globalThis.innerHeight=600;
  globalThis.getComputedStyle=()=>({display:"block",visibility:"visible",opacity:"1"});
  globalThis.document={body:{append:()=>{}},querySelector:()=>hudVisible?hud:null,querySelectorAll:()=>[],createElement:()=>indicator={
    style:{},dataset:{},offsetWidth:165,offsetHeight:35,setAttribute:()=>{},addEventListener:()=>{},remove:()=>{},
    getBoundingClientRect:()=>({width:165,height:35})}};
  const token={id:"a",x:100,y:200,w:100,h:100,visible:true,isOwner:true,actor:{name:"Hero",type:"character",system:{},items:[]}};
  globalThis.canvas={ready:true,tokens:{controlled:[token],placeables:[token]},stage:{worldTransform:{apply:p=>p}},app:{
    canvas:{getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600,width:800,height:600})},renderer:{screen:{width:800,height:600}}}};
  try{
    registerTurnEconomy();fire("controlToken");const normalTop=indicator.style.top;
    hudVisible=true;fire("renderTokenHUD",{},hud);assert.equal(frames.size,1);flush();
    assert.equal(Number.parseFloat(indicator.style.top)+35,hudTop-8);
    fire("canvasPan");fire("canvasPan");
    assert.equal(frames.size,1,"pan must wait for the final DOM transform, once per frame");
    hudTop=100;flush();assert.equal(Number.parseFloat(indicator.style.top)+35,92);
    assert.ok(observers[0].targets.includes(parent),"the HUD parent's transform moves all overflowing controls");
    hudTop=120;observers[0].callback([]);observers[0].callback([]);assert.equal(frames.size,1);flush();
    assert.equal(Number.parseFloat(indicator.style.top)+35,112);assert.equal(frames.size,0,"no idle polling");
    hudVisible=false;fire("closeTokenHUD");flush();assert.equal(indicator.style.top,normalTop);
    assert.equal(observers[0].disconnected,true);
    token.tooltip={text:"+150 m",visible:true,getBounds:()=>({x:120,y:160,width:60,height:30})};
    fire("refreshToken",token);assert.equal(frames.size,1);flush();
    assert.ok(Number.parseFloat(indicator.style.top)+35<=152,"a newly rendered elevation label clears the bar");
    token.tooltip.visible=false;fire("refreshToken",token);flush();assert.equal(indicator.style.top,normalTop);
    const neighbor={id:"b",visible:true,tooltip:{...token.tooltip,visible:true}};
    canvas.tokens.placeables.push(neighbor);fire("refreshToken",neighbor);assert.equal(frames.size,1);flush();
    assert.ok(Number.parseFloat(indicator.style.top)+35<=152,"nearby token labels also reserve space");
    assert.equal(frames.size,0,"canvas label avoidance does not poll");
    token.visible=false;fire("refreshToken",token);flush();
    const previousIndicator=indicator;
    token.visible=true;fire("refreshToken",token);
    assert.equal(frames.size,1,"a selected token can recreate its strip after a visibility refresh");flush();
    assert.notEqual(indicator,previousIndicator);
    canvas.tokens.controlled=[];fire("controlToken");fire("refreshToken",token);
    assert.equal(frames.size,0,"unselected tokens do not schedule indicator work");
  }finally{fire("canvasTearDown");for(const [k,v]of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
