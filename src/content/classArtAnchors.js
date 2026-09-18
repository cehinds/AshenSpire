// src/content/classArtAnchors.js — THE ONE HOME of where the sigil medallion
// sits on each painted class figure.
//
// The measurements themselves now live in
// content/config/ui/presentation/classArtAnchors.json under
// `positioning.medallionPct`. Everything below — why they are measured rather
// than derived, and how each was taken — is unchanged and binds whoever edits
// that file.
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
// a share of the frame (7% of its height, in `classSprite()`), so a value is
// only good if that whole band is chest.
//
// IF THE ART IS REPLACED these numbers are wrong until re-measured. They are
// bound to the source paintings pinned in tools/concept-cutout.mjs `CONCEPTS`;
// that tool fails rather than guessing when a class here has no anchor.
//
// RE-MEASURED 2026-09-07, AND THE ANCHOR GREW AN X. The 2026-09-04 pass
// recorded three of these as null — "measured as unplaceable" — and named the
// two things that defeated every candidate. Both were properties of the DISC,
// not of the art, and both are fixed:
//
//   · SIZE. The disc was a fixed 22px in a 190px frame whatever the art did,
//     which covered a full-body figure's chest from collar to forearm. It is
//     now a share of the frame, in `classSprite()`, and scales with its host.
//   · POSITION. The anchor was a HEIGHT only, centred at `left: 50%` — a claim
//     that the torso is horizontally centred, which a cape sweeping to one side
//     makes false. The anchor now carries an x as well.
//
// Candidates were drawn over the SHIPPED 450x570 sprites at the shipped size,
// four per class, then the surviving pair re-inspected at the real 150x190
// combat host so the choice was judged at the size a player sees. Evidence: the
// candidate and size sheets in the 2026-09-07 anchor pass.
//
// Per class, and why that spot: the Reaver's chest plate sits in the hollow
// between his crossed forearms; the Starseer's is the V below the mantle
// collar, above the belt tabard's own gold triangle; the Rogue's is the clean
// field of the jerkin below the hood's shadow. The Herald keeps 61 — its
// shipped sprite is STILL THE BUST, that number was measured for this art, and
// it re-inspected well, so it is left alone rather than churned. It is wrong
// the moment its full-body figure ships, exactly as before.
//
// Headless-safe: data only, no document, no storage, no timers.
import { uiConfig } from '../config/generated/ui.js';

/**
 * Medallion centre per class, as `{ x, y }` percentages of the sprite frame.
 * Measured on the 450x570 outputs of the cutters.
 */
export const CLASS_MEDALLION_PCT = uiConfig.presentation.classArtAnchors.positioning.medallionPct;

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
