// src/ui/screens/reward.js — M1 gauntlet glue between fights (SPEC §9 M1):
// heal a slice of max HP, then pick 1 of 3 cards (visible Skip — deck
// discipline is a skill we teach by affordance, GDD §5). Full run rewards
// (runes, relics, flasks) land with M2.

import { renderCard } from '../components/card.js';
import { esc } from '../components/tooltip.js';

/** Roll `count` distinct card ids from the class pool (stream 'cardRewards'). */
export function rollCardRewards(registries, game, count) {
  const pool = registries.classes.get(game.classId).cardPool;
  const weights = registries.balance.gauntlet.rarityWeights;
  const byRarity = {};
  for (const id of pool) {
    const def = registries.cards.get(id);
    (byRarity[def.rarity] = byRarity[def.rarity] || []).push(id);
  }
  const rarities = Object.keys(weights).filter((r) => byRarity[r] && byRarity[r].length);
  const total = rarities.reduce((a, r) => a + weights[r], 0);
  const picks = [];
  let guard = 0;
  while (picks.length < count && guard++ < 100) {
    let roll = game.rng.float('cardRewards') * total;
    let rarity = rarities[rarities.length - 1];
    for (const r of rarities) {
      roll -= weights[r];
      if (roll < 0) {
        rarity = r;
        break;
      }
    }
    const options = byRarity[rarity].filter((id) => !picks.includes(id));
    if (!options.length) continue;
    picks.push(game.rng.pick('cardRewards', options));
  }
  return picks;
}

export function mountReward(app, { registries, game, healed, onContinue }) {
  const picks = rollCardRewards(registries, game, registries.balance.gauntlet.rewardChoices);

  app.innerHTML = `
    <div class="screen">
      <h2 style="color:var(--gold);font-size:24px">VICTORY</h2>
      ${healed > 0 ? `<p class="heal-note">The grace of the shrine mends you: +${healed} HP (${game.hp}/${game.maxHp})</p>` : ''}
      <p class="subtitle">CHOOSE A CARD</p>
      <div class="reward-row"></div>
      <button class="subtle" id="skip-btn">Skip reward</button>
    </div>`;

  const row = app.querySelector('.reward-row');
  picks.forEach((cardId) => {
    const el = renderCard(registries, { cardId, upgraded: false }, {});
    el.addEventListener('click', () => {
      game.deck.push({ instanceId: `r${game.deck.length}_${cardId}`, cardId, upgraded: false });
      onContinue(cardId);
    });
    row.appendChild(el);
  });
  app.querySelector('#skip-btn').addEventListener('click', () => onContinue(null));

  if (!picks.length) {
    row.innerHTML = `<p style="color:var(--muted)">${esc('No rewards available.')}</p>`;
  }
}
