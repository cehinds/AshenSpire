// src/ui/screens/title.js — animated main menu + save slots (SPEC §7.1, §3.12)
//
// Ambient animation only (gold-glow pulse, drifting embers) — feedback
// animations stay ≤300 ms elsewhere; ambient loops respect
// prefers-reduced-motion (styles/ui.css). The menu is a list of save slots
// (one run each): Continue an occupied slot, or Begin a climb in an empty one.

import { esc } from '../components/tooltip.js';

export function mountTitle(app, { slots, onContinue, onNew, onDelete, onHistory, onSettings, onQuit, onCustom, onLan }) {
  // Ember density follows the "Ambient effects" setting (data-ambient on <html>).
  const EMBER_COUNT = { off: 0, low: 3, normal: 7, high: 14 };
  const emberN = EMBER_COUNT[document.documentElement.dataset.ambient] ?? 7;
  const embers = Array.from({ length: emberN }, (_, i) => {
    const left = 8 + ((i * 13.7) % 84);
    const delay = (i * 1.7) % 9;
    const dur = 7 + (i % 4) * 2;
    return `<span class="ember" style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s"></span>`;
  }).join('');

  const slotCards = slots
    .map(({ slot, summary }) =>
      summary
        ? `<div class="slot occupied">
             <div class="slot-info">
               <span class="slot-tag">SLOT ${slot}</span>
               <span class="slot-title">${esc(summary.className)}</span>
               <span class="slot-meta">Act ${summary.actNumber} · Floor ${summary.floor} · ${summary.hp}/${summary.maxHp} HP</span>
               <span class="slot-seed">SEED ${esc(summary.seedString)}</span>
             </div>
             <div class="slot-actions">
               <button class="slot-continue" data-slot="${slot}">CONTINUE</button>
               <button class="subtle slot-delete" data-slot="${slot}" title="Delete this run">✕</button>
             </div>
           </div>`
        : `<div class="slot empty">
             <div class="slot-info"><span class="slot-tag">SLOT ${slot}</span><span class="slot-empty-label">Empty</span></div>
             <button class="slot-new" data-slot="${slot}">BEGIN A CLIMB</button>
           </div>`
    )
    .join('');

  app.innerHTML = `
    <div class="screen title-screen">
      ${embers}
      <div class="title-stack">
        <h1 class="title-big title-glow">ASHEN SPIRE</h1>
        <p class="subtitle" style="text-align:center">A ROGUELIKE DECKBUILDER</p>
      </div>
      <div class="slot-list">${slotCards}</div>
      <div class="title-menu">
        <button class="subtle" id="lan-play" hidden>FORSAKEN TOGETHER</button>
        <button class="subtle" id="custom-climb">CUSTOM CLIMB</button>
        <button class="subtle" id="run-history">RUN HISTORY</button>
        <button class="subtle" id="settings">SETTINGS</button>
        <button class="subtle" id="quit-game">QUIT</button>
      </div>
      <p style="color:var(--muted);font-size:11px;letter-spacing:.15em">THE EMBER FLOWS UPWARD. FOLLOW IT.</p>
    </div>`;

  app.querySelector('#run-history').addEventListener('click', onHistory);
  app.querySelector('#settings').addEventListener('click', onSettings);
  if (onQuit) app.querySelector('#quit-game').addEventListener('click', onQuit);
  if (onCustom) app.querySelector('#custom-climb').addEventListener('click', onCustom);
  // LAN play only exists when the launcher's server is behind the page — the
  // orchestrator un-hides the button once /api/lan/info answers.
  if (onLan) app.querySelector('#lan-play').addEventListener('click', onLan);
  app.querySelectorAll('.slot-continue').forEach((b) => b.addEventListener('click', () => onContinue(+b.dataset.slot)));
  app.querySelectorAll('.slot-new').forEach((b) => b.addEventListener('click', () => onNew(+b.dataset.slot)));
  // Delete is a two-click, self-resetting confirm (no blocking dialog).
  app.querySelectorAll('.slot-delete').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.armed === '1') return onDelete(+b.dataset.slot);
      b.dataset.armed = '1';
      b.textContent = 'Delete?';
      b.classList.add('armed');
      setTimeout(() => {
        if (b.isConnected) {
          b.dataset.armed = '0';
          b.textContent = '✕';
          b.classList.remove('armed');
        }
      }, 2500);
    })
  );
}
