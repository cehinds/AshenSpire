// Breakpoint normalisation: raw CSS condition -> named band.
//
// Bands (proposal, see docs/tag-model/README.md, "Presentation layer"):
//   mobile  = phone: max-width <= 600px, or pointer:coarse with orientation:portrait
//   tablet  = 601px to 1023px
//   desktop = 1024px to 1439px
//   wide    = >= 1440px (owner decision 2, 2026-10-11; see DECISIONS.md)
//   all     = no condition
//   state   = data-* / body.* hooks (not a viewport condition)
//   other   = anything that does not fit a band (strictly: the condition's
//             width range must lie inside the band's range)

const BANDS = {
  mobile: [0, 600],
  tablet: [601, 1023],
  desktop: [1024, 1439],
  wide: [1440, Infinity],
};

function lengthPx(num, unit) {
  const n = Number(num);
  if (!unit || unit === 'px') return n;
  if (unit === 'rem' || unit === 'em') return n * 16;
  return NaN;
}

export function bandOf(raw) {
  const c = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (c === '' || c === 'all') return 'all';
  if (/data-|body\.|:root/.test(c)) return 'state';
  if (c.startsWith('@')) return 'other'; // @container, @supports, named containers
  const parts = c.replace(/^@media\s*/, '').replace(/[()]/g, '').split(/\s+and\s+/);
  let lo = 0;
  let hi = Infinity;
  let hasWidth = false;
  let coarse = false;
  let portrait = false;
  for (const raw1 of parts) {
    const p = raw1.trim();
    let m = p.match(/^(min|max)-width:\s*([\d.]+)(px|rem|em)?$/);
    if (m) {
      const v = lengthPx(m[2], m[3]);
      if (Number.isNaN(v)) return 'other';
      hasWidth = true;
      if (m[1] === 'min') lo = Math.max(lo, v);
      else hi = Math.min(hi, v);
      continue;
    }
    if (/^pointer:\s*coarse$/.test(p)) { coarse = true; continue; }
    if (/^orientation:\s*portrait$/.test(p)) { portrait = true; continue; }
    // any other feature (hover, prefers-reduced-motion, max-height, ...) only narrows
  }
  if (!hasWidth) {
    return coarse && portrait ? 'mobile' : 'other';
  }
  for (const [name, [blo, bhi]] of Object.entries(BANDS)) {
    if (lo >= blo && hi <= bhi) return name;
  }
  return 'other';
}

export const BAND_NAMES = ['mobile', 'tablet', 'desktop', 'wide', 'state', 'other', 'all'];
