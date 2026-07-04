// src/ui/components/overlay.js — the in-run tabbed overlay menu (SPEC §7.2).
//
// One overlay hosts every in-run menu as a tab: Deck, Relics & Flasks, Stats
// (run telemetry), and Settings. Opened from a button or hotkey on the map and
// in combat; combat is turn-based, so it needs no real "pause". Esc / the ✕ /
// clicking the veil closes it.

import { renderCard } from './card.js';
import { renderSettings } from '../screens/settings.js';
import { attachTooltip, esc } from './tooltip.js';

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
export function openOverlay({ registries, run, meta, onSettingsChange, onSave, initialTab = 'deck' }) {
  closeOverlay();
  const settings = meta.settings || (meta.settings = {});

  const TABS = [
    { id: 'deck', label: `Deck (${run.deck.length})` },
    { id: 'relics', label: 'Relics & Flasks' },
    { id: 'stats', label: 'Stats' },
    { id: 'settings', label: 'Settings' },
  ];

  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal overlay-modal">
      <div class="overlay-head">
        <div class="overlay-tabs">
          ${TABS.map((t) => `<button class="ov-tab" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div class="overlay-actions">
          ${onSave ? '<button class="subtle" id="ov-save">Save</button>' : ''}
          <button class="subtle" id="ov-close" title="Close (Esc)">✕</button>
        </div>
      </div>
      <div class="overlay-body"></div>
    </div>`;
  document.body.appendChild(veil);
  openVeil = veil;

  const body = veil.querySelector('.overlay-body');

  function selectTab(id) {
    veil.querySelectorAll('.ov-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
    body.innerHTML = '';
    if (id === 'deck') renderDeck(body);
    else if (id === 'relics') renderRelics(body);
    else if (id === 'stats') renderStats(body);
    else if (id === 'settings') renderSettings(body, { settings, onChange: onSettingsChange || (() => {}) });
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
      el.innerHTML = `<span class="ov-relic-ic">${esc(def.icon || '◆')}</span><div><b>${esc(def.name)}</b><p>${esc((def.textTemplate || '').replace(/[{}]/g, ''))}</p></div>`;
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

  function renderStats(container) {
    const s = run.stats || {};
    const cls = registries.classes.get(run.class);
    const rows = [
      ['Tarnished', (run.customization && run.customization.name) || cls.name],
      ['Class', cls.name],
      ['Seed', run.seedString],
      ['Act', `${run.actNumber} / 3`],
      ['Floor', run.floor],
      ['HP', `${run.hp} / ${run.maxHp}`],
      ['Runes', run.runes],
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
  const saveBtn = veil.querySelector('#ov-save');
  if (saveBtn && onSave) {
    saveBtn.addEventListener('click', () => {
      const slot = onSave();
      saveBtn.textContent = slot ? `Saved · Slot ${slot}` : 'Saved';
      setTimeout(() => (saveBtn.textContent = 'Save'), 1500);
    });
  }

  // Esc closes the overlay, captured before screen-level key handlers see it.
  escHandler = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      closeOverlay();
    }
  };
  addEventListener('keydown', escHandler, true);

  selectTab(TABS.some((t) => t.id === initialTab) ? initialTab : 'deck');
  return veil;
}
