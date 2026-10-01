import { SYSTEM_ID, SYSTEM_PATH } from "./config.mjs";
import { actorRuleCoverage, capabilityCoverage, supportSnapshot } from "./rules-coverage.mjs";
import { localize as t } from "./localization.mjs";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const canRead=actor=>Boolean(actor && (game.user.isGM || actor.testUserPermission?.(game.user,"OBSERVER")));

export class SupportWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS={
    id:"star-wars-support",tag:"section",classes:["star-wars","sf-support"],
    window:{title:"Star Wars FFG · Help & rules coverage",resizable:true},
    position:{width:920,height:720},actions:{filter:this.filter,download:this.download}
  };
  static PARTS={body:{template:`${SYSTEM_PATH}/templates/support.hbs`}};
  filters={actorId:"",query:"",status:""};
  async _prepareContext(){
    const actors=Array.from(game.actors??[]).filter(canRead);
    const actor=actors.find(a=>a.id===this.filters.actorId);
    const campaign=game.settings.get(SYSTEM_ID,"campaign")??{};
    const report=actorRuleCoverage(actor,campaign,this.filters);
    return {...this.filters,isGM:game.user.isGM,hasActor:!!actor,
      actors:actors.map(a=>({id:a.id,name:a.name,selected:a.id===this.filters.actorId})),
      report,capabilities:capabilityCoverage(),systemPath:SYSTEM_PATH,
      statuses:[["","All statuses"],["automatic","Automatic"],["choice","Requires a choice"],["manual","Manual / incomplete"]].map(([id,label])=>({id,label,selected:id===this.filters.status})),
      diagnostic:JSON.stringify(supportSnapshot(game),null,2)};
  }
  _onRender(context,options){
    super._onRender(context,options);
    for(const select of this.element.querySelectorAll("select"))select.addEventListener("change",()=>SupportWindow.filter.call(this));
    this.element.querySelector('[name="query"]')?.addEventListener("keydown",event=>{
      if(event.key==="Enter"){event.preventDefault();SupportWindow.filter.call(this);}
    });
  }
  static filter(){
    for(const key of ["actorId","query","status"])this.filters[key]=this.element.querySelector(`[name="${key}"]`)?.value??"";
    return this.render();
  }
  static download(){
    const blob=new Blob([JSON.stringify(supportSnapshot(game),null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="star-wars-ffg-diagnostics.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
export function openSupport(){const app=new SupportWindow();void app.render({force:true});return app;}
export function registerSupportTools(){
  game.settings.registerMenu(SYSTEM_ID,"supportMenu",{
    name:t("SWFFG.UI.HelpRulesCoverage","Help & rules coverage"),label:t("SWFFG.UI.OpenHelp","Open help"),hint:t("SWFFG.UI.HelpRulesCoverageHint","Quick starts, automation limits, learned effects and privacy-safe diagnostics."),
    icon:"fas fa-circle-question",type:SupportWindow,restricted:false
  });
}
export const supportApi=Object.freeze({
  open:openSupport,
  capabilities:capabilityCoverage,
  actorCoverage(actor,filters={}){
    if(!canRead(actor))throw new Error("Observer permission is required.");
    return actorRuleCoverage(actor,game.settings.get(SYSTEM_ID,"campaign")??{},filters);
  },
  diagnostics:()=>supportSnapshot(game)
});
