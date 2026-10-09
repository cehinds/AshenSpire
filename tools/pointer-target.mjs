// Serialized into browser probes; chooses input coordinates without dispatching
// events, changing game state, or bypassing a covering element.
export function pointerTargetExpression(selector) {
  return `(${visiblePointerTarget.toString()})(${JSON.stringify(selector)})`;
}

function visiblePointerTarget(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error('missing ' + selector);
  el.scrollIntoView({ block: 'nearest' });
  const b = el.getBoundingClientRect();
  const boxes = [];
  // A formation frame fills the field vertically, but its fitted foot target
  // has an independent center. Sample the physical core of that actual ::after
  // before the legacy frame grid; every point still requires a real owned hit.
  if (el.matches?.('.combatant:is(.enemy-target-hitbox, .player-target-hitbox)')) {
    const targetStyle = getComputedStyle(el, '::after');
    const localWidth = parseFloat(getComputedStyle(el).width) || el.offsetWidth;
    const scale = b.width / localWidth;
    const left = parseFloat(targetStyle.left), top = parseFloat(targetStyle.top);
    const width = parseFloat(targetStyle.width), height = parseFloat(targetStyle.height);
    if (Number.isFinite(scale) && scale > 0 && [left, top, width, height].every(Number.isFinite)
      && width > 0 && height > 0 && targetStyle.display !== 'none'
      && !['hidden', 'collapse'].includes(targetStyle.visibility) && targetStyle.pointerEvents !== 'none'
      && !['none', 'normal'].includes(targetStyle.content)) {
      const size = Math.min(44, width * scale, height * scale);
      boxes.push({ x: b.x + left * scale - size / 2, y: b.y + top * scale - size / 2, width: size, height: size });
    }
  }
  boxes.push(b);
  // Formation centers may be covered by nested intent or information buttons.
  for (const box of boxes) {
    for (const fy of [0.5, 0.75, 0.25, 0.9, 0.1]) {
      for (const fx of [0.5, 0.25, 0.75]) {
        const x = box.x + box.width * fx, y = box.y + box.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (!hit || !el.contains(hit)) continue;
        const control = hit.closest('button, input, select, textarea, a, [role="button"]');
        if (control && control !== el && el.contains(control)) continue;
        return { x, y };
      }
    }
  }
  throw new Error('no unobstructed pointer destination for ' + selector);
}
