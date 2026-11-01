// Owner 2026-11-01: an equipped armament carrying the Focus item type takes 1 Mana off every card, floored at 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, cardPlayCosts } from '../src/engine/combat.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { focusManaDiscount } from '../src/model/focusMana.js';
import { firstAffordableCard } from '../tools/simbot.mjs';

const fixture = (id, cost, manaCost) => ({ id, name: id, type: 'skill', kindIds: ['classification.skill'], costRule: 'fixed', cost, manaCost,
  tags: ['camp:physical', 'maneuver:defend'], effects: [{ op: 'block', target: 'self', amount: 1 }], textTemplate: 'Gain {block} Block.' });
const cards = [fixture('mp2', 1, 2), fixture('mp1', 1, 1), fixture('mp0', 1, 0), fixture('mp5', 1, 5)];
const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, ...cards] });

function fight(rightHand, { mana = 10 } = {}) {
  const run = createRunState({ registries, classId: 'starseer', seed: 7 });
  run.loadout.sets.rightHand[0] = rightHand;
  run.loadout.sets.leftHand[0] = null;
  run.loadout.active.rightHand = 0;
  run.loadout.active.leftHand = 0;
  const player = { id: 'player', classId: 'starseer', loadout: run.loadout, hp: 80, maxHp: 80, mana, maxMana: 10, stamina: 10, maxStamina: 10,
    energyMax: 10, drawPerTurn: 4, orderedDraw: true, relicIds: [],
    deck: cards.map(c => ({ cardId: c.id, instanceId: c.id })) };
  return createCombat({ registries, rng: createRng(11), player, enemyIds: ['wanderingSoldier'] });
}

test('a Focus sceptre takes 1 Mana off each card, floored at 0, and leaves Stamina alone', () => {
  const plain = fight('greatsword'), focus = fight('boneSceptre');
  for (const [id, base, reduced] of [['mp2', 2, 1], ['mp1', 1, 0], ['mp0', 0, 0], ['mp5', 5, 4]]) {
    assert.equal(cardPlayCosts(plain, id).mana, base, `${id} without Focus`);
    assert.equal(cardPlayCosts(focus, id).mana, reduced, `${id} with Focus`);
    assert.equal(cardPlayCosts(focus, id).stamina, cardPlayCosts(plain, id).stamina, `${id}: Stamina unchanged`);
    assert.equal(previewCard(focus, id).manaCost, reduced, `${id}: preview agrees`);
  }
});

test('the card face badge and the Mana actually spent show the reduced cost', () => {
  const combat = fight('boneSceptre');
  const badge = id => playingCardModel(registries, { cardId: id, instanceId: id }, { preview: previewCard(combat, id) }).costs.mana;
  assert.equal(badge('mp2'), 1);
  assert.equal(badge('mp1'), 0);
  const before = combat.player.mana;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'mp2' });
  assert.equal(before - combat.player.mana, 1, 'MP spent is the reduced cost');
});

test('a card payable only after the discount is not blocked as unaffordable', () => {
  const focus = fight('boneSceptre', { mana: 1 });
  // The bot's affordability check (tools/simbot.mjs) prices through the same resolver.
  focus.piles.hand = focus.piles.hand.filter(c => c.instanceId === 'mp2');
  assert.equal(firstAffordableCard(registries, focus)?.instanceId, 'mp2');
  dispatch(focus, { type: 'playCard', cardInstanceId: 'mp2' });
  assert.equal(focus.player.mana, 0);
  const plain = fight('greatsword', { mana: 1 });
  plain.piles.hand = plain.piles.hand.filter(c => c.instanceId === 'mp2');
  assert.equal(firstAffordableCard(registries, plain), undefined);
  assert.throws(() => dispatch(plain, { type: 'playCard', cardInstanceId: 'mp2' }), /mana/i);
});

test('the discount does not stack and every shipped Focus armament and sceptre is known', () => {
  assert.equal(focusManaDiscount(registries, fight('boneSceptre').loadout, 'starseer'), 1);
  assert.equal(focusManaDiscount(registries, fight('greatsword').loadout, 'starseer'), 0);
  const focusIds = [...registries.equipment.armaments?.values?.() ?? []].filter(p => (p.itemTypeTags || []).includes(registries.balance.mana.focusItemType)).map(p => p.id).sort();
  for (const id of ['boneSceptre', 'emberlightSceptre', 'ashStaff', 'blightRod']) assert.ok(focusIds.includes(id), `${id} is a Focus armament`);
});
