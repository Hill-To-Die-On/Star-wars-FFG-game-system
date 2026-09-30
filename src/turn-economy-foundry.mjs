import { SYSTEM_ID } from "./config.mjs";
import { TURN_DEFAULTS, TURN_LABELS, turnBudget, turnKey, turnUpdate, validateTurnConfig } from "./turn-economy.mjs";
import { canSpendXp } from "./xp-transactions.mjs";
import { TurnTransactionCoordinator } from "./turn-transactions.mjs";
import { aboard } from "./vehicle-crew.mjs";
import { groupDefinition, groupStateForActor, hasSharedMinionMove, minionMoveUpdate } from "./minion-groups.mjs";
import { chooseTurnIndicatorLayout } from "./turn-indicator-layout.mjs";
import { turnOptionTooltips } from "./turn-options.mjs";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const setting = (key, fallback) => {
  try { return globalThis.game?.settings?.get(SYSTEM_ID,key) ?? fallback; } catch { return fallback; }
};
let coordinator;
const indicators = new Map();
let reflowFrame=null,hudObserver=null,hudResizeObserver=null;
const watchedApplications=new WeakSet();

function scheduleTurnIndicatorReflow() {
  if(reflowFrame!==null || (!indicators.size && !globalThis.canvas?.tokens?.controlled?.length))return;
  reflowFrame=globalThis.requestAnimationFrame(()=>{reflowFrame=null;refreshTurnIndicators();});
}

function watchTurnHUD(root) {
  hudObserver?.disconnect();hudResizeObserver?.disconnect();
  hudObserver=null;hudResizeObserver=null;
  if(!root)return;
  if(globalThis.MutationObserver){
    hudObserver=new MutationObserver(scheduleTurnIndicatorReflow);
    hudObserver.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["style","class","hidden"]});
    if(root.parentElement)hudObserver.observe(root.parentElement,{attributes:true,attributeFilter:["style","class"]});
  }
  if(globalThis.ResizeObserver){
    hudResizeObserver=new ResizeObserver(scheduleTurnIndicatorReflow);
    for(const element of [root,...root.querySelectorAll(".col,.palette")])hudResizeObserver.observe(element);
  }
}

function visibleBounds(element) {
  if(element.checkVisibility && !element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))return null;
  const style=globalThis.getComputedStyle(element),r=element.getBoundingClientRect();
  return style.display!=="none" && style.visibility!=="hidden" && Number(style.opacity)!==0 && r.width>0 && r.height>0
    ? {left:r.left,top:r.top,right:r.right,bottom:r.bottom}:null;
}

export function turnIndicatorObstacleBounds() {
  const selectors=".application, .app.window-app, .sf-arc-picker-help, #scene-controls, #scene-navigation > menu > *, #sidebar, #hotbar, #players-active, #chat-message, .sf-compact-dice, #notifications .notification";
  const occupied=Array.from(document.querySelectorAll(selectors),visibleBounds).filter(Boolean);
  // The HUD root only spans the token. Columns, elevation fields and palettes
  // overflow it, so reserve their entire visible envelope (including extensions).
  const hud=document.querySelector("#token-hud");
  if(hud){
    const parts=[hud,...hud.querySelectorAll(".col,.control-icon,.attribute,.palette")].map(visibleBounds).filter(Boolean);
    if(parts.length)occupied.push({left:Math.min(...parts.map(r=>r.left)),top:Math.min(...parts.map(r=>r.top)),
      right:Math.max(...parts.map(r=>r.right)),bottom:Math.max(...parts.map(r=>r.bottom))});
  }
  // Elevation and level labels are drawn by PIXI, outside the DOM token HUD.
  // getBounds includes their anchors, UI scale, camera zoom and parent transforms.
  const app=globalThis.canvas?.app,view=app?.canvas ?? app?.view;
  const rect=view?.getBoundingClientRect?.(),screen=app?.renderer?.screen;
  if(rect?.width>0 && rect?.height>0 && screen?.width>0 && screen?.height>0){
    for(const token of globalThis.canvas?.tokens?.placeables ?? []){
      if(token.visible===false || token.renderable===false || (token.document?.hidden && !globalThis.game?.user?.isGM))continue;
      for(const label of [token.tooltip,token.levelIndicator,token.nameplate]){
        if(!label || label.destroyed || label.visible===false || label.worldVisible===false || label.renderable===false || label.worldAlpha===0)continue;
        if(typeof label.text==="string" && !label.text.trim())continue;
        const bounds=label.getBounds?.();
        if(!(bounds?.width>0 && bounds?.height>0) || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y))continue;
        occupied.push({left:rect.left+bounds.x*rect.width/screen.width,top:rect.top+bounds.y*rect.height/screen.height,
          right:rect.left+(bounds.x+bounds.width)*rect.width/screen.width,bottom:rect.top+(bounds.y+bounds.height)*rect.height/screen.height});
      }
    }
  }
  return occupied;
}

