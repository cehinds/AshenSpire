// src/content/classArtAnchors.js — THE ONE HOME of where the sigil medallion
// sits on each painted class figure.
//
// Two readers and neither retypes it:
//   · runtime — src/ui/assets.js `classSprite()` positions the overlay
//   · the manifest — tools/concept-cutout.mjs emits it per sprite as
//     `anchor.medallion_center_pct`, so the inventory records the anchor the
//     game actually uses rather than a number someone typed twice
//
// WHY IT IS DATA AND NOT A HEURISTIC. The overlay used to be a single
// hardcoded `top:53%` for all four classes. That is a claim that every figure
// keeps its chest at the same height, which was true of the Blender builders —
// one rig, four palettes — and is false of four separately painted figures.
// Shipped consequence, visible in docs/art-evidence/2026-09-03: 53% lands on
// the Starseer's face under the hat brim and inside the Herald's hood opening.
//
// I did try to derive it. A silhouette-width scan finds the shoulder line on
// the Reaver and the Rogue and is defeated by the Starseer's staff and the
// Herald's halo, which widen the row profile far above the shoulders. A
// detector that is wrong on two of four figures would re-ship the same defect
// with more machinery behind it, so these are MEASURED, one per painting.
//
// HOW EACH NUMBER WAS TAKEN. The medallion disc was drawn at candidate heights
// over each sprite and inspected: the accepted value puts the whole disc on
// chest, clear of the face opening and of the collar edge above it. The disc is
// 22px in a 190px frame, so it spans ±5.8 percentage points around the centre —
// a value is only good if that whole band is chest.
//
// IF THE ART IS REPLACED these numbers are wrong until re-measured. They are
// bound to the source paintings pinned in tools/concept-cutout.mjs `CONCEPTS`;
// that tool fails rather than guessing when a class here has no anchor.
//
// Headless-safe: data only, no document, no storage, no timers.

/**
 * Medallion centre as a percentage of the sprite frame's height, per class.
 * Measured on the 450x570 outputs of `node tools/concept-cutout.mjs`.
 */
export const CLASS_MEDALLION_PCT = Object.freeze({
  // Chest plate below the gorget. The helm ends well above; this is the value
  // the old shared 53% happened to be right about.
  reaver: 53,
  // Robe collar. The hat brim is wide and sits low, and the face beneath it
  // reaches ~54%, so the anchor clears both rather than splitting them.
  starseer: 62,
  // Chest strap, below the hood opening. Also right at the old shared value.
  rogue: 53,
  // Chest, between the two strands of prayer beads and below the hood opening,
  // which the halo makes read higher in the frame than the other three hoods.
  herald: 61,
});

/**
 * The medallion centre for a class, or null when that class has no measurement.
 *
 * Null rather than a fallback percentage ON PURPOSE: a default here would be
 * the shared-53% assumption smuggled back in, and it would put the overlay on
 * an unmeasured figure's face exactly as before, silently. Callers decide —
 * `classSprite()` omits the overlay, `concept-cutout.mjs` fails the run.
 */
export function medallionPct(classId) {
  return Object.prototype.hasOwnProperty.call(CLASS_MEDALLION_PCT, classId)
    ? CLASS_MEDALLION_PCT[classId]
    : null;
}
