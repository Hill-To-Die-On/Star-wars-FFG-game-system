import { hullZonePolygon } from "./hull-zones.mjs";

export const ARC_SECTIONS=Object.freeze([
  {key:"fore",label:"Fore"},{key:"starboard",label:"Starboard"},{key:"aft",label:"Aft"},{key:"port",label:"Port"},
  {key:"dorsal",label:"Up"},{key:"ventral",label:"Down"},
]);

/** The same corner-anchored zones drive both attack and defence selectors. */
export function arcSectorPolygon(section,width,height) {
  return hullZonePolygon(section,width,height);
}

export function arcSectionSelection(selection,stage,section,targetId) {
  if(!ARC_SECTIONS.some(row=>row.key===section))return null;
  const vertical=section==="dorsal" || section==="ventral";
  if(stage==="defence")return vertical ? null : {...selection,defenseZone:section,defenseTargetId:targetId};
  return {...selection,fireArc:vertical?"":section,fireFacing:vertical?section:""};
}

/** Hover is transient. Only the final valid click commits an attack choice. */
export class ArcSelection {
  constructor({sourceVehicle,targetVehicle,targetId,selection={},preview,commit,cancel}) {
    Object.assign(this,{sourceVehicle,targetVehicle,targetId,preview,commit,onCancel:cancel});
    this.selection={...selection};this.stage=sourceVehicle?"attack":"defence";
  }
  hover(section) {
    if(this.stage==="done")return null;
    const selection=arcSectionSelection(this.selection,this.stage,section,this.targetId);
    if(!selection)return {valid:false,error:"Ships have four standard defence zones. Up and Down identify weapon mounts, not additional shield values."};
    if(this.stage==="attack" && this.targetVehicle){selection.defenseZone="";selection.defenseTargetId=this.targetId;}
    const preview=this.preview(selection), awaitingDefence=this.stage==="attack" && this.targetVehicle &&
      /^Choose the target's agreed defence zone/.test(preview.error||"");
    return {selection,preview,valid:!!preview.pool && preview.range?.lineOfSight==="clear" && !preview.range?.arcError && (!preview.error||awaitingDefence),error:preview.error||""};
  }
  select(section) {
    const result=this.hover(section);
    if(!result?.valid)return false;
    this.selection=result.selection;
    if(this.stage==="attack" && this.targetVehicle)this.stage="defence";
    else this.finish();
    return true;
  }
  auto() {
    this.selection={defenseZone:this.selection.defenseZone,defenseTargetId:this.selection.defenseTargetId};
    if(this.targetVehicle){this.stage="defence";this.preview(this.selection);}
    else if(!this.preview(this.selection).error)this.finish();
  }
  back() {if(this.sourceVehicle)this.stage="attack";}
  finish() {this.stage="done";this.commit({...this.selection});}
  cancel() {if(this.stage!=="done"){this.stage="done";this.onCancel();}}
}
