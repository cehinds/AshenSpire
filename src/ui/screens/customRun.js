// src/ui/screens/customRun.js — Custom Climb setup (SPEC §10 ascension seam).
//
// Pick a class, an Ascension level (a preset that stacks difficulty rules), any
// individual difficulty/chaos toggles, a deck mode, and a seed — then hand the
// assembled { classId, seedString, custom } to the orchestrator. Custom runs
// are flagged and kept out of win-rate telemetry (see history.js).

import {
  DIFFICULTY_MODS, CHAOS_MODS, DECK_MODES, ASCENSION_ORDER, MAX_ASCENSION, activeMods,
} from '../../content/customMods.js';
import { classGlyph } from '../assets.js';
import { esc } from '../components/tooltip.js';

export function mountCustomRun(app, { registries, defaultSeedString, onBack, onStart }) {
  const state = {
    classId: registries.classes.all()[0].id,
    ascension: 0,
    mods: {}, // explicit toggles (on top of ascension-enabled rules)
    deckMode: 'standard',
  };

  app.innerHTML = `
    <div class="screen customrun" style="justify-content:flex-start;overflow-y:auto;gap:16px;padding-top:26px">
      <h2 style="color:var(--gold);font-size:24px;letter-spacing:.2em">CUSTOM CLIMB</h2>
      <p class="subtitle">SHAPE YOUR OWN ASCENT — RESULTS ARE KEPT OUT OF WIN-RATE STATS</p>

      <div style="display:flex;flex-direction:column;gap:16px;max-width:680px;width:92%">
        <div><p class="cz-label">CLASS</p><div id="cr-classes" class="class-row" style="flex-wrap:wrap;justify-content:center"></div></div>

        <div>
          <p class="cz-label">ASCENSION <span id="cr-asc-val" style="color:var(--gold)">0</span> / ${MAX_ASCENSION}</p>
          <input id="cr-asc" type="range" min="0" max="${MAX_ASCENSION}" step="1" value="0" style="width:100%;accent-color:var(--gold)">
          <p class="set-note" id="cr-asc-note">No extra difficulty. Slide up to stack the rules below.</p>
        </div>

        <div><p class="cz-label">DIFFICULTY RULES</p><div id="cr-diff" class="mod-grid"></div></div>
        <div><p class="cz-label">CHAOS</p><div id="cr-chaos" class="mod-grid"></div></div>
        <div><p class="cz-label">STARTING DECK</p><div id="cr-deck" class="mod-grid"></div></div>

        <div class="seed-line">Seed <input id="cr-seed" maxlength="10" spellcheck="false" value="${esc(defaultSeedString)}"></div>
      </div>

      <div style="display:flex;gap:14px;padding-bottom:24px">
        <button class="subtle" id="cr-back">Back</button>
        <button id="cr-start">BEGIN THE CLIMB</button>
      </div>
    </div>`;

  const $ = (s) => app.querySelector(s);

  // ---- class picks ----
  const classes = $('#cr-classes');
  for (const cls of registries.classes.all()) {
    const el = document.createElement('div');
    el.className = 'class-pick cr-class';
    el.dataset.classId = cls.id;
    el.innerHTML = `<div class="glyph">${classGlyph(cls.id)}</div><h3>${esc(cls.name)}</h3><span class="chip">HP ${cls.maxHp}</span>`;
    el.addEventListener('click', () => {
      state.classId = cls.id;
      classes.querySelectorAll('.cr-class').forEach((x) => x.classList.toggle('chosen', x === el));
    });
    classes.appendChild(el);
  }
  classes.querySelector('.cr-class').classList.add('chosen');

  // ---- ascension slider (enables the first N difficulty rules) ----
  const ascLabel = $('#cr-asc-val');
  const ascNote = $('#cr-asc-note');
  const asc = $('#cr-asc');
  asc.addEventListener('input', () => {
    state.ascension = Number(asc.value);
    ascLabel.textContent = state.ascension;
    const enabled = ASCENSION_ORDER.slice(0, state.ascension)
      .map((id) => DIFFICULTY_MODS.find((m) => m.id === id).label)
      .join(', ');
    ascNote.textContent = state.ascension ? `Enables: ${enabled}.` : 'No extra difficulty. Slide up to stack the rules below.';
    refreshModChips();
  });

  // ---- mod toggle grids ----
  function modChip(m) {
    const el = document.createElement('button');
    el.className = 'mod-chip';
    el.dataset.mod = m.id;
    el.innerHTML = `<b>${esc(m.label)}</b><span>${esc(m.desc)}</span>`;
    el.addEventListener('click', () => {
      if (el.classList.contains('forced')) return; // locked on by the ascension level
      state.mods[m.id] = !state.mods[m.id];
      refreshModChips();
    });
    return el;
  }
  const diffBox = $('#cr-diff');
  const chaosBox = $('#cr-chaos');
  DIFFICULTY_MODS.forEach((m) => diffBox.appendChild(modChip(m)));
  CHAOS_MODS.forEach((m) => chaosBox.appendChild(modChip(m)));

  // Reflect both explicit toggles and ascension-enabled rules; ascension-forced
  // rules show as "locked on" (can't be turned off below the slider level).
  function refreshModChips() {
    const eff = activeMods(state);
    const forced = new Set(ASCENSION_ORDER.slice(0, state.ascension));
    app.querySelectorAll('.mod-chip').forEach((el) => {
      const id = el.dataset.mod;
      el.classList.toggle('on', !!eff[id]);
      el.classList.toggle('forced', forced.has(id));
    });
  }

  // ---- deck mode ----
  const deckBox = $('#cr-deck');
  DECK_MODES.forEach((m, i) => {
    const el = document.createElement('button');
    el.className = `mod-chip${i === 0 ? ' on' : ''}`;
    el.dataset.deck = m.id;
    el.innerHTML = `<b>${esc(m.label)}</b><span>${esc(m.desc)}</span>`;
    el.addEventListener('click', () => {
      state.deckMode = m.id;
      deckBox.querySelectorAll('.mod-chip').forEach((x) => x.classList.toggle('on', x === el));
    });
    deckBox.appendChild(el);
  });

  $('#cr-back').addEventListener('click', onBack);
  $('#cr-start').addEventListener('click', () => {
    onStart({
      classId: state.classId,
      seedString: $('#cr-seed').value.trim(),
      custom: { ascension: state.ascension, mods: { ...state.mods }, deckMode: state.deckMode },
    });
  });

  refreshModChips();
}