export function activeCombatForActor(actor) {
  if (!actor?.uuid) return null;
  const combats = [...(globalThis.game?.combats ?? [])];
  const current = globalThis.game?.combat;
  if (current) combats.unshift(current);
  return combats.find(combat => combat.started && Array.from(combat.combatants ?? []).some(c => {
    if(c.actor?.uuid === actor.uuid)return true;
    const scene=c.token?.parent ?? combat.scene;
    if(actor.type === "vehicle") {
      const vehicles=new Set(Array.from(scene?.tokens ?? []).filter(t=>t.actor?.uuid===actor.uuid).map(t=>t.id));
      if(Array.from(scene?.tokens ?? []).some(t=>t.actor?.uuid===c.actor?.uuid && vehicles.has(aboard(t)?.vehicleId)))return true;
    }
    return c.tokenId && Array.from(scene?.tokens ?? []).some(t=>t.actor?.uuid===actor.uuid && aboard(t)?.vehicleId===c.tokenId);
  })) ?? null;
}

export function mayManageTurns(actor, user, mode = setting("turnTrackerControl", "gm")) {
  return canSpendXp(actor,user) && (user.isGM || mode === "players");
}

export function authorizeTurnRequest(actor, command, options, user, mode = setting("turnTrackerControl", "gm")) {
  if (!canSpendXp(actor,user)) throw new Error("Owner permission is required.");
  if (command === "activate" && !user.isGM) throw new Error("The GM must confirm this rule's prerequisites and costs.");
  const automatic = (options.automatic === "roll" && ["action","maneuver"].includes(command)) ||
    (options.automatic === "move" && command === "maneuver");
  if (!automatic && !mayManageTurns(actor,user,mode)) throw new Error("The GM manages turn indicators in this world. Automatic spending remains enabled.");
}

export function readTurnBudget(actor) {
  const combat = activeCombatForActor(actor);
  return { ...turnBudget(actor,{key:turnKey(combat)}),
    roundLabel:combat ? `Round ${combat.round}` : "Outside combat",
    editable:mayManageTurns(actor,globalThis.game?.user), isGM:!!globalThis.game?.user?.isGM };
}

export async function performTurnCommand(actor, command, options = {}) {
  if (!coordinator) throw new Error("The turn tracker is not ready.");
  const args = { expectedKey:turnKey(activeCombatForActor(actor)), ...options };
  authorizeTurnRequest(actor,command,args,game.user);
  return coordinator.request(actor,command,args);
}

export async function rotateToken(tokenOrDocument, direction, step = 45) {
  const doc = tokenOrDocument?.document ?? tokenOrDocument;
  if (!doc?.isOwner && !globalThis.game?.user?.isGM) throw new Error("Owner permission is required to rotate this token.");
  if (doc.lockRotation) throw new Error("Token rotation is locked.");
  if (!["cw","ccw"].includes(direction) || ![15,45,90].includes(step)) throw new Error("Choose a valid rotation step.");
  return doc.update({rotation:((Number(doc.rotation) || 0)+(direction === "cw" ? step : -step)+360)%360});
}

function tokenVerticalExtent(token) {
  const x = Number(token.x ?? token.document?.x) || 0, y = Number(token.y ?? token.document?.y) || 0;
  const w = Number(token.w) || 0, h = Number(token.h) || 0;
  const mw = Math.abs(Number(token.mesh?.width) || w), mh = Math.abs(Number(token.mesh?.height) || h);
  const angle = (Number(token.mesh?.angle) || 0)*Math.PI/180;
  const halfHeight = Math.max(h,Math.abs(Math.sin(angle))*mw+Math.abs(Math.cos(angle))*mh)/2;
  const halfWidth = Math.max(w,Math.abs(Math.cos(angle))*mw+Math.abs(Math.sin(angle))*mh)/2;
  return {x:x+w/2,left:x+w/2-halfWidth,right:x+w/2+halfWidth,top:y+h/2-halfHeight,bottom:y+h/2+halfHeight};
}
export function tokenIndicatorPosition(token) {
  const extent = tokenVerticalExtent(token);
  return {x:extent.x,y:extent.top};
}
export function tokenLabelPosition(token) {
  const extent = tokenVerticalExtent(token);
  return {x:extent.x,y:extent.bottom+12};
}

