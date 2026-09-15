// Reusable Map/Combat HUD Views. Structure is rendered from immutable
// Presentation Models; this module owns DOM, not domain projection or commands.
//
// THE HUD IS A KIT BAND (styles/kit.css `.as-band`), two rows deep, followed by
// a visually detached item rail:
//   1. class left, Cinders centred, Act/Floor right;
//   2. the meters (components/resbars.js, the kit Meter) and, on the right,
//      full-height Armoury and Menu controls;
//   below the band: the relic rail, the shared icon tray (iconTray.js). No top
//      HUD draws potions: they are the combat footer's Potions control (WGC11
//      listing WGH8) and its minis (wireframeUi.hud.potions.roomRail is off).
// The character name, portrait, sigil, screen-context line, build/seed/source,
// fullscreen and music remain off this compact band.
// Each function below says why its own is gone.
// A part whose WGH0 layer is off (models/RunHudLayerModel.js) is absent from
// the model, so it draws nothing here and reserves no row, track or gap.
// The classes that are not `as-*` are HOOKS the instruments read; kit.css
// draws nothing for them and no stylesheet may any more.
import { esc } from './tooltip.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';
import { childModel, optionalChildModel } from '../models/ComponentModel.js';
import { el, html, iconButton } from '../kit/index.js';

