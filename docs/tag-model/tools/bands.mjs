// Breakpoint normalisation: raw CSS condition -> named band.
//
// Bands (proposal, see docs/tag-model/README.md, "Presentation layer"):
//   mobile  = phone: 600px and under (0, 600], or pointer:coarse with orientation:portrait
//   tablet  = above 600px up to 1023px (600, 1023]
//   desktop = above 1023px up to 1439px (1023, 1439]
//   wide    = above 1439px (1439, infinity) (owner decision 2, 2026-10-11; see DECISIONS.md)
// The bands are half-open, so no width falls between two of them.
//   all     = no condition
//   state   = data-* / body.* hooks (not a viewport condition)
//   other   = anything that does not fit a band (strictly: the condition's
//             width range must lie inside the band's range)

// Checked in this order. A condition is in a band when its lower edge is inside
// the band (inclusive for mobile, which starts at 0; exclusive for the others)
// and its upper edge is at or below the band's top.
const BANDS = [
  { name: 'mobile', min: 0, minInclusive: true, max: 600 },
  { name: 'tablet', min: 600, minInclusive: false, max: 1023 },
  { name: 'desktop', min: 1023, minInclusive: false, max: 1439 },
  { name: 'wide', min: 1439, minInclusive: false, max: Infinity },
];

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
  for (const b of BANDS) {
    const aboveLow = b.minInclusive ? lo >= b.min : lo > b.min;
    if (aboveLow && hi <= b.max) return b.name;
  }
  return 'other';
}

export const BAND_NAMES = ['mobile', 'tablet', 'desktop', 'wide', 'state', 'other', 'all'];
