// WGH6 relic rail tiles: ONE renderer for the shared run HUD on every screen
// (combat and the rooms drew the same tile twice, and only combat's carried
// the relic's id). Each tile is the kit Slot, keyed by its stable relic id,
// and opens the shared collectible card (WC2b) on activation.
import { openCollectibleInspection } from './collectibleCard.js';
import { attachTooltip, esc } from './tooltip.js';
import { relicText } from './card.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { slot } from '../kit/index.js';

export function relicRailTile(registries, relicId) {
  const def = registries.relics.get(relicId);
  const tile = slot({ art: def.icon || '◆', small: true, tag: 'button', label: def.name, className: 'relic', attrs: { dataset: { relicId } } });
  markUiComponent(tile, UI.relicSlot);
  tile.addEventListener('click', () => openCollectibleInspection(registries, def, 'Relic', tile));
  attachTooltip(tile, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def, registries))}`);
  return tile;
}

/** mountRelicRail(host, registries, relicIds) — replace the rail's tiles; a
 * host whose relic layer is off (no host) draws nothing. */
export function mountRelicRail(host, registries, relicIds = []) {
  if (!host) return;
  host.replaceChildren(...relicIds.map((relicId) => relicRailTile(registries, relicId)));
}
