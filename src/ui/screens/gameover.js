// src/ui/screens/gameover.js — YOU DIED / GREAT RUNE RESTORED (SPEC §7.4)

import { resolveCard } from '../../model/registries.js';
import { esc } from '../components/tooltip.js';
import { sfx } from '../sfx.js';

export function mountGameOver(app, { registries, game, victory, onTitle }) {
  sfx.play(victory ? 'victory' : 'youDied');
  const title = victory ? 'GREAT RUNE RESTORED' : 'YOU DIED';
  const color = victory ? 'var(--gold)' : 'var(--blood)';

  app.innerHTML = `
    <div class="screen" style="gap:22px">
      <h1 class="title-big" style="color:${color}">${title}</h1>
      <table class="stats-table">
        <tr><td>Seed</td><td style="font-family:monospace">${esc(game.seedString)}</td></tr>
        <tr><td>Fights won</td><td>${game.stats.fightsWon} / ${game.gauntletLength}</td></tr>
        <tr><td>Damage dealt</td><td>${game.stats.damageDealt}</td></tr>
        <tr><td>Damage taken</td><td>${game.stats.damageTaken}</td></tr>
        <tr><td>Final HP</td><td>${victory ? game.hp : 0} / ${game.maxHp}</td></tr>
      </table>
      <div>
        <p class="subtitle" style="text-align:center;margin-bottom:8px">FINAL DECK (${game.deck.length})</p>
        <div class="deck-strip"></div>
      </div>
      <button id="to-title">RETURN TO TITLE</button>
    </div>`;

  const strip = app.querySelector('.deck-strip');
  for (const inst of game.deck) {
    const def = resolveCard(registries, inst);
    const el = document.createElement('span');
    el.className = `mini${inst.upgraded ? ' upgraded' : ''}`;
    el.textContent = def.name;
    strip.appendChild(el);
  }
  app.querySelector('#to-title').addEventListener('click', onTitle);
}
