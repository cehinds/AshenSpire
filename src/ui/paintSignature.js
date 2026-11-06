// A canvas repaints only when what it shows changes (owner, 2026-11-06: "it flickers because it's
// redrawing it"). paintSignature folds every input of a paint into one string; the gate remembers the last
// painted one, so an identical request clears and draws nothing.
export function paintSignature(parts) {
  return Object.values(parts).map(value => typeof value === 'number' ? Math.round(value * 100) / 100 : String(value)).join('|');
}
export function createPaintGate() {
  let last = null;
  return {
    // True when the signature differs from the last painted one (and records it). null forgets the last.
    changed(signature) { if (signature === null) { last = null; return true; } if (signature === last) return false; last = signature; return true; },
  };
}
