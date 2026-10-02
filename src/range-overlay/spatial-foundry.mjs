import { SYSTEM_ID } from "../config.mjs";
import { escapeHTML } from "../mechanics.mjs";
import { planLevelRay } from "./spatial.mjs";

const documentOf=token=>token?.document??token;
const values=collection=>Array.from(collection?.values?.()??collection??[]);
const levelId=doc=>typeof doc?.level==="string"?doc.level:doc?.level?.id;
const unavailable=reason=>({lineOfSight:"unavailable",lineOfSightBlocked:null,obstruction:null,
  sightBasis:"unverified",requiresGmRuling:true,sightReason:reason});
const pointOf=value=>value?.point??value;

export function spatialTokenVisible(token,user=globalThis.game?.user) {
  if(user?.isGM)return true;
  const doc=documentOf(token),object=token?.document?token:doc?.object;
  return doc?.hidden!==true && object?.visible!==false && !!object;
}

/** Use only public v14 collision APIs; native walls span their assigned level. */
export function nativeSightResult({source,target,start,end,scene,backend=globalThis.CONFIG?.Canvas?.polygonBackends?.sight}) {
  const levels=values(scene?.levels),sourceDoc=documentOf(source),targetDoc=documentOf(target);
  const sourceLevel=levels.find(l=>l.id===levelId(sourceDoc)),targetLevel=levels.find(l=>l.id===levelId(targetDoc));
  if(typeof backend?.testCollision!=="function")return unavailable("Sight collision checks are unavailable; a GM must confirm the firing path.");
  const elevated=start.elevation!==end.elevation;
  const plan=levels.length?planLevelRay({sourceElevation:start.elevation,targetElevation:end.elevation,sourceLevel,targetLevel,levels}):
    {verified:!elevated,segments:[{level:null,start:0,end:1}],reason:"Vertical obstructions need native level data and a GM ruling."};
  if(!plan.verified)return unavailable(plan.reason);
  if(levels.length && typeof scene?.testSurfaceCollision!=="function")return unavailable("Native floor and ceiling checks are unavailable; a GM must confirm the firing path.");
  let obstruction=null;
  const progressAt=point=>{
    const dx=end.x-start.x,dy=end.y-start.y,dz=end.elevation-start.elevation;
    if(dx*dx+dy*dy>1e-8)return ((point.x-start.x)*dx+(point.y-start.y)*dy)/(dx*dx+dy*dy);
    return dz?((point.elevation??start.elevation)-start.elevation)/dz:0;
  };
  const inspect=(collision,kind,segment)=>{
    if(collision?.then)throw Error("Asynchronous collision result");
    if(!collision || Array.isArray(collision)&&!collision.length)return;
    const point=pointOf(Array.isArray(collision)?collision[0]:collision);
    if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))throw Error("Collision result has no position");
    const progress=Math.max(0,Math.min(1,progressAt(point)));
    if(progress<segment.start-1e-7 || progress>segment.end+1e-7)throw Error("Collision result outside level segment");
    if(!obstruction || progress<obstruction.progress)obstruction={kind,name:kind==="surface"?"Sight-blocking surface":"Sight-blocking wall",point:{x:point.x,y:point.y},progress};
  };
  try {
    for(const segment of plan.segments) {
      const options={mode:"closest",type:"sight",...(segment.level?{level:segment.level,tMin:segment.start,tMax:segment.end}:{})};
      inspect(backend.testCollision(start,end,options),"wall",segment);
      if(segment.level)inspect(scene.testSurfaceCollision(start,end,options),"surface",segment);
    }
  } catch {return unavailable("The scene's height-aware obstruction check failed. A GM must confirm the firing path.");}
  return {lineOfSight:obstruction?"blocked":"clear",lineOfSightBlocked:!!obstruction,obstruction,
    sightBasis:levels.length?"native-levels":"two-dimensional",requiresGmRuling:false,sightReason:""};
}

export function planFlightMove(token,{level,elevation},user=globalThis.game?.user,{paused=globalThis.game?.paused}={}) {
  const doc=documentOf(token);
  if(!user?.isGM && doc?.canUserModify?.(user,"update")!==true)throw Error("No permission to move this token.");
  if(!user?.isGM && paused)throw Error("Flight is unavailable while the game is paused.");
  if(doc?.flags?.[SYSTEM_ID]?.aboard?.vehicleId)throw Error("Move the vehicle carrying this occupant, or disembark first.");
  const height=Number(elevation),destination=values(doc?.parent?.levels).find(l=>l.id===level);
  if(!Number.isFinite(height))throw Error("Choose a finite altitude in scene distance units.");
  if(!destination)throw Error("Choose a native scene level.");
  if(!user?.isGM && destination.id!==levelId(doc) && destination.isVisible!==true)throw Error("Ask the GM to move this token to a level outside the visible scene.");
  if(height<(destination.elevation?.bottom??-Infinity)||height>(destination.elevation?.top??Infinity))throw Error("Altitude must lie within the selected level's bounds.");
  return {x:doc.x,y:doc.y,elevation:height,level:destination.id};
}

export async function openFlightDialog(token=globalThis.canvas?.tokens?.controlled?.[0]) {
  const doc=documentOf(token),user=globalThis.game?.user;
  if(!doc || !user?.isGM && doc.canUserModify?.(user,"update")!==true)throw Error("Select an owned token to change its flight level.");
  const levels=values(doc.parent?.levels);
  if(!levels.length)throw Error("Create native scene levels before using flight controls.");
  const initialLevel=levelId(doc),initialElevation=doc.elevation;
  const choice=await foundry.applications.api.DialogV2.prompt({window:{title:`Flight · ${doc.name??doc.actor?.name??"Token"}`,resizable:true},position:{width:440},classes:["star-wars","sf-flight-dialog"],rejectClose:false,
    content:`<div class="sf-dialog"><p>Choose a level and altitude in ${escapeHTML(doc.parent.grid?.units||"scene units")}. Embarked crew moves with the vehicle.</p>
      <label>Level<select name="level">${levels.filter(l=>user.isGM||l.id===initialLevel||l.isVisible===true).map(l=>`<option value="${escapeHTML(l.id)}" ${l.id===initialLevel?"selected":""}>${escapeHTML(l.name)} (${l.elevation.bottom??"−∞"}–${l.elevation.top??"∞"})</option>`).join("")}</select></label>
      <label>Altitude<input type="number" name="elevation" step="any" value="${Number(doc.elevation)||0}" required></label>
      <p>Altitude uses the same zero point on every level. The GM decides which manoeuvre or action this move requires.</p></div>`,
    ok:{label:"Move",callback:(_event,button)=>Object.fromEntries(new FormData(button.form))}});
  if(!choice)return null;
  if(doc.elevation!==initialElevation||levelId(doc)!==initialLevel)throw Error("The token moved while this dialog was open. Reopen Flight to use its current position.");
  const waypoint=planFlightMove(doc,choice,user);
  if(typeof doc.move!=="function")throw Error("Native token movement is unavailable.");
  return doc.move(waypoint);
}
