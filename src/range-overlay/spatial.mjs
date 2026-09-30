const EPSILON=1e-8;

/** Intersect the ray parameter [0,1] with a vertical slab in scene units. */
export function elevationInterval(from,to,bottom,top) {
  if(![from,to].every(Number.isFinite) || Number.isNaN(bottom) || Number.isNaN(top) || bottom>top)return null;
  if(Math.abs(to-from)<EPSILON)return from>=bottom && from<=top ? {start:0,end:1} : null;
  const first=(bottom-from)/(to-from),second=(top-from)/(to-from);
  const start=Math.max(0,Math.min(first,second)),end=Math.min(1,Math.max(first,second));
  return start<=end ? {start,end} : null;
}

const limits=level=>({bottom:level?.elevation?.bottom??-Infinity,top:level?.elevation?.top??Infinity});
const unknown=reason=>({verified:false,segments:[],reason});

/** A shot is automatic only when native level volumes describe its whole path. */
export function planLevelRay({sourceElevation,targetElevation,sourceLevel,targetLevel,levels=[]}) {
  if(!sourceLevel || !targetLevel)return unknown("Assign both tokens to native scene levels before resolving vertical obstructions.");
  for(const [level,height] of [[sourceLevel,sourceElevation],[targetLevel,targetElevation]]) {
    const {bottom,top}=limits(level);
    if(!Number.isFinite(height)||height<bottom||height>top)return unknown("A token is outside its assigned level's elevation bounds.");
  }
  if(sourceLevel.id===targetLevel.id)return {verified:true,segments:[{level:sourceLevel,start:0,end:1}],reason:""};
  if(Math.abs(sourceElevation-targetElevation)<EPSILON)return unknown("Different levels at the same elevation need a GM line-of-sight ruling.");
  const segments=Array.from(levels).flatMap(level=>{
    const {bottom,top}=limits(level),interval=elevationInterval(sourceElevation,targetElevation,bottom,top);
    return interval && interval.end-interval.start>EPSILON ? [{level,...interval}] : [];
  }).sort((a,b)=>a.start-b.start||a.end-b.end);
  let cursor=0;
  for(const segment of segments) {
    if(segment.start>cursor+EPSILON)return unknown("The firing path crosses a gap between modeled levels. A GM must confirm obstructions.");
    if(segment.start<cursor-EPSILON)return unknown("Overlapping level elevations make this firing path ambiguous. A GM must confirm obstructions.");
    cursor=segment.end;
  }
  if(cursor<1-EPSILON)return unknown("The firing path leaves the modeled levels. A GM must confirm obstructions.");
  return {verified:true,segments,reason:""};
}

export function verticalRelationship(sourceElevation,targetElevation) {
  const delta=targetElevation-sourceElevation;
  return {direction:Math.abs(delta)<EPSILON?"level":delta>0?"above":"below",difference:Math.abs(delta)};
}

/** First intersection with an upright token volume. Depth is configured, never inferred from silhouette. */
export function tokenVolumeIntersection(source,target,volume) {
  const height=elevationInterval(source.elevation,target.elevation,volume.bottom,volume.top);
  if(!height || !(volume.width>0) || !(volume.height>0))return null;
  const angle=-(volume.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const local=p=>({x:(p.x-volume.x)*c-(p.y-volume.y)*s,y:(p.x-volume.x)*s+(p.y-volume.y)*c});
  const a=local(source),b=local(target),dx=b.x-a.x,dy=b.y-a.y;
  const rx=volume.width/2,ry=volume.height/2;
  let interval;
  if(volume.shape==="rectangle") {
    const x=elevationInterval(a.x,b.x,-rx,rx),y=elevationInterval(a.y,b.y,-ry,ry);
    if(!x||!y)return null;
    interval={start:Math.max(x.start,y.start),end:Math.min(x.end,y.end)};
  } else {
    const A=(dx/rx)**2+(dy/ry)**2,B=2*(a.x*dx/rx**2+a.y*dy/ry**2),C=(a.x/rx)**2+(a.y/ry)**2-1;
    if(A<EPSILON){if(C>0)return null;interval={start:0,end:1};}
    else {const d=B*B-4*A*C;if(d<0)return null;
      interval={start:Math.max(0,(-B-Math.sqrt(d))/(2*A)),end:Math.min(1,(-B+Math.sqrt(d))/(2*A))};}
  }
  const progress=Math.max(height.start,interval.start),end=Math.min(height.end,interval.end);
  if(progress>end+EPSILON)return null;
  return {progress,point:{x:source.x+(target.x-source.x)*progress,y:source.y+(target.y-source.y)*progress,
    elevation:source.elevation+(target.elevation-source.elevation)*progress}};
}
