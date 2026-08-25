// src/ui/components/overlay.js — the in-run tabbed overlay menu (SPEC §7.2).
//
// The in-run overlay is intentionally narrow: Settings and Controls only.
// Deck, Stats, equipment, relics, and flasks live in Armoury. Opened from a button or hotkey on the map and
// in combat; combat is turn-based, so it needs no real "pause". Esc / the ✕ /
// clicking the veil closes it.

import { renderSettings } from '../screens/settings.js';
import { renderControls } from '../screens/controls.js';
import { attachTooltip, esc } from './tooltip.js';
import { isEngaged, focusFirst, setTabRing } from '../input.js';
import { menuTabs } from '../uiContent.js';
import {
  openQuickNav, closeQuickNav, quickNavIsOpen, quickNavMode, quickNavFolds,
  saveAction, confirmQuickMenuAction,
} from './quicknav.js';
import { statProjection } from '../../model/statProjection.js';
import { closeFlaskActionMenu } from './flask.js';
import { menuOverlayModel } from '../models/MenuModels.js';
import { renderMenuOverlay, updateMenuSelection } from './menuComponents.js';

let openVeil = null;
let escHandler = null;
let overlayCleanup = [];

// ---- the panels: ONE name per tab, not two (#78) ---------------------------
//
// `selectTab` was `if (id === 'deck') … else if (id === 'relics') …`, which made
// the if-chain a second, implicit home of WHICH TABS RENDER. MENU_TABS is the
// home of the tab LIST; a row added there got a button, a bumper stop and a
// quick-nav entry, and then showed an empty body — every derived thing worked
// and the one thing that mattered was silent (Law 0 clause 5).
//
// Now the row's `id` IS the key into this table. There is no second list to
// disagree with: a tab either has a panel here or it fails by name at boot
// (assertSurfaces, src/ui/surfaces.js) — never at the click.
//
// A panel is CODE and that is the honest edge of the promise: a new tab costs a
// row AND a function. What it no longer costs is a chance to forget the second
// one. Each takes (container, ctx) — the same bag openOverlay builds once — so
// they can live at module scope where the check can see them.
const PANELS = {
  settings: (host, ctx) => renderSettings(host, {
    settings: ctx.settings,
    onChange: ctx.onSettingsChange || (() => {}),
  }),
  controls: (host, ctx) => renderControls(host, {
    settings: ctx.settings,
    onChange: ctx.onSettingsChange || (() => {}),
  }),
};

/** panelFor(id) → the renderer for a tab, or undefined. The one join. */
export function panelFor(id) {
  return PANELS[id];
}

export function hybridStatsPlan(ctx) {
  const s = ctx.run.stats || {};
  const cls = ctx.registries.classes.get(ctx.run.class);
  const projection = statProjection(ctx.registries, ctx.run);
  const attributes = projection.attributes.map((def) => [def.shortLabel, def.value]);
  const derived = projection.derived.flatMap((row) => [
    [row.label, row.formula],
    ...(row.note ? [[`${row.label} note`, row.note]] : []),
  ]);
  return [
    ['Forsaken', (ctx.run.customization && ctx.run.customization.name) || cls.name],
    ['Class', cls.name],
    ...attributes,
    ['Seed', ctx.run.seedString],
    ['Act', ctx.run.actNumber > 3 ? `${ctx.run.actNumber} (endless)` : `${ctx.run.actNumber} / 3`],
    ['Floor', ctx.run.floor],
    ...derived,
    ['Cinders', ctx.run.cinders],
    ['Fights won', s.fightsWon || 0],
    ['Damage dealt', s.damageDealt || 0],
    ['Damage taken', s.damageTaken || 0],
    ['Deck size', ctx.run.deck.length],
    ['Relics', ctx.run.relics.length],
  ];
}

// `overlayIsOpen()` USED TO LIVE HERE and is deleted rather than widened.
//
// It read this module's own `openVeil` handle, so it answered for ONE of the
// game's six veils — and combat.js, map.js and tutorial.js all called it meaning
// "is ANY veil standing". With the draw pile open, E ended the turn: hand 5 -> 0.
// Widening it would have made this module the home of a fact about five veils it
// does not own, so the predicate moved out instead: components/veil.js,
// `veilIsOpen()`, asked of the DOM the way input.js's scopeRoot() always did.
//
// `openVeil` below is NOT that fact and stays — it is this overlay's handle on
// its own element, which is how closeOverlay() knows what to remove.

