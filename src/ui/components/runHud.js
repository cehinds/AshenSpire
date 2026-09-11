// src/ui/components/runHud.js — THE ONE RUN HUD, mounted by every room the run
// passes through outside a fight: the map, the merchant, the Shrine, an event.
//
// Constantine, 2026-08-15 (#254): "I'd like the hud to look the same both
// combat and map". The map got the combat band that day; the three rooms
// between map nodes never did. A player at the merchant could not see their
// cinders — the screen's own "Cinders N · HP" line was a `.as-status` crushed
// to 0 px by the kit's ellipsis rule (`overflow: hidden` makes a flex child's
// min-height 0, and the merchant's column overflows). At the Shrine and in an
// event there was no purse, no HP and no act on screen at all. The fix is not
// three wallet lines; it is the band the map already draws, mounted by one
// function.
//
// TWO HALVES, because the map keeps its own template: `runHudHtml()` returns
// the band's markup (the same `sharedRunHudHtml` composition combat renders),
// and `wireRunHud()` fills it — the resource bars off the ONE plan builder the
// map and combat share (model/resources.js), the relic and flask slots, the
// Armoury and Menu controls, their tooltips and the quick-nav list. map.js
// calls both; a room calls both; nothing here decides navigation — every row
// calls a handler the caller already owns.
import { openCollectibleInspection } from './collectibleCard.js';
import { attachTooltip, esc } from './tooltip.js';
import { relicText } from './card.js';
import { actionHint } from '../input.js';
import { MENU } from '../uiContent.js';
import { openQuickNav, quickNavMode, saveAction } from './quicknav.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskIdentityHtml, flaskTooltipHtml, mountFlaskActionMenu } from './flask.js';
import { hudShellHtml } from './hudmeta.js';
import { runHudViewModel } from '../viewModels/RunHudViewModel.js';
import { wireHudQuickSettings } from './hudQuickSettings.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { resourceBars } from './resbars.js';
import { CHARGE_FLASK_KINDS, chargeFlaskDefinition } from '../../model/gracerefill.js';
import { useRunChargeFlask } from '../../engine/actions.js';
import { settingOn } from '../screens/settings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { el as kitEl, slot } from '../kit/index.js';

export const RUN_HUD_ARMOURY_ID = 'open-armoury';
export const RUN_HUD_MENU_ID = 'open-menu';

/**
 * runHudHtml({ registries, run, meta, place, headerClass }) → markup string.
 * `place` is the band's variant ('map', 'shop', 'rest', 'event'); `headerClass`
 * is the hook a screen's own stylesheet reads (`map-header` on the map).
 */
export function runHudHtml({ registries, run, meta, place, headerClass = 'map-header' }) {
  const map = run.mapGraph;
  const className = registries.classes.get(run.class).name;
  return hudShellHtml(runHudViewModel({
    place,
    headerClass,
    cinders: run.cinders,
    act: run.actNumber,
    actTotal: run.actNumber > 3 ? null : 3,
    floor: run.floor,
    floorTotal: map ? map.floors : null,
    seed: run.seedString,
    identity: { className },
    controls: {
      armouryId: RUN_HUD_ARMOURY_ID,
      menuId: RUN_HUD_MENU_ID,
      menuHint: actionHint('menu'),
    },
    // The settings bag. `presentation` went with the fullscreen/music pair,
    // and the band's compact/expanded grip went on 2026-09-11; nothing in
    // the bag steers the HUD now, the parameter keeps the callers' shape.
    quickSettings: { settings: meta.settings || {} },
    overlayHtml: '',
  }));
}

/**
 * wireRunHud(app, opts) — fill and wire the band `runHudHtml` drew inside `app`.
 *
 *   onArmoury(view)  opens the Armoury; absent → the control is removed
 *   onMenu(tab)      opens the overlay at a tab; absent → the control is inert
 *   onLoad/onSave/onQuit/onQuitWithoutSave  the quick-nav's save rows
 *   quickControls    the fullscreen/music controls the quick-nav reads
 *   onSettingsChange the quick-settings binding (kept for the callers' shape)
 *   remount()        re-draws the host screen after a flask is drunk here
 */
