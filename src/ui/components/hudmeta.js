// Reusable Map/Combat HUD Views. Structure is rendered from immutable
// Presentation Models; this module owns DOM, not domain projection or commands.
import { esc } from './tooltip.js';
import { buildStampHtml } from './buildstamp.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';
import { childModel } from '../models/ComponentModel.js';
import { hudQuickSettingsHtml } from './hudQuickSettings.js';

function progressHtml(value, total, label) {
  return `${esc(label)} ${esc(value)}`
    + (total == null ? '' : `<span class="hud-progress-total"> / ${esc(total)}</span>`);
}

export function identityClusterHtml(model) {
  const portrait = childModel(model, UI.portraitBadge).properties;
  const title = childModel(model, UI.characterTitle).properties;
  return `<div class="hud-identity" ${uiComponentAttrs(model.component, model.variant)}>
    <div class="portrait" ${uiComponentAttrs(UI.portraitBadge)} style="border-color:${esc(portrait.tint)}">${esc(portrait.glyph)}</div>
    <span class="nm" ${uiComponentAttrs(UI.characterTitle)}>${esc(title.name)} · ${esc(title.classLabel)}</span>
  </div>`;
}

export function cindersCounterHtml(model) {
  return `<div class="hud-center" ${uiComponentAttrs(model.component, model.variant)} role="status" aria-live="${esc(model.accessibility.live)}" aria-label="${esc(model.accessibility.label)}">
    <span class="hud-cinders">⛁ ${esc(model.properties.value)}</span>
  </div>`;
}

export function buildMetadataTrailHtml(model) {
  const act = childModel(model, UI.metadataField, 'act').properties;
  const floor = childModel(model, UI.metadataField, 'floor').properties;
  return `<div class="hud-run-meta" ${uiComponentAttrs(model.component, model.variant)}>
    <span class="hud-act" ${uiComponentAttrs(UI.metadataField, 'act')}>${progressHtml(act.value, act.total, act.label)}</span>
    <span class="hud-floor" ${uiComponentAttrs(UI.metadataField, 'floor')}>${progressHtml(floor.value, floor.total, floor.label)}</span>
    ${buildStampHtml(model.properties.place, { split: true, seed: model.properties.seed })}
  </div>`;
}

export function runHeaderStripHtml(model) {
  return `<div class="hud-info-row" ${uiComponentAttrs(model.component, model.variant)}>
    ${identityClusterHtml(childModel(model, UI.identityCluster))}
    ${cindersCounterHtml(childModel(model, UI.cindersCounter))}
    ${buildMetadataTrailHtml(childModel(model, UI.buildMetadataTrail))}
  </div>`;
}

// One orientation strip belongs to the shared run HUD, never to the Map
// screen. Both Map and Combat therefore reserve the same compact-header height
// and present the same run context while only the playfield below changes.
export function actRouteStripHtml(routeTitle) {
  if (!routeTitle) return '';
  return `<div class="act-route-strip map-entrance-orientation" data-composition="orientation-strip" role="note" aria-label="${esc(routeTitle)} orientation: entrance to boss">
    <strong>${esc(routeTitle)}</strong>
    <span class="map-orientation-progress" aria-hidden="true">
      <small data-role="start">ENTRANCE</small><span class="map-orientation-rail"></span><small data-role="boss">BOSS</small>
    </span>
  </div>`;
}

export function vitalsPanelHtml(model) {
  const meter = childModel(model, UI.resourceMeter);
  return `<section class="hud-vitals-panel" ${uiComponentAttrs(model.component, model.variant)} aria-label="Health, mana, and stamina">
    <div class="resbars-host" ${uiComponentAttrs(meter.component, meter.variant)}></div>
  </section>`;
}

export function quickAccessPanelHtml(model) {
  const armoury = childModel(model, UI.armouryControl);
  const menu = childModel(model, UI.quickMenuControl);
  return `<section class="hud-control-grid" ${uiComponentAttrs(model.component, model.variant)} aria-label="Quick access">
    <div class="hud-actions">
      <button class="topbar-btn" ${uiComponentAttrs(armoury.component, armoury.variant)} id="${esc(armoury.properties.id)}" title="${esc(armoury.accessibility.hint)}" aria-label="${esc(armoury.accessibility.label)}"><span aria-hidden="true">${esc(armoury.properties.glyph)}</span></button>
      <button class="topbar-btn" ${uiComponentAttrs(menu.component, menu.variant)} id="${esc(menu.properties.id)}" data-action-hint="menu"
        title="${esc(menu.accessibility.hint)}" aria-label="${esc(menu.accessibility.label)}"><span aria-hidden="true">${esc(menu.properties.glyph)}</span></button>
    </div>
    <div class="flasks hud-charge-flasks" aria-label="Healing and mana flasks"></div>
  </section>`;
}

export function primaryHudRowHtml(model) {
  return `<div class="hud-resource-row" ${uiComponentAttrs(model.component, model.variant)}>
    ${vitalsPanelHtml(childModel(model, UI.vitalsPanel))}
    ${quickAccessPanelHtml(childModel(model, UI.quickAccessPanel))}
  </div>`;
}

export function inventoryBeltHtml(model) {
  const relics = childModel(model, UI.relicTray);
  const potions = childModel(model, UI.potionTray);
  return `<div class="hud-bottom" ${uiComponentAttrs(model.component, model.variant)}>
    <div class="relics hud-relics" ${uiComponentAttrs(relics.component, relics.variant)} aria-label="Relics"></div>
    <div class="hud-potions${model.variant === 'map' ? ' mh-flasks' : ''}" ${uiComponentAttrs(potions.component, potions.variant)} aria-label="Potions"></div>
  </div>`;
}

export function sharedRunHudHtml(model) {
  const { place, headerClass, overlayHtml, hudMode } = model.properties;
  const grip = childModel(model, UI.hudModeGrip);
  return `<header class="topbar combat-hud shared-hud${headerClass ? ` ${esc(headerClass)}` : ''}" data-hud-mode="${esc(hudMode)}" data-has-utility-potions="false" ${uiComponentAttrs(model.component, place)}>
    <div class="hud-top">
      ${runHeaderStripHtml(childModel(model, UI.runHeaderStrip))}
      ${primaryHudRowHtml(childModel(model, UI.primaryHudRow))}
      ${inventoryBeltHtml(childModel(model, UI.inventoryBelt))}
      ${hudQuickSettingsHtml(childModel(model, UI.hudQuickSettings))}
    </div>
    <button type="button" class="hud-mode-grip" data-next-mode="${esc(grip.properties.next)}" ${uiComponentAttrs(grip.component, grip.variant)} aria-label="${esc(grip.accessibility.label)}" title="${esc(grip.accessibility.hint)}"><span aria-hidden="true"></span></button>
    ${overlayHtml}
    ${actRouteStripHtml(model.properties.routeTitle)}
  </header>`;
}

// Compatibility name for older tools and callers. It is the same reusable
// composition, not a second renderer.
export const hudShellHtml = sharedRunHudHtml;
