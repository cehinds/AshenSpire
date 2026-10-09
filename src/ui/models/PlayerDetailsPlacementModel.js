// Screen-pixel placement only. This never changes the actor's resting anchor.
export function playerDetailsPlacement({ art, width, height, viewport, handTop, hudBottom = 0, gap = 10, obstacles = [] }) {
  const left = Math.max(viewport.left + gap, Math.min(art.right + gap, viewport.right - width - gap));
  const ceiling = Math.max(viewport.top + gap, hudBottom + gap);
  const floor = Math.min(viewport.bottom - gap, Number.isFinite(handTop) ? handTop - gap : Infinity);
  const top = Math.max(ceiling, Math.min(art.top + 16, floor - height));
  const ys = [top, ceiling, ...obstacles.flatMap(box=>[box.top-height-gap,box.bottom+gap])]
    .filter(y=>y>=ceiling && y+height<=floor);
  const xs = [left, ...obstacles.flatMap(box=>[box.left-width-gap,box.right+gap])]
    .filter(x=>x>=viewport.left+gap && x+width<=viewport.right-gap);
  const candidates = xs.flatMap(x=>ys.map(y=>({left:x,top:y})))
    .sort((a,b)=>(a.left-left)**2+(a.top-top)**2-((b.left-left)**2+(b.top-top)**2));
  return candidates.find(p=>obstacles.every(box=>p.left+width+gap<=box.left || p.left>=box.right+gap || p.top+height+gap<=box.top || p.top>=box.bottom+gap))
    || {left,top};
}
