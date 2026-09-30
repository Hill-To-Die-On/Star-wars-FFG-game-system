import { ArcSelection, ARC_SECTIONS, arcSectorPolygon } from "./arc-selection.mjs";
import { escapeHTML } from "../mechanics.mjs";

let active=null;

export function closeCanvasArcPicker({restore=true}={}) {
  if(!active)return;
  const previous=active;active=null;
  previous.root.remove();previous.help.remove();
  globalThis.document?.removeEventListener("keydown",previous.keydown,true);
  if(restore)previous.controller.cancel();
}

export function repositionCanvasArcPicker() {
  if(!active)return;
  const {controller,source,target,root}=active,token=controller.stage==="attack"?source:target;
  const canvas=globalThis.canvas,view=canvas?.app?.canvas ?? canvas?.app?.view;
  if(!view||!token?.center||!canvas.stage?.worldTransform)return;
  const rect=view.getBoundingClientRect(),screen=canvas.app.renderer.screen;
  const point=canvas.stage.worldTransform.apply(token.center),scale=canvas.stage.scale?.x ?? 1;
  const width=token.w*scale*rect.width/screen.width,height=token.h*scale*rect.height/screen.height;
  root.style.left=`${rect.left+point.x*rect.width/screen.width-width/2}px`;
  root.style.top=`${rect.top+point.y*rect.height/screen.height-height/2}px`;
  root.style.width=`${width}px`;root.style.height=`${height}px`;
  root.style.setProperty("--sf-arc-centre",`${Math.min(width,height)*.36}px`);
  root.style.setProperty("--sf-arc-rotation",`${Number(token.document?.rotation ?? 0)-180}deg`);
  root.style.setProperty("--sf-arc-counter",`${180-Number(token.document?.rotation ?? 0)}deg`);
  const polygonFor=arcSectorPolygon;
  for(const button of root.querySelectorAll("[data-section]")) {
    const polygon=polygonFor(button.dataset.section,width,height);
    if(polygon.length){
      button.style.clipPath=`polygon(${polygon.map(p=>`${p.x}% ${p.y}%`).join(",")})`;
      // Keep labels inside narrow end zones as well as broad beam-wise faces.
      const label=button.querySelector("span");
      label.style.left=`${polygon.reduce((sum,p)=>sum+p.x,0)/polygon.length}%`;
      const side=button.dataset.section==="port"||button.dataset.section==="starboard";
      label.style.top=`${side&&height>width*1.2 ? 50-40*width/height : polygon.reduce((sum,p)=>sum+p.y,0)/polygon.length}%`;
    }
  }
  let lines=root.querySelector("svg");
  if(!lines){lines=globalThis.document.createElementNS("http://www.w3.org/2000/svg","svg");lines.setAttribute("aria-hidden","true");root.append(lines);}
  lines.setAttribute("viewBox","0 0 100 100");lines.setAttribute("preserveAspectRatio","none");
  lines.innerHTML=["fore","starboard","aft","port"].map(section=>`<polygon points="${polygonFor(section,width,height).map(p=>`${p.x},${p.y}`).join(" ")}"/>`).join("");
}

export function openCanvasArcPicker({source,target,selection,preview,commit,cancel}) {
  closeCanvasArcPicker();
  const document=globalThis.document;if(!document?.body)return null;
  const root=document.createElement("div"),help=document.createElement("section");
  root.className="sf-arc-picker";root.setAttribute("role","group");help.className="sf-arc-picker-help";
  help.innerHTML=`<strong class="sf-arc-step"></strong><p class="sf-arc-instruction"></p><p class="sf-arc-feedback" role="status" aria-live="polite"></p><nav><button type="button" data-command="back">Back to attacker</button><button type="button" data-command="auto">Auto strongest</button><button type="button" data-command="cancel">Cancel · Esc</button></nav>`;
  const cleanup=()=>closeCanvasArcPicker({restore:false});
  const controller=new ArcSelection({sourceVehicle:source.actor?.type==="vehicle",targetVehicle:target.actor?.type==="vehicle",
    targetId:target.id,selection,preview,commit:value=>{cleanup();commit(value);},cancel:()=>{cleanup();cancel();}});
  const feedback=result=>{
    if(!result)return;
    const p=result.preview;
    help.querySelector(".sf-arc-feedback").textContent=p
      ? `${p.attack?.itemName||"Attack"} · ${p.attack?.crewName||p.attack?.actorName||""} · ${p.range?.label||""} · ${p.poolLabel||""}${p.attack?.defenseZone?` · ${p.attack.defenseZone.toUpperCase()} shields: ${p.attack.defense}`:""}${p.error?` · ${p.error}`:" · Click to select"}`
      : result.error;
  };
  const render=()=>{
    if(controller.stage==="done")return;
    const attack=controller.stage==="attack",token=attack?source:target;
    root.setAttribute("aria-label",`${attack?"Attacking arcs":"Defensive zones"} · ${token.name||token.actor?.name}`);
    help.querySelector(".sf-arc-step").textContent=`${attack?"2 · Choose firing arc":"3 · Choose defensive zone"} · ${token.name||token.actor?.name}`;
    help.querySelector(".sf-arc-instruction").textContent=attack
      ? "Hover a ship section to preview. Click to lock its arc. Up / Down select recorded dorsal / ventral mounts."
      : "Hover a hull face to preview its shields. Fore and Aft meet the front/rear corners; Port and Starboard cover the sides. Click to confirm.";
    help.querySelector('[data-command="back"]').hidden=attack||!controller.sourceVehicle;
    help.querySelector('[data-command="auto"]').hidden=!controller.sourceVehicle;
    help.querySelector(".sf-arc-feedback").textContent="Hover a section, or focus it with Tab. Enter selects. Escape cancels.";
    root.innerHTML=ARC_SECTIONS.map(({key,label})=>`<button type="button" class="sf-arc-sector sf-arc-${key}" data-section="${key}" aria-label="${escapeHTML(`${attack?"Firing arc":"Defensive zone"}: ${label}`)}" ${!attack&&(key==="dorsal"||key==="ventral")?'disabled title="Four standard shield zones; Up / Down are weapon mounts"':""}><span>${label}</span></button>`).join("");
    for(const button of root.querySelectorAll("[data-section]")) {
      const hover=()=>{
        const result=controller.hover(button.dataset.section);
        for(const sibling of root.children)sibling.classList.toggle("sf-arc-hover",sibling===button);
        button.classList.toggle("sf-arc-invalid",!result?.valid);feedback(result);
      };
      button.addEventListener("pointerenter",hover);button.addEventListener("focus",hover);
      button.addEventListener("click",event=>{event.stopPropagation();if(controller.select(button.dataset.section))render();else hover();});
    }
    repositionCanvasArcPicker();
  };
  const keydown=event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeCanvasArcPicker();}};
  active={root,help,source,target,controller,keydown};
  for(const element of [root,help])for(const name of ["pointerdown","pointerup","dblclick"])element.addEventListener(name,event=>event.stopPropagation());
  help.querySelector('[data-command="back"]').addEventListener("click",()=>{controller.back();render();});
  help.querySelector('[data-command="auto"]').addEventListener("click",()=>{controller.auto();render();});
  help.querySelector('[data-command="cancel"]').addEventListener("click",()=>closeCanvasArcPicker());
  root.addEventListener("pointerleave",()=>{
    if(active?.controller!==controller)return;
    for(const button of root.children)button.classList.remove("sf-arc-hover");
    feedback({preview:preview(controller.selection)});
  });
  document.body.append(root,help);document.addEventListener("keydown",keydown,true);render();
  return controller;
}
