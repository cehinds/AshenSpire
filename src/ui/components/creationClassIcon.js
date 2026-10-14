// Original creation-only sigils. Geometry stays vector-based and inherits its
// class colour; canonical character paintings and global classGlyph stay intact.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SIGILS = {
  reaver: { motif: 'greatsword', paths: ['M26 18h12v27l-6 14-6-14V18Z', 'M32 4v14M21 18h22M28 7h8M32 23v23'] },
  starseer: { motif: 'spellbook', paths: ['M8 17c9-3 17-1 24 4v33c-7-5-15-7-24-4V17Z', 'M56 17c-9-3-17-1-24 4v33c7-5 15-7 24-4V17Z', 'M15 25c5-1 9 0 12 2M15 33c5-1 9 0 12 2M49 25c-5-1-9 0-12 2M49 33c-5-1-9 0-12 2', 'm44 4 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z'] },
  rogue: { motif: 'paired-daggers', paths: ['m12 6 4 1 2 12 7 29-4 10-7-8-1-30-1-14Z', 'm42 6 4 1 2 12 7 29-4 10-7-8-1-30-1-14Z', 'M7 21l17-3M37 21l17-3M17 26l3 19M47 26l3 19'] },
  herald: { motif: 'sun', paths: ['M32 4v9M32 51v9M4 32h9M51 32h9M12 12l7 7M45 45l7 7M12 52l7-7M45 19l7-7'], circle: { cx: 32, cy: 32, r: 14 } },
};

/** Decorative class mark; unknown/locked classes retain the caller's fallback. */
export function creationClassIcon(classId) {
  if (!Object.hasOwn(SIGILS, classId)) return null;
  const sigil = SIGILS[classId];
  if (!sigil) return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [name, value] of Object.entries({ class: 'cc-class-icon', 'data-class-icon': classId,
    'data-class-motif': sigil.motif, viewBox: '0 0 64 64', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) {
    svg.setAttribute(name, value);
  }
  for (const d of sigil.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  if (sigil.circle) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    for (const [name, value] of Object.entries(sigil.circle)) circle.setAttribute(name, value);
    svg.appendChild(circle);
  }
  return svg;
}
