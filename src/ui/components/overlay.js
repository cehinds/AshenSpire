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
import { menuTabs, CONTROLS_ENTRY } from '../uiContent.js';
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
export function openOverlay({ registries, run, meta, onSettingsChange, onSave, onQuit, onExit, initialTab = 'deck', context = 'map', actions = {} }) {
  closeOverlay();
  closeQuickNav(); // opened FROM the list on map/combat: it has done its job
  const settings = meta.settings || (meta.settings = {});

  const hasSave = !!(onSave || onQuit || onExit);
  // The strip is DERIVED, not restated. It and the quick-nav dropdown are two
  // presentations of one table (uiContent.js MENU_TABS) — the hardcoded list
  // that used to live here is exactly the second copy Law 1 catches.
  // Context threads from the screen that opened us (map or combat) — without
  // it the strip cannot carry a screen-local row, whatever the table says.
  const TABS = menuTabs(context, { hasSave, counts: { deck: run.deck.length } });
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
          ${TABS.map((t) => (t.act
            ? `<button class="ov-tab ov-act" data-act="${t.act}">${esc(t.icon)} ${esc(t.label)}</button>`
            : `<button class="ov-tab" data-tab="${t.id}">${esc(t.label)}</button>`)).join('')}
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
    else if (id === 'settings') renderSettingsWithControls(body);
    else if (id === 'controls') renderControlsSub(body);
  }

  // Controls is a SUB-SETTING of Settings now (Constantine, #42) — one entry at
  // the top of the Settings pane, rendered from CONTROLS_ENTRY so the label and
  // tip keep their one home in uiContent.js. The strip highlight stays on
  // Settings while Controls is open: the tab SET no longer contains controls,
  // so the bumper ring cycles the five real tabs and this pane sits inside one
  // of them (Law 3 clause 1a binds the set, not the widget).
  function renderSettingsWithControls(container) {
    const row = document.createElement('button');
    row.className = 'set-sub-link';
    row.innerHTML = `<span>${esc(CONTROLS_ENTRY.icon)} ${esc(CONTROLS_ENTRY.label)}</span><span class="chev">›</span>`;
    attachTooltip(row, () => esc(CONTROLS_ENTRY.tip));
    row.addEventListener('click', () => { body.innerHTML = ''; renderControlsSub(body); });
    // renderSettings CLEARS the container (it owns its pane), so the entry row
    // is prepended AFTER it runs — order in code is the opposite of order on
    // screen here, and that is why this comment exists.
    renderSettings(container, { settings, onChange: onSettingsChange || (() => {}) });
    container.insertBefore(row, container.firstChild);
  }
  function renderControlsSub(container) {
    const back = document.createElement('button');
    back.className = 'set-sub-link set-sub-back';
    back.innerHTML = `<span>‹ Settings</span>`;
    attachTooltip(back, () => 'Back to Settings.');
    back.addEventListener('click', () => selectTab('settings'));
    renderControls(container, { settings, onChange: onSettingsChange || (() => {}) });
    container.insertBefore(back, container.firstChild);
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

  veil.querySelectorAll('.ov-tab').forEach((b) => {
    // Two kinds of strip button since #42: a TAB selects a pane in here; an ACT
    // row (Armoury / Armaments) leaves this surface for a screen-local one, so
    // it closes the overlay first and fires the handler the screen passed in.
    // An act with no handler is dropped at render, never drawn dead (same rule
    // as the quick-nav list).
    if (b.dataset.act) {
      const act = b.dataset.act;
      if (typeof actions[act] !== 'function') { b.remove(); return; }
      const t = TABS.find((x) => x.act === act);
      if (t && t.tip) attachTooltip(b, () => `<div class="tt-title">${esc(t.label)}</div>${esc(t.tip)}`);
      b.addEventListener('click', () => { closeOverlay(); actions[act](); });
      return;
    }
    const t = TABS.find((x) => x.id === b.dataset.tab);
    if (t && t.tip) attachTooltip(b, () => `<div class="tt-title">${esc(t.label)}</div>${esc(t.tip)}`);
    b.addEventListener('click', () => selectTab(b.dataset.tab));
  });
  veil.querySelector('#ov-close').addEventListener('click', closeOverlay);
  veil.addEventListener('click', (e) => {
    if (e.target === veil) closeOverlay();
  });

  // Law 3 clauses 1 + 1a: RB → next, LB → previous, WRAP AT BOTH ENDS, over the
  // same set in the same order whether the strip is visible, wrapped to two rows,
  // or folded into the switcher. The ring is the TABS array — one order, and the
  // widget is not consulted.
  // The ring is the TAB set only — act rows are launchers that LEAVE this
  // surface, and a bumper ring that fires a navigation as a side effect of
  // cycling is a defect a thumb finds (Law 3 clause 6: the bumpers stay with
  // the tabs; the act rows take the focus cursor like any button).
  const RING = TABS.filter((t) => !t.act);
  const step = (d) => {
    const i = RING.findIndex((t) => t.id === currentTab);
    const at = i < 0 ? 0 : i;
    selectTab(RING[(at + d + RING.length) % RING.length].id);
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
