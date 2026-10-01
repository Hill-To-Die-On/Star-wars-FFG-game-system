const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Prefer above the token, then the closest clear pocket inside the viewport. */
export function chooseTurnIndicatorLayout({anchor,size,viewport,occupied=[],gap=8}) {
  const width=Math.max(1,size.width),height=Math.max(1,size.height);
  const minX=viewport.left+gap,maxX=Math.max(minX,viewport.right-width-gap);
  const minY=viewport.top+gap,maxY=Math.max(minY,viewport.bottom-height-gap);
  const preferred={left:clamp(anchor.x-width/2,minX,maxX),top:clamp(anchor.y-height-gap,minY,maxY)};
  const obstacles=occupied.filter(b=>overlap(b,viewport)>0).map(b=>({left:b.left-gap,right:b.right+gap,top:b.top-gap,bottom:b.bottom+gap}));
  let best;
  const assess=(left,top)=>{
    const bounds={left,top,right:left+width,bottom:top+height};
    const covered=obstacles.reduce((sum,b)=>sum+overlap(bounds,b),0);
    const score=covered*1e9+(left-preferred.left)**2+(top-preferred.top)**2;
    if(!best||score<best.score)best={...bounds,score};
    return covered===0;
  };
  if(!assess(preferred.left,preferred.top)) {
    const xs=new Set([preferred.left,minX,maxX]),ys=new Set([preferred.top,minY,maxY]);
    for(const b of obstacles){
      xs.add(clamp(b.left-width,minX,maxX));xs.add(clamp(b.right,minX,maxX));
      ys.add(clamp(b.top-height,minY,maxY));ys.add(clamp(b.bottom,minY,maxY));
    }
    for(const left of xs)for(const top of ys)assess(left,top);
  }
  delete best.score;
  return best;
}