export function turnIndicatorHTML(b, {editable = b.editable ?? false, compact = false, actor = null} = {}) {
  if (!b.supported) return "";
  const help = turnOptionTooltips(actor,b);
  const button = (command,label,content,enabled,cls="",extra="") =>
    `<button type="button" data-sf-turn="${command}" class="${cls}" title="${escape(label)}" aria-label="${escape(label)}" ${enabled && editable ? "" : "disabled"} ${extra}>${content}</button>`;
  const lights = (entries,command,label) => entries.map((pip,i) => button(command,`Use ${label} ${i+1}`,
    `<span aria-hidden="true"></span>`,pip.available,`sf-turn-light ${pip.available ? "available" : "spent"} ${pip.temporary ? "temporary" : ""}`)).join("");
  const cost = `${b.limits.strainCost} ${b.resourceLabel}`;
  return `<div class="sf-turn-indicators" role="group" aria-label="Turn indicators">
    ${b.vehicle ? "" : `<span class="sf-turn-pips" data-turn-help="action" title="${escape(help.action)}" aria-description="${escape(help.action)}"><b tabindex="0" title="${escape(help.action)}">${compact ? "ACT" : "Actions"}</b>${lights(b.actions,"action","action")}</span>`}
    <span class="sf-turn-pips" data-turn-help="maneuver" title="${escape(help.maneuver)}" aria-description="${escape(help.maneuver)}"><b tabindex="0" title="${escape(help.maneuver)}">${compact ? "MAN" : b.vehicle ? "Pilot manoeuvres" : "Manoeuvres"}</b>${lights(b.maneuvers,"maneuver","manoeuvre")}
    ${button("buyManeuver",`Buy extra manoeuvre · ${cost}`,"+",b.canPayStrain,"sf-turn-add")}</span>
    ${compact ? "" : `<small>${b.freeRemaining} ready · ${b.spent.maneuvers}/${b.limits.maneuverLimit} used</small>`}
  </div>`;
}

export function turnPanelHTML(actor) {
  const b = readTurnBudget(actor);
  if (!b.supported) return "";
  const disabled = value => value && b.editable ? "" : "disabled";
  return `<section class="sf-turn-panel" aria-label="Combat turn">
    <div class="sf-turn-heading"><strong>${b.roundLabel}</strong><small>${b.editable ? "Click a light to spend it" : "GM / automatic control"}</small></div>
    ${turnIndicatorHTML(b,{actor})}
    <div class="sf-turn-tools">
      <button type="button" data-sf-turn="tradeManeuver" ${disabled(b.canTradeAction)} title="Spend an action to prepare a manoeuvre">Trade action</button>
      <button type="button" data-sf-turn="undo" ${disabled(b.canUndo)}>Undo</button>
      <button type="button" data-sf-turn="reset" ${disabled(true)}>Reset turn</button>
      ${b.editable ? `<details><summary>Adjust</summary><button type="button" data-sf-turn="grant" ${disabled(b.maneuversRemaining > b.freeRemaining)} title="Award a manoeuvre without strain, within the turn limit">Grant manoeuvre</button>
        ${b.isGM && !b.vehicle ? '<button type="button" data-sf-turn="configure">Allowances</button>' : ""}</details>` : ""}
    </div>
    ${b.vehicle ? '<small class="sf-turn-note">Pilot-only manoeuvres. Crew members spend their own actions and manoeuvres separately.</small>' : ""}
    ${b.reasons.length ? `<small class="sf-turn-note">${b.reasons.map(escape).join(" · ")}</small>` : ""}
    ${b.isGM ? b.decisions.map(rule => `<button type="button" data-sf-turn="activate" data-rule-id="${escape(rule.id)}">Apply ${escape(rule.name)} this turn…</button>`).join("") : ""}
  </section>`;
}

