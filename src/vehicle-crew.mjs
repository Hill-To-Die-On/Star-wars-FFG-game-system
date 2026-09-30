import { SYSTEM_ID } from "./config.mjs";
import { minionState } from "./mechanics.mjs";
import { canSpendXp } from "./xp-transactions.mjs";
import { groupId, groupStateForActor } from "./minion-groups.mjs";

export const CREW_ROLES = Object.freeze({
  pilot:{label:"Pilot",short:"P",icon:"fa-compass",skills:["pilotingSpace","pilotingPlanetary"],exclusive:true},
  copilot:{label:"Co-pilot",short:"C",icon:"fa-headset",skills:["pilotingSpace","pilotingPlanetary"]},
  gunner:{label:"Gunner",short:"G",icon:"fa-crosshairs",skills:["gunnery"]},
  engineer:{label:"Engineer",short:"E",icon:"fa-wrench",skills:["mechanics"]},
  navigator:{label:"Navigator",short:"N",icon:"fa-route",skills:["astrogation","computers"]},
  commander:{label:"Commander",short:"L",icon:"fa-flag",skills:["leadership"]},
});
export const CREW_FLAG = `flags.${SYSTEM_ID}.aboard`;
const doc = value => value?.document ?? value;
export const aboard = token => doc(token)?.flags?.[SYSTEM_ID]?.aboard ?? null;
const numberCapacity = value => /^\d[\d,]*$/.test(String(value ?? "").trim())
  ? Math.min(1000000,Number(String(value).replaceAll(",",""))) : null;

