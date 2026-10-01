import { SYSTEM_ID, SKILLS } from "./config.mjs";
import { escapeHTML as esc } from "./mechanics.mjs";
import { availableOriginOptions, fuzzyOriginOptions } from "./character-origins.mjs";
import { publishedLibrary } from "./published-library.mjs";
import { crewRoster, crewCapacities } from "./vehicle-crew.mjs";
import { CREW_GENERATION_ROLES, crewGenerationDefaults, preparedCrewRows, planCrewGeneration } from "./crew-generation.mjs";
import { generateVehicleCrew, deployPreparedCrew } from "./crew-generation-service.mjs";

export async function executeCrewGeneration(target,command,recipe,user) {
  if(!user?.isGM)throw new Error("Only the GM can generate or deploy a prepared crew.");
  const context={user,actors:game.actors,campaign:game.settings.get(SYSTEM_ID,"campaign"),
    createActor:source=>Actor.create(source,{renderSheet:false}),deleteActor:actor=>actor.delete()};
  if(command==="deploy")return deployPreparedCrew(target,context);
  context.entries=(await publishedLibrary()).documents.Item;
  return generateVehicleCrew(target,recipe,context);
}
const actorOf=target=>target.actor??target;
const rowsFor=target=>target.actor?crewRoster(target,target.parent.tokens):preparedCrewRows(target,game.actors);
const optionHTML=(choices,selected)=>choices.map(o=>`<option value="${esc(o.id)}" ${o.id===selected?"selected":""}>${esc(o.name)} · ${esc(o.source.book)}, p. ${esc(o.source.page)}</option>`).join("");

export async function crewGenerationDialog(target,request) {
  if(!game.user.isGM)throw new Error("Only the GM can generate a crew.");
  const actor=actorOf(target),source=await publishedLibrary(),campaign=game.settings.get(SYSTEM_ID,"campaign"),
    choices=availableOriginOptions(source.documents.Item,campaign).species;
  if(!choices.length)throw new Error("No complete species profiles are available under the campaign's book and ruleset filters.");
  let recipe={speciesId:(choices.find(o=>o.name==="Human")??choices[0]).id,rank:1,counts:crewGenerationDefaults(actor,rowsFor(target))};
  const Dialog=foundry.applications.api.DialogV2,common={classes:["star-wars","sf-crew-dialog"],window:{resizable:true},position:{width:610,height:720},rejectClose:false};
  while(true) {
    const cap=crewCapacities({actor}),rows=rowsFor(target),used=seat=>rows.filter(r=>r.seat===seat).reduce((n,r)=>n+r.count,0);
    recipe=await Dialog.prompt({...common,window:{...common.window,title:`Generate crew · ${actor.name}`},content:`<div class="sf-crew-generator">
      <p>${used("crew")} / ${cap.crew??"?"} crew · ${used("passenger")} / ${cap.passenger??"?"} passengers. Generate only the extra occupants needed.</p>
      <label>Find species<input type="search" data-crew-species-search placeholder="Search species or sourcebook"></label>
      <label>Species<select name="speciesId" required>${optionHTML(choices,recipe.speciesId)}</select></label>
      <label>Specialist skill rank<input type="number" name="rank" min="0" max="5" step="1" value="${recipe.rank}" required></label>
      <div class="sf-crew-generation-counts">${Object.entries(CREW_GENERATION_ROLES).map(([key,label])=>`<label>${esc(label)}<input name="count-${key}" type="number" min="0" max="${key==="pilot"?1:1000}" step="1" value="${recipe.counts[key]??0}" required></label>`).join("")}</div>
      <p class="sf-hint">Specialists are individual rivals with training in their selected duty. Support crew and passengers form untrained minion groups, up to 100 each. These are editable NPC presets; species abilities, equipment and talents still need GM review. No AI service is used.</p>
      <p class="sf-hint">${target.actor?"New members will board this vehicle; current occupants stay in place.":"The prepared roster boards automatically when a GM places this vehicle. Each new vehicle token gets its own crew tokens."}</p></div>`,
      render:(_e,dialog)=>{
        const input=dialog.element.querySelector("[data-crew-species-search]"),select=dialog.element.querySelector('[name="speciesId"]');
        input.addEventListener("input",()=>{const selected=select.value;select.innerHTML=optionHTML(fuzzyOriginOptions(choices,input.value,choices.length),selected);});
      },
      ok:{label:"Preview crew",callback:(_e,b)=>{
        const data=new FormData(b.form);
        return {speciesId:data.get("speciesId"),rank:Number(data.get("rank")),counts:Object.fromEntries(Object.keys(CREW_GENERATION_ROLES).map(key=>[key,Number(data.get(`count-${key}`))]))};
      }}});
    if(!recipe)return null;
    let plan;
    try {plan=planCrewGeneration(actor,recipe,{rows:rowsFor(target),species:source.documents.Item.find(e=>(e.id??e._id)===recipe.speciesId),campaign});}
    catch(error){ui.notifications.warn(error.message);continue;}
    const choice=await Dialog.wait({...common,window:{...common.window,title:"Review generated crew"},
      content:`<div class="sf-crew-generation-review"><p><strong>${plan.people} occupants · ${plan.members.length} NPC sheets · ${esc(plan.species)}</strong></p>
        <p>${target.actor?"Create and board these NPCs now.":"Create these NPC sheets and save them in this vehicle's prepared roster."} Names and stats can be edited afterwards.</p>
        ${plan.members.map(m=>`<article><strong>${esc(m.source.name)}</strong><p>${m.count} ${m.count===1?"occupant":"occupants"} · ${m.source.type} · ${esc(m.seat)}</p><p>${Object.entries(m.source.system.skills).map(([key,s])=>`${esc(SKILLS[key].label)} ${s.rank}`).join(" · ")||"No trained skills"}</p></article>`).join("")}
        <p class="sf-hint">Generic presets, not official adversary stat blocks. Review species abilities and add equipment or talents as needed.</p></div>`,
      buttons:[{action:"back",label:"Back",callback:()=>"back"},{action:"create",label:"Create crew",default:true,callback:()=>"create"}]});
    if(choice==="back")continue;
    if(choice!=="create")return null;
    const result=await request(target,"generate",recipe);
    actor.sheet?.render(false);
    ui.notifications.info(`${result.people} occupants ${result.state==="aboard"?"boarded":"prepared"} for ${actor.name}.`);
    return result;
  }
}