async function configureAllowances(actor) {
  if (!game.user.isGM) throw new Error("Only the GM can configure allowances.");
  const values = {...TURN_DEFAULTS,...actor.system.turnEconomy};
  const result = await foundry.applications.api.DialogV2.prompt({
    classes:["star-wars"],
    window:{title:`Turn allowances · ${actor.name}`},
    content:`<p>Base allowances, before learned passive talents and Active Effects.</p>${Object.entries(values).map(([key,value]) => `<div class="form-group"><label>${TURN_LABELS[key]}</label><input name="${key}" type="number" min="0" max="10" step="1" value="${value}"></div>`).join("")}`,
    ok:{label:"Save",callback:(_event,button)=>Object.fromEntries(Object.entries(Object.fromEntries(new FormData(button.form))).map(([k,v])=>[k,Number(v)]))},rejectClose:false,
  });
  if (result) { validateTurnConfig(result); await actor.update({"system.turnEconomy":result}); }
}

export function bindTurnControls(root, actor) {
  if (!root || root.dataset.sfTurnsBound) return;
  root.dataset.sfTurnsBound = "true";
  root.addEventListener("click", async event => {
    const button = event.target.closest("[data-sf-turn]");
    if (!button || !root.contains(button) || button.disabled) return;
    event.preventDefault(); event.stopPropagation();
    button.disabled = true;
    try {
      const command = button.dataset.sfTurn;
      if (command === "configure") await configureAllowances(actor);
      else {
        if (command === "activate") {
          const confirmed = await foundry.applications.api.DialogV2.confirm({classes:["star-wars"],window:{title:"Confirm talent activation"},
            content:"<p>Apply this learned rule for the current turn after checking its source, prerequisites and any action or strain cost. Only its encoded allowance effects are automatic.</p>"});
          if (!confirmed) return;
        }
        await performTurnCommand(actor,command,{ruleId:button.dataset.ruleId});
      }
    } catch(error) { ui.notifications.warn(error.message); }
    finally { button.disabled = false; refreshTurnIndicators(); actor.sheet?.render(false); }
  });
}

function positionIndicator(token, element,occupied) {
  const view = canvas.app?.canvas ?? canvas.app?.view;
  if (!view || !canvas.stage?.worldTransform) return;
  const point = canvas.stage.worldTransform.apply(tokenIndicatorPosition(token)), rect = view.getBoundingClientRect();
  const screen = canvas.app.renderer.screen;
  const x = rect.left+point.x*rect.width/screen.width, y = rect.top+point.y*rect.height/screen.height;
  const extent=tokenVerticalExtent(token);
  const start=canvas.stage.worldTransform.apply({x:extent.left,y:extent.top}),end=canvas.stage.worldTransform.apply({x:extent.right,y:extent.bottom+12});
  const tokenBounds={left:rect.left+start.x*rect.width/screen.width,right:rect.left+end.x*rect.width/screen.width,
    top:y,bottom:rect.top+end.y*rect.height/screen.height};
  const indicatorBounds=element.getBoundingClientRect();
  const layout=chooseTurnIndicatorLayout({anchor:{x,y},size:{width:indicatorBounds.width,height:indicatorBounds.height},
    viewport:{left:Math.max(0,rect.left),top:Math.max(0,rect.top),right:Math.min(innerWidth,rect.right),bottom:Math.min(innerHeight,rect.bottom)},
    occupied:[...occupied,tokenBounds]});
  const left = `${layout.left}px`,top = `${layout.top}px`;
  const changed = element.style.left !== left || element.style.top !== top;
  if(element.style.left!==left)element.style.left=left;
  if(element.style.top!==top)element.style.top=top;
  occupied.push(layout);
  return changed;
}

