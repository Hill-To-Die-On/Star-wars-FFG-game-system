import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.foundry={applications:{api:{HandlebarsApplicationMixin:base=>base,DialogV2:{}},sheets:{ActorSheetV2:class{_onRender(){}},ItemSheetV2:class{}}}};
const {StarWarsActorSheet,StarWarsItemSheet,poolBuilderContext}=await import('../src/sheets.mjs');
const root=()=>Object.assign(new EventTarget(),{dataset:{},querySelector:()=>null,querySelectorAll:()=>[]});

test('item form saves an edited vehicle weapon arc and source',async()=>{
  const sheet=new StarWarsItemSheet();let saved;
  sheet.item={update:async data=>{saved=data;}};
  await StarWarsItemSheet.DEFAULT_OPTIONS.form.handler.call(sheet,null,null,{object:{'system.metadata.fireArcOverride':'fore','system.source.book':'GM table ruling'}});
  assert.equal(saved['system.metadata.fireArcOverride'],'fore');
  assert.equal(saved['system.source.book'],'GM table ruling');
});

test('a selected enemy ship cannot become the target of a route-planning skill check',()=>{
  globalThis.game={user:{targets:new Set([{id:'tie',actor:{type:'vehicle',name:'Patrol TIE/LN'}}])}};
  const actor={type:'npc',name:'Navigator',system:{characteristics:{intellect:3}},talentRulesForCheck:()=>null};
  const context=poolBuilderContext(actor,'astrogation',null,{group:'General',label:'Astrogation'},'intellect',1);
  assert.deepEqual(context.target,{});
  assert.equal(context.automatic.pool.difficulty,2);
});

test('rerendering an actor sheet cannot multiply item-drop actions',()=>{
  const sheet=new StarWarsActorSheet();sheet.element=root();let drops=0;sheet.onDrop=()=>drops++;
  for(let i=0;i<50;i++)sheet._onRender({themeKey:'edge'},{});
  sheet.element.dispatchEvent(new Event('drop'));
  assert.equal(drops,1);
});

test('replacing a sheet root detaches the old drop listener',()=>{
  const sheet=new StarWarsActorSheet();sheet.element=root();let drops=0;sheet.onDrop=()=>drops++;
  sheet._onRender({themeKey:'edge'},{});const old=sheet.element;
  sheet.element=root();sheet._onRender({themeKey:'edge'},{});
  old.dispatchEvent(new Event('drop'));assert.equal(drops,0);
  sheet.element.dispatchEvent(new Event('drop'));assert.equal(drops,1);
});
