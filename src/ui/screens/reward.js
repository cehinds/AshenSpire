// src/ui/screens/reward.js — post-combat / treasure rewards (SPEC §6, §7.1)
//
// Rewards arrive pre-rolled by engine/encounters.js (deterministic streams);
// this screen only presents them. Skipping the card is a visible affordance
// (deck discipline, GDD §5). Runes/relic/flask apply immediately; the flask
// is lost with a note if all slots are full.

import { renderCard } from '../components/card.js';
import { esc } from '../components/tooltip.js';
import { sfx } from '../sfx.js';

export function mountRewards(app, { registries, run, rewards, onDone }) {
  const lines = [];
  if (rewards.runes) {
    run.runes += rewards.runes;
    lines.push(`<span style="color:var(--gold)">+${rewards.runes} runes</span> (${run.runes} total)`);
  }
  if (rewards.relicId) {
    run.relics.push(rewards.relicId);
    const def = registries.relics.get(rewards.relicId);
    lines.push(`Relic: <b>${esc(def.icon || '◆')} ${esc(def.name)}</b> — ${esc(def.textTemplate.replace(/[{}]/g, ''))}`);
  }
  if (rewards.flaskId) {
    const def = registries.flasks.get(rewards.flaskId);
    if (run.flasks.length < (registries.balance.flaskSlots || 3)) {
      run.flasks.push({ flaskId: rewards.flaskId });
      lines.push(`Flask: <b>${esc(def.icon || '🧪')} ${esc(def.name)}</b>`);
    } else {
      lines.push(`<span style="color:var(--muted)">A ${esc(def.name)} — but your flask slots are full. It stays in the mud.</span>`);
    }
  }

  sfx.play('victory');
  app.innerHTML = `
    <div class="screen">
      <h2 style="color:var(--gold);font-size:26px">${esc(rewards.title || 'VICTORY')}</h2>
      ${lines.map((l) => `<p style="font-size:14px">${l}</p>`).join('')}
      ${rewards.cardIds && rewards.cardIds.length ? '<p class="subtitle">CHOOSE A CARD</p><div class="reward-row"></div>' : ''}
      <button class="subtle" id="reward-continue">${rewards.cardIds && rewards.cardIds.length ? 'Skip the card' : 'CONTINUE'}</button>
    </div>`;

  const row = app.querySelector('.reward-row');
  if (row) {
    for (const cardId of rewards.cardIds) {
      const el = renderCard(registries, { cardId, upgraded: false }, {});
      el.addEventListener('click', () => {
        run.deck.push({ instanceId: `r${run.deck.length}_${cardId}`, cardId, upgraded: false });
        onDone(cardId);
      });
      row.appendChild(el);
    }
  }
  app.querySelector('#reward-continue').addEventListener('click', () => onDone(null));
}
