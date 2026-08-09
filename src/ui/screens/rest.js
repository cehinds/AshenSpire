// src/ui/screens/rest.js — Shrine of Emberlight: Rest (heal) or Smith (upgrade)
// (SPEC §7.1; heal math from engine/encounters.js shrineHealAmount)

import { shrineHealAmount } from '../../engine/encounters.js';
import { passiveFlag, resolveCard } from '../../model/registries.js';
import { renderCard, upgradePreviewHtml } from '../components/card.js';
import { esc } from '../components/tooltip.js';
import { sfx } from '../sfx.js';

// THE REFILL LINE. `refill` is the plan engine/encounters.js ALREADY APPLIED on
// arrival — this screen reports, it never decides, and it is passed the plan
// rather than re-deriving it so the sentence cannot disagree with the flasks.
//
// IT SAYS WHAT IT COULD NOT DO — but only the half a PLAYER is owed. Two things
// go on this screen: what you were handed, and what the shrine could not hand
// you because your slots were full. Silence on the second is the real failure
// mode: a player given nothing and told nothing concludes the shrine is broken.
//
// AND THE `NOT BINDING` DECLARATION IS DELIBERATELY *NOT* HERE, which is a
// ruling and not an oversight. The first draft printed it and I photographed
// it: six letter-spaced lines at 390x844 about a resource that does not exist,
// over a Rest button. A player has never heard of a mana flask and is owed
// nothing about one. The inert row still names itself — in the Advanced debug
// row's own line, and in `node tools/gracerefill.mjs` — which is where the
// person who needs that sentence is standing. Audience, not censorship: the
// same fact, at the door the reader who needs it comes through.
//
// NOTHING AT ALL when the plan granted nothing and had nothing to confess (a
// table of zeroes, the feature switched off in Advanced). Sunna's rule: a state
// that needs no words needs silence.
function refillLineHtml(registries, refill) {
  if (!refill) return '';
  const said = [];
  if (refill.total) {
    const byId = new Map();
    for (const id of refill.grants) byId.set(id, (byId.get(id) || 0) + 1);
    const named = [...byId].map(([id, n]) => `${n} × ${esc(registries.flasks.get(id).name)}`);
    said.push(`Flasks refilled: ${named.join(', ')}.`);
  }
  for (const s of refill.shortfalls) said.push(`Flask slots full — ${s.short} not given.`);
  if (!said.length) return '';
  return `<p class="rest-refill">${said.join(' ')}</p>`;
}

export function mountRest(app, { registries, run, onDone, healMult = 1, refill = null }) {
  const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
  const noRest = passiveFlag(registries, run.relics, 'shrineNoRest');
  const upgradable = run.deck.filter((c) => !c.upgraded && registries.cards.get(c.cardId).upgrade);

  app.innerHTML = `
    <div class="screen">
      <h2 style="color:var(--gold);font-size:26px">SHRINE OF EMBER</h2>
      <p class="subtitle">THE GOLD LIGHT HOLDS, FOR NOW</p>
      ${refillLineHtml(registries, refill)}
      <div class="class-row">
        <div class="class-pick${noRest ? ' locked' : ''}" id="rest-opt">
          <div class="glyph">♨</div>
          <h3>Rest</h3>
          <p>${noRest ? 'The Wyrm Heart will not let you rest.' : `Heal ${heal} HP (${run.hp} → ${Math.min(run.maxHp, run.hp + heal)}/${run.maxHp}).`}</p>
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
        // Hover/focus a candidate to preview exactly what the upgrade changes.
        const el = renderCard(registries, inst, { small: true, tooltipFn: () => upgradePreviewHtml(registries, inst) });
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