export function refreshTurnIndicators() {
  if (!globalThis.canvas?.ready || !globalThis.document) return;
  let changed = false;
  const selected = new Map((canvas.tokens?.controlled ?? []).filter(t => t.visible !== false && t.actor &&
    t.actor.type !== "group" && (t.isOwner || game.user.isGM)).map(t=>[t.id,t]));
  for (const [id,entry] of indicators) if (!selected.has(id)) { entry.element.remove(); indicators.delete(id); changed = true; }
  const occupied=selected.size ? turnIndicatorObstacleBounds() : [];
  for (const [id,token] of [...selected].sort(([a],[b])=>a.localeCompare(b))) {
    let entry = indicators.get(id);
    if (!entry) {
      const element = document.createElement("div");
      element.className = "sf-token-turn"; element.dataset.tokenId = id;
      element.setAttribute("aria-label",`${token.actor.name} turn`);
      for(const type of ["pointerdown","dblclick","contextmenu"]) element.addEventListener(type,event=>event.stopPropagation());
      document.body.append(element); bindTurnControls(element,token.actor);
      indicators.set(id,entry={element,html:""});
    }
    const html = turnIndicatorHTML(readTurnBudget(token.actor),{compact:true,actor:token.actor});
    if (html !== entry.html) { entry.element.innerHTML = html; entry.html = html; changed = true; }
    changed = positionIndicator(token,entry.element,occupied) || changed;
  }
  if (changed) globalThis.Hooks?.callAll("starWarsTurnIndicatorsChanged");
}

/** A committed drag is one move declaration. Distance remains a GM range-band ruling. */
export function shouldTrackMovement(doc, movement, options = {}, inCombat = false) {
  return !!(inCombat && doc.actor && doc.actor.type !== "group" && movement?.method === "dragging" &&
    !movement.planned && !options.starWarsFreeMovement &&
    (movement.origin?.x !== movement.destination?.x || movement.origin?.y !== movement.destination?.y));
}

export function automaticRollCost(actor, cost) {
  if (!actor || !activeCombatForActor(actor) || !setting("automaticTurnRolls",true) || cost === "none") return null;
  if (!["action","maneuver"].includes(cost)) throw new Error("Choose action, manoeuvre or incidental for this check.");
  const b = readTurnBudget(actor);
  if (cost === "action" && !b.actionsRemaining) throw new Error("No action remains. Adjust the turn or mark this check incidental.");
  if (cost === "maneuver" && !b.freeRemaining) throw new Error("No manoeuvre is ready. Use + or trade an action first.");
  return cost;
}

