// src/ui/screens/rest.js — Shrine of Emberlight: Rest (heal) or Smith (upgrade)
// (SPEC §7.1; heal math from engine/encounters.js shrineHealAmount)
//
// TWO ACTIONS ON THIS SCREEN TAKE A SECOND BEAT, and they take DIFFERENT ONES,
// which is the clearest illustration in the tree of why the form is derived
// rather than chosen:
//
//   REST holds. Rest and Smith are two adjacent panels and taking either closes
//   the other, so the mistake is a THUMB LANDING 14 px OFF — and the answer is
//   the fill, inside the same gesture.
//   SMITH CONFIRMS. Constantine asked for the upgrade preview to be
//   confirmable. #105 shipped the preview as a HOVER tooltip, which on a phone
//   is nothing at all, and then one tap committed a permanent upgrade. Holding
//   the wrong card upgrades the wrong card; what the player needs is to SEE
//   WHAT IT BECOMES and then say yes. So the confirm panel carries
//   `upgradePreviewHtml` — the same preview, on the screen, where a finger can
//   read it.
//
// Neither of those decisions is in this file. `model/secondbeat.js` holds the
// characteristics; this screen names its actions.

import { shrineHealAmount } from '../../engine/encounters.js';
import { passiveFlag, resolveCard } from '../../model/registries.js';
import { renderCard, upgradePreviewHtml } from '../components/card.js';
import { esc } from '../components/tooltip.js';
import { beatArmer } from '../components/holdconfirm.js';
import { sfx } from '../sfx.js';
import { flaskIdentityHtml } from '../components/flask.js';

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
    const named = [...byId].map(([id, n]) => `${n} × ${flaskIdentityHtml(registries.flasks.get(id))}`);
    said.push(`Flasks refilled: ${named.join(', ')}.`);
  }
  for (const s of refill.shortfalls) said.push(`Flask slots full — ${s.short} not given.`);
  if (!said.length) return '';
  return `<p class="rest-refill">${said.join(' ')}</p>`;
}

export function mountRest(app, { registries, run, meta, onDone, healMult = 1, refill = null }) {
  const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
  const noRest = passiveFlag(registries, run.relics, 'shrineNoRest');
  const upgradable = run.deck.filter((c) => !c.upgraded && registries.cards.get(c.cardId).upgrade);
  const arm = beatArmer(meta, registries);

  app.innerHTML = `
    <div class="screen">
      <h2 style="color:var(--gold);font-size:26px">SHRINE OF EMBER</h2>
      <p class="subtitle">THE GOLD LIGHT HOLDS, FOR NOW</p>
      ${refillLineHtml(registries, refill)}
      <div class="class-row">
        <div class="class-pick${noRest ? ' locked' : ''}" id="rest-opt">
          <div class="glyph">♨</div>
          <h3>Rest</h3>
          <p>${noRest ? 'The Wyrm Heart will not let you rest.' : `Heal ${heal} HP (${run.hp} → ${Math.min(run.maxHp, run.hp + heal)}/${run.maxHp}) and restore Mana (${run.mana} → ${run.maxMana}).`}</p>
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
    arm(app.querySelector('#rest-opt'), 'shrineRest', {
      onConfirm: () => {
        run.hp = Math.min(run.maxHp, run.hp + heal);
        run.mana = run.maxMana;
        sfx.play('shrine');
        onDone(`Rested: +${heal} HP.`);
      },
    });
  }
  if (upgradable.length) {
    // OPENING THE GRID IS NOT AN ACTION THE TABLE RULES ON, and the asymmetry
    // is the point: this button commits nothing — it reveals the candidates,
    // and the player can walk away or rest instead. Rest commits. Same screen,
    // same shape of panel, different characteristics, different answer.
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
        arm(el, 'smithUpgrade', {
          question: `Smith ${resolveCard(registries, inst).name}? This is permanent.`,
          // THE SAME PREVIEW THE TOOLTIP CARRIES, ON THE SCREEN. One home — a
          // second rendering of "what this upgrade does" is the second copy
          // this house exists to catch, and it would be the copy a phone reads.
          detailHtml: upgradePreviewHtml(registries, inst),
          confirmLabel: 'SMITH IT',
          onConfirm: () => {
            inst.upgraded = true;
            sfx.play('shrine');
            onDone(`Smithed: ${esc(resolveCard(registries, inst).name)}.`);
          },
        });
        grid.appendChild(el);
      }
    });
  }
}
