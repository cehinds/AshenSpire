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
 * The SAME width, written so the cascade can still be overridden.
 *
 * A renderer that sets an inline `--epc-level-w: 152px` wins over the root
 * `--card-w-glance` the tuner projects, because an inline style beats a
 * document-level custom property. That is how the card-size sliders came to
 * move `--card-w-*` while every equipment card stayed exactly where it was:
 * measured on the shop's armament shelf, `--card-w-glance` went 152px -> 250px
 * and the faces did not move off 182px, because each one carried the authored
 * number inline.
 *
 * So a renderer writes a REFERENCE, not a resolved number: `var(--card-w-glance,
 * 152px)`. The projected value wins where one exists, and the authored literal
 * is the fallback — which is also what the preview pages need, since they
 * project no tokens of their own and would otherwise render zero-width cards.
 * One home for the number, and the override reaches every surface that draws a
 * card rather than only the ones that happen not to set it inline.
 */
export function cardLevelWidthCss(level, config) {
  const [name, variant] = String(level || 'focus').split(':');
  const px = cardLevelWidthPx(level, config);   // also validates the level by name
  return `var(--card-w-${name}${variant ? `-${variant}` : ''}, ${px}px)`;
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

/**
 * The readable measure a door's details column needs beside the card.
 *
 * Exported in its own right because the threshold is no longer a fixed sum: the
 * inspect width is tunable at runtime, so a caller that has the EFFECTIVE width
 * still needs the authored second term to add to it. Reading it from the config
 * here keeps that term in one home rather than letting the caller carry 384.
 */
export function doorReadableMinPx(config = uiConfig.components.card.sizing) {
  const readable = Number(config?.doorReadableMinPx);
  if (!Number.isFinite(readable) || readable <= 0) {
    throw new Error(`card sizing.doorReadableMinPx must be a positive number, got ${JSON.stringify(config?.doorReadableMinPx)}`);
  }
  return readable;
}

/**
 * The width below which the reading door must stop being two columns.
 *
 * A media query cannot read a custom property, so a stylesheet that wants this
 * threshold has to be TOLD it — an earlier attempt wrote the inspect width out
 * again as `calc(20rem + 24rem)` and called that derived, which it was not: it
 * would not have moved when card.json did. Both terms are authored, so the
 * config stays the one home and `cardInspectionLayout()` only has to compare.
 *
 * The readable term comes from `doorReadableMinPx` rather than being re-read
 * here: it had two readers in this one file, which is the shape this file
 * exists to argue against.
 */
export function cardDoorStackBelowPx(config = uiConfig.components.card.sizing) {
  const inspect = Number(config?.levels?.inspect?.widthPx);
  if (!Number.isFinite(inspect) || inspect <= 0) {
    throw new Error(`card sizing.levels.inspect.widthPx must be a positive number, got ${JSON.stringify(config?.levels?.inspect?.widthPx)}`);
  }
  return inspect + doorReadableMinPx(config);
}

/**
 * THE AUTHORED TABLE, WITH A PLAYER'S OVERRIDES LAID OVER IT.
 *
 * The numbers in card.json remain the default and the only thing that ships;
 * this is a TUNING layer on top, so a size can be tried in the running game
 * without a rebuild, and the result exported back into the file it came from.
 *
 * An override that would break the ladder is REFUSED rather than clamped: the
 * whole point of `glance < focus < inspect` is that a card you opened to read
 * is never smaller than one you were browsing past, and silently repairing a
 * bad number would hide exactly the mistake the tuner is trying to see. A
 * refused table falls back to the authored one and says which key was wrong.
 */
export function cardLevelsWithOverrides(settings = {}, config = uiConfig.components.card.sizing.levels) {
  const authored = cardLevels(config);
  const px = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const merged = {};
  for (const [level, row] of Object.entries(authored)) {
    const variants = { ...row.variants };
    for (const name of Object.keys(variants)) {
      const override = px(settings[`cardWidth_${level}_${name}`]);
      if (override !== null) variants[name] = override;
    }
    merged[level] = { widthPx: px(settings[`cardWidth_${level}`]) ?? row.widthPx, variants };
  }
  const order = ['glance', 'focus', 'inspect'];
  for (let i = 1; i < order.length; i += 1) {
    if (!(merged[order[i - 1]].widthPx < merged[order[i]].widthPx)) {
      return { levels: authored, refused: `${order[i - 1]} (${merged[order[i - 1]].widthPx}px) must be smaller than ${order[i]} (${merged[order[i]].widthPx}px)` };
    }
  }
  // EVERY RESTING WIDTH IS A RESTING WIDTH, INCLUDING THE VARIANTS.
  // Checking only `glance.widthPx` left the ladder open at exactly the place
  // this PR widened it: `glance.variants.mobile` is what a phone actually
  // rests at, so a mobile override of 640 against the default focus of 280
  // passed the loop above and still put a browsing card half again wider than
  // a selected one. A variant is refused by its own key, so the message names
  // the slider that is wrong rather than the level it hangs under.
  for (const [name, width] of Object.entries(merged.glance.variants)) {
    if (!(width < merged.focus.widthPx)) {
      return { levels: authored, refused: `glance:${name} (${width}px) must be smaller than focus (${merged.focus.widthPx}px)` };
    }
  }
  return { levels: merged, refused: null };
}

/** The same CSS properties, from an override-aware table. */
export function cardLevelCssPropertiesFor(levels) {
  const out = {};
  for (const [name, row] of Object.entries(levels)) {
    out[`--card-w-${name}`] = `${row.widthPx}px`;
    for (const [variant, px] of Object.entries(row.variants)) out[`--card-w-${name}-${variant}`] = `${px}px`;
  }
  return out;
}

/**
 * The tuned table as the JSON it came from, ready to paste back into
 * content/config/ui/components/card.json. Exporting a DIFFERENT shape from the
 * one the file uses would mean translating by hand on the way in, which is
 * where a transcription error would live.
 */
export function cardSizingExport(levels) {
  const out = {};
  for (const [name, row] of Object.entries(levels)) {
    out[name] = Object.keys(row.variants).length
      ? { widthPx: row.widthPx, variants: { ...row.variants } }
      : { widthPx: row.widthPx };
  }
  // ONLY THE BLOCK BEING TUNED, AT ITS REAL PATH. An earlier draft also emitted
  // `ratio` and `bands` for completeness and would have been wrong to paste:
  // the generated config resolves `ratio` to a NUMBER (0.714286) while
  // card.json authors it as `{ numerator, denominator }`, so a round trip
  // through this export would have quietly rewritten the shape into a form the
  // file does not use.
  //
  // But a bare `{ levels: … }` was wrong too, and for the opposite reason: the
  // widths live at `sizing.levels`, not at the root, so text that LOOKED like a
  // whole card.json would have produced a file with no `sizing` block at all
  // and the config builder would have refused it.
  //
  // So it is nested to match the file's own shape and MERGED AT THE ROOT. The
  // first attempt at this got the instruction wrong in the other direction —
  // the settings row said "paste it over `sizing.levels`", which with this
  // nesting yields `sizing.levels.sizing.levels` and no tuned rows at all.
  // Shape and instruction have to agree, so `cardSizingExportPath` states the
  // destination once and the UI row reads from the same idea rather than
  // describing it again in its own words.
  return JSON.stringify({ sizing: { levels: out } }, null, 2);
}

/**
 * The width below which a card at rest uses its MOBILE glance width.
 *
 * Read from the kit's existing `tokens.compactBelowPx` rather than a number of
 * this component's own: "is this a compact viewport" is one question the whole
 * kit already answers, and a card that disagreed with the rest of the UI about
 * where mobile starts would be a second definition of the same word.
 */
export function cardMobileBelowPx(tokens = uiConfig.tokens) {
  const px = Number(tokens?.compactBelowPx);
  if (!Number.isFinite(px) || px <= 0) {
    throw new Error(`ui tokens.compactBelowPx must be a positive number, got ${JSON.stringify(tokens?.compactBelowPx)}`);
  }
  return px;
}

/**
 * The resting width for a given viewport width.
 *
 * `glance` is the size a card rests at; `glance.variants.mobile` is that size
 * ON A PHONE, where the same number reads differently because `--ui-zoom` has
 * already scaled it. It ships EQUAL to `glance`, so nothing moves until it is
 * tuned — a variant that silently changed the phone on the day it was added
 * would be a behaviour change wearing a knob's clothes.
 *
 * This resolves in JS rather than in a media query so there is one property
 * name for a resting card's width. The alternative — a `--card-w-glance`
 * redeclared inside `@media` — is the same later-rule-wins shape that has
 * produced three defects in this component already.
 */
export function restingWidthPx(viewportWidthPx, levels, tokens = uiConfig.tokens) {
  const glance = levels.glance;
  const mobile = glance.variants && glance.variants.mobile;
  return (viewportWidthPx < cardMobileBelowPx(tokens) && Number.isFinite(mobile)) ? mobile : glance.widthPx;
}

/** Where `cardSizingExport`'s text belongs, for whatever presents the copy. */
export const cardSizingExportPath = 'merge at the root of content/config/ui/components/card.json (replaces sizing.levels)';
