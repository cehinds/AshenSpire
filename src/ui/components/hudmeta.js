// Shared top-row progress receipt for map and combat.
import { esc } from './tooltip.js';

export function hudCenterHtml({ cinders, floor, floorTotal = null }) {
  const floorText = floorTotal == null ? `FLOOR ${floor}` : `FLOOR ${floor} / ${floorTotal}`;
  return `<div class="hud-center" role="status" aria-label="${esc(`${floorText}; ${cinders} cinders`)}">
    <span class="hud-floor">${esc(floorText)}</span>
    <span class="hud-cinders">⛁ ${esc(cinders)}</span>
  </div>`;
}
