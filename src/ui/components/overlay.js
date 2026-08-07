// src/ui/components/overlay.js — the in-run tabbed overlay menu (SPEC §7.2).
//
// One overlay hosts every in-run menu as a tab: Deck, Relics & Flasks, Stats
// (run telemetry), and Settings. Opened from a button or hotkey on the map and
// in combat; combat is turn-based, so it needs no real "pause". Esc / the ✕ /
// clicking the veil closes it.

import { renderCard } from './card.js';
import { renderSettings } from '../screens/settings.js';
import { renderControls } from '../screens/controls.js';
import { attachTooltip, esc } from './tooltip.js';
import { relicText } from './card.js';
import { isEngaged, focusFirst, setTabRing } from '../input.js';
import { menuTabs } from '../uiContent.js';
import { openQuickNav, closeQuickNav, quickNavIsOpen, quickNavMode, quickNavFolds, saveAction } from './quicknav.js';

let openVeil = null;
let escHandler = null;

/** True if the overlay is currently open (so callers can route Esc/hotkeys). */
export function overlayIsOpen() {
  return !!openVeil;
}

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
}

/**
 * openOverlay({ registries, run, meta, onSettingsChange, onSave, initialTab })
 * onSave (optional) → returns the slot number saved to (adds a Save action).
 */
