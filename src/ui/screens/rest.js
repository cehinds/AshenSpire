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
import { levelUpPlan, applyLevelUp } from '../../model/levelup.js';
import { passiveFlag, resolveCard } from '../../model/registries.js';
import { renderCard, upgradePreviewHtml } from '../components/card.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { beatArmer } from '../components/holdconfirm.js';
import { sfx } from '../sfx.js';
import { flaskIdentityHtml } from '../components/flask.js';
import { chargeFlaskDefinition, flaskChargePlan, moveFlaskCharge } from '../../model/gracerefill.js';

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
// it: several letter-spaced lines at 390x844 about an inactive row,
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

// WHAT A POINT IN THIS STAT DOES, READ AND NEVER TYPED. Every word comes from
// the content tables — the attribute's own `sense` (content/attributes.js) and
// the `presentation.label` of every derived stat whose `sourceStat` is this
// attribute (content/derivedStats.js). So the sixth attribute, or a sixth
// derived stat, describes itself at the shrine with nothing edited here, and no
// number a player reads is a copy of one in a table (Law 1 clause 2).
//
// THE `→` IS THE ONLY THING THIS SCREEN AUTHORS. Both sides of it are read off
// the run: the point is permanent and the player is owed the arithmetic before
// they spend, not a promise about it.
function levelDetailHtml(registries, run, attr, points) {
  const rules = (registries.derivedStatRules || {}).rules || {};
  const presentation = (registries.derivedStatRules || {}).presentation || {};
  const feeds = Object.keys(rules)
    .filter((id) => rules[id] && rules[id].sourceStat === attr.id)
    .sort((a, b) => ((presentation[a] || {}).order || 0) - ((presentation[b] || {}).order || 0))
    .map((id) => (presentation[id] || {}).label || id);
  const now = run.attributes[attr.id];
  // BOTH SIDES OF THE ARROW ARE READ, including the step: the level value is a
  // dial he turns (Settings → Advanced), so a hard-coded +1 here would be the
  // confirm panel promising one thing while the purchase does another.
  return `<p><b>${esc(attr.label)} ${now} → ${now + points}</b></p>
    <p>${esc(attr.sense || '')}</p>
    ${feeds.length ? `<p class="set-note">Feeds: ${feeds.map(esc).join(' · ')}</p>` : ''}`;
}

/** The partner kind's authored NAME, never its id — a player has never heard of `mana`. */
function partnerName(registries, kind) {
  if (!kind) return 'nothing';
  const def = chargeFlaskDefinition(registries, kind);
  return (def && def.name) || kind;
}

