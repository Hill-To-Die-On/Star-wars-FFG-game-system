import { CHARACTERISTICS, SKILLS, SYSTEM_ID } from "./config.mjs";
import { escapeHTML as esc } from "./mechanics.mjs";
import { CREATION_ROLES, GUIDE_COMBAT, GUIDE_FORCE, creationCandidates, spendCreationXp, planEnemy } from "./creation-guide.mjs";
import { availableOriginOptions, fuzzyOriginOptions, ORIGIN_INDEX_FIELDS } from "./character-origins.mjs";
import { sheetLibrary } from "./sheet-catalogue.mjs";
import { groupDefinition } from "./minion-groups.mjs";

const dialogOptions=title=>({window:{title,resizable:true},classes:["star-wars","sf-creation-dialog"],position:{width:680,height:650},rejectClose:false});
const id=e=>String(e.id??e._id),option=e=>({id:id(e),name:e.name,source:e.system.source});
const options=(rows,selected)=>rows.map(e=>`<option value="${esc(e.id)}" ${e.id===selected?"selected":""}>${esc(e.name)}${e.source?.book?` · ${esc(e.source.book)}, p. ${esc(e.source.page)}`:""}</option>`).join("");
const field=(name,label,choices,selected="")=>`<label>${esc(label)}<select name="${name}">${Object.entries(choices).map(([k,v])=>`<option value="${k}" ${k===selected?"selected":""}>${esc(v.label??v)}</option>`).join("")}</select></label>`;
function searchable(dialog,choices,name) {
  const root=dialog.element,input=root.querySelector(`[data-search="${name}"]`),select=root.querySelector(`[name="${name}"]`);
  input?.addEventListener("input",()=>{select.innerHTML=options(fuzzyOriginOptions(choices,input.value,choices.length),select.value);});
}
export async function chooseCharacterOrigins(actor,pack,campaign,mode="manual") {
  const Dialog=foundry.applications.api.DialogV2,answers={};
  if(mode==="guided") {
    const questions=[
      ["role","What does this character contribute to the group?",CREATION_ROLES,"Careers and specializations are narrowed using their recorded career skills."],
      ["combat","How do they approach danger?",GUIDE_COMBAT,"A preferred combat skill narrows specializations further. Avoid fighting leaves combat unrestricted."],
      ["aptitude","What is their natural strength?",{any:"Any starting strengths",...CHARACTERISTICS},"This narrows species to those whose chosen characteristic is among their highest starting values. It spends no XP."],
      ["force","What is their starting relationship with the Force?",GUIDE_FORCE,"The GM's enabled rulebooks remain in force. Later Force specializations can still be acquired through advancement."],
    ];
    for(let step=0;step<questions.length;) {
      const [key,title,choices,hint]=questions[step],result=await Dialog.wait({...dialogOptions(`Character guide · ${step+1} of ${questions.length}`),
        content:`<div class="sf-dialog sf-creation-guide"><h2>${title}</h2>${field(key,"Choose a preference",choices,answers[key])}<p>${hint}</p><p class="sf-hint">These questions suggest catalogue choices. They grant no additional abilities or resources.</p></div>`,
        buttons:[...(step?[{action:"back",label:"Back",callback:()=>({back:true})}]:[]),{action:"next",label:"Next",default:true,callback:(_e,b)=>({value:b.form.elements[key].value})}]});
      if(!result)return null;if(result.back){step--;continue;}answers[key]=result.value;step++;
    }
  }
  let all=mode!=="guided",speciesId=actor.system.creation?.speciesId,careerId=actor.system.creation?.careerId;
  while(true) {
    const candidates=creationCandidates(pack.index,campaign,all?{}:answers),species=candidates.species.map(option),careers=candidates.careers.map(option);
    const result=await Dialog.wait({...dialogOptions(mode==="guided"?"Character guide · Choose origins":"Manual creation · Choose origins"),
      content:`<div class="sf-dialog sf-creation-guide"><p>${all?"All complete origins allowed by the GM's campaign are available.":`${species.length} species and ${careers.length} careers match these preferences. Specializations must also match.`}</p>
      <label>Find species<input type="search" data-search="species" placeholder="Species or sourcebook"></label><label>Species<select name="species" required>${options(species,speciesId)}</select></label>
      <label>Find career<input type="search" data-search="career" placeholder="Career or sourcebook"></label><label>Career<select name="career" required>${options(careers,careerId)}</select></label>
      <p class="sf-hint">Numbers and skills come from cited database entries. Missing species exceptions remain a required source review. The original sheet is unchanged until the final confirmation.</p></div>`,
      render:(_e,d)=>{searchable(d,species,"species");searchable(d,careers,"career");},
      buttons:[...(mode==="guided"?[{action:"broaden",label:all?"Use guide matches":"Show all allowed choices",callback:(_e,b)=>({broaden:true,speciesId:b.form.elements.species.value,careerId:b.form.elements.career.value})}]:[]),
        {action:"next",label:"Choose specialization",default:true,disabled:!species.length||!careers.length,callback:(_e,b)=>({speciesId:b.form.elements.species.value,careerId:b.form.elements.career.value})}]});
    if(!result)return null;
    if(result.broaden){all=!all;speciesId=result.speciesId;careerId=result.careerId;continue;}
    if(!species.some(e=>e.id===result.speciesId)||!careers.some(e=>e.id===result.careerId))throw new Error("Choose valid origins from the displayed list.");
    return {...result,mode,answers,specializationIds:candidates.specializations.map(id)};
  }
}
export async function creationXpDialog(base) {
  const Dialog=foundry.applications.api.DialogV2;
  let draft=base,allocation={characteristics:{},skills:{}};
  return Dialog.prompt({...dialogOptions("Character creation · Spend starting XP"),
    content:`<div class="sf-dialog sf-creation-guide"><p>Increase characteristics before starting play. Skills are capped at rank 2 during creation. XP can be saved for talents on the Advancement tab.</p>
      <output data-xp-summary aria-live="polite">${base.xp.available} XP available</output>
      <fieldset><legend>Characteristic increases</legend><div class="sf-creation-grid">${Object.entries(CHARACTERISTICS).map(([key,label])=>`<label>${label} · starts ${base.characteristics[key]}<input type="number" name="characteristics:${key}" value="0" min="0" max="${Math.max(0,5-base.characteristics[key])}" step="1"></label>`).join("")}</div></fieldset>
      <fieldset><legend>Skill increases</legend><div class="sf-creation-grid">${Object.entries(base.skills).sort(([a],[b])=>SKILLS[a].label.localeCompare(SKILLS[b].label)).map(([key,s])=>`<label>${esc(SKILLS[key].label)} · ${s.rank}${s.career?" · career":""}<input type="number" name="skills:${key}" value="0" min="0" max="${Math.max(0,2-s.rank)}" step="1"></label>`).join("")}</div></fieldset></div>`,
    render:(_e,dialog)=>{
      const root=dialog.element,update=()=>{
        allocation={characteristics:{},skills:{}};
        for(const input of root.querySelectorAll('input[name*="\:"]')) {const [kind,key]=input.name.split(":");allocation[kind][key]=Number(input.value);}
        const out=root.querySelector("[data-xp-summary]"),button=root.querySelector('[data-action="ok"]');
        try {draft=spendCreationXp(base,allocation);out.textContent=`${draft.xp.available} XP remaining · ${base.xp.available-draft.xp.available} XP allocated`;out.classList.remove("invalid");if(button)button.disabled=false;}
        catch(error){draft=null;out.textContent=error.message;out.classList.add("invalid");if(button)button.disabled=true;}
      };
      root.addEventListener("input",update);
    },ok:{label:"Review character",callback:()=>spendCreationXp(base,allocation)}});
}
export async function enemyGuideDialog(actor) {
  if(!game.user.isGM)throw new Error("Only the GM can generate enemies.");
  if(!["minion","rival","nemesis"].includes(actor.type))throw new Error("Open an adversary sheet to use this guide.");
  if(actor.items.size||actor.system.metadata?.enemyGuideApplied||groupDefinition(actor))throw new Error("Use a new, empty adversary sheet for the enemy guide.");
  const snapshot=()=>JSON.stringify(actor.toObject()),before=snapshot();
  const Dialog=foundry.applications.api.DialogV2,campaign=game.settings.get(SYSTEM_ID,"campaign"),pack=await sheetLibrary("Item",ORIGIN_INDEX_FIELDS),species=availableOriginOptions(pack.index,campaign).species;
  if(!species.length)throw new Error("No complete species are available in the enabled sources.");
  const role=await Dialog.prompt({...dialogOptions("Enemy guide · Role and approach"),content:`<div class="sf-dialog sf-creation-guide"><h2>What does this enemy do?</h2>${field("role","Role",CREATION_ROLES)}${field("combat","Approach to combat",GUIDE_COMBAT)}<p>Build an original NPC preset for the GM to review. Published adversaries can instead be imported from the reference catalogue. NPCs do not use player creation XP budgets.</p></div>`,ok:{label:"Choose profile",callback:(_e,b)=>Object.fromEntries(new FormData(b.form))}});
  if(!role)return;
  const recipe=await Dialog.prompt({...dialogOptions("Enemy guide · Profile"),content:`<div class="sf-dialog sf-creation-guide"><p>${esc(CREATION_ROLES[role.role].label)} · ${esc(GUIDE_COMBAT[role.combat])}</p>
    <label>Name<input name="name" value="${esc(actor.name)}" required></label><label>Find species<input type="search" data-search="species"></label><label>Species<select name="species" required>${options(species,(species.find(e=>e.name==="Human")??species[0]).id)}</select></label>
    <p>Type: <strong>${esc(actor.type)}</strong></p><label>${actor.type==="minion"?"Starting group members":"Number of individuals"}<input type="number" name="count" value="1" min="1" max="${actor.type==="minion"?100:1}"></label>
    ${actor.type!=="minion"?'<label>Trained skill rank<input type="number" name="rank" value="1" min="0" max="5"></label>':'<p>Group skill ranks follow the surviving member count, capped at 5.</p>'}</div>`,render:(_e,d)=>searchable(d,species,"species"),ok:{label:"Preview enemy",callback:(_e,b)=>Object.fromEntries(new FormData(b.form))}});
  if(!recipe)return;
  const plan=planEnemy({...recipe,...role,type:actor.type,rank:Number(recipe.rank??0),count:Number(recipe.count)},await pack.getDocument(recipe.species),campaign);
  const accepted=await Dialog.confirm({...dialogOptions("Enemy guide · Review"),content:`<div class="sf-dialog"><h2>${esc(plan.name)}</h2><p>${esc(plan.system.species)} · ${plan.type} · ${plan.system.groupSize} member(s)</p><p>${Object.entries(plan.system.skills).map(([k,v])=>`${esc(SKILLS[k].label)}: ${v.group?"group skill":v.rank}`).join(" · ")}</p><p>Wound threshold ${plan.system.wounds.max} per member · Soak ${plan.system.soak}</p><p>Species abilities, weapons, armour and talents still need review. This is an original preset, not a published stat block.</p></div>`});
  if(!accepted)return;
  if(!game.user.isGM||before!==snapshot()||JSON.stringify(campaign)!==JSON.stringify(game.settings.get(SYSTEM_ID,"campaign")))throw new Error("The actor or campaign changed while the guide was open; review it before generating.");
  plan.system.metadata={...plan.system.metadata,enemyGuideApplied:true};
  await actor.update(plan);actor.sheet.render();
}
