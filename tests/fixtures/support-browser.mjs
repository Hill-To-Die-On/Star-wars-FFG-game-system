class Application {
 constructor(){this.element=null;}
 async render(){
   const context=await this._prepareContext();
   this.element?.remove();
   const host=document.createElement("section");host.className="application star-wars sf-support";
   host.innerHTML='<div class="window-content">'+Handlebars.templates.support(context)+'</div>';
   document.body.append(host);this.element=host;
   for(const button of host.querySelectorAll("[data-action]"))button.addEventListener("click",event=>this.constructor.DEFAULT_OPTIONS.actions[button.dataset.action].call(this,event,button));
   this._onRender(context,{});return this;
 }
 _onRender(){}
 async close(){this.element?.remove();this.element=null;}
}
globalThis.foundry={applications:{api:{ApplicationV2:Application,HandlebarsApplicationMixin:Base=>Base}}};
const nodes=[
 {id:"auto",name:"Leadership focus",activation:"Passive",effects:[{type:"pool",operation:"add",target:"boost",count:1,skills:["leadership"]}]},
 {id:"manual",name:"Situational ability",effects:[]},
 {id:"active",name:"Chosen modifier",activation:"Incidental",effects:[{type:"pool",operation:"remove",target:"setback",count:1}]}
];
const actor={id:"hero",name:"Mira",system:{advancement:nodes.map(n=>({itemId:"tree",nodeId:n.id}))},items:[{id:"tree",type:"specialization",system:{source:{book:"Test Book",page:"12"},tree:{nodes,verification:{source:"full-chart"}}}}],testUserPermission:()=>true};
globalThis.game={version:"14.368",system:{version:"0.3.0"},user:{isGM:false},actors:Object.assign([actor,{id:"hidden",name:"Secret actor",testUserPermission:()=>false}],{size:2}),settings:{get:()=>({bookMode:"all"})},modules:new Map(),scenes:{size:1},messages:{size:8}};
const module=await import("/src/support-foundry.mjs");
globalThis.fixture={...module,app:module.openSupport(),actor};

