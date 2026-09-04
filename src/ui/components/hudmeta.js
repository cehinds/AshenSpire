// Reusable Map/Combat HUD Views. Structure is rendered from immutable
// Presentation Models; this module owns DOM, not domain projection or commands.
//
// THE HUD IS A KIT BAND (styles/kit.css `.as-band`), three rows deep:
//   1. the run header — identity as a LabelStack (Eyebrow "name · class",
//      Title·S = the context: the act on the map, the fight in combat), the
//      Cinders receipt as a StatChip, and the Act · Floor · Build trail as a
//      StatStrip;
//   2. the resource row — the meters (components/resbars.js, the kit Meter)
//      and, on the right, a cluster of IconButtons (⚒ ☰ ⛶ ♫) over the flask
//      Slots the screen mounts;
//   3. the belt — relic Slots and carried-potion Slots.
// The classes that are not `as-*` are HOOKS the instruments read; kit.css
// draws nothing for them and no stylesheet may any more.
import { esc } from './tooltip.js';
import { buildStampHtml } from './buildstamp.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';
import { childModel } from '../models/ComponentModel.js';
import { hudQuickSettingsHtml } from './hudQuickSettings.js';
import { el, html, eyebrow, titleS, iconButton } from '../kit/index.js';

function attrsOf(componentAttrs) {
  // uiComponentAttrs() returns attribute TEXT for string templates; the kit's
  // el() wants a map. One parser, so the two forms cannot drift.
  const out = {};
  for (const m of componentAttrs.matchAll(/([a-z-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function progressChip(className, componentAttrs, { label, value, total }) {
  return el('span', { ...attrsOf(componentAttrs), class: `as-chip ${className}` }, [
    el('span', { class: 'ck', text: label }),
    el('span', { class: 'cv' }, [
      String(value),
      total == null ? null : el('span', { class: 'hud-progress-total', text: ` / ${total}` }),
    ]),
  ]);
}

export function identityClusterHtml(model) {
  const title = childModel(model, UI.characterTitle).properties;
  const context = model.properties.context || '';
  return html(el('div', { ...attrsOf(uiComponentAttrs(model.component, model.variant)), class: 'hud-identity as-labelstack' }, [
    eyebrow(`${title.name} · ${title.classLabel}`, { ...attrsOf(uiComponentAttrs(UI.characterTitle)), class: 'nm' }),
    context ? titleS(context, { tag: 'span', class: 'ls-label hud-context fold' }) : null,
  ]));
}

export function cindersCounterHtml(model) {
  return html(el('div', {
    ...attrsOf(uiComponentAttrs(model.component, model.variant)), class: 'hud-center as-statstrip',
    role: 'status', 'aria-live': model.accessibility.live, 'aria-label': model.accessibility.label,
  }, el('span', { class: 'as-chip hud-cinders' }, [
    el('span', { class: 'ck', text: 'Cinders' }),
    el('span', { class: 'cv', text: `⛁ ${model.properties.value}` }),
  ])));
}

export function buildMetadataTrailHtml(model) {
  const act = childModel(model, UI.metadataField, 'act').properties;
  const floor = childModel(model, UI.metadataField, 'floor').properties;
  return `<div class="hud-run-meta as-statstrip trail" ${uiComponentAttrs(model.component, model.variant)}>
    ${html(progressChip('hud-act', uiComponentAttrs(UI.metadataField, 'act'), act))}
    ${html(progressChip('hud-floor', uiComponentAttrs(UI.metadataField, 'floor'), floor))}
    ${buildStampHtml(model.properties.place, { split: true, seed: model.properties.seed })}
  </div>`;
}

export function runHeaderStripHtml(model) {
  return `<div class="hud-info-row as-band-row thirds" ${uiComponentAttrs(model.component, model.variant)}>
    ${identityClusterHtml(childModel(model, UI.identityCluster))}
    ${cindersCounterHtml(childModel(model, UI.cindersCounter))}
    ${buildMetadataTrailHtml(childModel(model, UI.buildMetadataTrail))}
  </div>`;
}

export function vitalsPanelHtml(model) {
  const meter = childModel(model, UI.resourceMeter);
  return `<section class="hud-vitals-panel grow" ${uiComponentAttrs(model.component, model.variant)} aria-label="Health, mana, and stamina">
    <div class="resbars-host" ${uiComponentAttrs(meter.component, meter.variant)}></div>
  </section>`;
}

export function quickAccessPanelHtml(model, { quickSettingsHtml = '' } = {}) {
  const armoury = childModel(model, UI.armouryControl);
  const menu = childModel(model, UI.quickMenuControl);
  const button = (control, extra = {}) => html(iconButton({
    glyph: control.properties.glyph, label: control.accessibility.label, id: control.properties.id,
    className: 'topbar-btn',
    attrs: { ...attrsOf(uiComponentAttrs(control.component, control.variant)), title: control.accessibility.hint, ...extra },
  }));
  return `<section class="hud-control-grid as-cluster stack" ${uiComponentAttrs(model.component, model.variant)} aria-label="Quick access">
    <div class="hud-actions as-cluster">
      ${button(armoury)}
      ${button(menu, { 'data-action-hint': 'menu' })}
      ${quickSettingsHtml}
    </div>
    <div class="flasks hud-charge-flasks as-cluster" aria-label="Healing and mana flasks"></div>
  </section>`;
}

export function primaryHudRowHtml(model, options = {}) {
  return `<div class="hud-resource-row as-band-row" ${uiComponentAttrs(model.component, model.variant)}>
    ${vitalsPanelHtml(childModel(model, UI.vitalsPanel))}
    ${quickAccessPanelHtml(childModel(model, UI.quickAccessPanel), options)}
  </div>`;
}

export function inventoryBeltHtml(model) {
  const relics = childModel(model, UI.relicTray);
  const potions = childModel(model, UI.potionTray);
  return `<div class="hud-bottom as-band-row fold" ${uiComponentAttrs(model.component, model.variant)}>
    <div class="relics hud-relics as-cluster wrap grow" ${uiComponentAttrs(relics.component, relics.variant)} aria-label="Relics"></div>
    <div class="hud-potions as-cluster end${model.variant === 'map' ? ' mh-flasks' : ''}" ${uiComponentAttrs(potions.component, potions.variant)} aria-label="Potions"></div>
  </div>`;
}

export function sharedRunHudHtml(model) {
  const { place, headerClass, overlayHtml, hudMode } = model.properties;
  const grip = childModel(model, UI.hudModeGrip);
  const quickSettingsHtml = hudQuickSettingsHtml(childModel(model, UI.hudQuickSettings));
  const gripButton = iconButton({
    glyph: hudMode === 'compact' ? '⌄' : '⌃', label: grip.accessibility.label, className: 'hud-mode-grip as-grip',
    attrs: { ...attrsOf(uiComponentAttrs(grip.component, grip.variant)), 'data-next-mode': grip.properties.next, title: grip.accessibility.hint },
  });
  return `<header class="topbar combat-hud shared-hud as-band stack${headerClass ? ` ${esc(headerClass)}` : ''}" data-hud-mode="${esc(hudMode)}" data-has-utility-potions="false" ${uiComponentAttrs(model.component, place)}>
    <div class="hud-top as-cluster stack">
      ${runHeaderStripHtml(childModel(model, UI.runHeaderStrip))}
      ${primaryHudRowHtml(childModel(model, UI.primaryHudRow), { quickSettingsHtml })}
      ${inventoryBeltHtml(childModel(model, UI.inventoryBelt))}
    </div>
    ${html(gripButton)}
    ${overlayHtml}
  </header>`;
}

// Compatibility name for older tools and callers. It is the same reusable
// composition, not a second renderer.
export const hudShellHtml = sharedRunHudHtml;
