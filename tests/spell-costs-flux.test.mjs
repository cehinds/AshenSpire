// Owner, 2026-11-15 (W25-F): spells cost 1 more Mana (and 1 more Stamina unless a cantrip); Prepared takes 1 SP off a spell; a Focus item takes 1 MP off;
// the last spell's element becomes a flux that lifts the next card of that element by x1.25 (each number floored). The numbers live in
// fixCoreMechanics.json `spellCosts` and `elementFlux`; a fight created before the ruling has neither block and plays today's costs with no flux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules } from '../src/model/fixCoreMechanics.js';

test('shipped data holds the approved spell cost and flux numbers and the validator guards them', () => {
  assert.deepEqual(shipped.spellCosts, { version: 1, manaSurcharge: 1, staminaSurcharge: 1, cantripTag: 'rank.cantrip', preparedStaminaDiscount: 1, focusManaDiscount: 1 });
  assert.deepEqual(shipped.elementFlux, { version: 1, multiplier: 1.25 });
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  const { spellCosts, elementFlux, ...saved } = shipped;
  assert.doesNotThrow(() => validateFixCoreRules(saved), 'a block saved before the ruling stays valid');
  const costs = patch => validateFixCoreRules({ ...shipped, spellCosts: { ...shipped.spellCosts, ...patch } });
  assert.throws(() => costs({ manaSurcharge: -1 }), /spellCosts/);
  assert.throws(() => costs({ staminaSurcharge: 0.5 }), /spellCosts/);
  assert.throws(() => costs({ extra: 1 }), /spellCosts/);
  assert.throws(() => costs({ version: 2 }), /spellCosts/);
  const flux = patch => validateFixCoreRules({ ...shipped, elementFlux: { ...shipped.elementFlux, ...patch } });
  assert.throws(() => flux({ multiplier: 0.5 }), /elementFlux/);
  assert.throws(() => flux({ extra: 1 }), /elementFlux/);
});

// ---- Costs (src/engine/spellCosts.js, applied in combat.js resolvedCardPriceReceipt) ----
import { fight, profile, reg } from './elementFixture.mjs';
import { cardPlayCosts, previewCard, dispatch } from '../src/engine/combat.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';

const SPELLS = profile.content.cards.filter(card => cardManaCategory(reg, reg.cards.get(card.id)) === 'spell');
const PREPARED = { maneuver: 'casting', camp: 'spell' };
function costsIn({ hand, stance, id, legacy = false }) {
  const { combat } = fight({ legacy });
  if (legacy) { delete combat.fixCoreRules.spellCosts; delete combat.fixCoreRules.elementFlux; }
  combat.loadout.sets.rightHand[0] = hand;
  if (stance) combat.player.combatStance = { ...stance };
  const card = combat.piles.hand[0];
  card.cardId = id;
  return { costs: cardPlayCosts(combat, card.instanceId), preview: previewCard(combat, card.instanceId), combat };
}
// The rule written out on top of the price the fight charged before the ruling (its stance cuts, such as a Graduate's same-stance Mana cut, are unchanged):
// Mana +1; Stamina +1 unless a cantrip (or X-cost); Prepared -1 Stamina; a Focus item -1 Mana; floors at 0. `before` is the same card priced with the rule off.
function expected(card, before, { prepared, focus }) {
  const cantrip = card.tags.includes('rank.cantrip'), x = card.cost === 'X';
  return { stamina: x ? null : Math.max(0, before.stamina + (cantrip ? 0 : 1) - (prepared ? 1 : 0)), mana: Math.max(0, before.mana + 1 - (focus ? 1 : 0)) };
}

test('cost table over every shipped Core 2 spell and cantrip: base, Prepared, Focus, both (shown = paid)', () => {
  assert.ok(SPELLS.length >= 60, 'the table covers the whole shipped spell list');
  assert.ok(SPELLS.some(card => card.tags.includes('rank.cantrip')) && SPELLS.some(card => !card.tags.includes('rank.cantrip')));
  for (const card of SPELLS) {
    for (const [name, hand, stance] of [['base', 'greatsword', null], ['Prepared', 'greatsword', PREPARED], ['Focus', 'boneSceptre', null], ['both', 'boneSceptre', PREPARED]]) {
      // Before the ruling: no Focus item, so nothing but the stance's own cuts is in this price.
      const before = costsIn({ hand: 'greatsword', stance, id: card.id, legacy: true }).costs;
      const want = expected(card, before, { prepared: !!stance, focus: hand === 'boneSceptre' });
      const { costs, preview } = costsIn({ hand, stance, id: card.id });
      if (want.stamina !== null) assert.equal(costs.stamina, want.stamina, `${card.id} ${name} SP`);
      assert.equal(costs.mana, want.mana, `${card.id} ${name} MP`);
      assert.equal(preview.manaCost, costs.mana, `${card.id} ${name}: the preview shows the Mana paid`);
      assert.equal(costs.energy, costs.stamina, `${card.id} ${name}: Stamina paid is the Action cost`);
    }
  }
});

