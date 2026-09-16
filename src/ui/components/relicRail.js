// WGH6 relic rail: ONE renderer for the shared run HUD on every screen. The
// rail is the shared icon tray (components/iconTray.js) — the combatant card's
// status row is its reference, so a relic wears the same round Pip, the same
// non-wrapping row with its `+N` tile, and the same tooltip: hover or a tap
// explains it, a second tap (or Enter) opens the shared collectible card
// (WC2b). Each icon is keyed by its stable relic id.
import { openCollectibleInspection } from './collectibleCard.js';
import { esc } from './tooltip.js';
import { relicText } from './card.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { observeIconTray, setIconTrayItems, trayIcon } from './iconTray.js';

export function relicRailTile(registries, relicId) {
  const def = registries.relics.get(relicId);
  const tile = trayIcon({
    glyph: def.icon || '◆', tone: def.tint || '', label: def.name,
    attrs: { class: 'relic', dataset: { relicId } },
    tip: () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def, registries))}`,
    activate: (node) => openCollectibleInspection(registries, def, 'Relic', node),
  });
  markUiComponent(tile, UI.relicSlot);
  return tile;
}

/** mountRelicRail(host, registries, relicIds) — replace the rail's icons and
 * keep them fitted to the rail; a host whose relic layer is off (no host)
 * draws nothing. */
export function mountRelicRail(host, registries, relicIds = []) {
  if (!host) return;
  setIconTrayItems(host, relicIds.map((relicId) => relicRailTile(registries, relicId)));
  observeIconTray(host);
}
