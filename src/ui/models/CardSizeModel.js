import { uiConfig } from '../../config/generated/ui.js';

// THE ONE HOME FOR HOW BIG A CARD IS.
//
// Every card in the game is one renderer — `.epc-frame` is a fixed 350x490
// design-pixel canvas that is transform-scaled into whatever box holds it, so
// the container's width IS the card's size. Before this file there was no
// authored size at all: nine surfaces each wrote their own `max-width` into
// styles/kit.css, and the card came out whatever that number happened to be.
// Measured at b3130e515, one renderer, two viewports:
//
//   shop armaments   315x441 desktop / 236x330 phone   (no cap at all —
//                    the card simply inherited the 280px shelf track)
//   armoury faces    305x427 / 228x320                 (max-width:280px)
//   inspect modal    264x370 / 144x202                 (max-width:220px)
//   cc summary slot  216x302 / 162x227                 (max-width:180px)
//   cc picker        154x215 / 130x182                 (max-width:152px)
//
// A 2.05x spread on the desktop, and — the part that was a bug rather than an
// inconsistency — INSPECT CAME OUT SMALLER THAN FOCUS. The one surface whose
// job is to show you everything was the second-smallest card on the screen,
// and its effect text was silently cut off the bottom of the face with no
// ellipsis and no scroller. Size is now three authored numbers, here:
//
//   content/config/ui/components/card.json -> sizing.levels
//
// THE LEVEL NAMES ARE SHARED, AND DELIBERATELY ONLY THREE. `glance | focus |
// inspect` is one vocabulary: this file decides how BIG the card is at each
// level and the field manifest decides WHICH FIELDS it shows. A fourth level
// name would fork that vocabulary, so the one surface that genuinely needs a
// different width — the character-creation picker's list view, whose cards sit
// beside their own text — declares a VARIANT of glance rather than a level of
// its own. A variant is authored data with a name; it is not a new CSS rule.

const LEVELS = ['glance', 'focus', 'inspect'];

// THE ONE HOME FOR WHAT SHAPE A CARD IS, for the same reason as the widths
// above — and it was a LIVE Law 1 violation, not a tidy-up. Measured at
// c63a09620, one renderer, eight surfaces, two viewports:
//
//   combat hand / shop shelf / reward pick / inspect modal / co-op    5 / 8
//   deck+discard piles / armoury card gallery / cc starting fold      5 / 7
//
// The same card, two shapes, decided by which screen it landed on. And the
// authored number had no reach: `content/config/ui/components/card.json`
// declared `sizing.ratio` and `sizing.bands`, but its ONLY readers were
// HandLayout and CombatLayout — the hand's geometry maths. The card's own face
// was drawn by `styles/kit.css`, which wrote `aspect-ratio: 5 / 8` and
// `grid-template-rows: ...1fr 4fr 4fr 1fr` out a SECOND time, with no link
// between them. Editing the JSON moved the hand's arithmetic and left the card
// looking exactly as it had.
//
// WHICH SHAPE WON, AND WHY IT IS NOT THE JSON'S OLD NUMBER. SPEC.md is the
// source of truth (CONTRIBUTING §1) and states the playing card's shape once:
// "the solo hand ... preserving its 5:7 aspect ratio" (§12). There is no 5:8
// anywhere in SPEC.md. docs/COMPONENT-CATALOG.md says the shipped
// `player-hand-tray` is "Fixed 5:7 card faces". styles/combat.css says it twice
// more, in rules that carry their own comment ("A hand card has one portrait
// profile") and pin 178 x 249.2 px — 5:7 exactly. The 5:8 came from
// docs/WIREFRAME-FIRST-REBUILD-IMPLEMENTATION-PLAN.md ("Cards | 5:8 ratio;
// 10/40/40/10 bands"), a rebuild plan rather than the spec, and reached the
// tree as this JSON and the WC1 stylesheet rule. So the spec's shape is the
// card's shape, and it now has one home:
//
//   content/config/ui/components/card.json -> sizing.ratio, sizing.bands
//
// Everything downstream DERIVES: the hand's layout maths reads the number
// through wireframeUi, and the stylesheet reads the custom properties below.