export function turnCostHTML(actor, selected = "action") {
  if (!activeCombatForActor(actor) || !setting("automaticTurnRolls",true)) return "";
  return `<label class="sf-turn-roll-cost">Turn cost<select name="turnCost">${[["action","Action"],["maneuver","Manoeuvre"],["none","Incidental / already spent"]].map(([key,label])=>`<option value="${key}" ${selected === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
}

function refreshTurnSheets() {
  const sheets = new Set(Object.values(globalThis.ui?.windows ?? {}).filter(app=>app.actor && app.rendered));
  for(const actor of game.actors ?? []) if(actor.sheet?.rendered) sheets.add(actor.sheet);
  for(const sheet of sheets) sheet.render(false);
}

export function registerTurnEconomy() {
  game.settings.register(SYSTEM_ID,"turnTrackerControl",{name:"Turn indicators: player control",scope:"world",config:true,type:String,default:"gm",
    choices:{gm:"GM / automatic only",players:"Players manage their own indicators"},
    hint:"Choose who can manually spend, add, undo and reset indicators. Automatic spending works in both modes. Ownership and manoeuvre limits still apply.",
    onChange:()=>{ refreshTurnIndicators(); refreshTurnSheets(); }});
  game.settings.register(SYSTEM_ID,"automaticTurnRolls",{name:"Turn indicators: automatic checks",scope:"world",config:true,type:Boolean,default:true,
    hint:"Combat checks spend their selected action or manoeuvre after the dice evaluate. Initiative and incidental checks are excluded."});
  game.settings.register(SYSTEM_ID,"automaticTurnMovement",{name:"Turn indicators: automatic token drags",scope:"world",config:true,type:Boolean,default:true,
    hint:"Each committed token drag during combat spends one ready manoeuvre. Long moves may need additional spending. Keyboard nudges, API/forced moves and previews are excluded."});
  Hooks.once("ready",()=>{
    coordinator = new TurnTransactionCoordinator({socket:game.socket,currentUser:()=>game.user,users:()=>game.users,
      getActor:uuid=>fromUuid(uuid),execute:async(actor,command,options,user)=>{
        authorizeTurnRequest(actor,command,options,user);
        const key = turnKey(activeCombatForActor(actor));
        if (options.expectedKey && options.expectedKey !== key) throw new Error("The combat round changed. Check the new indicators and try again.");
        const turnOptions={key,payment:options.payment,ruleId:options.ruleId,
          operationId:options.operationId,isGM:user.isGM,allowPlayerManagement:setting("turnTrackerControl","gm") === "players"};
        const update = options.automatic==="move" && groupDefinition(actor)
          ? minionMoveUpdate(actor,groupStateForActor(actor),options.moveTokenId,turnOptions)
          : turnUpdate(actor,command,turnOptions);
        if (Object.keys(update).length) await actor.update(update);
        return turnBudget(actor,{key});
      }}).start();
  });
  for (const hook of ["controlToken","canvasReady","updateActor","updateItem","createItem","deleteItem","updateActiveEffect","createActiveEffect","deleteActiveEffect"])
    Hooks.on(hook,refreshTurnIndicators);
  Hooks.on("canvasPan",scheduleTurnIndicatorReflow);
  Hooks.on("refreshToken",scheduleTurnIndicatorReflow);
  for (const hook of ["updateCombat","deleteCombat","createCombatant","deleteCombatant"]) Hooks.on(hook,()=>{
    refreshTurnIndicators();
    refreshTurnSheets();
  });
  for(const hook of ["renderApplicationV2","closeApplicationV2","renderApplication","closeApplication","renderTokenHUD","closeTokenHUD"])
    Hooks.on(hook,scheduleTurnIndicatorReflow);
  Hooks.on("renderApplicationV2",app=>{
    if(!watchedApplications.has(app)){app.addEventListener?.("position",scheduleTurnIndicatorReflow);watchedApplications.add(app);}
  });
  Hooks.on("renderTokenHUD",(_hud,html)=>watchTurnHUD(html?.querySelector?html:html?.[0]));
  Hooks.on("closeTokenHUD",()=>watchTurnHUD(null));
  globalThis.addEventListener?.("resize",scheduleTurnIndicatorReflow);
  Hooks.on("canvasTearDown",()=>{
    for(const entry of indicators.values()) entry.element.remove();indicators.clear();watchTurnHUD(null);
    if(reflowFrame!==null)globalThis.cancelAnimationFrame(reflowFrame);reflowFrame=null;
  });
  Hooks.on("preMoveToken",(doc,move,options)=>{
    // A vehicle's hull bearing is independent of its travel direction. Foundry
    // uses this flag for both the committed rotation and the movement animation.
    // Explicit rotation updates (including the HUD controls) remain untouched.
    if (doc.actor?.type === "vehicle") move.autoRotate = false;
    if (!setting("automaticTurnMovement",true) || !shouldTrackMovement(doc,move,options,!!activeCombatForActor(doc.actor))) return;
    const budget=readTurnBudget(doc.actor),group=groupStateForActor(doc.actor);
    if(group&&!group.active.some(t=>t.id===doc.id)){ui.notifications.warn("This minion is out of action.");return false;}
    if (!budget.freeRemaining && !(group && hasSharedMinionMove(doc.actor,doc.id,budget.key))) {
      ui.notifications.warn("No manoeuvre is ready. Use + or trade an action before dragging this token.");
      return false;
    }
  });
  Hooks.on("moveToken",(doc,move,options,user)=>{
    if (user?.id !== game.user.id || !setting("automaticTurnMovement",true) ||
      !shouldTrackMovement(doc,move,options,!!activeCombatForActor(doc.actor))) return;
    void performTurnCommand(doc.actor,"maneuver",{automatic:"move",operationId:`move:${doc.id??"token"}:${move.id}`,moveTokenId:doc.id})
      .catch(error=>ui.notifications.warn(error.message));
  });
  Hooks.on("renderTokenHUD",(hud,html)=>{
    const root = html?.querySelector ? html : html?.[0], column = root?.querySelector(".col.left");
    if (!column || root.querySelector("[data-sf-rotate]")) return;
    for(const [direction,label,icon] of [["ccw","CCW","fa-rotate-left"],["cw","CW","fa-rotate-right"]]) {
      const button = document.createElement("button");
      button.type = "button";button.className = "control-icon sf-token-rotate";button.dataset.sfRotate = direction;
      button.title = `${label} 45° · Shift-click 15°`;button.setAttribute("aria-label",`Rotate ${label}`);
      button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><small>${label}</small>`;
      button.addEventListener("click",async event=>{event.preventDefault();event.stopPropagation();
        try { await rotateToken(hud.document,direction,event.shiftKey ? 15 : 45); }
        catch(error) { ui.notifications.warn(error.message); }
      });column.append(button);
    }
  });
}
