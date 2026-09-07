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
 * Medallion centre per class, as `{ x, y }` percentages of the sprite frame.
 * Measured on the 450x570 outputs of the cutters.
 */
// RE-MEASURED 2026-09-07, AND THE ANCHOR GREW AN X.
//
// The 2026-09-04 pass recorded three of these as null — "measured as
// unplaceable" — and named the two things that defeated every candidate. Both
// were properties of the DISC, not of the art, and both are fixed now, so the
// measurement is possible again and these are real numbers:
//
//   · SIZE. The disc was a fixed 22px in a 190px frame — 11.6% of the frame's
//     height whatever the art did. A bust's chest was about a third of the
//     frame; a full-body chest is about a tenth, so 22px covered the Reaver's
//     chest from collar to forearm. The disc is now a share of the frame
//     (7% of its height, in `classSprite()`), which is a chest-sized jewel on
//     a full-body figure and scales with whatever frame it is drawn in.
//   · POSITION. The anchor was a HEIGHT only, and the overlay was centred at
//     `left: 50%` — a claim that the torso is horizontally centred. A cape
//     sweeping to one side moves the content box's centre off the body's. The
//     anchor now carries an x as well, so the disc goes where the chest is
//     rather than where the frame's middle is.
//
// HOW THESE WERE TAKEN. The method the file has always used: candidate discs
// drawn over the SHIPPED 450x570 sprites at the shipped 7% size and inspected,
// four candidates per class, then the surviving pair re-inspected at the real
// 150x190 combat host so the choice was judged at the size a player sees. The
// accepted value puts the whole disc on chest, clear of the face opening above
// and of the hands, belt or existing gold clasp below. Evidence: the candidate
// and size sheets in the 2026-09-07 anchor pass.
//
// Per class, and why that spot: the Reaver's chest plate sits in the hollow
// between his crossed forearms; the Starseer's is the V below the mantle
// collar, above the belt tabard's own gold triangle; the Rogue's is the clean
// field of the jerkin below the hood's shadow. The Herald keeps 61 — its
// shipped sprite is STILL THE BUST, that number was measured for this art, and
// it re-inspected well, so it is left alone rather than churned. It is wrong
// the moment its full-body figure ships, exactly as before.
export const CLASS_MEDALLION_PCT = Object.freeze({
  reaver: Object.freeze({ x: 50, y: 35 }),
  starseer: Object.freeze({ x: 48, y: 37 }),
  rogue: Object.freeze({ x: 49, y: 35 }),
  herald: Object.freeze({ x: 50, y: 61 }),
});

/**
 * The medallion centre for a class as `{ x, y }` percentages of the sprite
 * frame, or null when that class has no measurement.
 *
 * Null rather than a fallback ON PURPOSE: a default here would be the shared
 * assumption smuggled back in, and it would put the overlay on an unmeasured
 * figure's face exactly as before, silently. Callers decide —
 * `classSprite()` omits the overlay, `concept-cutout.mjs` fails the run.
 *
 * BOTH AXES OR NEITHER. A y with no x would be the `left: 50%` claim again,
 * so the anchor is one value carrying both and there is no accessor for half
 * of it.
 */
export function medallionAnchor(classId) {
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
