import { firingZoneContains } from "./hull-zones.mjs";
// Source-backed weapon arc names; the canvas places boundaries at hull corners.
// Canvas bearings retain Foundry's south-at-zero, clockwise-positive convention.
export const FIRE_ARCS=Object.freeze(["fore","aft","port","starboard"]);

export function weaponArcProfile(weapon) {
  const metadata=weapon?.system?.metadata ?? {};
  const raw=String(metadata.fireArcOverride ?? "").trim() || metadata.fireArcs || metadata.firingArc || "";
  const text=(Array.isArray(raw)?raw.join(","):String(raw)).toLowerCase().replace(/^fire\s+arc\s*:?[\s]*/,"");
  const tokens=text.match(/[a-z]+/g) ?? [];
  const aliases={forward:"fore",rear:"aft",fore:"fore",aft:"aft",port:"port",starboard:"starboard"};
  const known=new Set([...Object.keys(aliases),"all","dorsal","ventral","and"]);
  const invalid=tokens.some(token=>!known.has(token)) || /[^a-z\s,;/&()\-]/.test(text);
  const arcs=tokens.includes("all") ? [...FIRE_ARCS] : [...new Set(tokens.map(t=>aliases[t]).filter(Boolean))];
  const location=String(metadata.location ?? "").trim().toLowerCase();
  const dorsal=tokens.includes("dorsal") || location==="dorsal", ventral=tokens.includes("ventral") || location==="ventral";
  return {arcs,vertical:dorsal ? "dorsal" : ventral ? "ventral" : "",
    error:invalid || !arcs.length || dorsal&&ventral ? "Weapon firing arcs are missing or unknown. Set recorded arcs on the weapon sheet or use Manual after a GM ruling." : ""};
}

export function checkWeaponArc(weapon,{origin,point,rotation=0,hull=null,sourceElevation=0,targetElevation=0,fireArc=""}) {
  const profile=weaponArcProfile(weapon);
  if(profile.error)return {...profile,inArc:null,arc:""};
  if(fireArc && !profile.arcs.includes(fireArc))return {...profile,inArc:null,arc:"",error:"The selected weapon does not support this firing arc."};
  const delta=targetElevation-sourceElevation;
  if (profile.vertical==="dorsal" && delta<0 || profile.vertical==="ventral" && delta>0)
    return {...profile,inArc:false,arc:"",error:`The target is outside this weapon's ${profile.vertical} firing arc.`};
  const dx=point.x-origin.x,dy=point.y-origin.y;
  if(Math.hypot(dx,dy)<1e-7)return {...profile,inArc:null,arc:"",error:"Overlapping vehicle centres need a GM firing-arc ruling."};
  // Dimensionless callers retain conventional centre-based sectors. On-canvas
  // callers supply the occupied hull, whose corner bisectors define the zones.
  const footprint=hull??{...origin,width:0,height:0,rotation};
  const arc=(fireArc?[fireArc]:profile.arcs).find(key=>firingZoneContains(footprint,key,point)) ?? "";
  return {...profile,inArc:!!arc,arc,error:arc?"":`No clear target point is in this weapon's ${profile.arcs.join(" / ")} firing arcs.`};
}
