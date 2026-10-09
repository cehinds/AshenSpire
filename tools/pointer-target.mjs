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
  // Formation actors publish the centre of their independent physical target.
  // It can sit away from the actor wrapper after footer collision packing, so
  // sample it before the wrapper fractions used by ordinary controls.
  const style = globalThis.getComputedStyle?.(el);
  const anchorX = Number.parseFloat(style?.getPropertyValue('--enemy-hit-x'));
  const anchorY = Number.parseFloat(style?.getPropertyValue('--enemy-hit-y'));
  const published = Number.isFinite(anchorX) && Number.isFinite(anchorY)
    ? [{ x: b.x + anchorX, y: b.y + anchorY }]
    : [];
  // Formation centers may be covered by nested intent or information buttons.
  const fractions = [0.5, 0.75, 0.25, 0.9, 0.1].flatMap(fy =>
    [0.5, 0.25, 0.75].map(fx => ({ x: b.x + b.width * fx, y: b.y + b.height * fy })));
  for (const { x, y } of [...published, ...fractions]) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !el.contains(hit)) continue;
      const control = hit.closest('button, input, select, textarea, a, [role="button"]');
      if (control && control !== el && el.contains(control)) continue;
      return { x, y };
  }
  throw new Error('no unobstructed pointer destination for ' + selector);
}