export function closeOverlay() {
  if (openVeil) {
    openVeil.remove();
    openVeil = null;
    closeQuickNav(); // the mirrored list has nothing behind it any more
    setTabRing(null); // the bumpers go back to their global bindings
  }
  if (escHandler) {
    removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
  for (const release of overlayCleanup.splice(0)) release();
}

/**
 * openOverlay({ registries, run, meta, onSettingsChange, onSave, initialTab })
 * onSave (optional) → returns the slot number saved to (adds a Save action).
 */
export function openOverlay({
  registries, run, meta, saves = null, onSettingsChange, onSave, onLoad,
  onSaveQuit, onQuitWithoutSave, onArmoury, quickControls = {}, initialTab = 'settings',
}) {
  closeFlaskActionMenu({ cancelled: true });
  closeOverlay();
  closeQuickNav(); // opened FROM the list on map/combat: it has done its job
  const settings = meta.settings || (meta.settings = {});

  const hasSave = !!(onSave || onSaveQuit || onQuitWithoutSave);
  // The strip is DERIVED, not restated. It and the quick-nav dropdown are two
  // presentations of one table (uiContent.js MENU_TABS) — the hardcoded list
  // that used to live here is exactly the second copy Law 1 catches.
  const TABS = menuTabs({ hasSave, counts: { deck: run.deck.length } });
  // Variant B, and the fold test is `data-layout` — the mode autoLayout()
  // already chose. A width threshold of its own would be a second decider of
  // what "narrow" means, which is the defect #24 was (Law 2).
  const folded = quickNavFolds();
  const mirrored = quickNavMode() === 'mirror';

  const initialId = TABS.some((tab) => tab.id === initialTab) ? initialTab : 'settings';
  const model = menuOverlayModel({ tabs: TABS, activeId: initialId, folded, mirrored });
  const { veil, body } = renderMenuOverlay(model);
  document.body.appendChild(veil);
  openVeil = veil;
  let currentTab = null;

  // ONE bag, built once, handed to whichever panel the tab names. Everything a
  // panel could need is in it — so a panel is a plain function of (host, ctx)
  // and can sit at module scope where the boot check can find it.
  //
  // `saves` IS passed now, and I am reversing my own earlier decision here
  // rather than quietly leaving it (#67, Sunna's D18). I withheld it so the
  // Profile section would not render mid-run, on the grounds that restoring a
  // profile three floors into a climb is not a calm moment. Two things
  // changed: replacePrimaryWith now archives whatever it replaces, so the
  // hazard I was guarding against is recoverable rather than final; and
  // withholding the manager silently broke the quarantine feedback on this
  // door, which is the worse harm and the one a player actually meets. One
  // surface, one sentence, both doors — that is Sunna's call and she is right
  // that two strings is how they drift. A restore here does not touch the run
  // save: runs live in their own slot keys.
  const ctx = {
    registries, run, meta, settings, saves,
    onSettingsChange, onSave, onSaveQuit,
  };

  const saveButton = veil.querySelector('#ov-save');
  const quitButton = veil.querySelector('#ov-quit');
  if (!onSave && saveButton) saveButton.hidden = true;
  if (!onSaveQuit && quitButton) quitButton.hidden = true;
  saveButton?.addEventListener('click', () => {
    const slot = onSave?.();
    saveButton.textContent = slot ? `Saved · Slot ${slot}` : 'Saved';
    clearTimeout(saveButton._labelTimer);
    saveButton._labelTimer = setTimeout(() => { saveButton.textContent = 'Save Game'; }, 1500);
  });
  quitButton?.addEventListener('click', () => {
    closeOverlay();
    onSaveQuit?.();
  });

  function selectTab(id) {
    currentTab = id;
    veil.querySelector('.overlay-modal')?.classList.toggle('settings-surface', id === 'settings');
    updateMenuSelection(veil, TABS, id);
    // NO if-chain, and no trailing `else` that quietly renders nothing. A tab
    // declared in MENU_TABS with no entry in PANELS names itself here, and
    // assertSurfaces() has already failed the boot, so a player never meets it.
    const panel = panelFor(id);
    if (!panel) {
      console.error(`[ui] menu tab ${JSON.stringify(id)} is declared in MENU_TABS`
        + ' and has no panel in PANELS (src/ui/components/overlay.js) \u2014 the tab is'
        + ' the declaration, the panel is the handler, and one of them is missing.');
      body.innerHTML = `<div class="ov-dead">The <b>${esc(id)}</b> tab is declared and has no panel.</div>`;
      return;
    }
    panel(body, ctx);
  }

  veil.querySelectorAll('.ov-tab').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.member)));
  veil.querySelector('#ov-close').addEventListener('click', closeOverlay);
  veil.addEventListener('click', (e) => {
    if (e.target === veil) closeOverlay();
  });

  // Law 3 clauses 1 + 1a: RB → next, LB → previous, WRAP AT BOTH ENDS, over the
  // same set in the same order whether the strip is visible, wrapped to two rows,
  // or folded into the switcher. The ring is the TABS array — one order, and the
  // widget is not consulted.
  const step = (d) => {
    const i = TABS.findIndex((t) => t.id === currentTab);
    const at = i < 0 ? 0 : i;
    selectTab(TABS[(at + d + TABS.length) % TABS.length].id);
  };
  setTabRing({ prev: () => step(-1), next: () => step(1) });

  // The quick-nav list, mirrored (A) or folded-into (B). Both open the SAME list
  // over the SAME table; only which control opens it differs, which is the whole
  // difference between the two variants at this one screen.
  const openHere = (anchor) =>
    openQuickNav(anchor, 'overlay', {
      counts: { deck: run.deck.length },
      current: currentTab,
      hasSave,
      controls: {
        ...quickControls,
        ...(quickControls.music ? {
          music: {
            ...quickControls.music,
            activate: async (...args) => {
              const result = await quickControls.music.activate(...args);
              if (currentTab === 'settings' && result?.changed) panelFor('settings')(body, ctx);
              return result;
            },
          },
        } : {}),
      },
      actions: {
        settings: () => selectTab('settings'),
        controls: () => selectTab('controls'),
        ...(onArmoury ? {
          inventory: () => { closeOverlay(); onArmoury('inventory'); },
          character: () => { closeOverlay(); onArmoury('character'); },
        } : {}),
        ...(onLoad ? { load: confirmQuickMenuAction(
          'Load another slot? Changes since the last save will be lost.',
          () => { closeOverlay(); onLoad(); },
        ) } : {}),
        ...(onSave ? { save: saveAction(onSave) } : {}),
        ...(onSaveQuit ? { saveQuit: () => { closeOverlay(); onSaveQuit(); } } : {}),
        ...(onQuitWithoutSave ? { quitWithoutSave: confirmQuickMenuAction(
          'Quit without saving? Changes since the last save will be lost.',
          () => { closeOverlay(); onQuitWithoutSave(); },
        ) } : {}),
      },
    });
  const overlayHead = veil.querySelector('.overlay-head');
  const syncQuickLauncher = () => {
    if (!overlayHead) return;
    const tabs = overlayHead.querySelector('.overlay-tabs');
    const actions = overlayHead.querySelector('.overlay-actions');
    const foldedNow = quickNavFolds();
    if (tabs) tabs.hidden = foldedNow;
    let switcher = overlayHead.querySelector('#ov-switch');
    if (foldedNow && !switcher) {
      switcher = document.createElement('button');
      switcher.className = 'subtle ov-switch';
      switcher.id = 'ov-switch';
      switcher.setAttribute('aria-haspopup', 'menu');
      actions?.before(switcher);
    } else if (!foldedNow) {
      switcher?.remove();
      switcher = null;
    }
    if (switcher) switcher.textContent = `${TABS.find((tab) => tab.id === currentTab)?.label || currentTab} ▾`;
    let quickButton = overlayHead.querySelector('#ov-quicknav');
    if (quickNavMode() === 'mirror' && !quickButton) {
      quickButton = document.createElement('button');
      quickButton.className = 'subtle';
      quickButton.id = 'ov-quicknav';
      quickButton.title = 'Go to…';
      quickButton.textContent = '☰';
      actions?.prepend(quickButton);
    } else if (quickNavMode() !== 'mirror') {
      quickButton?.remove();
    }
  };
  const onQuickLauncherClick = (event) => {
    const anchor = event.target.closest('#ov-quicknav, #ov-switch');
    if (!anchor || !overlayHead.contains(anchor)) return;
    event.stopPropagation();
    openHere(anchor);
  };
  overlayHead?.addEventListener('click', onQuickLauncherClick);
  window.addEventListener('ashenspire:quicknav-mode-change', syncQuickLauncher);
  overlayCleanup.push(() => {
    overlayHead?.removeEventListener('click', onQuickLauncherClick);
    window.removeEventListener('ashenspire:quicknav-mode-change', syncQuickLauncher);
  });
  syncQuickLauncher();

  // Esc closes the overlay, captured before screen-level key handlers see it.
  escHandler = (ev) => {
    if (ev.key === 'Escape') {
      // Esc peels ONE layer. With the mirrored list open over the overlay, the
      // list is the layer the player is looking at; closing both would take away
      // a screen they never asked to leave.
      if (quickNavIsOpen()) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeOverlay();
    }
  };
  addEventListener('keydown', escHandler, true);

  selectTab(initialId);

  // Smart default (keyboard/gamepad): land on the active tab so arrows can move
  // to its content or across tabs, rather than leaving focus nowhere.
  if (isEngaged()) setTimeout(() => focusFirst('.ov-tab.on') || focusFirst('.ov-tab'), 0);

  return veil;
}
