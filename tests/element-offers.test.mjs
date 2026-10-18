// Owner decision #13: Herald and Starseer meet Psychic and Earth cards more
// often in card rewards; other classes are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { rollCardRewardIds } from '../src/engine/encounters.js';

const registries = createRegistries(contentBundle);
const ELEMENT = new Set(['mindSpike', 'dissonance', 'mindFracture', 'wakingNightmare', 'stoneSling', 'rockfall', 'entomb']);

function withAffinity(affinity) {
  const rewards = { ...contentBundle.balance.rewards, elementAffinity: affinity };
  return createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, rewards } });
}

const rolls = (classId, reg = registries, n = 600) => {
  const out = [];
  for (let seed = 1; seed <= n; seed++) {
    out.push(rollCardRewardIds(reg, createRng(seed), { classId, pool: 'normal', combatExpansionVersion: 2 }));
  }
  return out;
};
const freq = (all) => all.flat().filter(id => ELEMENT.has(id)).length / all.flat().length;

test('herald and starseer are offered element cards more often than a mult of 1 gives', () => {
  const flat = withAffinity({ ...contentBundle.balance.rewards.elementAffinity, offerWeightMult: 1 });
  for (const classId of ['herald', 'starseer']) {
    const boosted = freq(rolls(classId));
    const base = freq(rolls(classId, flat));
    assert.ok(base > 0, `${classId}: element cards are in the pool`);
    assert.ok(boosted > base * 1.25, `${classId}: ${boosted} vs ${base}`);
  }
});

test('a class without affinity rolls exactly as the unweighted pick does', () => {
  const none = withAffinity(undefined);
  assert.deepEqual(rolls('reaver', registries, 200), rolls('reaver', none, 200));
  assert.deepEqual(rolls('rogue', registries, 200), rolls('rogue', none, 200));
});

test('the same seed offers the same cards', () => {
  assert.deepEqual(rolls('herald', registries, 50), rolls('herald', registries, 50));
});
