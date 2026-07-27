// Known-good: the conversion is open-coded but CORRECT — the raw rect is divided
// by --ui-zoom before it is written. The check must clear this, or it is testing
// "did you call anchorLocalBox" (a style rule) rather than "did a visual pixel
// reach a local-space write" (the defect).
//
// This fixture is the one that keeps the check honest about what it claims. It is
// still a second copy of fx.js's transform, and a reviewer should still say so —
// but it is not THIS defect, and a check that cannot tell the two apart is a
// checklist wearing a detector's clothes.

export function place(layer, anchor, el) {
  const lr = layer.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  el.style.left = `${(ar.left - lr.left) / z}px`;
  el.style.top = `${(ar.top - lr.top) / z}px`;
}
