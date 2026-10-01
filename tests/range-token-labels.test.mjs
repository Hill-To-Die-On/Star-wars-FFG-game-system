import test from "node:test";
import assert from "node:assert/strict";
import { rangeOriginTitlePosition, refreshRangeOverlay, registerRangeOverlay } from "../src/range-overlay/foundry.mjs";
import { refreshCrewStrips } from "../src/vehicle-crew-foundry.mjs";

test("range caption clears the rendered nameplate at different zooms, UI scales and line heights", () => {
  const oldCanvas=globalThis.canvas, oldPIXI=globalThis.PIXI;
  globalThis.PIXI={};
  try {
    for(const zoom of [0.25,0.5,1,2])for(const height of [28,64]) {
      const offset={x:150,y:80}, nameBottom=338+height;
      globalThis.canvas={interface:{worldTransform:{applyInverse:p=>({x:(p.x-offset.x)/zoom,y:(p.y-offset.y)/zoom})}},
        app:{renderer:{screen:{height:800}},canvas:{getBoundingClientRect:()=>({height:800})}}};
      const token={x:100,y:200,w:100,h:100,nameplate:{visible:true,width:220,height,
        getBounds:()=>({x:40*zoom+offset.x,y:338*zoom+offset.y,width:220*zoom,height:height*zoom})}};
      const result=rangeOriginTitlePosition(token);
      assert.equal(result.x,150);
      assert.ok((result.y-nameBottom)*zoom>=6-1e-8,`caption overlaps the displayed name at zoom ${zoom}`);
      assert.ok((result.y-nameBottom)*zoom<=16,"keep the caption close to the name");
      token.nameplate.visible=false;
      assert.deepEqual(rangeOriginTitlePosition(token),{x:150,y:312},"a hidden name must not reserve space");
      token.nameplate.visible=true;
      assert.equal(rangeOriginTitlePosition(token).y,result.y,"late minion names receive the same clearance");
    }
  }finally{globalThis.canvas=oldCanvas;globalThis.PIXI=oldPIXI;}
});

test("range caption still clears rotated artwork without a rendered nameplate",()=>{
  const token={x:100,y:200,w:100,h:300,mesh:{width:100,height:300,angle:45}};
  const position=rangeOriginTitlePosition(token);
  assert.equal(position.x,150);assert.ok(position.y>=512);
});

test("a player never draws a range origin for a token outside their vision",()=>{
  const oldCanvas=globalThis.canvas,oldPIXI=globalThis.PIXI,oldGame=globalThis.game;
  const point=()=>({set(){}});
  class Container {
    children=[];position=point();scale=point();anchor=point();
    addChild(child){child.parent=this;this.children.push(child);return child;}
    removeChildren(){return this.children.splice(0);}
    sortChildren(){}destroy(){this.destroyed=true;}
  }
  class Graphics extends Container {
    lineStyle(){return this;}beginFill(){return this;}endFill(){return this;}
    drawRoundedRect(){return this;}drawCircle(){return this;}moveTo(){return this;}lineTo(){return this;}
  }
  class Text extends Container {constructor(text){super();this.text=text;}}
  const root=new Container();
  const token={id:"unseen",center:{x:150,y:250},x:100,y:200,w:100,h:100,visible:false,
    actor:{name:"Unseen Droid"},document:{id:"unseen",hidden:false,rotation:0}};
  globalThis.PIXI={Container,Graphics,Text,TextStyle:class{}};
  globalThis.canvas={interface:root,scene:{id:"vision-test",grid:{size:100}}};
  globalThis.game={user:{isGM:false},settings:{get:()=>true}};
  try {
    const preview={token,profile:{bands:[],scaleLabel:"Personal"}};
    refreshRangeOverlay({preview});
    assert.equal(root.children[0].children.length,0,"the hidden token's crosshair and name stay concealed");
    token.visible=true;
    refreshRangeOverlay({preview});
    assert.equal(root.children[0].children.length,1,"the same origin appears when Foundry reveals its token");
  }finally{globalThis.canvas=oldCanvas;globalThis.PIXI=oldPIXI;globalThis.game=oldGame;}
});

test("a late minion name reflows an existing caption once, including a caption without band labels",()=>{
  const keys=["canvas","PIXI","game","document","Hooks","requestAnimationFrame","cancelAnimationFrame","innerWidth","innerHeight"];
  const saved=Object.fromEntries(keys.map(key=>[key,globalThis[key]])),hooks=new Map(),frames=new Map();let next=0;
  const point=()=>({x:0,y:0,set(x,y=x){this.x=x;this.y=y;}});
  class Container {
    children=[];position=point();scale=point();
    addChild(child){child.parent=this;this.children.push(child);return child;}
    removeChildren(){return this.children.splice(0);}
    sortChildren(){} destroy(){this.destroyed=true;}
  }
  class Graphics extends Container {
    lineStyle(){return this;}beginFill(){return this;}endFill(){return this;}
    drawRoundedRect(){return this;}drawCircle(){return this;}moveTo(){return this;}lineTo(){return this;}
  }
  class Text extends Container {constructor(text){super();this.text=text;}anchor=point();width=220;height=26;}
  const root=new Container();root.worldTransform={applyInverse:p=>p};
  const token={id:"minion",x:100,y:200,w:100,h:100,center:{x:150,y:250},visible:true,
    actor:{type:"minion",name:"Patrol",system:{groupSize:1}},document:{name:"Stormtrooper",flags:{}},
    nameplate:{text:"Stormtrooper",visible:false,width:220,height:28,getBounds:()=>({x:40,y:338,width:220,height:28})}};
  globalThis.PIXI={Container,Graphics,Text,TextStyle:class{}};
  globalThis.canvas={ready:true,interface:root,scene:{id:"label-test",grid:{size:100}},tokens:{placeables:[token]},
    app:{renderer:{screen:{width:800,height:600}},canvas:{getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})}}};
  globalThis.game={user:{isGM:true},settings:{get:()=>false,register:()=>{}}};
  globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};globalThis.innerWidth=800;globalThis.innerHeight=600;
  const fire=(name,...args)=>{for(const fn of hooks.get(name)??[])fn(...args);};
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,[...(hooks.get(name)??[]),fn]),callAll:fire};
  globalThis.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
  try {
    registerRangeOverlay();refreshRangeOverlay({preview:{token,profile:{bands:[],scaleLabel:"Personal"}}});
    const title=root.children[0].children[0].children.find(c=>c.name==="sf-range-origin-title");
    assert.ok(title,"the actual origin caption was drawn");assert.equal(title.position.y,312);
    refreshCrewStrips();assert.equal(token.nameplate.visible,true);assert.equal(token.nameplate.text,"1 Stormtrooper");
    assert.equal(frames.size,1,"the late name schedules a reflow even without visible band labels");
    refreshCrewStrips();assert.equal(frames.size,1);flush();
    assert.equal(title.position.y,374,"caption clears the rendered minion name by eight world pixels");
    refreshCrewStrips();assert.equal(frames.size,0,"unchanged names cause no idle work");
    token.nameplate.getBounds=()=>({x:40,y:338,width:220,height:60});fire("canvasPan");flush();
    assert.equal(title.position.y,406,"camera reflow measures the changed text height");
    fire("canvasTearDown");fire("starWarsTokenNameplateChanged");assert.equal(frames.size,0);
  }finally{for(const key of keys)globalThis[key]=saved[key];}
});
