// Owner 2026-11-05: a combat door lays out a random 3..5 choices, skills and powers are offered more often than before,
// and first doors vary across seeds. Chests keep offerCount (3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const door = (seed, source = 'combat', floor = 1) => {
  const run = createRunState({ seed, classId: 'reaver', registries: reg }); run.floor = floor;
  return gameProfileRewardOffers(reg, run, createRng(seed), { offerId: `1:n:${source}`, source });
};

test('a combat door lays out 3, 4 or 5 choices, all three sizes occur, and a reload keeps the size', () => {
  const sizes = new Map();
  for (let s = 1; s <= 120; s++) { const n = door(s).options.length; sizes.set(n, (sizes.get(n) || 0) + 1); }
  assert.deepEqual([...sizes.keys()].sort(), [3, 4, 5], JSON.stringify([...sizes]));
  const run = createRunState({ seed: 9, classId: 'reaver', registries: reg });
  const first = gameProfileRewardOffers(reg, run, createRng(9), { offerId: 'x' });
  assert.equal(gameProfileRewardOffers(reg, run, createRng(77), { offerId: 'x' }).options.length, first.options.length);
});

test('chests keep their 3 choices', () => {
  for (let s = 1; s <= 40; s++) assert.equal(door(s, 'treasure').options.length, 3);
});

test('over 200 doors skills and powers are at least half the offered combat cards', () => {
  let cards = 0, nonAttack = 0;
  for (let s = 1; s <= 200; s++) for (const o of door(s, 'combat', 1 + (s % 8)).options) if (o.kind === 'combatCards') { cards++; if (reg.cards.get(o.id).type !== 'attack') nonAttack++; }
  assert.ok(nonAttack / cards >= 0.5, `${nonAttack}/${cards}`);
});

test('first doors vary across 50 seeds: no card in more than 35% of doors, 45+ distinct cards', () => {
  const freq = new Map();
  for (let s = 1; s <= 50; s++) for (const o of door(s).options) if (o.kind === 'combatCards' || o.kind === 'weaponArts') freq.set(o.id, (freq.get(o.id) || 0) + 1);
  const top = Math.max(...freq.values());
  assert.ok(top <= 50 * 0.35, `top card in ${top}/50 doors`);
  assert.ok(freq.size >= 45, `${freq.size} distinct`);
});
