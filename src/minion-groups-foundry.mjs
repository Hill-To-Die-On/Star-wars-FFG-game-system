import { SYSTEM_ID } from "./config.mjs";
import { escapeHTML as esc } from "./mechanics.mjs";
import { groupDefinition, groupId, groupStateForActor, minionGroupState, minionLinkEdges, validateMinionMembers, createMinionGroup, reconcileMinionMembers } from "./minion-groups.mjs";
import { ActorTransactionQueue, selectXpAuthority } from "./xp-transactions.mjs";

let overlay,scheduled=0,forming=false;
const rosterQueue=new ActorTransactionQueue();
const fail=error=>ui.notifications.warn(error.message);
const options=title=>({window:{title,resizable:true},classes:["star-wars","sf-minion-dialog"],position:{width:600,height:580},rejectClose:false});
export async function formSelectedMinionGroup() {
  if(forming)return;forming=true;
  try {
    if(!game.user.isGM)throw new Error("Only the GM can form a minion group.");
    const tokens=validateMinionMembers(canvas.tokens.controlled);
    const name=await foundry.applications.api.DialogV2.prompt({...options("Link selected minions"),content:`<div class="sf-dialog"><p>Link ${tokens.length} matching minions into one combat group. Wounds, skill ranks, equipment and turn indicators will be shared. Positions stay separate and the original source actors remain available.</p><label>Group name<input name="name" value="${esc(tokens[0].actor.name)}" required></label><p>Casualties follow the roster order. Recovered members rejoin automatically. Add only one group member to the combat tracker.</p></div>`,ok:{label:"Create minion group",callback:(_e,b)=>b.form.elements.name.value}});
    if(!name)return;
    const actor=await createMinionGroup(tokens,name,{user:game.user,createActor:data=>Actor.create(data,{renderSheet:false}),deleteActor:a=>a.delete()});
    ui.notifications.info(`${actor.name}: ${tokens.length} linked members.`);schedule();
  }finally{forming=false;}
}
export async function manageMinionGroup(actor) {
  if(!game.user.isGM)throw new Error("Only the GM can manage individual minion availability.");
  while(true) {
    const state=groupStateForActor(actor),definition=groupDefinition(actor);
    if(!state)throw new Error("This minion group is not available on its recorded scene.");
    const before=JSON.stringify({wounds:actor.system.wounds,definition});
    const result=await foundry.applications.api.DialogV2.wait({...options(`Minion group · ${actor.name}`),content:`<div class="sf-dialog sf-minion-roster"><p><strong>${state.remaining} active / ${state.members.length} members · group skill rank ${state.rank}</strong></p><p>All members share this sheet, equipment and turn allowance. Wounds above a member's threshold remove one link; healing reverses this in roster order.</p>
      <label>Group wounds<input type="number" name="wounds" min="0" max="100000" step="1" value="${actor.system.wounds.value}" required></label><p>Per-member threshold ${actor.system.wounds.max}. Use Apply damage on the sheet to subtract soak automatically.</p>
      ${state.members.map((t,i)=>`<article><img src="${esc(t.texture?.src??actor.img)}" alt=""/><strong>${i+1}. ${esc(t.name)}</strong><span>${state.active.includes(t)?"Active":"Out of action"}</span><label><input type="checkbox" name="inactive:${esc(t.id)}" ${definition.inactive?.includes(t.id)?"checked":""}> Temporarily unavailable</label></article>`).join("")}
      <p>Untick temporary unavailability to let a healed member rejoin. Defeated tokens remain on the scene. A deleted token is no longer counted.</p></div>`,buttons:[{action:"save",label:"Update group",default:true,callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},{action:"sheet",label:"Open group sheet",callback:()=>"sheet"}]});
    if(!result)return;
    if(result==="sheet"){actor.sheet.render(true);return;}
    if(before!==JSON.stringify({wounds:actor.system.wounds,definition:groupDefinition(actor)})){ui.notifications.warn("The group changed; review the refreshed roster.");continue;}
    const wounds=Number(result.wounds);if(!Number.isInteger(wounds)||wounds<0||wounds>100000){ui.notifications.warn("Enter a whole wound total from 0 to 100,000.");continue;}
    const inactive=state.members.filter(t=>result[`inactive:${t.id}`]).map(t=>t.id);
    await actor.update({"system.wounds.value":wounds,[`flags.${SYSTEM_ID}.minionGroup.inactive`]:inactive});schedule();return;
  }
}
export function minionPanelHTML(actor) {
  const state=groupStateForActor(actor);if(!state)return "";
  return `<aside class="sf-creation-entry"><strong>Linked minion group · ${state.remaining} / ${state.members.length} active</strong><span>Shared wounds ${actor.system.wounds.value} · per-member threshold ${actor.system.wounds.max} · group skill rank ${state.rank}</span><small>Select a member on the recorded scene to see marching connections. Healing restores the links.</small>${game.user.isGM?'<button type="button" data-action="manageMinions">Manage group members</button>':""}</aside>`;
}
export function refreshMinionLinks() {
  if(!globalThis.canvas?.ready||!globalThis.document)return;
  const selected=new Map((canvas.tokens?.controlled??[]).filter(t=>t.visible!==false&&groupId(t)&&(!t.document.hidden||game.user.isGM)).map(t=>[groupId(t),t.actor]));
  if(!selected.size){overlay?.remove();overlay=null;return;}
  const rect=canvas.app.view.getBoundingClientRect(),screen=canvas.app.renderer.screen;
  if(!rect.width||!screen.width)return;
  if(!overlay){overlay=document.createElementNS("http://www.w3.org/2000/svg","svg");overlay.classList.add("sf-minion-links");overlay.setAttribute("aria-hidden","true");document.body.append(overlay);}
  overlay.setAttribute("viewBox",`0 0 ${innerWidth} ${innerHeight}`);
  const point=token=>{
    const p=token.object;if(!p)return null;const c=canvas.stage.toGlobal(p.center);
    return {id:token.id,x:rect.left+c.x*rect.width/screen.width,y:rect.top+c.y*rect.height/screen.height,r:Math.min(p.w,p.h)*canvas.stage.scale.x*rect.width/screen.width/2};
  };
  let markup="";
  for(const actor of selected.values()) {
    const state=minionGroupState(actor,canvas.scene.tokens,{visibleOnly:true,isGM:game.user.isGM});if(!state)continue;
    const points=state.visible.map(point).filter(Boolean);
    for(const [a,b] of minionLinkEdges(points)) {
      const d=Math.hypot(b.x-a.x,b.y-a.y);if(d<=a.r+b.r)continue;
      const ux=(b.x-a.x)/d,uy=(b.y-a.y)/d,path=`M${a.x+ux*a.r},${a.y+uy*a.r} L${b.x-ux*b.r},${b.y-uy*b.r}`;
      markup+=`<path class="sf-minion-link-shadow" d="${path}"/><path class="sf-minion-link" d="${path}"/>`;
    }
    // Mark only locally visible casualties; never reveal hidden token positions to players.
    for(const t of state.members.filter(t=>!state.active.includes(t)&&(!t.hidden||game.user.isGM)&&t.object?.visible!==false)) {
      const p=point(t);if(!p)continue;
      markup+=`<circle class="sf-minion-casualty" cx="${p.x}" cy="${p.y}" r="${p.r+3}"/><path class="sf-minion-casualty" d="M${p.x-p.r*.6},${p.y-p.r*.6} L${p.x+p.r*.6},${p.y+p.r*.6}"/>`;
    }
  }
  if(overlay.innerHTML!==markup)overlay.innerHTML=markup;
}
function schedule() {
  if(scheduled)return;
  if(!overlay && !(globalThis.canvas?.tokens?.controlled??[]).some(t=>groupId(t)))return;
  scheduled=requestAnimationFrame(()=>{scheduled=0;refreshMinionLinks();});
}
export function registerMinionGroups() {
  Hooks.on("getSceneControlButtons",controls=>{
    const tools=controls.starWarsRange?.tools??Object.values(controls).find(c=>c.title==="Star Wars FFG · Range bands")?.tools;
    if(tools)tools.minions={name:"minions",order:20,title:"Link selected minions / manage group",icon:"fa-solid fa-people-group",button:true,visible:game.user.isGM,
      onChange:()=>{const actor=canvas.tokens.controlled.find(t=>groupId(t))?.actor;void (actor?manageMinionGroup(actor):formSelectedMinionGroup()).catch(fail);}};
  });
  for(const hook of ["controlToken","canvasReady","canvasPan","refreshToken","updateToken","deleteToken","updateActor"])Hooks.on(hook,schedule);
  Hooks.on("canvasTearDown",()=>{if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;overlay?.remove();overlay=null;});
  Hooks.on("renderTokenHUD",(hud,html)=>{
    const root=html?.querySelector?html:html?.[0],column=root?.querySelector(".col.left");
    if(!column||!game.user.isGM||!groupId(hud.document))return;
    const button=document.createElement("button");button.type="button";button.className="control-icon";button.title="Manage minion group";button.setAttribute("aria-label","Manage minion group");button.innerHTML='<i class="fa-solid fa-people-group" aria-hidden="true"></i>';
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();void manageMinionGroup(hud.document.actor).catch(fail);});column.append(button);
  });
  Hooks.on("preCreateCombatant",combatant=>{
    const actor=combatant.actor??game.actors.get(combatant.actorId);
    if(groupDefinition(actor)&&Array.from(combatant.parent?.combatants??[]).some(c=>c.actorId===actor.id)){
      ui.notifications.warn("This minion group already has a combat slot. Its members share one turn.");return false;
    }
  });
  Hooks.on("preCreateToken",token=>{
    if(groupDefinition(token.actor)) {ui.notifications.warn("This linked group already has scene members. Drag its original minion template to form another group.");return false;}
  });
  Hooks.on("deleteToken",token=>{
    const actor=game.actors.get(groupId(token));
    if(!actor||selectXpAuthority(actor,game.users)?.id!==game.user.id)return;
    void rosterQueue.run(actor.id,async()=>{
      const update=reconcileMinionMembers(actor,token.parent.tokens);
      if(Object.keys(update).length)await actor.update(update);
    }).catch(fail);
  });
}
