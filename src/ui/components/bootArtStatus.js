// src/ui/components/bootArtStatus.js — the boot status line beside the startup
// gate (docs/EXTERNAL-ASSETS-PLAN.md step 5; model: BootArtStatusModel).
//
// A polite live region, aria-busy while it counts, mounted in #app as a
// SIBLING of the gate's <section role="button"> (never inside it, where it
// would be presentational to assistive tech, and never one of the gate's
// children, which SPEC §7.1 fixes). It takes no input (pointer-events: none),
// so a press on it is a press on the gate beneath. It is drawn only in a build
// that pins packs; src/ui/bootArt.js paintBootArt rewrites it as the load
// moves on, and the next screen's mount replaces it with the rest of #app.

import { esc } from './tooltip.js';

/** The line's markup for a model. */
export function bootArtStatusHtml(model) {
  const a = model.accessibility;
  return `<p class="boot-art-status" data-component="boot-art-status" data-boot-art-status data-state="${esc(model.variant)}"
    role="${esc(a.role)}" aria-live="${esc(a.live)}" aria-busy="${a.busy ? 'true' : 'false'}">${esc(model.properties.text)}</p>`;
}

/** Put the line at the end of `app` (beside the gate), replacing one already there. */
export function mountBootArtStatus(app, model) {
  if (!app || typeof app.querySelector !== 'function' || !model) return null;
  app.querySelector(':scope > .boot-art-status')?.remove();
  app.insertAdjacentHTML('beforeend', bootArtStatusHtml(model));
  return app.querySelector(':scope > .boot-art-status');
}
