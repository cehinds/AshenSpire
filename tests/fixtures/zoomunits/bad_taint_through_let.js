// Known-bad: the visual rect reaches the write through a reassigned `let`, not
// directly. A grep for `style.left = ${r.` misses this shape entirely — it is
// the shape tooltip.js:15-25 actually has, and the reason this check tracks
// bindings instead of matching one line.

export function place(el, x, y) {
  const r = el.getBoundingClientRect();
  let left = x + 14;
  let top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${Math.max(4, top)}px`;
}
