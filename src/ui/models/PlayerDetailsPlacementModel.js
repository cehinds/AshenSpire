// Screen-pixel placement only. This never changes the actor's resting anchor.
export function playerDetailsPlacement({ art, width, height, viewport, handTop, hudBottom = 0, gap = 10, obstacles = [], inspect = null }) {
  const left = Math.max(viewport.left + gap, Math.min(art.right + gap, viewport.right - width - gap));
  const ceiling = Math.max(viewport.top + gap, hudBottom + gap) + (inspect ? inspect.height + gap : 0);
  const floor = Math.min(viewport.bottom - gap, Number.isFinite(handTop) ? handTop - gap : Infinity);
  const top = Math.max(ceiling, Math.min(art.top + 16, floor - height));
  const ys = [top, ceiling, ...obstacles.flatMap(box=>[box.top-height-gap,box.bottom+gap, ...(inspect ? [box.bottom+inspect.height+gap*2] : [])])]
    .filter(y=>y>=ceiling && y+height<=floor);
  const xs = [left, ...(inspect ? [viewport.left+gap, viewport.right-width-gap] : []), ...obstacles.flatMap(box=>[box.left-width-gap,box.right+gap])]
    .filter(x=>x>=viewport.left+gap && x+width<=viewport.right-gap);
  const candidates = xs.flatMap(x=>ys.map(y=>({left:x,top:y})))
    .sort((a,b)=>(a.left-left)**2+(a.top-top)**2-((b.left-left)**2+(b.top-top)**2));
  const clear = (rect, box) => rect.right+gap<=box.left || rect.left>=box.right+gap
    || rect.bottom+gap<=box.top || rect.top>=box.bottom+gap;
  return candidates.find(p => {
    const boxes = [{left:p.left,top:p.top,right:p.left+width,bottom:p.top+height}];
    if (inspect) boxes.push({left:p.left+(width-inspect.width)/2, right:p.left+(width+inspect.width)/2,
      top:p.top-gap-inspect.height,bottom:p.top-gap});
    return boxes.every(rect=>obstacles.every(box=>clear(rect,box)));
  }) || {left,top};
}
