// Playtest 2026-11-17, theme C: every card that grants Evade carries a drawback, and its upgrades may ease it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { gameProfileRewardPools, gameProfileWeaponArtIds } from '../src/model/gameProfileRewards.js';

const unlocked = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const CLASSES = ['reaver', 'starseer', 'rogue', 'herald'];

/** Every card a Core run can meet: offered as a reward, sold as a weapon art, or dealt in a starter deck. */
export function coreReachableCardIds() {
  const ids = new Set();
  for (const classId of CLASSES) {
    const run = createRunState({ registries, classId, seed: 1, profileMeta: unlocked });
    run.maxMana = 20;
    for (const id of gameProfileRewardPools(registries, run).combatCards) ids.add(id);
    for (const id of gameProfileWeaponArtIds(registries, run)) ids.add(id);
    for (const card of run.deck) ids.add(card.cardId ?? card.id ?? card);
  }
  return [...ids].filter((id) => registries.cards.has(id));
}

const grantsEvade = (card) => (card.effects || []).some((e) => e.op === 'applyStatus' && e.target === 'self' && /(^|\.)evade$/.test(e.status));
const stamina = (card) => (Number.isInteger(card.staminaCost) ? card.staminaCost : Number.isInteger(card.cost) ? card.cost : 0);

/** The drawbacks the owner listed: 2 or more Stamina, a Mana cost, Exhaust or Ethereal, a rising cost, or damage to yourself. */
export function drawbacksOf(card) {
  const keywords = card.keywords || [];
  const found = [];
  if (stamina(card) >= 2) found.push('stamina');
  if ((card.manaCost || 0) > 0) found.push('mana');
  if (keywords.includes('exhaust')) found.push('exhaust');
  if (keywords.includes('ethereal')) found.push('ethereal');
  if ((card.costGrowth?.stamina || 0) > 0 || (card.costGrowth?.mana || 0) > 0) found.push('risingCost');
  if ((card.effects || []).some((e) => e.op === 'loseHp' && e.target === 'self')) found.push('selfDamage');
  return found;
}

test('every Core card that grants Evade carries a drawback', () => {
  const evaders = coreReachableCardIds().map((id) => registries.cards.get(id)).filter(grantsEvade);
  assert.ok(evaders.some((card) => card.id === 'core.backstep'), 'Backstep is reachable and grants Evade');
  for (const card of evaders) assert.ok(drawbacksOf(card).length, `${card.id} grants Evade with no drawback`);
});

test('the 1-Stamina Evade cards Exhaust, and Sidestep does too', () => {
  for (const id of ['core.backstep', 'quickstep', 'base.evade']) assert.ok(registries.cards.get(id).keywords.includes('exhaust'), id);
});
