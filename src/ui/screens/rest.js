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
//   confirmable. #105 shipped a per-card HOVER tooltip, which on a phone was
//   nothing at all, and then one tap committed. Smithing now selects the source
//   armament and shows every affected basic-card delta in a persistent panel;
//   what the player needs is to SEE THE WHOLE PROMOTION and then say yes.
//
// Neither of those decisions is in this file. `model/secondbeat.js` holds the
// characteristics; this screen names its actions.

import { shrineHealAmount } from '../../engine/encounters.js';
import { levelUpPlan, applyLevelUp } from '../../model/levelup.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { passiveFlag } from '../../model/registries.js';
import { commitSmithing, smithingPlan } from '../../model/smithing.js';
import { esc, attachTooltip } from '../components/tooltip.js';
import { beatArmer } from '../../framework/optionDecision.js';
import { sfx } from '../sfx.js';
import { flaskIdentityHtml } from '../components/flask.js';
import { chargeFlaskDefinition, flaskChargePlan, moveFlaskCharge } from '../../model/gracerefill.js';
import { renderStatAllocationCard } from '../components/statAllocationCard.js';
import { UI_COMPONENTS as UI, markUiComponent } from '../components/uiComponents.js';
import { smithSelectionModel } from '../models/SmithSelectionModel.js';
import { mountSmithUpgradeModal } from '../components/smithUpgradeModal.js';

const boundedNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
};

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

/** The partner kind's authored NAME, never its id — a player has never heard of `mana`. */
function partnerName(registries, kind) {
  if (!kind) return 'nothing';
  const def = chargeFlaskDefinition(registries, kind);
  return (def && def.name) || kind;
}

