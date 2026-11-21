// Wave 2 batch 5 (owner, 2026-11-15): "+1 Counter" is a card upgrade step. It is offered only on a card that already grants Counter stacks, never pushes
// one play's grant above 3, changes what the card does, and reads as a before -> after on the picker face.
import test from 'node:test';
import assert from 'node:assert/strict';
import { play, registries } from './helpers/upgrade-probe.mjs';
import { profile } from './helpers/fixcore-combat-rules.mjs';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';

const RUN = { seed: 7, gameProfile: profile, rangePolicy: {} };
const options = (cardId, steps = []) => {
  const base = registries.cards.get(cardId);
  const inst = { instanceId: 'k1', cardId, ...(steps.length ? { upgraded: true, upgradeSteps: steps } : { upgraded: false }) };
  return nextUpgradeOptions(RUN, inst, base, registries, 60, { noAuthored: true, everyFamily: true });
};
const counterStep = { k: 'fx', fx: 'counter', n: 1 };
const isCounter = step => step.k === 'fx' && step.fx === 'counter';

test('+1 Counter is offered on a Counter card that has room under 3, and on no other card', () => {
  assert.ok(options('core.counter').some(isCounter), 'core.counter grants 1 (2 upgraded): room for +1');
  const rules = fixCoreMechanics.counter;
  for (const card of registries.cards.all().filter(c => c.id.startsWith('core.') || !c.id.includes('.'))) {
    const maneuver = (card.tags || []).includes('maneuver:counter');
    const offered = options(card.id).some(isCounter);
    if (!maneuver) assert.equal(offered, false, `${card.id} grants no Counter, so no +1 Counter`);
    // A ranked ability card's grade table owns its numbers, so it is offered only drawback-removal steps (review of #2819).
    else if (Array.isArray(card.gradeProfiles)) assert.equal(offered, false, `${card.id} is a ranked ability card: no +1 Counter`);
    else {
      const room = (rules.stacksByCard?.[card.id] ?? rules.stacksPerCard) + rules.stacksUpgradeBonus + 1 <= rules.stacksMax;
      assert.equal(offered, room, `${card.id}: offered exactly when the grant stays within ${rules.stacksMax}`);
    }
  }
});

test('the step is never offered a second time past the cap of 3 a play', () => {
  const once = [counterStep];
  assert.equal(options('core.counter', once).some(isCounter), false, '1 + 1 upgrade + 1 = 3 already');
  assert.equal(options('umbralWard').some(isCounter), false, 'a 3-stack card has no room');
});

test('the step changes the card: one more Counter a play, shown as an added effect', () => {
  const base = registries.cards.get('core.counter');
  const upgraded = applyUpgradeSteps(base, [counterStep]);
  assert.ok(upgraded.effects.some(e => e.op === 'gainCounterStacks' && e.amount === 1), 'the face gains "Gain 1 Counter"');
  const stacksOf = result => result.ev.filter(e => e.type === 'counterStacksChanged').reduce((s, e) => s + e.amount, 0);
  const before = play('core.counter', { upgraded: true, upgradeSteps: [{ k: 'authored' }] });
  const after = play('core.counter', { upgraded: true, upgradeSteps: [{ k: 'authored' }, counterStep] });
  assert.equal(stacksOf(before), 2); assert.equal(stacksOf(after), 3);
  assert.equal(stacksOf(play('core.counter')), 1);
});
