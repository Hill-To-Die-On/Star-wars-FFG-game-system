// The canvas convention anchors firing and defence boundaries at hull corners.
// In local coordinates Fore is up; native Foundry rotation zero faces south.
const faces=(width,height)=>({fore:[0,1,height/2],aft:[0,-1,height/2],port:[1,0,width/2],starboard:[-1,0,width/2]});
const distance=(face,p)=>face[0]*p.x+face[1]*p.y+face[2];
const tolerance=1e-5;

/** Nearest-face regions: the joins bisect each hull corner at 45 degrees. */
export function hullZonePolygon(zone,width,height) {
  const boundaries=faces(width,height),selected=boundaries[zone];
  if(!selected || !(width>0&&height>0))return [];
  let points=[{x:-width/2,y:-height/2},{x:width/2,y:-height/2},{x:width/2,y:height/2},{x:-width/2,y:height/2}];
  for(const other of Object.values(boundaries)) {
    const clipped=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      const da=distance(other,a)-distance(selected,a),db=distance(other,b)-distance(selected,b);
      if(da>=0)clipped.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);clipped.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}
    }
    points=clipped;
  }
  const unique=new Map(points.map(p=>[`${p.x},${p.y}`,p]));
  return [...unique.values()].map(p=>({x:50+100*p.x/width,y:50+100*p.y/height}));
}

function transform(hull,point,inverse=false) {
  const radians=((hull.rotation??0)-180)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
  if(inverse){const dx=point.x-hull.x,dy=point.y-hull.y;return {x:dx*c+dy*s,y:-dx*s+dy*c};}
  return {x:hull.x+point.x*c-point.y*s,y:hull.y+point.x*s+point.y*c};
}

/** A shot must end on this hull face; shared corners belong to both neighbours. */
export function defenseZoneContains(hull,zone,point) {
  const boundaries=faces(hull.width,hull.height),selected=boundaries[zone];
  if(!selected || !(hull.width>0&&hull.height>0))return false;
  const local=transform(hull,point,true),minimum=Math.min(...Object.values(boundaries).map(face=>distance(face,local)));
  return minimum>=-tolerance && Math.abs(distance(selected,local))<=tolerance;
}

/** Corner contact only exposes a face when the ray approaches from its outside. */
export function defenseZoneExposed(hull,zone,point,origin) {
  if(!defenseZoneContains(hull,zone,point))return false;
  return distance(faces(hull.width,hull.height)[zone],transform(hull,origin,true)) < -tolerance;
}

/** Extend the same face partition beyond the hull along its corner bisectors. */
export function firingZoneContains(hull,zone,point) {
  const boundaries=faces(hull.width,hull.height),selected=boundaries[zone];
  if(!selected)return false;
  const local=transform(hull,point,true),minimum=Math.min(...Object.values(boundaries).map(face=>distance(face,local)));
  return distance(selected,local)<=minimum+tolerance;
}

/** Exact outward corner rays and face centre lines for the candidate search. */
export function firingZoneRays(hull,zones) {
  const w=hull.width/2,h=hull.height/2,definitions={
    fore:[[-w,-h,-1,-1],[0,-h,0,-1],[w,-h,1,-1]],
    aft:[[-w,h,-1,1],[0,h,0,1],[w,h,1,1]],
    port:[[-w,-h,-1,-1],[-w,0,-1,0],[-w,h,-1,1]],
    starboard:[[w,-h,1,-1],[w,0,1,0],[w,h,1,1]],
  };
  const unique=new Map(zones.flatMap(zone=>definitions[zone]??[]).map(ray=>[ray.join(","),ray]));
  return [...unique.values()].map(([x,y,dx,dy])=>({origin:transform(hull,{x,y}),direction:Math.atan2(dy,dx)+((hull.rotation??0)-180)*Math.PI/180}));
}

/** Both corners and the nearest point on the chosen face seed the sight search. */
export function defenseZoneBoundaryPoints(hull,zone,near) {
  if(!faces(hull.width,hull.height)[zone] || !(hull.width>0&&hull.height>0))return [];
  const w=hull.width/2,h=hull.height/2,local=transform(hull,near,true);
  const endpoints={fore:[[-w,-h],[w,-h]],aft:[[-w,h],[w,h]],port:[[-w,-h],[-w,h]],starboard:[[w,-h],[w,h]]}[zone];
  const [a,b]=endpoints,dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((local.x-a[0])*dx+(local.y-a[1])*dy)/(dx*dx+dy*dy)));
  return [...endpoints,[a[0]+dx*t,a[1]+dy*t]].map(([x,y])=>transform(hull,{x,y}));
}