export function openOverlay({ registries, run, meta, onSettingsChange, onSave, onQuit, onExit, initialTab = 'deck' }) {
  closeOverlay();
  closeQuickNav(); // opened FROM the list on map/combat: it has done its job
  const settings = meta.settings || (meta.settings = {});

  const hasSave = !!(onSave || onQuit || onExit);
  // The strip is DERIVED, not restated. It and the quick-nav dropdown are two
  // presentations of one table (uiContent.js MENU_TABS) — the hardcoded list
  // that used to live here is exactly the second copy Law 1 catches.
  const TABS = menuTabs({ hasSave, counts: { deck: run.deck.length } });
  // Variant B, and the fold test is `data-layout` — the mode autoLayout()
  // already chose. A width threshold of its own would be a second decider of
  // what "narrow" means, which is the defect #24 was (Law 2).
  const folded = quickNavFolds();
  const mirrored = quickNavMode() === 'mirror';

  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal overlay-modal">
      <div class="overlay-head">
        <div class="overlay-tabs"${folded ? ' hidden' : ''}>
          ${TABS.map((t) => `<button class="ov-tab" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}
        </div>
        ${folded ? '<button class="ov-switch" id="ov-switch" aria-haspopup="menu"></button>' : ''}
        <div class="overlay-actions">
          ${mirrored ? '<button class="subtle" id="ov-quicknav" title="Go to…">☰</button>' : ''}
          <button class="subtle" id="ov-close" title="Close (Esc)">✕</button>
        </div>
      </div>
      <div class="overlay-body"></div>
    </div>`;
  document.body.appendChild(veil);
  openVeil = veil;

  const body = veil.querySelector('.overlay-body');
  let currentTab = null;

  function selectTab(id) {
    currentTab = id;
    veil.querySelectorAll('.ov-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    const sw = veil.querySelector('#ov-switch');
    if (sw) {
      const t = TABS.find((x) => x.id === id);
      sw.textContent = `${t ? t.label : id} ▾`;
    }
    body.innerHTML = '';
    if (id === 'deck') renderDeck(body);
    else if (id === 'relics') renderRelics(body);
    else if (id === 'stats') renderStats(body);
    else if (id === 'save') renderSave(body);
    // No `saves` here ON PURPOSE, so the Profile section does not render in the
    // in-run overlay (#67): restoring an archived profile replaces the live one,
    // and offering that mid-run — three floors into a climb — is the opposite of
    // the calm moment the surface exists for. Its home is the title screen's
    // Settings. Do not "fix" this by passing the manager through.
    else if (id === 'settings') renderSettings(body, { settings, onChange: onSettingsChange || (() => {}) });
    else if (id === 'controls') renderControls(body, { settings, onChange: onSettingsChange || (() => {}) });
  }

  function renderDeck(container) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    if (!run.deck.length) {
      grid.innerHTML = '<div style="color:var(--muted);padding:20px">Empty.</div>';
    } else {
      for (const inst of run.deck) grid.appendChild(renderCard(registries, inst, { small: true }));
    }
    container.appendChild(grid);
  }

  function renderRelics(container) {
    const wrap = document.createElement('div');
    wrap.className = 'ov-relics';
    const rTitle = document.createElement('h3');
    rTitle.className = 'set-cat';
    rTitle.textContent = `Relics (${run.relics.length})`;
    wrap.appendChild(rTitle);
    const rGrid = document.createElement('div');
    rGrid.className = 'ov-relic-grid';
    for (const rid of run.relics) {
      const def = registries.relics.get(rid);
      const el = document.createElement('div');
      el.className = 'ov-relic';
      el.innerHTML = `<span class="ov-relic-ic">${esc(def.icon || '◆')}</span><div><b>${esc(def.name)}</b><p>${esc(relicText(def))}</p></div>`;
      rGrid.appendChild(el);
    }
    if (!run.relics.length) rGrid.innerHTML = '<div style="color:var(--muted)">None yet.</div>';
    wrap.appendChild(rGrid);

    const fTitle = document.createElement('h3');
    fTitle.className = 'set-cat';
    fTitle.textContent = `Flasks (${run.flasks.length})`;
    wrap.appendChild(fTitle);
    const fGrid = document.createElement('div');
    fGrid.className = 'ov-relic-grid';
    for (const f of run.flasks) {
      const def = registries.flasks.get(f.flaskId);
      const el = document.createElement('div');
      el.className = 'ov-relic';
      el.innerHTML = `<span class="ov-relic-ic">${esc(def.icon || '🧪')}</span><div><b>${esc(def.name)}</b><p>${esc(def.textTemplate || '')}</p></div>`;
      fGrid.appendChild(el);
    }
    if (!run.flasks.length) fGrid.innerHTML = '<div style="color:var(--muted)">None.</div>';
    wrap.appendChild(fGrid);
    container.appendChild(wrap);
  }

  // Save tab: save to the current slot, save-and-quit to title, or quit the app.
  // (In-run slot switching is intentionally left to the title's Continue.)
  function renderSave(container) {
    const wrap = document.createElement('div');
    wrap.className = 'ov-save-tab';
    wrap.innerHTML = `
      <h3 class="set-cat">Save</h3>
      <p class="set-note" style="max-width:420px">Your climb is written to its save slot. You can resume it later from the title screen's Continue.</p>
      <div class="ov-save-actions">
        ${onSave ? '<button class="subtle" id="ovs-save">Save now</button>' : ''}
        ${onQuit ? '<button class="subtle" id="ovs-quit">Save &amp; Quit to Title</button>' : ''}
        ${onExit ? '<button class="subtle danger" id="ovs-exit">Quit Game</button>' : ''}
      </div>`;
    container.appendChild(wrap);
    const s = wrap.querySelector('#ovs-save');
    if (s && onSave) {
      s.addEventListener('click', () => {
        const slot = onSave();
        s.textContent = slot ? `Saved · Slot ${slot}` : 'Saved';
        setTimeout(() => (s.textContent = 'Save now'), 1500);
      });
    }
    const q = wrap.querySelector('#ovs-quit');
    if (q && onQuit) q.addEventListener('click', () => { closeOverlay(); onQuit(); });
    const e = wrap.querySelector('#ovs-exit');
    if (e && onExit) e.addEventListener('click', () => { closeOverlay(); onExit(); });
  }

  function renderStats(container) {
    const s = run.stats || {};
    const cls = registries.classes.get(run.class);
    const rows = [
      ['Forsaken', (run.customization && run.customization.name) || cls.name],
      ['Class', cls.name],
      ['Seed', run.seedString],
      ['Act', run.actNumber > 3 ? `${run.actNumber} (endless)` : `${run.actNumber} / 3`],
      ['Floor', run.floor],
      ['HP', `${run.hp} / ${run.maxHp}`],
      ['Cinders', run.cinders],
      ['Fights won', s.fightsWon || 0],
      ['Damage dealt', s.damageDealt || 0],
      ['Damage taken', s.damageTaken || 0],
      ['Deck size', run.deck.length],
      ['Relics', run.relics.length],
    ];
    const el = document.createElement('div');
    el.className = 'ov-stats';
    el.innerHTML = rows
      .map(([k, v]) => `<div class="ov-stat"><span>${esc(String(k))}</span><b>${esc(String(v))}</b></div>`)
      .join('');
    container.appendChild(el);
  }

  veil.querySelectorAll('.ov-tab').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
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
      actions: {
        close: () => closeOverlay(),
        tab: (id) => selectTab(id),
        ...(onSave ? { save: saveAction(onSave) } : {}),
        ...(onQuit ? { quit: () => { closeOverlay(); onQuit(); } } : {}),
      },
    });
  const qnBtn = veil.querySelector('#ov-quicknav');
  if (qnBtn) qnBtn.addEventListener('click', (e) => { e.stopPropagation(); openHere(qnBtn); });
  const swBtn = veil.querySelector('#ov-switch');
  if (swBtn) swBtn.addEventListener('click', (e) => { e.stopPropagation(); openHere(swBtn); });

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

  selectTab(TABS.some((t) => t.id === initialTab) ? initialTab : 'deck');

  // Smart default (keyboard/gamepad): land on the active tab so arrows can move
  // to its content or across tabs, rather than leaving focus nowhere.
  if (isEngaged()) setTimeout(() => focusFirst('.ov-tab.on') || focusFirst('.ov-tab'), 0);

  return veil;
}
