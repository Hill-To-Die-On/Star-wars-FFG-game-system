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

test('requested check opens native confirmation and cancellation never rolls', async () => {
  let dialog;
  globalThis.game = {user: {targets: new Set()}, settings: {get: () => 'publicroll'}};
  foundry.applications.api.DialogV2.prompt = async options => { dialog = options; return null; };
  const actor = {type:'npc', name:'Scout', system:{characteristics:{intellect:3}, criticals:[]},
    skillDefinition:key => key === 'Computers' ? {key:'computers', label:'Computers', group:'General', state:{characteristic:'intellect'}} : null,
    skillRank: () => 2, talentRulesForCheck: () => null, assertOwner: () => {}};
  const {openRequestedSkillCheck} = await import('../src/sheets.mjs');
  assert.equal(await openRequestedSkillCheck(actor,'Computers',{difficulty:1,challenge:0,setback:0}), undefined);
  assert.match(dialog.window.title,/Computers/);
  assert.match(dialog.ok.label,/Roll/);
  await assert.rejects(openRequestedSkillCheck({...actor, assertOwner: () => {throw new Error('Owner permission is required.');}},'Computers',{difficulty:1,challenge:0,setback:0}), /Owner permission/);
  await assert.rejects(openRequestedSkillCheck(actor,'Wrong',{difficulty:1,challenge:0,setback:0}), /valid native skill/);
});
