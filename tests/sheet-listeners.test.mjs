import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.foundry={applications:{api:{HandlebarsApplicationMixin:base=>base,DialogV2:{}},sheets:{ActorSheetV2:class{_onRender(){}},ItemSheetV2:class{}}}};
const {StarWarsActorSheet}=await import('../src/sheets.mjs');
const root=()=>Object.assign(new EventTarget(),{dataset:{},querySelector:()=>null,querySelectorAll:()=>[]});

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
