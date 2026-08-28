// src/ui/components/buildstamp.js — THE ONE RENDERER of the build stamp.
//
// Constantine asked for the build version on three surfaces (main menu, map,
// combat). Three surfaces is three chances to type the same markup three ways,
// and this house has paid for that twice already in bigger things — two map
// renderers (ui/components/mapboard.js), two hand renderers. So the string has
// one home (src/buildversion.js) and its MARKUP has one home, here.
//
// WHY IT CARRIES `data-role` RATHER THAN LEANING ON ITS CLASS. A class is a
// styling hook and any stylesheet may take it away; the role is what the
// photograph gate looks for (tools/buildstamp-shot.mjs), and a gate keyed to a
// styling hook goes quiet the day someone renames the hook.
//
// AND `data-place` IS NOT DECORATION. It is how the gate proves there are
// THREE placements rather than one element photographed three times.
//
// ONE THING THIS CANNOT DO, and it is written here so nobody reads the class as
// a promise: being in the DOM is not being on the screen. `opacity: 0`,
// `visibility: hidden`, a colour equal to the panel behind it, `height: 0` and
// a narrow-layout `display: none` all leave this element exactly where it is
// (Vira's finding on `UNMOVED AND UNEXPLAINED`, 2026-08-15). That is why the
// gate measures INK inside this element's box and not its presence — and why
// styles/ui.css keeps `.build-stamp` out of every narrow-layout hide rule
// deliberately rather than by luck.

import { esc } from './tooltip.js';
import { BUILD_STAMP_TEXT, BUILD_VERSION, BUILD_IS_STAMPED, BUILD_IS_ORDERED, SOURCE } from '../../buildversion.js';

/**
 * The one sentence a player gets if they hover it, and it asks for the report.
 *
 * THREE STATES, NOT TWO, because the two halves of the stamp fail
 * independently: a page can carry a real digest and no ordinal (the dev server
 * on an edited working copy) and never the reverse. The middle sentence says
 * WHICH half is missing rather than implying the whole stamp is worthless.
 */
const WHY = !BUILD_IS_STAMPED
  ? `Build ${BUILD_VERSION} — this page was opened without the launcher, so the`
    + ` source digest was never derived. Run the game with run.sh / run.bat to get a real build stamp.`
  : BUILD_IS_ORDERED
    ? `Build ${BUILD_VERSION} — a higher last number is a newer build. Quote this whole line when something looks wrong.`
    : `Build ${BUILD_VERSION} — served from an edited working copy, so it has no build number yet; the source id`
      + ` beside it still names this exact tree. Quote this whole line when something looks wrong.`;

/**
 * buildStampHtml(place) → the stamp, ready to drop into a template.
 * `place` names the surface ('title' | 'map' | 'combat') and reaches the DOM so
 * the gate can count placements instead of taking three on trust.
 */
export function buildStampHtml(place, { split = false, seed = null } = {}) {
  const contents = split
    ? `<span class="build-number">BUILD ${esc(BUILD_VERSION)}</span>`
      + `<span class="build-source"> · src ${esc(SOURCE)}</span>`
    : esc(BUILD_STAMP_TEXT);
  const seedAttrs = split && seed != null
    ? ` data-seed="${esc(seed)}" aria-label="BUILD ${esc(BUILD_VERSION)}, SEED ${esc(seed)}, SOURCE ${esc(SOURCE)}"`
    : '';
  return `<span class="build-stamp" data-role="build-version" data-place="${esc(place)}"${seedAttrs} title="${esc(WHY)}">${contents}</span>`;
}
