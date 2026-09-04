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
// RE-MEASURED 2026-09-04 for the three classes whose art became FULL BODY
// (docs/art-evidence/2026-09-04/poses, shipped by `pose-cutout.mjs --ship`).
// The old values were right for busts and wrong the moment the art changed,
// exactly as the note above warns: a bust's chest sat around the middle of the
// frame, and a full-body figure's sits in its upper third. Taken by the same
// method — the disc drawn at candidate heights over the shipped 450x570 output
// and inspected.
//
// ONE THING THE BAND RULE ABOVE CANNOT MEET ON FULL-BODY ART, said plainly
// rather than quietly relaxed: the disc is a fixed 22px in a 190px frame, so it
// spans ±5.8 points whatever the art does, while a full-body figure's chest is
// roughly half the share of frame height a bust's was. No candidate puts that
// whole band on chest any more — the values below put the disc's CENTRE and the
// bulk of it on chest, clear of the face opening above and the hands or belt
// below, which is the best the current disc size allows. Making the disc scale
// with the figure is the real fix and belongs with the disc, not here.
export const CLASS_MEDALLION_PCT = Object.freeze({
  // MEASURED AS UNPLACEABLE, not unmeasured — the distinction the tools read
  // below. Candidates were drawn at 22/25/27/29/31/34/38% over each shipped
  // full-body sprite and inspected. Two things defeat every one of them, and
  // both are consequences of the art becoming full body rather than of the
  // heights being badly chosen:
  //
  //   · SIZE. The disc is a fixed 22px in a 190px frame — 11.6% of the frame's
  //     height whatever the art does. A bust's chest was about a third of the
  //     frame; a full-body chest is about a tenth. The best candidates put the
  //     disc on the Reaver's pauldron and on the Starseer's hood shadow, which
  //     is the same defect this file was written to stop ("53% lands on the
  //     Starseer's face under the hat brim").
  //   · POSITION. The anchor is a HEIGHT only, and the overlay is centred at
  //     `left: 50%` — a claim that the torso is horizontally centred in the
  //     frame. True of a bust. False of a full-body figure whose cape sweeps to
  //     one side, which moves the CONTENT box's centre off the body's centre.
  //
  // So these are null: no overlay, which this file already argues is strictly
  // better than a wrong one. Restoring the sigil needs the anchor to carry an x
  // as well as a y and the disc to scale with the figure — a change to the
  // medallion, not a different number here, and carded rather than smuggled in.
  reaver: null,
  starseer: null,
  rogue: null,
  // STILL A BUST, and still measured for one: the Herald's full-body source was
  // refused by the image service's daily limit, so its shipped sprite is the
  // 2026-09-03 crop and 61 remains the value that art was measured at. This
  // number is wrong the moment its full-body figure ships.
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

/**
 * Has this class's art been LOOKED AT for an anchor? — `true` for a measured
 * percentage and `true` for a measured null.
 *
 * The runtime cannot tell those apart and should not care: both mean "draw no
 * overlay". A build tool must, because its gate exists to stop art shipping
 * before anyone checked where the sigil would land, and "we checked and it
 * cannot go anywhere on this figure" is a check, not a gap. Without this the
 * only way past that gate would be to invent a number.
 */
export function medallionDeclared(classId) {
  return Object.prototype.hasOwnProperty.call(CLASS_MEDALLION_PCT, classId);
}