function attrsOf(componentAttrs) {
  // uiComponentAttrs() returns attribute TEXT for string templates; the kit's
  // el() wants a map. One parser, so the two forms cannot drift.
  const out = {};
  for (const m of componentAttrs.matchAll(/([a-z-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

// Render an optional child through `render`, or nothing when it is filtered out.
const part = (parent, component, render, variant = null) => {
  const child = optionalChildModel(parent, component, variant);
  return child ? render(child) : '';
};

// The left track is deliberately terse: class only. It identifies the active
// kit without restoring the older portrait/name/context stack.
export function identityClusterHtml(model) {
  const { className, label } = model.properties;
  return html(el('div', {
    ...attrsOf(uiComponentAttrs(model.component, model.variant)),
    class: 'hud-identity as-statstrip', 'aria-label': `${label}: ${className}`,
  }, el('span', { class: 'as-chip hud-class' }, [
    el('span', { class: 'ck', text: label }),
    el('span', { class: 'cv', text: className }),
  ])));
}

export function cindersCounterHtml(model) {
  return html(el('div', {
    ...attrsOf(uiComponentAttrs(model.component, model.variant)), class: 'hud-center as-statstrip',
    role: 'status', 'aria-live': model.accessibility.live, 'aria-label': model.accessibility.label,
  }, el('span', { class: 'as-chip hud-cinders' }, [
    el('span', { class: 'ck', text: model.properties.label }),
    el('span', { class: 'cv', text: `⛁ ${model.properties.value}` }),
  ])));
}

// A field's value, then its detail when it has one (the act's seat name).
function metadataFieldHtml(model) {
  const { label, value, detail = null } = model.properties;
  return el('span', {
    ...attrsOf(uiComponentAttrs(model.component, model.variant)),
    class: `as-chip hud-${model.variant}`,
  }, [
    el('span', { class: 'ck', text: label }),
    el('span', { class: 'cv', text: detail ? `${value} · ${detail}` : String(value) }),
  ]);
}

export function buildMetadataTrailHtml(model) {
  return html(el('div', {
    ...attrsOf(uiComponentAttrs(model.component, model.variant)),
    class: 'hud-run-meta as-statstrip trail', 'aria-label': model.properties.label,
  }, [
    metadataFieldHtml(childModel(model, UI.metadataField, 'act')),
    metadataFieldHtml(childModel(model, UI.metadataField, 'floor')),
  ]));
}

// One baseline with three negotiating tracks: class, Cinders, Act/Floor.
export function runHeaderStripHtml(model) {
  return `<div class="hud-info-row as-band-row thirds" ${uiComponentAttrs(model.component, model.variant)}>
    ${part(model, UI.identityCluster, identityClusterHtml)}
    ${part(model, UI.cindersCounter, cindersCounterHtml)}
    ${part(model, UI.buildMetadataTrail, buildMetadataTrailHtml)}
  </div>`;
}

export function vitalsPanelHtml(model) {
  const meter = childModel(model, UI.resourceMeter);
  return `<section class="hud-vitals-panel grow" ${uiComponentAttrs(model.component, model.variant)} aria-label="Health, mana, and stamina">
    <div class="resbars-host" ${uiComponentAttrs(meter.component, meter.variant)}></div>
  </section>`;
}

// TWO CONTROLS, NOT FOUR. Fullscreen and music are gone from the band (owner,
// 2026-09-05: "the full screen and music buttons don't need to be there since
// we have it in the quick and main menu settings"). Verified before removing
// rather than after: `screens/settings.js` carries Fullscreen under Display and
// Music with its volume under Audio, so neither affordance is stranded by this.
// They still sit on the TITLE screen, which is the main menu the owner names.
//
// `quickSettingsHtml` is gone from the signature too, not just unused — an
// options bag that silently accepts a pair nobody draws is how the pair comes
// back by accident.
export function quickAccessPanelHtml(model) {
  const button = (control, extra = {}) => html(iconButton({
    glyph: control.properties.glyph, label: control.accessibility.label, id: control.properties.id,
    className: 'topbar-btn',
    attrs: { ...attrsOf(uiComponentAttrs(control.component, control.variant)), title: control.accessibility.hint, ...extra },
  }));
  return `<section class="hud-control-grid as-cluster stack" ${uiComponentAttrs(model.component, model.variant)} aria-label="Quick access">
    <div class="hud-actions as-cluster">
      ${part(model, UI.armouryControl, (armoury) => button(armoury))}
      ${part(model, UI.quickMenuControl, (menu) => button(menu, { 'data-action-hint': 'menu' }))}
    </div>
  </section>`;
}

export function primaryHudRowHtml(model) {
  return `<div class="hud-resource-row as-band-row" ${uiComponentAttrs(model.component, model.variant)}>
    ${part(model, UI.vitalsPanel, vitalsPanelHtml)}
    ${part(model, UI.quickAccessPanel, quickAccessPanelHtml)}
  </div>`;
}

export function inventoryBeltHtml(model) {
  const relics = optionalChildModel(model, UI.relicTray);
  const potions = optionalChildModel(model, UI.potionTray);
  // Both are the shared icon tray (components/iconTray.js): one row of round
  // icons that never wraps, the combatant card's status row its reference.
  // relicRail.js and runHud.js fill them.
  return `<div class="hud-bottom as-band-row fold" ${uiComponentAttrs(model.component, model.variant)}>${relics ? `
    <div class="relics hud-relics as-pips icon-tray grow" ${uiComponentAttrs(relics.component, relics.variant)} aria-label="Relics"></div>` : ''}${potions ? `
    <div class="hud-potions as-pips icon-tray${model.variant === 'map' ? ' mh-flasks' : ''}" ${uiComponentAttrs(potions.component, potions.variant)} aria-label="Potions"></div>` : ''}
  </div>`;
}

export function sharedRunHudHtml(model) {
  const { place, headerClass, overlayHtml, layout = '', orientationHtml = '' } = model.properties;
  // NO GRIP. The band used to hang a fold control off its bottom edge that
  // snapped it between Expanded and a compact strip; the owner called it a
  // stray button (2026-09-11) and it went, and the compact mode with it — the
  // band draws one way. A HOST CONTEXT is not a grip: `layout` is chosen by the
  // screen (the map's W4b 10 vh header, styles/kit.css § MAP HEADER), never by
  // the player, and combat passes none.
  return `<header class="topbar combat-hud shared-hud as-band stack${headerClass ? ` ${esc(headerClass)}` : ''}"${layout ? ` data-hud-layout="${esc(layout)}"` : ''} data-has-utility-potions="false" ${uiComponentAttrs(model.component, place)}>
    <div class="hud-top as-cluster stack">
      ${part(model, UI.runHeaderStrip, runHeaderStripHtml)}
      ${part(model, UI.primaryHudRow, primaryHudRowHtml)}${orientationHtml ? `
      ${orientationHtml}` : ''}
      ${part(model, UI.inventoryBelt, inventoryBeltHtml)}
    </div>
    ${overlayHtml}
  </header>`;
}

// Compatibility name for older tools and callers. It is the same reusable
// composition, not a second renderer.
export const hudShellHtml = sharedRunHudHtml;
