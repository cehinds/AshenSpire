// src/ui/screens/rest.js — Shrine of Grace: Rest (heal) or Smith (upgrade)
// (SPEC §7.1; heal math from engine/encounters.js shrineHealAmount)

import { shrineHealAmount } from '../../engine/encounters.js';
import { passiveFlag, resolveCard } from '../../model/registries.js';
import { renderCard } from '../components/card.js';
import { esc } from '../components/tooltip.js';
import { sfx } from '../sfx.js';

export function mountRest(app, { registries, run, onDone, healMult = 1 }) {
  const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
  const noRest = passiveFlag(registries, run.relics, 'shrineNoRest');
  const upgradable = run.deck.filter((c) => !c.upgraded && registries.cards.get(c.cardId).upgrade);

  app.innerHTML = `
    <div class="screen">
      <h2 style="color:var(--gold);font-size:26px">SHRINE OF GRACE</h2>
      <p class="subtitle">THE GOLD LIGHT HOLDS, FOR NOW</p>
      <div class="class-row">
        <div class="class-pick${noRest ? ' locked' : ''}" id="rest-opt">
          <div class="glyph">♨</div>
          <h3>Rest</h3>
          <p>${noRest ? 'The Dragon Heart will not let you rest.' : `Heal ${heal} HP (${run.hp} → ${Math.min(run.maxHp, run.hp + heal)}/${run.maxHp}).`}</p>
        </div>
        <div class="class-pick${upgradable.length ? '' : ' locked'}" id="smith-opt">
          <div class="glyph">⚒</div>
          <h3>Smith</h3>
          <p>${upgradable.length ? 'Upgrade a card, permanently.' : 'Nothing left to upgrade.'}</p>
        </div>
      </div>
      <div id="smith-grid" class="deck-strip" style="display:none;max-width:900px"></div>
    </div>`;

  if (!noRest) {
    app.querySelector('#rest-opt').addEventListener('click', () => {
      run.hp = Math.min(run.maxHp, run.hp + heal);
      sfx.play('shrine');
      onDone(`Rested: +${heal} HP.`);
    });
  }
  if (upgradable.length) {
    app.querySelector('#smith-opt').addEventListener('click', () => {
      const grid = app.querySelector('#smith-grid');
      if (grid.style.display !== 'none') return;
      grid.style.display = 'flex';
      grid.style.gap = '14px';
      grid.style.flexWrap = 'wrap';
      grid.style.justifyContent = 'center';
      for (const inst of upgradable) {
        const el = renderCard(registries, inst, { small: true });
        el.addEventListener('click', () => {
          inst.upgraded = true;
          sfx.play('shrine');
          onDone(`Smithed: ${esc(resolveCard(registries, inst).name)}.`);
        });
        grid.appendChild(el);
      }
    });
  }
}
