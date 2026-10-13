export const edges=(r,axis)=>axis==='x'?[r.x,r.x+r.w/2,r.x+r.w]:[r.y,r.y+r.h/2,r.y+r.h];
export function bounds(rects){
  const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));
  return {x,y,w:Math.max(...rects.map(r=>r.x+r.w))-x,h:Math.max(...rects.map(r=>r.y+r.h))-y};
}
export function nearest(values,targets,tolerance){
  let best=null;
  for(const value of values)for(const target of targets){const delta=target.value-value;
    if(Math.abs(delta)<=tolerance&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={...target,delta};
  }
  return best;
}
export function moveSnapped(rect,dx,dy,targets,tolerance){
  const moved={...rect,x:rect.x+dx,y:rect.y+dy};
  const x=nearest(edges(moved,'x'),targets.x,tolerance),y=nearest(edges(moved,'y'),targets.y,tolerance);
  return {rect:{...moved,x:moved.x+(x?.delta||0),y:moved.y+(y?.delta||0)},guides:{x,y}};
}
export function resizeBox(r,handle,dx,dy,aspect){
  let left=r.x,right=r.x+r.w,top=r.y,bottom=r.y+r.h;
  if(handle.includes('w'))left=Math.min(right-4,left+dx);
  if(handle.includes('e'))right=Math.max(left+4,right+dx);
  if(handle.includes('n'))top=Math.min(bottom-4,top+dy);
  if(handle.includes('s'))bottom=Math.max(top+4,bottom+dy);
  if(aspect){
    const ratio=r.w/r.h,hasX=/[ew]/.test(handle),hasY=/[ns]/.test(handle);
    let w=right-left,h=bottom-top;
    if(hasX&&(!hasY||Math.abs(w-r.w)/r.w>=Math.abs(h-r.h)/r.h))h=w/ratio;else w=h*ratio;
    if(handle.includes('w'))left=right-w;else if(handle.includes('e'))right=left+w;else{left=r.x+(r.w-w)/2;right=left+w;}
    if(handle.includes('n'))top=bottom-h;else if(handle.includes('s'))bottom=top+h;else{top=r.y+(r.h-h)/2;bottom=top+h;}
  }
  return {x:left,y:top,w:right-left,h:bottom-top};
}
export function transformGroup(rect,from,to){return {x:to.x+(rect.x-from.x)*to.w/from.w,y:to.y+(rect.y-from.y)*to.h/from.h,w:rect.w*to.w/from.w,h:rect.h*to.h/from.h};}