export function crewCapacities(vehicle) {
  const actor=doc(vehicle)?.actor, custom=actor?.flags?.[SYSTEM_ID]?.seating ?? {};
  return Object.fromEntries(["crew","passenger"].map(key=>[key,
    Number.isSafeInteger(custom[key]) && custom[key]>=0 ? custom[key] : numberCapacity(actor?.system?.[key==="crew"?"crew":"passengers"])]));
}
export function occupantCount(token) {
  const actor=doc(token)?.actor;
  if(groupId(token))return groupStateForActor(actor)?.active.some(t=>t.id===doc(token).id)?1:0;
  if (actor?.type!=="minion") return 1;
  const s=actor.system;
  try {return minionState(s.groupSize,s.wounds.value,s.wounds.max).remaining;}
  catch {return Math.max(1,Number(s.groupSize)||1);}
}
export function crewRoster(vehicle, tokens, {user,visibleOnly=false}={}) {
  const v=doc(vehicle);
  if (visibleOnly && v?.hidden && !user?.isGM) return [];
  return Array.from(tokens ?? []).map(doc).filter(t=>t.parent?.id===v?.parent?.id &&
    aboard(t)?.vehicleId===v?.id && (!visibleOnly || !t.hidden || user?.isGM)).map(t=>({
      id:t.id,token:t,actor:t.actor,name:t.name ?? t.actor?.name ?? "Crew",img:t.texture?.src ?? t.actor?.img,
      actorId:t.actorId ?? t.actor?.id,seat:aboard(t).seat,roles:Array.from(aboard(t).roles ?? []),count:occupantCount(t),
    }));
}
export function groupCrew(rows) {
  const groups=new Map();
  for(const row of rows) {
    const key=["minion","rival"].includes(row.actor?.type)
      ? JSON.stringify([row.actorId,row.name,row.img,row.seat,[...row.roles].sort(),!!row.token.hidden]) : row.id;
    let group=groups.get(key);
    if(!group) groups.set(key,group={...row,count:0,members:[]});
    group.count+=row.count;group.members.push(row);
  }
  return [...groups.values()];
}
export function canManageCrew(token,vehicle,user,{leaving=false}={}) {
  return canSpendXp(doc(token)?.actor,user) && (leaving || canSpendXp(doc(vehicle)?.actor,user));
}
function assertCrewPermission(token,vehicle,user,options) {
  if (!canManageCrew(token,vehicle,user,options)) throw new Error("Owner permission for the character and vehicle is required. The GM can board or assign any crew member.");
}
export function attachedPosition(token,vehicle) {
  const t=doc(token),v=doc(vehicle),size=Number(v.parent?.grid?.size)||100;
  return {x:v.x+(v.width-t.width)*size/2,y:v.y+(v.height-t.height)*size/2,elevation:v.elevation ?? 0,...(v.level?{level:v.level}:{})};
}
function sharesBoardingHeight(token,vehicle,position=token) {
  const level=position.level??token.level;
  if(!level && !vehicle.level)return true;
  if(level!==vehicle.level)return false;
  const distance=Number(token.parent?.grid?.distance)||1;
  const bottom=Number(position.elevation??token.elevation)||0,vehicleBottom=Number(vehicle.elevation)||0;
  return bottom<=vehicleBottom+Math.max(0,Number(vehicle.depth)||0)*distance &&
    vehicleBottom<=bottom+Math.max(0,Number(token.depth)||0)*distance;
}
export function boardingUpdate(token,vehicle,tokens,{user,seat="crew"}={}) {
  const t=doc(token),v=doc(vehicle);
  assertCrewPermission(t,v,user);
  if(v.actor?.type!=="vehicle" || !["character","minion","rival","nemesis"].includes(t.actor?.type)) throw new Error("Board a character or NPC onto a vehicle.");
  if(t.parent?.id!==v.parent?.id) throw new Error("Both tokens must be in the same scene.");
  if(!sharesBoardingHeight(t,v))throw new Error("Boarding requires the same native level and overlapping altitude. Move to the vehicle first.");
  if(aboard(t)) throw new Error("This token is already aboard a vehicle. Disembark first.");
  if(groupId(t)) throw new Error("This token shares a linked combat group. Use a separate minion actor for vehicle crew; splitting a linked group between stations is not supported.");
  if(!["crew","passenger"].includes(seat)) throw new Error("Choose a crew or passenger place.");
  const limit=crewCapacities(v)[seat],used=crewRoster(v,tokens).filter(r=>r.seat===seat).reduce((n,r)=>n+r.count,0);
  if(limit===null) throw new Error(`The GM must set the ${seat} capacity first; this database entry has no exact count.`);
  if(!occupantCount(t)) throw new Error("This minion group has no active members.");
  if(used+occupantCount(t)>limit) throw new Error(`The ${seat} places are full or cannot hold this group.`);
  return {...attachedPosition(t,v),[CREW_FLAG]:{vehicleId:v.id,seat,roles:[],
    original:{x:t.x,y:t.y,rotation:t.rotation ?? 0,elevation:t.elevation ?? 0,...(t.level?{level:t.level}:{})}}};
}
export function departureUpdate(token,vehicle,{user,index=0}={}) {
  const t=doc(token),v=doc(vehicle),state=aboard(t);
  assertCrewPermission(t,v,user,{leaving:true});
  if(!state) throw new Error("This token is not aboard a vehicle.");
  const size=Number(t.parent?.grid?.size)||100;
  return {[CREW_FLAG]:null,rotation:state.original?.rotation ?? t.rotation,
    x:v ? v.x+v.width*size+index*t.width*size : state.original?.x ?? t.x,
    y:v ? v.y+(v.height-t.height)*size/2 : state.original?.y ?? t.y,
    elevation:v?.elevation ?? state.original?.elevation ?? t.elevation,
    ...((v?.level??state.original?.level??t.level)?{level:v?.level??state.original?.level??t.level}:{})};
}
export function roleUpdate(token,vehicle,tokens,role,{user}={}) {
  const t=doc(token),v=doc(vehicle),state=aboard(t);
  assertCrewPermission(t,v,user);
  if(!CREW_ROLES[role]) throw new Error("Unknown crew role.");
  if(state?.vehicleId!==v.id) throw new Error("This character is not aboard this vehicle.");
  if(state.seat!=="crew") throw new Error("A passenger needs a crew place before taking a station.");
  const roles=new Set(state.roles ?? []);
  if(roles.has(role)) roles.delete(role);
  else {
    if(CREW_ROLES[role].exclusive && crewRoster(v,tokens).some(r=>r.id!==t.id && r.roles.includes(role)))
      throw new Error(`A ${CREW_ROLES[role].label.toLowerCase()} is already assigned. Clear that role first.`);
    roles.add(role);
  }
  return {[`${CREW_FLAG}.roles`]:[...roles]};
}
export function crewForSkill(vehicle,tokens,skill) {
  const roles=Object.keys(CREW_ROLES).filter(r=>CREW_ROLES[r].skills.includes(skill));
  return crewRoster(vehicle,tokens).filter(r=>r.seat==="crew" && r.roles.some(role=>roles.includes(role)) && r.count>0);
}
export function resolveCrewCheck(vehicle,tokens,skill,tokenId) {
  const candidates=crewForSkill(vehicle,tokens,skill),member=tokenId ? candidates.find(c=>c.id===tokenId) : candidates.length===1?candidates[0]:null;
  if(!member) throw new Error(candidates.length>1 ? "Choose which assigned crew member makes this check." : "No crew member is assigned to this duty.");
  const handling=["pilotingSpace","pilotingPlanetary"].includes(skill) ? Number(doc(vehicle).actor.system.handling)||0 : 0;
  return {...member,vehicle:doc(vehicle),boost:Math.max(0,handling),setback:Math.max(0,-handling)};
}
export function crewStripPosition(rect,width,height,viewport) {
  if(rect.right<viewport.left || rect.left>viewport.right || rect.bottom<viewport.top || rect.top>viewport.bottom) return null;
  const side=rect.bottom<=viewport.bottom?"bottom":"top";
  return {side,left:Math.max(viewport.left,Math.min(viewport.right-width,(rect.left+rect.right-width)/2)),
    top:Math.max(viewport.top,Math.min(viewport.bottom-height,side==="bottom"?rect.bottom-height-8:rect.top+8))};
}
export function boardingTargets(token,movement,tokens,{user}={}) {
  const t=doc(token),size=t.parent?.grid?.size||100;
  const destination=movement?.destination ?? t;
  const c={x:destination.x+t.width*size/2,y:destination.y+t.height*size/2};
  return Array.from(tokens).map(doc).filter(v=>v.actor?.type==="vehicle" && (!v.hidden || user?.isGM) && canManageCrew(t,v,user) &&
    sharesBoardingHeight(t,v,destination) &&
    c.x>=v.x && c.x<=v.x+v.width*size && c.y>=v.y && c.y<=v.y+v.height*size).sort((a,b)=>a.width*a.height-b.width*b.height);
}
export function crewVacancyPosition(rect,size,viewport,width=size) {
  if(rect.right<viewport.left || rect.left>viewport.right || rect.bottom<viewport.top || rect.top>viewport.bottom)return null;
  const side=rect.bottom<=viewport.bottom?"bottom":"top",inset=Math.min(size,(rect.right-rect.left)*.07),margin=size/8;
  const desired={x:rect.right-width-inset,y:side==="bottom"?rect.bottom-size-inset:rect.top+inset};
  const corners=rect.corners??[{x:rect.left,y:rect.top},{x:rect.right,y:rect.top},{x:rect.right,y:rect.bottom},{x:rect.left,y:rect.bottom}];
  const centre={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};
  if(viewport.right-viewport.left<width+margin*2 || viewport.bottom-viewport.top<size+margin*2)return null;
  let feasible=[{x:viewport.left+margin,y:viewport.top+margin},{x:viewport.right-width-margin,y:viewport.top+margin},
    {x:viewport.right-width-margin,y:viewport.bottom-size-margin},{x:viewport.left+margin,y:viewport.bottom-size-margin}];
  // Intersect the viewport with hull half-planes inset by the entire badge pair,
  // not just its centre. This also handles rotated and partly clipped vehicles.
  for(let i=0;i<corners.length;i++) {
    const p=corners[i],q=corners[(i+1)%corners.length];
    let a=q.y-p.y,b=p.x-q.x,c=a*p.x+b*p.y;
    if(a*centre.x+b*centre.y>c){a=-a;b=-b;c=-c;}
    c-=Math.max(0,a*width)+Math.max(0,b*size)+margin*Math.hypot(a,b);
    const clipped=[];
    for(let j=0;j<feasible.length;j++) {
      const start=feasible[j],end=feasible[(j+1)%feasible.length],s=a*start.x+b*start.y-c,e=a*end.x+b*end.y-c;
      if(s<=0)clipped.push(start);
      if((s<=0)!==(e<=0)){const t=s/(s-e);clipped.push({x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t});}
    }
    feasible=clipped;if(!feasible.length)return null;
  }
  const area=Math.abs(feasible.reduce((n,p,i)=>{const q=feasible[(i+1)%feasible.length];return n+p.x*q.y-q.x*p.y;},0))/2;
  if(area<1e-9)return null;
  // The closest feasible point keeps the pair by its preferred corner without
  // pushing it outside the token at the left or right edge of the screen.
  let nearest=null,distance=Infinity;
  for(let i=0;i<feasible.length;i++) {
    const p=feasible[i],q=feasible[(i+1)%feasible.length],dx=q.x-p.x,dy=q.y-p.y;
    const t=Math.max(0,Math.min(1,((desired.x-p.x)*dx+(desired.y-p.y)*dy)/(dx*dx+dy*dy||1)));
    const candidate={x:p.x+dx*t,y:p.y+dy*t},d=Math.hypot(candidate.x-desired.x,candidate.y-desired.y);
    if(d<distance){distance=d;nearest=candidate;}
  }
  // Preserve a preferred point that is already inside the feasible polygon.
  const signs=feasible.map((p,i)=>{const q=feasible[(i+1)%feasible.length];return(q.x-p.x)*(desired.y-p.y)-(q.y-p.y)*(desired.x-p.x);});
  if(signs.every(v=>v>=0)||signs.every(v=>v<=0))nearest=desired;
  return {side,left:nearest.x,top:nearest.y};
}
export function crewBadgeLayout(rect,viewport) {
  const sides=rect.corners?.map((p,i)=>{const q=rect.corners[(i+1)%rect.corners.length];return Math.hypot(q.x-p.x,q.y-p.y);})
    ?? [rect.right-rect.left,rect.bottom-rect.top];
  const size=Math.min(24,Math.min(...sides)*.22);
  // Browsers round very thin borders up; hide at subpixel zoom instead of overflowing the hull.
  if(!(size>=1.5))return null;
  const gap=size/6,width=size*2+gap,pos=crewVacancyPosition(rect,size,viewport,width);
  return pos?{...pos,size,gap,width}:null;
}
