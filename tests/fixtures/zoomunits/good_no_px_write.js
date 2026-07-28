// Known-good: reads rects, writes no px geometry. input.js (the focus cursor) is
// this shape — three getBoundingClientRect calls, zero inline writes, all
// comparisons inside one space. A check that flags "file mentions rect" would
// redden it, and a check that reddens correct code stops being read.
//
// The `%` write is here on purpose too (combat.js:251 has one): a percentage is
// not a visual pixel and cannot carry the zoom error.

export function nearest(list, cur) {
  const cr = cur.getBoundingClientRect();
  let best = null;
  for (const el of list) {
    const r = el.getBoundingClientRect();
    if (r.left > cr.left) best = el;
  }
  return best;
}

export function bar(el, pct) {
  el.style.width = `${pct * 100}%`;
}
