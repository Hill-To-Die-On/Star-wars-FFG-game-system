// Range follows the occupied base, independent of portrait padding or texture scale.
// Rounded rectangular bases rotate with their token; circular bases are unchanged.
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const angle = footprint => (footprint.rotation ?? 0) * Math.PI / 180;

export function rangeFootprint({ x = 0, y = 0, width = 0, height = width, shape = "circle", rotation = 0 } = {}) {
  width = nonnegative(width);
  height = nonnegative(height);
  const radius = shape === "rectangle" ? 0 : Math.min(width, height) / 2;
  rotation = Number.isFinite(Number(rotation)) ? ((Number(rotation) % 360) + 360) % 360 : 0;
  return { x: Number(x), y: Number(y), width, height, radius, rotation };
}

function coreBounds(footprint) {
  const halfWidth = footprint.width / 2 - footprint.radius;
  const halfHeight = footprint.height / 2 - footprint.radius;
  return { left: footprint.x - halfWidth, right: footprint.x + halfWidth,
    top: footprint.y - halfHeight, bottom: footprint.y + halfHeight };
}
function rotate(point, footprint, radians = angle(footprint)) {
  const dx = point.x - footprint.x, dy = point.y - footprint.y;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  return { x: footprint.x + dx*cos - dy*sin, y: footprint.y + dx*sin + dy*cos };
}
function corners(footprint) {
  const b = coreBounds(footprint);
  return [[b.left,b.top],[b.right,b.top],[b.right,b.bottom],[b.left,b.bottom]]
    .map(([x,y]) => rotate({x,y},footprint));
}
function containsCore(footprint, point) {
  const p = rotate(point,footprint,-angle(footprint)), b = coreBounds(footprint);
  return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
}
function nearestAxis(a0, a1, b0, b1) {
  if (a1 < b0) return [a1, b0];
  if (b1 < a0) return [a0, b1];
  const common = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
  return [common, common];
}
function project(point, start, end) {
  const dx = end.x-start.x, dy = end.y-start.y, lengthSquared = dx*dx+dy*dy;
  const t = lengthSquared ? clamp(((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared,0,1) : 0;
  return {x:start.x+t*dx,y:start.y+t*dy};
}
function crossing(a, b, c, d) {
  const rx=b.x-a.x, ry=b.y-a.y, sx=d.x-c.x, sy=d.y-c.y, denominator=rx*sy-ry*sx;
  if (Math.abs(denominator) <= Number.EPSILON*Math.hypot(rx,ry)*Math.hypot(sx,sy)) return null;
  const qx=c.x-a.x, qy=c.y-a.y, t=(qx*sy-qy*sx)/denominator, u=(qx*ry-qy*rx)/denominator;
  return t>=0 && t<=1 && u>=0 && u<=1 ? {x:a.x+t*rx,y:a.y+t*ry} : null;
}
function nearestCores(source, target) {
  if (!(source.rotation ?? 0) && !(target.rotation ?? 0)) {
    const a=coreBounds(source), b=coreBounds(target);
    const [ax,bx]=nearestAxis(a.left,a.right,b.left,b.right), [ay,by]=nearestAxis(a.top,a.bottom,b.top,b.bottom);
    return {source:{x:ax,y:ay},target:{x:bx,y:by}};
  }
  const a=corners(source), b=corners(target);
  for (const point of a) if (containsCore(target,point)) return {source:point,target:{...point}};
  for (const point of b) if (containsCore(source,point)) return {source:point,target:{...point}};
  let best, minimum=Infinity;
  const consider=(source,target) => {
    const distance=Math.hypot(target.x-source.x,target.y-source.y);
    if (distance<minimum) {minimum=distance;best={source,target};}
  };
  // For disjoint convex polygons the minimum is a vertex-to-edge projection.
  // Crossing edges detect overlap even when neither polygon contains a vertex.
  // Duplicate vertices deliberately retain zero-width circles/segments.
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
    const p=a[i],q=a[(i+1)%4],r=b[j],s=b[(j+1)%4], hit=crossing(p,q,r,s);
    if (hit) return {source:hit,target:{...hit}};
    consider(p,project(p,r,s)); consider(q,project(q,r,s));
    consider(project(r,p,q),r); consider(project(s,p,q),s);
  }
  return best;
}

/** Exact shortest separation of oriented rectangles expanded by corner radii. */
export function measureFootprintGap(source, target) {
  const closest=nearestCores(source,target), a=closest.source, b=closest.target;
  const length = Math.hypot(b.x-a.x,b.y-a.y);
  const combined = source.radius + target.radius;
  if (length <= combined) {
    const progress = length ? Math.min(source.radius,length)/length : 0;
    const common = {x:a.x+(b.x-a.x)*progress,y:a.y+(b.y-a.y)*progress};
    return {distance:0,source:common,target:{...common}};
  }
  const dx=(b.x-a.x)/length, dy=(b.y-a.y)/length;
  return {distance:length-combined,
    source:{x:a.x+dx*source.radius,y:a.y+dy*source.radius},
    target:{x:b.x-dx*target.radius,y:b.y-dy*target.radius}};
}

// Coordinates before rotation; draw around the footprint centre, then rotate.
export function rangeOutline(footprint, distance) {
  const gap = nonnegative(distance);
  return {x:footprint.x-footprint.width/2-gap,y:footprint.y-footprint.height/2-gap,
    width:footprint.width+gap*2,height:footprint.height+gap*2,
    radius:footprint.radius+gap,rotation:footprint.rotation ?? 0};
}

/** World-space ray intersection with the rotated expanded outline. */
export function footprintBoundaryPoint(footprint, distance, direction) {
  const bounds=coreBounds(footprint), radius=footprint.radius+nonnegative(distance);
  const localAngle=direction-angle(footprint), dx=Math.cos(localAngle), dy=Math.sin(localAngle);
  let low=0, high=Math.hypot(footprint.width/2,footprint.height/2)+nonnegative(distance);
  for (let step=0;step<42;step++) {
    const length=(low+high)/2, x=footprint.x+dx*length,y=footprint.y+dy*length;
    const gap=Math.hypot(x-clamp(x,bounds.left,bounds.right),y-clamp(y,bounds.top,bounds.bottom));
    if (gap<=radius) low=length; else high=length;
  }
  return rotate({x:footprint.x+dx*(low+high)/2,y:footprint.y+dy*(low+high)/2},footprint);
}

function containsFootprint(footprint, point) {
  const p=rotate(point,footprint,-angle(footprint)), b=coreBounds(footprint);
  return Math.hypot(p.x-clamp(p.x,b.left,b.right),p.y-clamp(p.y,b.top,b.bottom)) <= footprint.radius+1e-7;
}

// Stop at the first hull surface, including when the sampled point is on its rear.
function firstSurface(footprint, start, end) {
  let low=0, high=1;
  if (containsFootprint(footprint,start)) return start;
  for (let step=0;step<40;step++) {
    const t=(low+high)/2, point={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};
    if (containsFootprint(footprint,point)) high=t; else low=t;
  }
  return {x:start.x+(end.x-start.x)*high,y:start.y+(end.y-start.y)*high};
}

export function footprintSightRay(source, target, point) {
  const start=measureFootprintGap(source,rangeFootprint(point)).source;
  const end=firstSurface(target,start,point);
  return {source:start,target:end,distance:Math.hypot(end.x-start.x,end.y-start.y)};
}

/** Exact ray intersections with a rectangular hull, including rotated corners. */
export function footprintRayIntersections(footprint,origin,direction) {
  if(footprint.radius)return [];
  const vertices=corners(footprint),dx=Math.cos(direction),dy=Math.sin(direction),points=[];
  for(let i=0;i<vertices.length;i++) {
    const a=vertices[i],b=vertices[(i+1)%vertices.length],sx=b.x-a.x,sy=b.y-a.y,denom=dx*sy-dy*sx;
    if(Math.abs(denom)<1e-9)continue;
    const ax=a.x-origin.x,ay=a.y-origin.y,t=(ax*sy-ay*sx)/denom,u=(ax*dy-ay*dx)/denom;
    if(t>=-1e-7 && u>=-1e-7 && u<=1+1e-7)points.push({x:origin.x+t*dx,y:origin.y+t*dy});
  }
  return points;
}

/** Bounded alternative sight rays, separate from the geometric nearest gap. */
export function footprintSightCandidates(source, target, additionalPoints=[]) {
  if (!target.width && !target.height) return [];
  const points=[...additionalPoints];
  if (!target.radius) {
    const vertices=corners(target);
    for (let side=0;side<4;side++) for (let step=0;step<8;step++) {
      const a=vertices[side], b=vertices[(side+1)%4], t=step/8;
      points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
  } else {
    for (let step=0;step<32;step++) points.push(footprintBoundaryPoint(target,0,step*Math.PI/16));
  }
  const seen=new Set(), rays=[];
  for (const point of points) {
    const ray=footprintSightRay(source,target,point), start=ray.source, end=ray.target;
    const key=[start.x,start.y,end.x,end.y].map(value=>value.toFixed(4)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    rays.push(ray);
  }
  return rays.sort((a,b)=>a.distance-b.distance || a.target.x-b.target.x || a.target.y-b.target.y);
}
