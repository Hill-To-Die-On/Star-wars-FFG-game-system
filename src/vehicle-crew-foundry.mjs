import { SYSTEM_ID, SKILLS } from "./config.mjs";
import { escapeHTML as esc } from "./mechanics.mjs";
import { selectXpAuthority } from "./xp-transactions.mjs";
import { CREW_FLAG, CREW_ROLES, aboard, crewCapacities, crewRoster, occupantCount,
  canManageCrew, boardingUpdate, departureUpdate, roleUpdate, attachedPosition, crewForSkill, resolveCrewCheck, boardingTargets, crewBadgeLayout } from "./vehicle-crew.mjs";
import { CrewTransactionCoordinator } from "./crew-transactions.mjs";
import { preparedCrew, preparedCrewRows } from "./crew-generation.mjs";
import { crewGenerationDialog, executeCrewGeneration } from "./crew-generation-foundry.mjs";

const documentOf=value=>value?.document ?? value;
const sceneTokens=vehicle=>documentOf(vehicle)?.parent?.tokens ?? [];
const warn=error=>globalThis.ui?.notifications?.warn(error.message);
let coordinator,frame=0,checkBuilder;
const strips=new Map(),masked=new WeakSet(),prompts=new Set();
let activeCrewDrag=null;
export function cancelCrewDrag() {activeCrewDrag?.cancel();}
export const hasVehicle=token=>!!aboard(token) && !!documentOf(token)?.parent?.tokens?.get(aboard(token).vehicleId);