export function wireRunHud(app, {
  registries, run, meta,
  onArmoury = null, onMenu = null, onLoad = null, onSave = null, onQuit = null, onQuitWithoutSave = null,
  quickControls = {}, onSettingsChange = null, remount = null,
}) {
  wireHudQuickSettings(app, { settings: meta.settings || {}, onSettingsChange });
  const hud = app.querySelector('.shared-hud');
  if (!hud) throw new Error('wireRunHud: the band is not in the document — call runHudHtml first');

  // ---- THE HUD, AND IT IS THE COMBAT HUD ---------------------------------
  //
  // E9 / #254, his words: "I'd like the hud to look the same both combat and
  // map". ONE renderer for both — ui/components/resbars.js — fed by the one
  // plan builder, model/resources.js `resourceBarPlan(…, 'main', …)`, which is
  // the identical call combat.js and coop.js make. So:
  //
  //   · WHICH rows appear is content/resources.js's business, not a screen's.
  //     HP, then Mana, then Stamina — no room gets its own list and none can
  //     drift from combat's.
  //   · TROUGH LENGTH is `scale(max)/scale(reference)` against the SAME
  //     reference table (HUD_REFERENCE_MAX, his 200/20/20), so each pool's length
  //     means the same thing on every screen.
  //   · The `run` IS the view and the entity here, exactly as it is in
  //     tools/hybridstats.mjs — the readers take current/max off it and a row
  //     whose reader returns null is ABSENT, never a lying 0/0 trough.
  //   · the shared component writes the exact max/reference percentage; there
  //     is no screen-specific floor or post-layout correction.
  const resHost = hud.querySelector('.resbars-host');
  if (resHost) {
    const plan = resourceBarPlan(registries, 'main', run, run, resourceDomains(registries));
    resHost.appendChild(resourceBars(plan, { surface: 'main' }));
  }

  const strip = hud.querySelector('.hud-relics');
  for (const rid of run.relics) {
    const def = registries.relics.get(rid);
    const tile = slot({ art: def.icon || '◆', small: true, tag: 'button', label: def.name, className: 'relic' });
    markUiComponent(tile, UI.relicSlot);
    tile.addEventListener('click', () => openCollectibleInspection(registries, def, 'Relic', tile));
    attachTooltip(tile, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def, registries))}`);
    strip.appendChild(tile);
  }

  const flaskArt = (def) => kitEl('span', { class: 'sl-art', 'aria-hidden': 'true', html: flaskIdentityHtml(def, { showName: false }) });
  const flaskWrap = hud.querySelector('.hud-potions');
  for (const kind of CHARGE_FLASK_KINDS) {
    const def = chargeFlaskDefinition(registries, kind);
    if (!def) continue;
    const current = run.flaskCharges ? run.flaskCharges[`${kind}Current`] : 0;
    // The same kit Slot combat draws: art, count as a round StatePill.
    const tile = slot({ art: flaskArt(def), count: current, label: def.name, disabled: current <= 0, className: 'relic flask-slot flask-charge', attrs: { dataset: { flaskKind: kind } } });
    markUiComponent(tile, kind === 'hp' ? UI.crimsonFlaskControl : UI.azureFlaskControl);
    tile.querySelector('.sl-count').classList.add('flask-charge-count');
    attachTooltip(tile, () => flaskTooltipHtml(def, { charges: current }));
    tile.addEventListener('click', () => {
      const canUse = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat') && current > 0;
      const plan = flaskActionPlan({
        context: 'run',
        canUse,
        useReason: current <= 0 ? 'No charges remain' : 'Enable “Use flasks outside combat” in Settings',
        canDrop: false,
        dropReason: 'Charge flasks stay with the run',
      });
      mountFlaskActionMenu(tile, {
        def, plan, charges: current, onCancel: () => {},
        onAction: (actionId) => {
          if (actionId !== 'use' || !canUse) return;
          useRunChargeFlask({ run, registries, rng: null, kind });
          onSave?.();
          remount?.();
        },
      });
    });
    flaskWrap.appendChild(tile);
  }

  for (const f of run.flasks) {
    const def = registries.flasks.get(f.flaskId);
    // The shared HUD lives inside CHROME, so `.flask-slot` is the deliberate
    // unified-cursor exception in input.js. Keep utility flasks reachable by
    // keyboard/gamepad Confirm as well as pointer click.
    const tile = slot({ art: flaskArt(def), label: def.name, className: 'mh-flask flask-slot' });
    markUiComponent(tile, UI.potionControl);
    attachTooltip(tile, () => flaskTooltipHtml(def));
    tile.addEventListener('click', () => {
      const plan = flaskActionPlan({
        context: 'run',
        canUse: false,
        useReason: 'Flasks can only be used in combat',
        canDrop: true,
      });
      mountFlaskActionMenu(tile, {
        def,
        plan,
        onCancel: () => {},
        onAction: (actionId) => {
          if (actionId !== 'drop') return;
          const at = run.flasks.indexOf(f);
          if (at >= 0) run.flasks.splice(at, 1);
          tile.remove();
          hud.dataset.hasUtilityPotions = run.flasks.length ? 'true' : 'false';
        },
      });
    });
    flaskWrap.appendChild(tile);
  }
  hud.dataset.hasUtilityPotions = run.flasks.length ? 'true' : 'false';

  const armouryBtn = hud.querySelector(`#${RUN_HUD_ARMOURY_ID}`);
  if (onArmoury) armouryBtn.addEventListener('click', () => onArmoury());
  else armouryBtn.remove();

  // ☰ — today it opens the overlay at Settings; under the quick-nav experiment
  // it opens the list of everywhere this screen can go. Every row below calls
  // a handler that already exists, so nothing here decides navigation state.
  const menuBtn = hud.querySelector(`#${RUN_HUD_MENU_ID}`);
  if (onMenu) {
    menuBtn.addEventListener('click', (e) => {
      if (quickNavMode() === 'off') return onMenu('settings');
      e.stopPropagation();
      openQuickNav(menuBtn, 'map', {
        counts: { deck: run.deck.length },
        hasSave: !!(onSave || onQuit),
        controls: quickControls,
        actions: {
          tab: (id) => onMenu(id),
          ...(onArmoury ? { inventory: () => onArmoury('rack'), character: () => onArmoury('grid') } : {}),
          ...(onLoad ? { load: () => onLoad({ returnFocusElement: menuBtn }) } : {}),
          ...(onSave ? { save: saveAction(onSave) } : {}),
          ...(onQuit ? { saveQuit: () => onQuit() } : {}),
          ...(onQuitWithoutSave ? { quit: () => onQuitWithoutSave({ returnFocusElement: menuBtn }) } : {}),
        },
      });
    });
  }

  // Law 3 clause 4 — a real tooltip, hover AND focus cursor, with its text from
  // the same MENU table the rows read. `title=` alone is invisible to touch and
  // to a pad.
  const armouryRow = (MENU.map || []).find((r) => r.act === 'armoury');
  if (onArmoury && armouryRow) attachTooltip(armouryBtn, () => `<div class="tt-title">${esc(armouryRow.label)}</div>${esc(armouryRow.tip)}`);
  attachTooltip(menuBtn, () =>
    `<div class="tt-title">Menu</div>${esc(quickNavMode() === 'off'
      ? 'Armoury, settings, controls and saving.'
      : 'Everywhere you can go from here.')}`);

  return { hud, armouryBtn: onArmoury ? armouryBtn : null, menuBtn };
}
