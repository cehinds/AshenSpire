// Map-only orientation component. It sits between the shared run HUD and the
// map board; Combat never mounts it and the shared HUD does not know it exists.
import { esc } from './tooltip.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';

export function actRouteStripHtml({ title } = {}) {
  if (!title) return '';
  return `<div class="act-route-strip map-entrance-orientation" ${uiComponentAttrs(UI.actRouteStrip)} data-composition="orientation-strip" role="note" aria-label="${esc(title)} orientation: entrance to boss">
    <strong>${esc(title)}</strong>
    <span class="map-orientation-progress" aria-hidden="true">
      <small data-role="start">ENTRANCE</small><span class="map-orientation-rail"></span><small data-role="boss">BOSS</small>
    </span>
  </div>`;
}
