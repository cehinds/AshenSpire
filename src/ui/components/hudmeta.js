// Reusable Map/Combat HUD assets. Each exported function owns one named DOM
// component; sharedRunHudHtml composes them without taking ownership of run
// state or screen callbacks.
import { esc } from './tooltip.js';
import { buildStampHtml } from './buildstamp.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';

function progressText(value, total, label) {
  return total == null ? `${label} ${value}` : `${label} ${value} / ${total}`;
}

export function identityClusterHtml(identity) {
  return `<div class="hud-identity" ${uiComponentAttrs(UI.identityCluster)}>
    <div class="portrait" ${uiComponentAttrs(UI.portraitBadge)} style="border-color:${esc(identity.tint)}">${esc(identity.glyph)}</div>
    <span class="nm" ${uiComponentAttrs(UI.characterTitle)}>${esc(identity.name)} · ${esc(identity.classLabel)}</span>
  </div>`;
}

export function cindersCounterHtml(cinders) {
  return `<div class="hud-center" ${uiComponentAttrs(UI.cindersCounter)} role="status" aria-label="${esc(`${cinders} cinders`)}">
    <span class="hud-cinders">⛁ ${esc(cinders)}</span>
  </div>`;
}

export function buildMetadataTrailHtml({ place, act, actTotal, floor, floorTotal, seed }) {
  return `<div class="hud-run-meta" ${uiComponentAttrs(UI.buildMetadataTrail)}>
    <span class="hud-act">${esc(progressText(act, actTotal, 'ACT'))}</span>
    <span class="hud-floor">${esc(progressText(floor, floorTotal, 'FLOOR'))}</span>
    ${buildStampHtml(place, { split: true, seed })}
  </div>`;
}

export function runHeaderStripHtml({ place, cinders, act, actTotal, floor, floorTotal, seed, identity }) {
  return `<div class="hud-info-row" ${uiComponentAttrs(UI.runHeaderStrip)}>
    ${identityClusterHtml(identity)}
    ${cindersCounterHtml(cinders)}
    ${buildMetadataTrailHtml({ place, act, actTotal, floor, floorTotal, seed })}
  </div>`;
}

export function vitalsPanelHtml() {
  return `<section class="hud-vitals-panel" ${uiComponentAttrs(UI.vitalsPanel)} aria-label="Health, mana, and stamina">
    <div class="resbars-host" ${uiComponentAttrs(UI.resourceMeter)}></div>
  </section>`;
}

export function quickAccessPanelHtml(controls) {
  return `<section class="hud-control-grid" ${uiComponentAttrs(UI.quickAccessPanel)} aria-label="Quick access">
    <div class="hud-actions">
      <button class="topbar-btn" ${uiComponentAttrs(UI.armouryControl)} id="${esc(controls.armouryId)}" title="Armoury" aria-label="Armoury"><span aria-hidden="true">⚒</span></button>
      <button class="topbar-btn" ${uiComponentAttrs(UI.quickMenuControl)} id="${esc(controls.menuId)}" data-action-hint="menu"
        title="${esc(controls.menuHint)}" aria-label="${esc(controls.menuHint)}"><span aria-hidden="true">☰</span></button>
    </div>
    <div class="flasks hud-charge-flasks" aria-label="Healing and mana flasks"></div>
  </section>`;
}

export function primaryHudRowHtml(controls) {
  return `<div class="hud-resource-row" ${uiComponentAttrs(UI.primaryHudRow)}>
    ${vitalsPanelHtml()}
    ${quickAccessPanelHtml(controls)}
  </div>`;
}

export function inventoryBeltHtml(place) {
  return `<div class="hud-bottom" ${uiComponentAttrs(UI.inventoryBelt)}>
    <div class="relics hud-relics" ${uiComponentAttrs(UI.relicTray)} aria-label="Relics"></div>
    <div class="hud-potions${place === 'map' ? ' mh-flasks' : ''}" ${uiComponentAttrs(UI.potionTray)} aria-label="Potions"></div>
  </div>`;
}

export function sharedRunHudHtml({
  place,
  headerClass = '',
  cinders,
  act,
  actTotal = null,
  floor,
  floorTotal = null,
  seed,
  identity,
  controls,
  overlayHtml = '',
} = {}) {
  return `<header class="topbar combat-hud shared-hud${headerClass ? ` ${esc(headerClass)}` : ''}" ${uiComponentAttrs(UI.sharedRunHud, place)}>
    <div class="hud-top">
      ${runHeaderStripHtml({ place, cinders, act, actTotal, floor, floorTotal, seed, identity })}
      ${primaryHudRowHtml(controls)}
      ${inventoryBeltHtml(place)}
    </div>
    ${overlayHtml}
  </header>`;
}

// Compatibility name for older tools and callers. It is the same reusable
// composition, not a second renderer.
export const hudShellHtml = sharedRunHudHtml;
