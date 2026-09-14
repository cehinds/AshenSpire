// W4b MAP HEADER — the DOM half of `ui/models/MapHeaderLayout.js`.
//
// A map screen opts in by drawing the run HUD with `layout: 'map-compact'`
// (and its route receipt as `orientationHtml`), then calling `sizeMapHeader`
// BEFORE its board mounts and again on every resize, ahead of the camera. The
// board checks a saved fit camera against the scene's height, so the header
// must already have its final height when the board first measures.
//
// The model decides in physical px; this file only reads the viewport the same
// way main.js's applyUiScale does and writes the answer as unitless custom
// properties and data attributes. styles/kit.css § MAP HEADER converts through
// `--ui-zoom`, so a zoom change needs no second write.
import { mapHeaderLayout } from '../models/MapHeaderLayout.js';

export const MAP_HEADER_LAYOUT = 'map-compact';

export function readMapHeaderViewport(win = window) {
  const viewport = win.visualViewport;
  const height = viewport && viewport.scale === 1 ? viewport.height : win.innerHeight;
  // The player's tap size (balance.ui.tapSize, written as --tap-target) is the
  // floor's row; absent, the model falls back to its configured 44.
  const tap = Number.parseFloat(win.getComputedStyle(win.document.documentElement).getPropertyValue('--tap-target'));
  return { viewportWidthPx: win.innerWidth, viewportHeightPx: height, targetPx: Number.isFinite(tap) ? tap : null };
}

export function applyMapHeaderLayout(hud, layout) {
  hud.style.setProperty('--map-header-height-px', String(layout.heightPx));
  hud.style.setProperty('--map-header-inset-px', String(layout.insetPx));
  hud.style.setProperty('--map-header-gap-px', String(layout.gapPx));
  hud.dataset.mapHeaderLayout = layout.layout;
  hud.dataset.mapHeaderRoute = layout.route;
  hud.dataset.mapHeaderFloored = layout.floored ? 'true' : 'false';
  return layout;
}

/** Size every compact map header under `root`; returns the layout, or null. */
export function sizeMapHeader(root, win = window) {
  const hud = root.querySelector(`.shared-hud[data-hud-layout="${MAP_HEADER_LAYOUT}"]`);
  if (!hud) return null;
  return applyMapHeaderLayout(hud, mapHeaderLayout(readMapHeaderViewport(win)));
}
