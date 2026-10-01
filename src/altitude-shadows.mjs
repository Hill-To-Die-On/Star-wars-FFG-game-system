import { SYSTEM_ID } from "./config.mjs";

const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function shadowSettings(value={}) {
  return {enabled:value.enabled!==false,direction:((finite(value.direction,45)%360)+360)%360,
    heightScale:value.heightScale==="linear"?"linear":"log",heightReference:clamp(finite(value.heightReference,50),.01,1000000),
    sunElevation:clamp(finite(value.sunElevation,75),5,90),softness:clamp(finite(value.softness,.035),0,.25),
    opacity:clamp(finite(value.opacity,.32),0,.7)};
}

/** A visual projection only; logarithmic height never changes rules or stored elevation. */
export function projectAltitudeShadow({elevation,surface,pixelsPerUnit,...options}) {
  if(![elevation,surface,pixelsPerUnit].every(Number.isFinite) || pixelsPerUnit<=0 || elevation<=surface)return null;
  const settings=shadowSettings(options);
  if(!settings.enabled || settings.opacity<=0)return null;
  const gap=elevation-surface,visualHeight=settings.heightScale==="linear"?gap:
    settings.heightReference*Math.log1p(gap/settings.heightReference),height=visualHeight*pixelsPerUnit;
  const distance=height/Math.tan(settings.sunElevation*Math.PI/180),angle=settings.direction*Math.PI/180;
  return {gap,visualHeight,dx:Math.cos(angle)*distance,dy:Math.sin(angle)*distance,
    blur:1+height*settings.softness,opacity:settings.opacity};
}

export function shadowReceivers(scene,viewedLevel) {
  const levels=Array.from(scene?.levels??[]),visible=levels.filter(level=>level.id===viewedLevel?.id || level.isVisible===true);
  if(!levels.length)return [{id:"ground",elevation:0}];
  return visible.flatMap(level=>{
    const surface=level.flags?.[SYSTEM_ID]?.shadowSurface??{};
    if(surface.enabled===false)return [];
    const base=finite(level.elevation?.base,finite(level.elevation?.bottom,0));
    const elevation=surface.elevation==null?base:finite(surface.elevation,base);
    return [{id:level.id,elevation}];
  });
}

export function canCastAltitudeShadow(token) {
  return !!token?.actor && token.actor.type!=="group" && !token.hidden && token.alpha!==0 &&
    !token.actor.statuses?.has?.("invisible") && !token.flags?.[SYSTEM_ID]?.aboard?.vehicleId &&
    token.flags?.[SYSTEM_ID]?.castShadow!==false && !!token.texture?.src;
}

/** Bound CPU/GPU work per silhouette, even for capital ships and very high altitudes. */
export function shadowRasterPlan(width,height,blur) {
  const worldWidth=width+blur*6,worldHeight=height+blur*6;
  const scale=Math.min(1,510/Math.max(worldWidth,worldHeight));
  const padding=Math.ceil(blur*3*scale);
  return {width:Math.min(512,Math.ceil(width*scale)+padding*2),height:Math.min(512,Math.ceil(height*scale)+padding*2),
    artWidth:width*scale,artHeight:height*scale,padding,blur:blur*scale,
    worldWidth:Math.max(worldWidth,(Math.ceil(width*scale)+padding*2)/scale),
    worldHeight:Math.max(worldHeight,(Math.ceil(height*scale)+padding*2)/scale),scale};
}

export function shadowIntersectsArtwork(caster,receiver,projection) {
  const bounds=(g,dx=0,dy=0,pad=0)=>{
    const angle=g.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const corners=[[0,0],[g.width,0],[g.width,g.height],[0,g.height]].map(([x,y])=>{
      x=(x-g.width*g.anchorX)*(g.flipX?-1:1);y=(y-g.height*g.anchorY)*(g.flipY?-1:1);
      return {x:g.x+dx+x*c-y*s,y:g.y+dy+x*s+y*c};
    });
    return {left:Math.min(...corners.map(p=>p.x))-pad,right:Math.max(...corners.map(p=>p.x))+pad,
      top:Math.min(...corners.map(p=>p.y))-pad,bottom:Math.max(...corners.map(p=>p.y))+pad};
  };
  const a=bounds(caster,projection.dx,projection.dy,projection.blur*3),b=bounds(receiver);
  return a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
}
