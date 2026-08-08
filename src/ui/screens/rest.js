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

export function mountRest(app, { registries, run, meta, onDone, healMult = 1 }) {
  const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
  const noRest = passiveFlag(registries, run.relics, 'shrineNoRest');
  const upgradable = run.deck.filter((c) => !c.upgraded && registries.cards.get(c.cardId).upgrade);
  const arm = beatArmer(meta, registries);

  app.innerHTML = `
    <div class="screen">
      <h2 style="color:var(--gold);font-size:26px">SHRINE OF EMBER</h2>
      <p class="subtitle">THE GOLD LIGHT HOLDS, FOR NOW</p>
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
    arm(app.querySelector('#rest-opt'), 'shrineRest', {
      onConfirm: () => {
        run.hp = Math.min(run.maxHp, run.hp + heal);
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