/** The authored shape, checked. `ratio` is width/height; `bands` are the four face tracks. */
export function cardShape(config = uiConfig.components.card.sizing) {
  const ratio = Number(config?.ratio);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new Error(`card sizing.ratio must be a positive width/height fraction, got ${JSON.stringify(config?.ratio)}`);
  }
  const bands = config?.bands;
  // FOUR TRACKS, NOT "SOME TRACKS". The face is name / art / body / metadata
  // and the renderer emits exactly those four children; a fifth number here
  // would silently stop being a band and start being a lie.
  if (!Array.isArray(bands) || bands.length !== 4
    || !bands.every((b) => Number.isFinite(Number(b)) && Number(b) > 0)) {
    throw new Error(`card sizing.bands must be four positive numbers (name, art, body, metadata), got ${JSON.stringify(bands)}`);
  }
  const weights = bands.map(Number);
  const total = weights.reduce((sum, b) => sum + b, 0);
  return Object.freeze({ ratio, bands: Object.freeze(weights), bandTotal: total });
}

/**
 * The root custom properties the stylesheet reads for the card's SHAPE. Every
 * `.card` rule in styles/ reads these rather than restating the numbers, so a
 * change to card.json moves the face and the hand's arithmetic together.
 */
export function cardShapeCssProperties(config) {
  const { ratio, bands, bandTotal } = cardShape(config);
  const [head] = bands;
  return Object.freeze({
    // `aspect-ratio: var(--card-ratio)` — width / height, as CSS wants it.
    '--card-ratio': `${ratio}`,
    // Height per unit width, for the few rules that must state a height in
    // `calc()` because they also pin a pixel width.
    '--card-height-per-width': `${1 / ratio}`,
    // `grid-template-rows: var(--card-bands)` — the four face tracks.
    '--card-bands': bands.map((b) => `minmax(0, ${b}fr)`).join(' '),
    // The head band as a percentage, for the cost rail that hangs just under it.
    '--card-band-head': `${(head / bandTotal) * 100}%`,
  });
}

/** The authored level table, checked. A bad number here is a loud boot, not a wrong card. */
export function cardLevels(config = uiConfig.components.card.sizing.levels) {
  const out = {};
  for (const level of LEVELS) {
    const row = config?.[level];
    const width = Number(row?.widthPx);
    if (!Number.isFinite(width) || width <= 0) {
      throw new Error(`card sizing.levels.${level}.widthPx must be a positive number, got ${JSON.stringify(row?.widthPx)}`);
    }
    const variants = {};
    for (const [name, value] of Object.entries(row.variants || {})) {
      const px = Number(value);
      if (!Number.isFinite(px) || px <= 0) {
        throw new Error(`card sizing.levels.${level}.variants.${name} must be a positive number, got ${JSON.stringify(value)}`);
      }
      variants[name] = px;
    }
    out[level] = Object.freeze({ widthPx: width, variants: Object.freeze(variants) });
  }
  // THE ORDERING IS THE CONTRACT, not a preference. A card you asked to inspect
  // that came out smaller than the one you were browsing is the exact defect
  // this file exists to close, so it is refused at boot rather than measured
  // later by someone wondering why the text is cut.
  if (!(out.glance.widthPx < out.focus.widthPx && out.focus.widthPx < out.inspect.widthPx)) {
    throw new Error('card sizing.levels: widths must increase glance < focus < inspect, got '
      + `${out.glance.widthPx} / ${out.focus.widthPx} / ${out.inspect.widthPx}`);
  }
  return Object.freeze(out);
}

/** `level` and `level:variant` both resolve here; anything else is refused by name. */
export function cardLevelWidthPx(level, config) {
  const levels = cardLevels(config);
  const [name, variant] = String(level || 'focus').split(':');
  const row = levels[name];
  if (!row) throw new Error(`card level "${level}": levels are ${LEVELS.join(', ')}`);
  if (!variant) return row.widthPx;
  if (!(variant in row.variants)) {
    throw new Error(`card level "${level}": ${name} has no variant "${variant}"`
      + ` (declare it in content/config/ui/components/card.json, not in a stylesheet)`);
  }
  return row.variants[variant];
}

/**
 * The root custom properties the stylesheet reads. A surface whose width is
 * decided by its CONTAINER rather than by its render call — the picker's view
 * toggle flips `data-view` on the grid without re-rendering a single card —
 * can only read the number from here, which is why these exist at all.
 */
export function cardLevelCssProperties(config) {
  const levels = cardLevels(config);
  const out = {};
  for (const [name, row] of Object.entries(levels)) {
    out[`--card-w-${name}`] = `${row.widthPx}px`;
    for (const [variant, px] of Object.entries(row.variants)) out[`--card-w-${name}-${variant}`] = `${px}px`;
  }
  return Object.freeze(out);
}