test('literal prices: a 1 SP / 1 MP spell is 2/2 plain, 1/2 in Prepared, 2/1 with a Focus, 1/1 with both; a cantrip is 1/1, 0/1, 1/0, 0/0', () => {
  for (const [id, base, prepared, focus, both] of [['core.cometLance', [2, 2], [1, 2], [2, 1], [1, 1]], ['core.cantrip', [1, 1], [0, 1], [1, 0], [0, 0]], ['core.manaSurge', [2, 1], [1, 1], [2, 0], [1, 0]]]) {
    for (const [hand, stance, want] of [['greatsword', null, base], ['greatsword', PREPARED, prepared], ['boneSceptre', null, focus], ['boneSceptre', PREPARED, both]]) {
      const { costs } = costsIn({ hand, stance, id });
      assert.deepEqual([costs.stamina, costs.mana], want, `${id} ${hand} ${stance ? 'Prepared' : 'no stance'}`);
    }
  }
});

test('a cantrip after a first spell with a Focus costs 0 SP and 0 MP, and the payment equals the face', () => {
  const { combat } = costsIn({ hand: 'boneSceptre', stance: null, id: 'core.cometLance' });
  const [first, second] = combat.piles.hand;
  first.cardId = 'core.cometLance'; second.cardId = 'core.cantrip';
  const open = cardPlayCosts(combat, second.instanceId);
  assert.deepEqual([open.stamina, open.mana], [1, 0], 'before the first cast: 1 SP, 0 MP (Focus took the surcharge back)');
  const [energy, mana] = [combat.player.energy, combat.player.mana];
  dispatch(combat, { type: 'playCard', cardInstanceId: first.instanceId, targetId: combat.enemies[0].id });
  assert.ok(energy - combat.player.energy >= 1);
  assert.ok(mana - combat.player.mana >= 0);
  assert.ok(['casting', 'prepared'].includes(combat.player.combatStance?.maneuver), 'the first cast enters Prepared');
  const after = cardPlayCosts(combat, second.instanceId);
  assert.deepEqual([after.stamina, after.mana], [0, 0]);
  assert.equal(previewCard(combat, second.instanceId).manaCost, 0);
  const [e1, m1] = [combat.player.energy, combat.player.mana];
  dispatch(combat, { type: 'playCard', cardInstanceId: second.instanceId, targetId: combat.enemies[0].id });
  assert.equal(e1 - combat.player.energy, 0, 'paid 0 SP');
  assert.equal(m1 - combat.player.mana, 0, 'paid 0 MP');
});

test('a basic attack is no spell: it takes no surcharge and no Prepared cut', () => {
  const strike = costsIn({ hand: 'greatsword', stance: PREPARED, id: 'core.strike' }).costs, plain = costsIn({ hand: 'greatsword', stance: PREPARED, id: 'core.strike', legacy: true }).costs;
  assert.deepEqual(strike, plain);
});

test('a fight saved without the spellCosts block keeps today\'s costs and the Prepared-only Focus rule', () => {
  for (const card of SPELLS) {
    const plain = costsIn({ hand: 'greatsword', stance: null, id: card.id, legacy: true }).costs;
    if (card.cost !== 'X') assert.equal(plain.stamina, card.staminaCost, `${card.id} SP as printed`);
    assert.equal(plain.mana, card.manaCost, `${card.id} MP as printed`);
    const focusOff = costsIn({ hand: 'boneSceptre', stance: null, id: card.id, legacy: true }).costs;
    assert.equal(focusOff.mana, card.manaCost, `${card.id}: old Focus gives nothing outside Prepared`);
    const prepared = costsIn({ hand: 'greatsword', stance: PREPARED, id: card.id, legacy: true }).costs;
    const focusOn = costsIn({ hand: 'boneSceptre', stance: PREPARED, id: card.id, legacy: true }).costs;
    assert.equal(focusOn.mana, Math.max(0, prepared.mana - 1), `${card.id}: old Focus takes 1 Mana off in Prepared`);
    if (card.cost !== 'X') assert.equal(prepared.stamina, card.staminaCost, `${card.id}: Prepared took no Stamina off before`);
  }
});