export function vehicleForActor(actor) {
  if(actor?.isToken && actor.token?.actor?.type==="vehicle")return actor.token;
  const matches=Array.from(globalThis.canvas?.tokens?.placeables ?? []).filter(t=>t.actor?.uuid===actor?.uuid);
  const selected=matches.filter(t=>t.controlled);
  return documentOf(selected.length===1?selected[0]:matches.length===1?matches[0]:null);
}
export function assignedCrewCheck(vehicle,skill,memberId) {
  const v=documentOf(vehicle),result=resolveCrewCheck(v,sceneTokens(v),skill,memberId);
  if(!canManageCrew(result.token,v,globalThis.game?.user))throw new Error("Owner permission for this crew member and vehicle is required to roll.");
  return result;
}
export function visibleCrew(vehicle) {
  return crewRoster(vehicle,sceneTokens(vehicle),{user:globalThis.game?.user,visibleOnly:true});
}
export function crewContext(actor) {
  const vehicle=vehicleForActor(actor);
  return {available:!!vehicle,vehicleTokenUuid:vehicle?.uuid ?? null,capacities:crewCapacities(vehicle ?? {actor}),
    members:vehicle?visibleCrew(vehicle).map(r=>({tokenUuid:r.token.uuid,actorUuid:r.actor?.uuid,name:r.name,seat:r.seat,roles:r.roles,count:r.count})):[],
    guidance:"Use assigned characters for vehicle skills and their own turn budgets. Generate crew is an explicit GM workflow producing editable NPC presets. Prepared rosters board new vehicle tokens while a GM is connected. Select a vehicle token when several copies exist. Defence zone, weapon arcs and unencoded actions require a GM ruling."};
}
function crewCounts(vehicle,rows=crewRoster(vehicle,sceneTokens(vehicle))) {
  const cap=crewCapacities(vehicle),used={crew:0,passenger:0};
  for(const r of rows)used[r.seat]=(used[r.seat]??0)+r.count;
  return {cap,used,free:Object.fromEntries(Object.entries(cap).map(([k,v])=>[k,v===null?null:Math.max(0,v-used[k])]))};
}
function seatingSummary(vehicle) {
  const {cap,used}=crewCounts(vehicle,visibleCrew(vehicle));
  return `${used.crew} / ${cap.crew ?? "?"} crew · ${used.passenger} / ${cap.passenger ?? "?"} passengers`;
}
function portrait(row) {return `<img src="${esc(row.img)}" alt="" draggable="false">`;}
function lights(row,vehicle) {
  if(row.seat!=="crew")return '<span class="sf-crew-passenger">Passenger</span>';
  return `<div class="sf-crew-lights" role="group" aria-label="${esc(row.name)} duties">${Object.entries(CREW_ROLES).map(([key,role])=>
    `<button type="button" class="sf-crew-light ${row.roles.includes(key)?"active":""}" data-crew-command="role" data-crew-token="${esc(row.id)}" data-crew-role="${key}" aria-pressed="${row.roles.includes(key)}" aria-label="${esc(role.label)} · ${esc(row.name)}" title="${esc(role.label)} · ${row.roles.includes(key)?"assigned":"unassigned"}" ${canManageCrew(row.token,vehicle,game.user)?"":"disabled"}><i class="fa-solid ${role.icon}" aria-hidden="true"></i><span>${role.label}</span></button>`).join("")}</div>`;
}
export function crewBadgeHTML(vehicle) {
  const rows=visibleCrew(vehicle),counts=crewCounts(vehicle,rows),pilot=rows.find(r=>r.roles.includes("pilot") && r.count>0);
  const aboardCount=rows.reduce((n,r)=>n+r.count,0),pilotLabel=pilot?`Pilot: ${pilot.name}`:"No pilot assigned";
  const known=counts.free.crew!==null && counts.free.passenger!==null,free=known?counts.free.crew+counts.free.passenger:null;
  return `<button type="button" class="sf-crew-portrait sf-crew-roster" data-crew-command="roster" data-crew-token="all" aria-label="Manage crew & passengers · ${esc(vehicle.name)} · ${aboardCount} aboard" title="${esc(pilotLabel)} · ${aboardCount} aboard · click to manage; drag to disembark" ${rows.length?"":"disabled"}>${pilot?portrait(pilot):'<i class="fa-solid fa-users" aria-hidden="true"></i>'}</button>
    <button type="button" class="sf-crew-portrait sf-crew-vacancy" data-crew-command="board" aria-label="Board ${esc(vehicle.name)}" title="${esc(seatingSummary(vehicle))} · ${free===null?"Set seating":free+" places free"}">${free===null?"?":free>1?new Intl.NumberFormat("en-GB",{notation:"compact",maximumFractionDigits:1}).format(free):free===1?"+":"0"}</button>`;
}
export function crewPanelHTML(actor) {
  if(actor?.type!=="vehicle")return "";
  const vehicle=vehicleForActor(actor);
  if(!vehicle){
    const rows=preparedCrewRows(actor,game.actors),cap=crewCapacities({actor});
    return `<section class="sf-panel sf-crew-panel"><h2>Crew & passengers</h2><p>${cap.crew??"?"} crew places · ${cap.passenger??"?"} passenger places</p>
      <p>Prepare a crew here before placing the vehicle. Each new vehicle token boards its own copy of this roster while a GM is connected. If several copies are already on this scene, select the intended vehicle token to manage its occupants.</p>
      ${rows.map(row=>`<div class="sf-crew-sheet-row" data-crew-sheet data-crew-actor="${esc(row.actorId)}" tabindex="0" title="Double-click to open character sheet">${row.img?portrait(row):""}<strong>${row.count>1?row.count+" ":""}${esc(row.name)}</strong><span>${row.roles.map(r=>CREW_ROLES[r]?.label).filter(Boolean).join(" · ")||esc(row.seat)}</span>${row.actor?`<button type="button" data-crew-command="prepared-sheet" data-crew-actor="${esc(row.actorId)}">Open sheet</button>`:""}${game.user.isGM?`<button type="button" data-crew-command="unprepare" data-crew-actor="${esc(row.actorId)}" title="Remove from this prepared roster; keep the NPC actor">Remove</button>`:""}</div>`).join("")||"<p>No prepared crew yet.</p>"}
      ${game.user.isGM?'<div class="sf-button-row"><button type="button" data-crew-command="generate"><i class="fa-solid fa-users" aria-hidden="true"></i> Generate crew</button><button type="button" data-crew-command="configure">Configure seating</button></div>':"<p>Ask the GM to generate a crew.</p>"}</section>`;
  }
  const rows=visibleCrew(vehicle);
  return `<section class="sf-panel sf-crew-panel" data-crew-vehicle="${esc(vehicle.id)}"><h2>Crew & passengers</h2>
    <p>${esc(seatingSummary(vehicle))} · ${esc(vehicle.name)}</p><p class="sf-hint">Manage occupants to assign duties or disembark. Crew members use their own skills, talents and turn allowances. The small pilot portrait on the canvas opens the full roster.</p>
    ${rows.map(row=>`<div class="sf-crew-sheet-row" data-crew-sheet data-crew-token="${esc(row.id)}" tabindex="0" title="Double-click to open character sheet">${portrait(row)}<strong>${row.count>1?row.count+" ":""}${esc(row.name)}</strong><span>${esc(row.seat==="passenger"?"Passenger":row.roles.map(r=>CREW_ROLES[r]?.label).filter(Boolean).join(" · ")||"Crew · unassigned")}</span><button type="button" data-crew-command="manage" data-crew-token="${row.id}">Manage / leave</button></div>`).join("") || '<p>No named occupants aboard.</p>'}
    <div class="sf-button-row"><button type="button" data-crew-command="roster" ${rows.length?"":"disabled"}>Manage all occupants</button><button type="button" data-crew-command="board">Board a character</button>${game.user.isGM?`<button type="button" data-crew-command="generate"><i class="fa-solid fa-users" aria-hidden="true"></i> Generate crew</button><button type="button" data-crew-command="configure">Configure seating</button>${preparedCrew(actor).length?'<button type="button" data-crew-command="deploy">Board prepared crew</button>':""}`:""}</div>
    <div class="sf-crew-checks">${["pilotingPlanetary","pilotingSpace","gunnery","mechanics","astrogation","computers","leadership"].map(skill=>`<button type="button" data-crew-command="check" data-crew-skill="${skill}" ${crewForSkill(vehicle,sceneTokens(vehicle),skill).length?"":"disabled"}>${esc(SKILLS[skill]?.label ?? skill)}</button>`).join("")}</div></section>`;
}
function membersFor(vehicle,id) {
  const rows=visibleCrew(vehicle);
  return id==="all"?rows:rows.filter(r=>r.id===id);
}
function departurePoint(token,point) {
  if(!point)return {};
  if(!Number.isFinite(point.x) || !Number.isFinite(point.y))throw new Error("Choose a valid canvas position.");
  const scene=token.parent,size=scene.grid?.size || 100,rect=scene.dimensions?.sceneRect;
  let x=point.x-token.width*size/2,y=point.y-token.height*size/2;
  if(rect){x=Math.max(rect.x,Math.min(rect.right-token.width*size,x));y=Math.max(rect.y,Math.min(rect.bottom-token.height*size,y));}
  return {x,y};
}
export async function executeCrewCommand(token,command,args,user) {
  if(command==="generate"||command==="deploy")return executeCrewGeneration(token,command,args,user);
  const scene=token.parent,vehicle=scene.tokens.get(args.vehicleId ?? aboard(token)?.vehicleId);
  if(command==="board")await token.update(boardingUpdate(token,vehicle,scene.tokens,{user,seat:args.seat}),{starWarsCrewMove:true,starWarsFreeMovement:true,animate:false});
  else if(command==="role")await token.update(roleUpdate(token,vehicle,scene.tokens,args.role,{user}));
  else if(command==="leave")await token.update({...departureUpdate(token,vehicle,{user}),...departurePoint(token,args.point)},{starWarsCrewMove:true,starWarsFreeMovement:true,animate:false});
  else if(command==="split")await splitMinionGroup(token,vehicle,args,user);
  else throw new Error("Unknown crew action.");
  return {tokenId:token.id,aboard:!!aboard(token)};
}
async function splitMinionGroup(token,vehicle,args,user) {
  // Partial groups keep existing wounds aboard; the departing members are unwounded.
  departureUpdate(token,vehicle,{user});
  const count=Number(args.count),available=occupantCount(token);
  if(token.actor?.type!=="minion" || !Number.isInteger(count) || count<1 || count>=available)throw new Error("Choose fewer than all the active minions, or disembark the whole group.");
  const original=token.toObject(),sourceActor=token.actor.toObject(),copy=structuredClone(original);
  delete copy._id;copy.actorLink=false;
  copy.delta={name:sourceActor.name,type:sourceActor.type,img:sourceActor.img,system:{...sourceActor.system,groupSize:count,wounds:{...sourceActor.system.wounds,value:0}},items:sourceActor.items,effects:sourceActor.effects,flags:sourceActor.flags};
  copy.flags ??={};copy.flags[SYSTEM_ID] ??={};copy.flags[SYSTEM_ID].aboard=null;
  Object.assign(copy,departureUpdate(token,vehicle,{user}),departurePoint(token,args.point));
  delete copy[CREW_FLAG];
  const originalSize=sourceActor.system.groupSize;
  await token.update({actorLink:false,delta:{...copy.delta,system:{...sourceActor.system,groupSize:originalSize-count}}},{starWarsCrewMove:true});
  try {await sceneCreateToken(token.parent,copy);}
  catch(error){await token.update({actorLink:original.actorLink,delta:original.delta},{starWarsCrewMove:true,recursive:false});throw error;}
}
const sceneCreateToken=(scene,data)=>scene.createEmbeddedDocuments("Token",[data],{starWarsCrewMove:true});
export async function requestCrewCommand(token,command,args={}) {
  if(!coordinator)throw new Error("The crew service is not ready.");
  return coordinator.request(documentOf(token),command,args);
}
export async function boardingDialog(token,vehicle) {
  token=documentOf(token);vehicle=documentOf(vehicle);
  if(prompts.has(token.id) || aboard(token))return;
  prompts.add(token.id);
  try {
    const {free}=crewCounts(vehicle),count=occupantCount(token),crewFull=free.crew!==null && free.crew<count,passengerFull=free.passenger!==null && free.passenger<count;
    const seat=await foundry.applications.api.DialogV2.prompt({window:{title:`Enter ${vehicle.name}?`},
      content:`<p>Board <strong>${esc(token.name)}</strong>${count>1?` (${count} members)`:""}?</p><div class="form-group"><label>Place</label><select name="seat"><option value="crew" ${crewFull?"disabled":""}>Crew · ${free.crew ?? "unknown"} free</option><option value="passenger" ${passengerFull?"disabled":""} ${crewFull?"selected":""}>Passenger · ${free.passenger ?? "unknown"} free</option></select></div><p>Assigned roles use this character's skills. Boarding keeps their actor, equipment and turn state.</p>`,
      ok:{label:"Yes, enter",callback:(_e,b)=>new FormData(b.form).get("seat")},rejectClose:false});
    if(seat)await requestCrewCommand(token,"board",{vehicleId:vehicle.id,seat});
  } finally {prompts.delete(token.id);}
}
async function chooseBoarder(vehicle) {
  const candidates=Array.from(sceneTokens(vehicle)).filter(t=>["character","minion","rival","nemesis"].includes(t.actor?.type) && !aboard(t) && (!t.hidden || game.user.isGM) && canManageCrew(t,vehicle,game.user));
  if(!candidates.length)throw new Error("No available character tokens are owned on this scene. Place a character, or ask the GM to board it.");
  const id=await foundry.applications.api.DialogV2.prompt({window:{title:`Board · ${vehicle.name}`},content:`<label>Character<select name="token">${candidates.map(t=>`<option value="${t.id}">${esc(t.name)}${occupantCount(t)>1?` · ${occupantCount(t)} members`:""}</option>`).join("")}</select></label>`,ok:{label:"Choose",callback:(_e,b)=>new FormData(b.form).get("token")},rejectClose:false});
  if(id)await boardingDialog(candidates.find(t=>t.id===id),vehicle);
}
async function configureSeating(vehicle) {
  if(!game.user.isGM)throw new Error("Only the GM can change seating.");
  const cap=crewCapacities(vehicle);
  const result=await foundry.applications.api.DialogV2.prompt({window:{title:"Vehicle seating"},content:`<p>Defaults come from the database crew and passenger counts. Set the available places here when a published crew complement differs from usable seats. Named occupants are tracked; unrepresented background crew are not created.</p>${Object.entries(cap).map(([key,value])=>`<label>${key==="crew"?"Crew places":"Passenger places"}<input type="number" name="${key}" min="0" max="1000000" step="1" value="${value ?? ""}" required></label>`).join("")}`,ok:{label:"Save seating",callback:(_e,b)=>Object.fromEntries(Array.from(new FormData(b.form),([k,v])=>[k,Number(v)]))},rejectClose:false});
  if(result){for(const n of Object.values(result))if(!Number.isSafeInteger(n)||n<0||n>1000000)throw new Error("Seat counts must be whole numbers between 0 and 1,000,000.");await vehicle.actor.update({[`flags.${SYSTEM_ID}.seating`]:result});}
}
export async function crewCheckDialog(vehicle,skill,item) {
  const candidates=crewForSkill(vehicle,sceneTokens(vehicle),skill).filter(r=>canManageCrew(r.token,vehicle,game.user));
  if(!candidates.length)throw new Error("Assign an owned crew member to this duty first.");
  let id=candidates[0].id;
  if(candidates.length>1)id=await foundry.applications.api.DialogV2.prompt({window:{title:"Choose acting crew member"},content:`<label>Crew member<select name="crew">${candidates.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></label>`,ok:{label:"Build pool",callback:(_e,b)=>new FormData(b.form).get("crew")},rejectClose:false});
  if(!id)return;
  const crew=assignedCrewCheck(vehicle,skill,id);
  if(!checkBuilder)throw new Error("The dice pool builder is not ready.");
  return checkBuilder(crew.actor,skill,item,{crew});
}
export function crewManagementHTML(vehicle,members,{manage=false,point,selectAll=false}={}) {
  const duplicates=new Map();
  for(const row of members)duplicates.set(row.name,(duplicates.get(row.name)||0)+1);
  const seen=new Map();
  return `<div class="sf-crew-manage" data-crew-vehicle="${esc(vehicle.id)}"><p>${point?"Selected occupants will appear where the portrait was dropped.":"Assign duties here, or choose occupants to leave beside the vehicle."} For a partial minion group, existing wounds stay aboard and unwounded members leave.</p>${members.map(r=>{
    seen.set(r.name,(seen.get(r.name)||0)+1);
    const owned=canManageCrew(r.token,vehicle,game.user,{leaving:true}),wounds=r.actor?.system?.wounds;
    const detail=`${r.count} aboard · ${r.seat==="passenger"?"Passenger":"Crew"}${owned&&wounds?` · ${wounds.value ?? 0} wounds`:""}`;
    return `<fieldset><legend>${esc(r.name)}${duplicates.get(r.name)>1?` · Group ${seen.get(r.name)}`:""}</legend><div class="sf-crew-member-heading">${manage?`<img class="sf-crew-sheet-portrait" data-crew-sheet data-crew-token="${esc(r.id)}" src="${esc(r.img||`systems/${SYSTEM_ID}/assets/character.svg`)}" alt="" role="button" tabindex="0" aria-label="Character sheet: ${esc(r.name)}" title="Double-click to open character sheet" draggable="false">`:r.img?portrait(r):""}<span>${esc(detail)}</span></div>${manage&&r.seat==="crew"?lights(r,vehicle):""}<label>Members to disembark<input name="count-${r.id}" type="number" min="0" max="${r.count}" step="1" value="${selectAll&&owned?r.count:0}" ${owned?"":"disabled"}></label>${owned?"":'<p class="sf-hint">Only an owner or GM can change this occupant.</p>'}</fieldset>`;
  }).join("")}</div>`;
}
async function disembarkDialog(vehicle,members,point,{manage=false,all=false}={}) {
  if(!members.length)throw new Error("Only an owner or GM can disembark this character.");
  if(members.length===1 && occupantCount(members[0].token)<=1 && !manage && !all)
    return requestCrewCommand(members[0].token,"leave",{point});
  const result=await foundry.applications.api.DialogV2.prompt({classes:["sf-crew-dialog"],window:{title:manage?`Crew & passengers · ${vehicle.name}`:"Who is disembarking?",resizable:true},position:{width:560,height:560},
    content:crewManagementHTML(vehicle,members,{manage,point,selectAll:!manage&&!all}),
    render:(_e,dialog)=>bindCrewControls(dialog.element,vehicle),
    ok:{label:"Disembark selected",callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},rejectClose:false});
  if(!result)return;
  let offset=0;
  for(const row of members) {
    const count=Number(result[`count-${row.id}`]??0);
    if(!count)continue;
    if(!Number.isInteger(count)||count<0||count>row.count)throw new Error("Choose a valid number of occupants.");
    const destination=point?{x:point.x+offset*(vehicle.parent.grid?.size||100),y:point.y}:undefined;
    await requestCrewCommand(row.token,count<row.count?"split":"leave",{count,point:destination});offset++;
  }
}
function canvasPoint(event) {
  const view=canvas.app?.canvas ?? canvas.app?.view,rect=view.getBoundingClientRect(),screen=canvas.app.renderer.screen;
  return canvas.stage.worldTransform.applyInverse({x:(event.clientX-rect.left)*screen.width/rect.width,y:(event.clientY-rect.top)*screen.height/rect.height});
}
export function crewRowActor(row,vehicle,actors=game.actors) {
  return row.dataset.crewToken?sceneTokens(vehicle).get?.(row.dataset.crewToken)?.actor:actors.get(row.dataset.crewActor);
}
export function bindCrewControls(root,vehicle,actor=vehicle?.actor) {
  if(!root || root.dataset.sfCrewBound)return;
  root.dataset.sfCrewBound="true";
  const openRow=event=>{
    if(event.target.closest("button, input, select, a"))return;
    const row=event.target.closest("[data-crew-sheet]");if(!row||!root.contains(row))return;
    const member=crewRowActor(row,vehicle);
    if(member&&(game.user.isGM||member.testUserPermission(game.user,"OBSERVER"))){event.preventDefault();event.stopPropagation();member.sheet.render({force:true});}
  };
  root.addEventListener("dblclick",openRow);
  root.addEventListener("keydown",event=>{if(["Enter"," "].includes(event.key)&&event.target.matches("[data-crew-sheet]"))openRow(event);});
  root.addEventListener("click",async event=>{
    const b=event.target.closest("[data-crew-command]");if(!b || b.disabled || !root.contains(b))return;
    event.preventDefault();event.stopPropagation();
    if(root.dataset.crewDragged){delete root.dataset.crewDragged;return;}
    const id=b.dataset.crewToken,token=sceneTokens(vehicle).get?.(id);
    try {
      switch(b.dataset.crewCommand) {
        case "board":await chooseBoarder(vehicle);break;
        case "configure":await configureSeating(vehicle??{actor});break;
        case "generate":await crewGenerationDialog(vehicle??actor,requestCrewCommand);break;
        case "deploy":await requestCrewCommand(vehicle,"deploy");refreshCrewSheets();break;
        case "prepared-sheet":game.actors.get(b.dataset.crewActor)?.sheet.render({force:true});break;
        case "unprepare":if(game.user.isGM)await actor.update({[`flags.${SYSTEM_ID}.preparedCrew`]:preparedCrew(actor).filter(m=>m.actorId!==b.dataset.crewActor)});break;
        case "role":{
          await requestCrewCommand(token,"role",{role:b.dataset.crewRole});
          const active=aboard(token)?.roles?.includes(b.dataset.crewRole)??false;
          b.setAttribute("aria-pressed",String(active));b.classList.toggle("active",active);
          b.title=`${CREW_ROLES[b.dataset.crewRole].label} · ${active?"assigned":"unassigned"}`;break;
        }
        case "manage":await disembarkDialog(vehicle,membersFor(vehicle,id),null,{manage:true});break;
        case "roster":await disembarkDialog(vehicle,visibleCrew(vehicle),null,{manage:true,all:true});break;
        case "sheet":token?.actor?.sheet?.render({force:true});break;
        case "check":await crewCheckDialog(vehicle,b.dataset.crewSkill);break;
      }
    }catch(error){warn(error);}
  });
  root.addEventListener("pointerdown",event=>{
    const button=event.target.closest(".sf-crew-portrait[data-crew-token]");
    if(!button || button.disabled || event.button!==0)return;
    cancelCrewDrag();
    event.stopPropagation();delete root.dataset.crewDragged;
    const start={x:event.clientX,y:event.clientY},members=membersFor(vehicle,button.dataset.crewToken);
    let ghost;
    const move=e=>{
      if(Math.hypot(e.clientX-start.x,e.clientY-start.y)<8 && !ghost)return;
      if(!ghost){ghost=button.cloneNode(true);ghost.classList.add("sf-crew-drag-ghost");document.body.append(ghost);root.dataset.crewDragged="true";}
      ghost.style.left=`${e.clientX-24}px`;ghost.style.top=`${e.clientY-24}px`;
    };
    const finish=e=>{
      const dragged=!!ghost;cleanup();
      if(!dragged)return;
      const target=document.elementFromPoint(e.clientX,e.clientY);
      if(!target?.closest("canvas"))return;
      const point=canvasPoint(e),v=documentOf(vehicle),size=v.parent.grid?.size||100;
      if(point.x>=v.x && point.x<=v.x+v.width*size && point.y>=v.y && point.y<=v.y+v.height*size)return;
      void disembarkDialog(vehicle,members,point,{all:button.dataset.crewToken==="all"}).catch(warn);
    };
    const keydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}};
    const cleanup=()=>{
      ghost?.remove();document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",finish);document.removeEventListener("pointercancel",cancel);
      document.removeEventListener('keydown',keydown,true);globalThis.removeEventListener?.('blur',cancel);
      if(activeCrewDrag?.cancel===cancel)activeCrewDrag=null;
    };
    const cancel=()=>{cleanup();delete root.dataset.crewDragged;};
    activeCrewDrag={root,cancel};
    document.addEventListener("pointermove",move);document.addEventListener("pointerup",finish,{once:true});document.addEventListener("pointercancel",cancel,{once:true});
    document.addEventListener('keydown',keydown,true);globalThis.addEventListener?.('blur',cancel,{once:true});
  });
}
function viewport() {
  const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
  const sidebar=rect("#sidebar"),hotbar=rect("#hotbar"),controls=rect("#scene-controls");
  return {left:Math.max(12,controls?.right+8||12),top:70,right:Math.min(innerWidth-12,sidebar?.left-12||innerWidth-12),bottom:Math.min(innerHeight-12,hotbar?.top-8||innerHeight-12)};
}
function screenRect(token) {
  const view=canvas.app?.canvas ?? canvas.app?.view,rect=view.getBoundingClientRect(),screen=canvas.app.renderer.screen,transform=canvas.stage.worldTransform;
  const w=token.w,h=token.h,c=token.center,angle=(token.mesh?.angle||0)*Math.PI/180;
  const hw=(Math.abs(w*Math.cos(angle))+Math.abs(h*Math.sin(angle)))/2,hh=(Math.abs(h*Math.cos(angle))+Math.abs(w*Math.sin(angle)))/2;
  const a=transform.apply({x:c.x-hw,y:c.y-hh}),b=transform.apply({x:c.x+hw,y:c.y+hh});
  const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>{
    const p=transform.apply({x:c.x+x*Math.cos(angle)-y*Math.sin(angle),y:c.y+x*Math.sin(angle)+y*Math.cos(angle)});
    return {x:rect.left+p.x*rect.width/screen.width,y:rect.top+p.y*rect.height/screen.height};
  });
  return {left:rect.left+a.x*rect.width/screen.width,right:rect.left+b.x*rect.width/screen.width,top:rect.top+a.y*rect.height/screen.height,bottom:rect.top+b.y*rect.height/screen.height,corners};
}
export function maskEmbarkedToken(token) {
  // Off-canvas TokenDocuments have read-only visibility and no render layers.
  token=token?.document ? token : token?.object;
  if(!token)return;
  if(hasVehicle(token)) {
    masked.add(token);if(token.controlled)token.release();
    token.visible=false;token.renderable=false;if(token.mesh)token.mesh.visible=false;
  }else if(masked.has(token)){
    masked.delete(token);token.renderable=true;token.renderFlags?.set({refreshVisibility:true});
  }
}
export function refreshCrewStrips() {
  frame=0;if(!globalThis.canvas?.ready || !globalThis.document)return;
  const vehicles=(canvas.tokens?.placeables ?? []).filter(t=>t.actor?.type==="vehicle" && t.visible && (!t.document.hidden || game.user.isGM));
  let nameplatesChanged=false;
  for(const token of canvas.tokens?.placeables ?? [])if(token.actor?.type==="minion" && token.visible && !hasVehicle(token) && token.nameplate){
    const text=`${occupantCount(token)} ${token.document.name}`;
    if(token.nameplate.text!==text || !token.nameplate.visible){
      token.nameplate.text=text;token.nameplate.visible=true;nameplatesChanged=true;
    }
  }
  if(nameplatesChanged)globalThis.Hooks?.callAll("starWarsTokenNameplateChanged");
  const ids=new Set(vehicles.map(t=>t.id));
  for(const [id,entry] of strips)if(!ids.has(id)){entry.element.remove();strips.delete(id);}
  const vp=viewport();
  for(const token of vehicles) {
    let entry=strips.get(token.id);
    if(!entry){const element=document.createElement("div");element.className="sf-vehicle-crew-strip";element.dataset.vehicleId=token.id;element.setAttribute("aria-label",`${token.name} crew`);
      for(const type of ["pointerdown","dblclick","contextmenu"])element.addEventListener(type,e=>e.stopPropagation());
      document.body.append(element);bindCrewControls(element,token.document);strips.set(token.id,entry={element,html:""});}
    const html=crewBadgeHTML(token.document);
    if(entry.html!==html){entry.element.innerHTML=html;entry.html=html;}
    const pos=crewBadgeLayout(screenRect(token),vp);
    entry.element.hidden=!pos;if(pos){
      entry.element.style.setProperty("--sf-crew-size",`${pos.size}px`);entry.element.style.gap=`${pos.gap}px`;
      entry.element.style.left=`${pos.left}px`;entry.element.style.top=`${pos.top}px`;entry.element.dataset.side=pos.side;
    }
  }
}
function scheduleCrew(){if(!frame)frame=requestAnimationFrame(refreshCrewStrips);}
function refreshCrewSheets(){
  for(const app of foundry.applications.instances.values())if(app.actor?.type==="vehicle" && app.rendered)app.render(false);
}
async function followVehicle(vehicle,position={}) {
  if(selectXpAuthority(vehicle.actor,game.users)?.id!==game.user.id)return;
  await coordinator.queue.run(vehicle.parent.id,async()=>{
    const end={x:position.x ?? vehicle.x,y:position.y ?? vehicle.y,elevation:position.elevation ?? vehicle.elevation,
      level:position.level ?? vehicle.level,width:vehicle.width,height:vehicle.height,parent:vehicle.parent};
    const updates=crewRoster(vehicle,sceneTokens(vehicle)).map(r=>({_id:r.id,...attachedPosition(r.token,end)}));
    if(updates.length)await vehicle.parent.updateEmbeddedDocuments("Token",updates,{starWarsCrewMove:true,starWarsFreeMovement:true,animate:false});
  });
}
export function registerVehicleCrew({openCheck}={}) {
  checkBuilder=openCheck;
  Hooks.once("ready",()=>{coordinator=new CrewTransactionCoordinator({socket:game.socket,currentUser:()=>game.user,users:()=>game.users,getToken:uuid=>fromUuid(uuid),execute:executeCrewCommand}).start();});
  for(const hook of ["canvasReady","canvasPan","controlToken","updateActor","createToken","deleteToken","collapseSidebar"])Hooks.on(hook,scheduleCrew);
  globalThis.addEventListener?.("resize",scheduleCrew);
  Hooks.on("refreshToken",token=>{maskEmbarkedToken(token);scheduleCrew();});
  Hooks.on("preCreateToken",(token,_data,options)=>{
    if(options.starWarsCrewMove)return;
    if(aboard(token))token.updateSource({[CREW_FLAG]:null});
    if(token.actor?.type==="vehicle")token.updateSource({[`flags.${SYSTEM_ID}.crewPreparedApplied`]:[]});
  });
  Hooks.on("createToken",(token,options,userId)=>{
    if(token.actor?.type==="vehicle" && preparedCrew(token.actor).length && game.user.isGM && selectXpAuthority(token.actor,game.users)?.id===game.user.id){
      void requestCrewCommand(token,"deploy").then(refreshCrewSheets).catch(warn);return;
    }
    if(userId!==game.user.id || options.starWarsCrewMove || !["character","minion","rival","nemesis"].includes(token.actor?.type))return;
    const target=boardingTargets(token,null,token.parent.tokens,{user:game.user})[0];
    if(target)void boardingDialog(token,target).catch(warn);
  });
  Hooks.on("updateToken",(token,changes,options)=>{
    maskEmbarkedToken(token.object ?? token);scheduleCrew();
    if(changes.flags || changes.delta || changes.actorLink!==undefined)refreshCrewSheets();
    if(token.actor?.type==="vehicle" && !options.starWarsCrewMove && !options._movement && ["x","y","elevation","level","width","height"].some(k=>k in changes))void followVehicle(token,changes).catch(warn);
  });
  Hooks.on("moveToken",(token,move,options,user)=>{
    if(token.actor?.type==="vehicle" && !options.starWarsCrewMove && !move.planned)void followVehicle(token,move.destination).catch(warn);
    if(user?.id!==game.user.id || options.starWarsCrewMove || move.planned || move.method!=="dragging" || aboard(token) || !["character","minion","rival","nemesis"].includes(token.actor?.type))return;
    const targets=boardingTargets(token,move,token.parent.tokens,{user:game.user});
    if(targets[0])void boardingDialog(token,targets[0]).catch(warn);
  });
  Hooks.on("deleteToken",vehicle=>{
    if(vehicle.actor?.type!=="vehicle" || selectXpAuthority(vehicle.actor,game.users)?.id!==game.user.id)return;
    const updates=crewRoster(vehicle,sceneTokens(vehicle)).map((r,index)=>({_id:r.id,...departureUpdate(r.token,vehicle,{user:game.user,index})}));
    if(updates.length)void vehicle.parent.updateEmbeddedDocuments("Token",updates,{starWarsCrewMove:true,animate:false}).catch(warn);
  });
  Hooks.on("canvasTearDown",()=>{cancelCrewDrag();cancelAnimationFrame(frame);frame=0;for(const e of strips.values())e.element.remove();strips.clear();});
  Hooks.on('closeApplicationV2',app=>{if(activeCrewDrag&&(!activeCrewDrag.root.isConnected||app.element?.contains(activeCrewDrag.root)))cancelCrewDrag();});
}
export const crewApi=Object.freeze({roster:visibleCrew,context:crewContext,capacities:crewCapacities,vehicleForActor,assignedCheck:assignedCrewCheck,
  generate:(target,recipe)=>requestCrewCommand(target,"generate",recipe),deployPrepared:vehicle=>requestCrewCommand(vehicle,"deploy"),
  board:(token,vehicle,seat="crew")=>requestCrewCommand(token,"board",{vehicleId:documentOf(vehicle).id,seat}),
  leave:(token,point)=>requestCrewCommand(token,"leave",{point}),
  toggleRole:(token,role)=>requestCrewCommand(token,"role",{role}),openCheck:crewCheckDialog});
