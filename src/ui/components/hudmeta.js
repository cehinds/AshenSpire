// Reusable Map/Combat HUD Views. Structure is rendered from immutable
// Presentation Models; this module owns DOM, not domain projection or commands.
//
// THE HUD IS A KIT BAND (styles/kit.css `.as-band`), three rows deep, and the
// owner's list of 2026-09-05 is the whole of it — "vitals, relics, cinders,
// armory, menu and hp and mp potions":
//   1. the run header — the Cinders receipt as a StatChip, centred, with the
//      build stamp trailing right;
//   2. the resource row — the meters (components/resbars.js, the kit Meter)
//      and, on the right, the Armoury and Menu IconButtons over the flask
//      Slots the screen mounts;
//   3. the belt — relic Slots and carried-potion Slots.
// WHAT LEFT THE BAND, so nothing drifts back in: the character name, the class,
// the chosen sigil, the screen's context line, the Act chip and the Floor chip
// (all on that list, or absent from it), and the fullscreen and music pair —
// which lives on the title screen and in Settings, and needed no third home.
// Each function below says why its own is gone.
// The classes that are not `as-*` are HOOKS the instruments read; kit.css
// draws nothing for them and no stylesheet may any more.
import { esc } from './tooltip.js';
import { buildStampHtml } from './buildstamp.js';
import { UI_COMPONENTS as UI, uiComponentAttrs } from './uiComponents.js';
import { childModel } from '../models/ComponentModel.js';
import { el, html, iconButton } from '../kit/index.js';

function attrsOf(componentAttrs) {
  // uiComponentAttrs() returns attribute TEXT for string templates; the kit's
  // el() wants a map. One parser, so the two forms cannot drift.
  const out = {};
  for (const m of componentAttrs.matchAll(/([a-z-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

// THE BAND CARRIES NO IDENTITY AT ALL (owner, 2026-09-05: "it should just be
// vitals, relics, cinders, armory, menu and hp and mp potions in the Hud").
// The name, the class, the chosen sigil and the screen's context line were all
// here; none of them is state that changes in a fight, which is the only thing
// this band is for. Each is still reachable where it belongs: the name labels
// the save slot, the sigil and class are the character-creation facts the
// player just chose, and the act is named by the map's own route strip.
//
// The cluster stays as an EMPTY LabelStack rather than being deleted, and that
// is deliberate: `.hud-info-row` is a three-track grid (identity | receipt |
// trail) whose middle track is what centres the Cinders receipt. Dropping the
// first track would slide the receipt off centre and take `hudparity`'s
// centring rule with it. An empty track holds the shape.
export function identityClusterHtml(model) {
  return html(el('div', {
    ...attrsOf(uiComponentAttrs(model.component, model.variant)),
    class: 'hud-identity as-labelstack', 'aria-hidden': 'true',
  }, []));
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

// THE TRAIL IS THE BUILD STAMP AND NOTHING ELSE. The Floor chip went first,
// then the Act chip with the rest of the run chrome (owner's list above names
// neither). The `metadataField` models stay in RunHeaderModel — act, floor,
// seed and source are all still projected, and the map's own progress derives
// from them; only the chips are gone.
//
// THE STAMP STAYS, AND IT IS NOT AN OVERSIGHT AGAINST THAT LIST. It is not
// chrome a player reads, it is the receipt that identifies a screenshot:
// `tools/buildstamp-shot.mjs` photographs exactly one stamp on the title, the
// map and a fight, and on 2026-09-05 the owner's own screenshot of build
// 0.4.0.1454 is what identified where the utility rail used to live. A HUD with
// no version on it cannot answer "which build is this". Removing it is one line
// here plus that tool's three placements, if the owner wants it gone too.
export function buildMetadataTrailHtml(model) {
  return `<div class="hud-run-meta as-statstrip trail" ${uiComponentAttrs(model.component, model.variant)}>
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
    </div>
    <div class="flasks hud-charge-flasks as-cluster" aria-label="Healing and mana flasks"></div>
  </section>`;
}

export function primaryHudRowHtml(model) {
  return `<div class="hud-resource-row as-band-row" ${uiComponentAttrs(model.component, model.variant)}>
    ${vitalsPanelHtml(childModel(model, UI.vitalsPanel))}
    ${quickAccessPanelHtml(childModel(model, UI.quickAccessPanel))}
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
  const gripButton = iconButton({
    glyph: hudMode === 'compact' ? '⌄' : '⌃', label: grip.accessibility.label, className: 'hud-mode-grip as-grip',
    attrs: { ...attrsOf(uiComponentAttrs(grip.component, grip.variant)), 'data-next-mode': grip.properties.next, title: grip.accessibility.hint },
  });
  return `<header class="topbar combat-hud shared-hud as-band stack${headerClass ? ` ${esc(headerClass)}` : ''}" data-hud-mode="${esc(hudMode)}" data-has-utility-potions="false" ${uiComponentAttrs(model.component, place)}>
    <div class="hud-top as-cluster stack">
      ${runHeaderStripHtml(childModel(model, UI.runHeaderStrip))}
      ${primaryHudRowHtml(childModel(model, UI.primaryHudRow))}
      ${inventoryBeltHtml(childModel(model, UI.inventoryBelt))}
    </div>
    ${html(gripButton)}
    ${overlayHtml}
  </header>`;
}

// Compatibility name for older tools and callers. It is the same reusable
// composition, not a second renderer.
export const hudShellHtml = sharedRunHudHtml;