export function mountRest(app, { registries, run, meta, onDone, onReallocate = null, onLevelUp = null, levelValue = null, healMult = 1, refill = null, openPanel = null, multiUse = false, rested = false }) {
  // E13's multi-use Shrine: an action re-opens the same screen (with what was
  // already taken recorded) instead of leaving; LEAVE is the one way out.
  const remount = (extra = {}) => mountRest(app, {
    registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, refill, openPanel: null, multiUse, rested, ...extra,
  });
  const heal = Math.floor(shrineHealAmount(registries, run) * healMult);
  const noRest = passiveFlag(registries, run.relics, 'shrineNoRest') || (multiUse && rested);
  const smith = smithingPlan(registries, run);
  const canInspectSmithing = smith.candidates.length > 0;
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
  // The shrine assignment card grants exactly one point. The model still owns
  // pricing, caps, persistence, and pool reconciliation; the screen only fixes
  // the size of this one interaction.
  const level = levelUpPlan(registries, run, { pointsPerLevel: 1 });
  const shrinePresentation = registries.balance?.ui?.shrinePresentation || {};
  const authoredShrineLayout = shrinePresentation.optionLayout;
  const shrineLayout = authoredShrineLayout === 'grid' ? 'grid' : 'list';
  const foldedCardWidthViewportPct = boundedNumber(shrinePresentation.foldedCardWidthViewportPct, 88, 60, 100);
  const foldedCardMaxWidthRem = boundedNumber(shrinePresentation.foldedCardMaxWidthRem, 44, 24, 72);
  const foldedCardHeightViewportPct = boundedNumber(shrinePresentation.foldedCardHeightViewportPct, 10, 6, 18);
  const foldedCardMaxHeightRem = boundedNumber(shrinePresentation.foldedCardMaxHeightRem, 7, 4, 12);

  app.innerHTML = `
    <div class="screen" style="--shrine-folded-card-width:${foldedCardWidthViewportPct}vw;--shrine-folded-card-max-width:${foldedCardMaxWidthRem}rem;--shrine-folded-card-height:${foldedCardHeightViewportPct}vh;--shrine-folded-card-max-height:${foldedCardMaxHeightRem}rem">
      <h2 style="color:var(--gold);font-size:26px">SHRINE OF EMBER</h2>
      <p class="subtitle">THE GOLD LIGHT HOLDS, FOR NOW</p>
      ${refillLineHtml(registries, refill)}
      <div class="class-row shrine-option-${shrineLayout}" data-option-layout="${shrineLayout}">
        <div class="class-pick${noRest ? ' locked' : ''}" id="rest-opt">
          <div class="glyph">♨</div>
          <div class="cp-body">
            <h3>Rest</h3>
            <p>${noRest ? 'The Wyrm Heart will not let you rest.' : `Heal ${heal} HP (${run.hp} → ${Math.min(run.maxHp, run.hp + heal)}/${run.maxHp}) and restore Mana (${run.mana} → ${run.maxMana}).`}</p>
          </div>
        </div>
        <div class="class-pick${canInspectSmithing ? '' : ' locked'}" id="smith-opt"
             role="button" tabindex="${canInspectSmithing ? '0' : '-1'}"
             aria-disabled="${canInspectSmithing ? 'false' : 'true'}">
          <div class="glyph">⚒</div>
          <div class="cp-body">
            <h3>Upgrade an Item</h3>
            <p>${canInspectSmithing
              ? `${smith.stones} Smithing Stone${smith.stones === 1 ? '' : 's'} · choose one owned armament.`
              : 'No owned armament has an effective tier remaining.'}</p>
          </div>
        </div>
        <details class="class-pick shrine-fold" id="flask-reallocate"${openPanel === 'flask' ? ' open' : ''}>
          <summary>
            <span class="shrine-fold-glyph">⚗</span>
            <span class="shrine-fold-summary"><b>Reallocate Flask Charges</b><small>${charge.assigned}/${charge.capacity} assigned</small></span>
            <span class="shrine-fold-caret" aria-hidden="true">›</span>
          </summary>
          <div class="shrine-fold-content">
          <h3>Reallocate Flask Charges</h3>
          <div class="shrine-fold-detail">
          <div class="glyph">⚗</div>
          <div class="cp-body">
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
          </div>
          </div>
        </details>
        <!-- THE AFFORDABILITY PREDICATE, PUBLISHED RATHER THAN RE-DERIVED.
             Constantine: "make the flask and the level up collapsible (with
             level up being grayed out or not visible when there isn't enough
             cinders)". The fold and the grey-out are the player-experience
             seat's; the PREDICATE is model/levelup.js's, and these attributes
             are the seam between them. A styling seat reads data-affordable,
             data-blocked-by and data-short and never subtracts a cost from a
             purse - the day it did there would be two answers to "can he afford
             this" and the screen would eventually disagree with the commit path
             below.
             THE SAME OBJECT DRIVES BOTH: the locked class and these attributes
             come off ONE level plan, computed once per mount, so a disabled card
             and a refused purchase cannot diverge. An instrument reads them too,
             which is why they are on the element and not in a closure.
             NO BACKTICKS IN THIS BLOCK. It sits inside a template literal. I
             closed the string with a pair of them THREE TIMES tonight, in three
             files, every time inside a comment explaining myself - and
             node --check exits 0 on the result because it parses the file as a
             SCRIPT, so my own "parses" check was silent on all three. The gate
             that caught this one is tools/linkcheck.mjs. -->
        <details class="class-pick shrine-fold${level.offerable ? '' : ' locked'}" id="level-opt"${openPanel === 'level' ? ' open' : ''}
             data-affordable="${level.affordable ? '1' : '0'}"
             data-blocked-by="${level.blockedBy || ''}"
             data-cost="${level.cost}"
             data-short="${level.short}">
          <summary>
            <span class="shrine-fold-glyph">✦</span>
            <span class="shrine-fold-summary"><b>Level up</b><small>${level.capped ? 'Level cap reached' : `${level.cost} cinders · +1 point`}</small></span>
            <span class="shrine-fold-caret" aria-hidden="true">›</span>
          </summary>
          <div class="shrine-fold-content">
          <h3>Level up</h3>
          <div class="shrine-fold-detail">
            <div class="glyph">✦</div>
            <div class="cp-body">
            ${level.capped
            ? `<p>You have taken every level this climb allows (${level.levelsTaken}).</p>`
            : `<p class="level-cinder-preview" data-level-cinder-preview>
                <span aria-hidden="true">✦</span>
                <span>You hold <b>${level.cinders}</b> − <strong class="level-cinder-cost">${level.cost} cinders</strong> to level up.</span>
                <span class="level-cinder-result" data-level-cinder-result hidden>→ <b>${level.cinders - level.cost} remaining</b></span>
              </p>`}
            </div>
          </div>
          <div class="shrine-stat-mount"></div>
          </div>
        </details>
      </div>
      ${multiUse ? '<button id="shrine-leave" class="shrine-leave">LEAVE THE SHRINE</button>' : ''}
    </div>`;

  for (const [selector, variant] of [
    ['#rest-opt', 'rest'], ['#smith-opt', 'smith'],
    ['#flask-reallocate', 'flask-allocation'], ['#level-opt', 'level-up'],
  ]) markUiComponent(app.querySelector(selector), UI.shrineOptionCard, variant);
  const leave = app.querySelector('#shrine-leave');
  if (leave) leave.addEventListener('click', () => onDone(rested ? 'Left the Shrine, rested.' : 'Left the Shrine.'));

  if (!noRest) {
    arm(app.querySelector('#rest-opt'), 'shrineRest', {
      question: `Rest here? Heal ${heal} HP and restore Mana, then leave this Shrine.`,
      confirmLabel: 'REST',
      onConfirm: () => {
        run.hp = Math.min(run.maxHp, run.hp + heal);
        run.mana = run.maxMana;
        sfx.play('shrine');
        if (multiUse) { if (onLevelUp) onLevelUp(); remount({ rested: true }); return; }
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
      mountRest(app, { registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, openPanel: 'flask', refill: { chargePools: { ...run.flaskCharges }, grants: [], total: 0, shortfalls: [] } });
    });
  }
  // The same allocation component used by character creation, with shrine
  // policy: existing values are immutable, one and only one plus may be chosen,
  // and the run is not mutated until Done commits it through applyLevelUp.
  if (level.offerable) {
    let pendingAttribute = null;
    const mount = app.querySelector('#level-opt .shrine-stat-mount');
    const drawLevelCard = () => {
      const result = app.querySelector('#level-opt [data-level-cinder-result]');
      if (result) result.hidden = !pendingAttribute;
      const values = Object.fromEntries(level.attributes.map((attr) => [
        attr.id,
        run.attributes[attr.id] + (pendingAttribute === attr.id ? 1 : 0),
      ]));
      const cards = new Map(attributeCardModels(registries, values, {
        equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
      }).map((card) => [card.id, card]));
      renderStatAllocationCard(mount, {
        title: 'ASSIGN 1 POINT',
        remaining: pendingAttribute ? 0 : 1,
        note: 'Choose one attribute. Existing points cannot be reduced.',
        cancelLabel: 'Clear',
        doneLabel: 'Level up',
        doneDisabled: !pendingAttribute,
        rows: level.attributes.map((attr) => ({
          id: attr.id,
          label: attr.label,
          shortLabel: attr.shortLabel,
          value: values[attr.id],
          card: cards.get(attr.id),
          canDecrease: false,
          canIncrease: !pendingAttribute,
        })),
        onIncrease: (id) => { pendingAttribute = id; drawLevelCard(); },
        onCancel: () => { pendingAttribute = null; drawLevelCard(); },
        onDone: () => {
          if (!pendingAttribute) return;
          applyLevelUp(registries, run, pendingAttribute, { pointsPerLevel: 1 });
          sfx.play('shrine');
          if (onLevelUp) onLevelUp();
          mountRest(app, { registries, run, meta, onDone, onReallocate, onLevelUp, levelValue, healMult, refill, openPanel: 'level' });
        },
      });
    };
    drawLevelCard();
  }
  if (canInspectSmithing) {
    // Smith is a reversible modal transaction until its explicit Confirm.
    // Opening and selecting mutate presentation state only. Back and Escape
    // return to the Shrine with the run byte-for-byte untouched; Confirm is
    // the one item promotion and the one path that leaves the Shrine.
    const smithOption = app.querySelector('#smith-opt');
    const openSmith = () => {
      let selectedItemRef = null;
      const model = () => smithSelectionModel(registries, smithingPlan(registries, run), selectedItemRef);
      const modal = mountSmithUpgradeModal(app, model(), {
        registries,
        meta,
        returnFocusElement: smithOption,
        onSelect: (itemRef) => {
          selectedItemRef = itemRef;
          modal.update(model());
        },
        onBack: () => {},
        onConfirm: (itemRef) => {
          const receipt = commitSmithing(registries, run, itemRef);
          sfx.play('shrine');
          if (multiUse) { if (onLevelUp) onLevelUp(); remount(); return; }
          onDone(`Upgraded ${esc(receipt.itemName || receipt.armamentName)} to tier ${receipt.afterLevel}: spent ${receipt.cost} Stone.`);
        },
      });
    };
    smithOption.addEventListener('click', openSmith);
    smithOption.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openSmith();
    });
  }
}