export function mountRest(app, { registries, run, meta, onDone, onReallocate = null, onLevelUp = null, levelValue = null, healMult = 1, refill = null }) {
  const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
  const noRest = passiveFlag(registries, run.relics, 'shrineNoRest');
  const upgradable = run.deck.filter((c) => !c.upgraded && registries.cards.get(c.cardId).upgrade);
  const arm = beatArmer(meta, registries);
  // `hpCharge` / `manaCharge` are GONE, and their absence is the point: this
  // screen no longer names a charge kind at all. It used to reach for exactly
  // two by id to build a caption; the plan below hands it however many the
  // closed set holds, each already carrying its own authored flask.
  // E10 — "just increment button for each that automatically adjusts the other
  // flask to keep to the total available." The screen asks the model what it may
  // offer; every row, every disabled state and every reason below is read off
  // this plan, and none of them is decided here (model/gracerefill.js).
  const charge = flaskChargePlan(registries, run.flaskCharges);
  // "also at graces, players should have the option to level up their character
  // (per run) by trading cinders to level up." The screen asks the model what
  // it may offer and prices nothing itself.
  const level = levelUpPlan(registries, run, { pointsPerLevel: levelValue });

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
        <div class="class-pick" id="flask-reallocate">
          <div class="glyph">⚗</div>
          <h3>Reallocate Flask Charges</h3>
          <!-- THE PER-FLASK COUNTS LEFT THIS LINE WHEN THE ROWS GAINED THEM.
               It used to read "Fixed capacity 3: <art> 2 · <art> 1" — the same
               two numbers the increment rows below now carry, which is Law 1
               clause 2 (a number a player reads is a copy nothing syncs) and,
               measured at 390x844, the thing that pushed the `+` button and the
               count clean off the right edge of the phone. presentation-matrix
               went red on "relevant controls remain inside the viewport" and
               that is how I found it, not by looking. The capacity stays,
               because it is the one number the rows do NOT say. -->
          <p>Fixed capacity ${charge.capacity}</p>
          <div class="flask-increment">
            ${charge.rows.map((row) => `
              <div class="flask-increment-row" data-kind="${esc(row.kind)}">
                <span class="flask-increment-id">${flaskIdentityHtml(row.def)}</span>
                <!-- THE STEPPER IS ONE UNIT AND WRAPS AS ONE. Read order is the
                     reading order — "Crimson Flask: − 2 +" — and on a narrow
                     shape the whole group drops to its own line under the name
                     instead of the `+` walking off the right edge, which is
                     what it did when the buttons were loose children of the row
                     (measured 390x844: 2 controls outside the viewport). Law 5
                     clause 3: a narrow shape is a different composition. -->
                <span class="flask-increment-steps">
                  <button type="button" class="flask-step" data-step="-1" data-kind="${esc(row.kind)}"
                          data-focusable="true" aria-disabled="${String(!row.canSub)}"
                          aria-label="One fewer ${esc((row.def && row.def.name) || row.kind)}">−</button>
                  <b class="flask-increment-count" data-kind="${esc(row.kind)}">${row.count}</b>
                  <button type="button" class="flask-step" data-step="1" data-kind="${esc(row.kind)}"
                          data-focusable="true" aria-disabled="${String(!row.canAdd)}"
                          aria-label="One more ${esc((row.def && row.def.name) || row.kind)}">+</button>
                </span>
              </div>`).join('')}
            <p class="flask-increment-total">${charge.assigned} of ${charge.capacity} assigned</p>
          </div>
        </div>
        <div class="class-pick${level.offerable ? '' : ' locked'}" id="level-opt">
          <div class="glyph">✦</div>
          <h3>Level up</h3>
          <p>${level.capped
            ? `You have taken every level this climb allows (${level.levelsTaken}).`
            : `${level.cost} cinders for ${level.pointsPerLevel} point${level.pointsPerLevel === 1 ? '' : 's'}. You hold ${level.cinders}${level.levelsTaken ? ` · ${level.levelsTaken} taken` : ''}.`}</p>
          <div class="flask-allocation-controls">
            ${level.attributes.map((a) => `<button type="button" data-attr="${a.id}"${level.offerable ? '' : ' disabled'}>${esc(a.shortLabel || a.label)} ${run.attributes[a.id]}</button>`).join('')}
          </div>
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
  // E10, THE WIRING. Every button is `aria-disabled`, never `disabled`, and the
  // reason is why: a `disabled` button fires no pointer events in Chrome, so a
  // tooltip on it never opens and a player is told nothing about why the control
  // will not move. That is the same trap the flask action menu carried until
  // 2026-08-17, found by photographing it. The guard is in the handler.
  //
  // ONE MOVE, AND THE MODEL PICKS THE PARTNER. The screen never names hp or mana
  // and never computes a complement — it hands the model a kind and a direction,
  // and moveFlaskCharge composes the whole allocation through the one validator.
  // That is what makes "automatically adjusts the other flask" true for a third
  // charge kind that does not exist yet.
  for (const button of app.querySelectorAll('#flask-reallocate .flask-step')) {
    const kind = button.dataset.kind;
    const step = Number(button.dataset.step);
    const row = charge.rows.find((r) => r.kind === kind);
    if (!row) continue;
    const allowed = step > 0 ? row.canAdd : row.canSub;
    const partner = step > 0 ? row.donor : row.receiver;
    const reason = step > 0 ? row.addReason : row.subReason;
    // Law 3 clause 4: a real tooltip, for hover AND the pad/keyboard focus
    // cursor — the native `title=` a mouse gets is not the whole audience.
    // The ENABLED tooltip names the partner, because "the other flask" is the
    // half of his sentence a player cannot see until it moves.
    attachTooltip(button, () => (allowed
      ? `<div class="tt-title">${esc(step > 0 ? 'One more' : 'One fewer')} ${esc((row.def && row.def.name) || kind)}</div>`
        + esc(`Takes the charge ${step > 0 ? 'from' : 'to'} ${partnerName(registries, partner)}. The total stays ${charge.capacity}.`)
      : `<div class="tt-title">Cannot move</div>${esc(reason || '')}`));
    if (!allowed) continue;
    button.addEventListener('click', () => {
      moveFlaskCharge(registries, run.flaskCharges,
        step > 0 ? { from: partner, to: kind } : { from: kind, to: partner });
      sfx.play('shrine');
      if (onReallocate) onReallocate({ ...run.flaskCharges });
      // RE-MOUNT, the shape this panel already used and the shape Vira's level
      // panel adopted from it: the counts moved, and so did which buttons are
      // legal. A control that redrew only its own number would leave the OTHER
      // row's `+` looking pressable at the moment it stopped being.
      mountRest(app, { registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, refill: { chargePools: { ...run.flaskCharges }, grants: [], total: 0, shortfalls: [] } });
    });
  }
  // THE SECOND BEAT IS NOT DECIDED HERE — `shrineLevelUp` is a row in
  // model/secondbeat.js and the machinery picks the form from its
  // characteristics. This screen names the action and hands over the commit,
  // which is the rule that whole file exists to enforce.
  if (level.offerable) {
    for (const attr of level.attributes) {
      const btn = app.querySelector(`#level-opt [data-attr="${attr.id}"]`);
      if (!btn) continue;
      arm(btn, 'shrineLevelUp', {
        question: `Spend ${level.cost} cinders on ${attr.label}? ${level.pointsPerLevel === 1 ? 'The point is' : `All ${level.pointsPerLevel} points are`} permanent.`,
        detailHtml: levelDetailHtml(registries, run, attr, level.pointsPerLevel),
        confirmLabel: 'LEVEL UP',
        onConfirm: () => {
          applyLevelUp(registries, run, attr.id, { pointsPerLevel: levelValue });
          sfx.play('shrine');
          if (onLevelUp) onLevelUp();
          // RE-MOUNT, the same shape the flask reallocation above already uses:
          // the price has moved, the purse has moved, and so has a derived pool
          // the Rest panel is quoting. A screen that stayed put would be
          // offering the old price for the next point.
          mountRest(app, { registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, refill });
        },
      });
    }
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
