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
import { BUILD_VERSION, BUILD_IS_STAMPED } from '../../buildversion.js';

/** The one sentence a player gets if they hover it, and it asks for the report. */
const WHY = BUILD_IS_STAMPED
  ? `Build ${BUILD_VERSION} — quote this when something looks wrong.`
  : `Build ${BUILD_VERSION} — this page was opened without the launcher, so the`
    + ` source digest was never derived. Run the game with run.sh / run.bat to get a real build stamp.`;

/**
 * buildStampHtml(place) → the stamp, ready to drop into a template.
 * `place` names the surface ('title' | 'map' | 'combat') and reaches the DOM so
 * the gate can count placements instead of taking three on trust.
 */
export function buildStampHtml(place) {
  return `<span class="build-stamp" data-role="build-version" data-place="${esc(place)}" title="${esc(WHY)}">BUILD ${esc(BUILD_VERSION)}</span>`;
}
