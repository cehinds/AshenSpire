// src/ui/screens/title.js — title + class select + seed entry (SPEC §7.1)

import { LOCKED_CLASSES } from '../../content/index.js';
import { classGlyph } from '../assets.js';
import { esc } from '../components/tooltip.js';

export function mountTitle(app, { registries, defaultSeedString, onStart }) {
  app.innerHTML = `
    <div class="screen">
      <div>
        <h1 class="title-big">SPIRE OF THE ERDTREE</h1>
        <p class="subtitle" style="text-align:center">A ROGUELIKE DECKBUILDER — M1 COMBAT SLICE</p>
      </div>
      <div class="class-row"></div>
      <div class="seed-line">Seed <input id="seed-input" maxlength="10" spellcheck="false"></div>
      <p style="color:var(--muted);font-size:11px;max-width:520px;text-align:center;line-height:1.6">
        Choose the Vagabond to begin the gauntlet: two fights, an elite, and The Watchful Omen.
        Same seed, same run.
      </p>
    </div>`;

  app.querySelector('#seed-input').value = defaultSeedString;

  const row = app.querySelector('.class-row');
  for (const cls of registries.classes.all()) {
    const el = document.createElement('div');
    el.className = 'class-pick';
    el.innerHTML = `
      <div class="glyph">${classGlyph(cls.id)}</div>
      <h3>${esc(cls.name)}</h3>
      <p>${esc(cls.description || '')}</p>
      <span class="chip">HP ${cls.maxHp} · ${cls.startingDeck.length} cards</span>`;
    el.addEventListener('click', () => onStart(cls.id, app.querySelector('#seed-input').value.trim()));
    row.appendChild(el);
  }
  for (const cls of LOCKED_CLASSES) {
    const el = document.createElement('div');
    el.className = 'class-pick locked';
    el.innerHTML = `
      <div class="glyph">${classGlyph(cls.id)}</div>
      <h3>${esc(cls.name)}</h3>
      <p>${esc(cls.description)}</p>
      <span class="chip">ARRIVES IN ${esc(cls.milestone)}</span>`;
    row.appendChild(el);
  }
}
