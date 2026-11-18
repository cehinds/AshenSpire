// Owner 2026-11-18: an elite fight pays six times and a boss fight three times the character XP (pace ruling, docs/balance/level-pace-2026-11-18.md) (balance.xp.tierMultiplier).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { combatLevelXp, combatXpReceipt } from '../src/model/levelup.js';

const plain = createRegistries(contentBundle);
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
// The default Core profile's bound registries are the ones a live run plays on.
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const dead = (n, level = 5) => Array.from({ length: n }, () => ({ level, hp: 0, alive: false }));

for (const [label, registries] of [['content bundle', plain], ['default Core profile', core]]) {
  test(`the tier multipliers ship as normal 1, elite 6, boss 3 (${label})`, () => {
    const tiers = registries.balance.xp.tierMultiplier;
    assert.deepEqual([tiers.normal, tiers.elite, tiers.boss], [1, 6, 3]);
  });

  test(`elite pays 6x and boss 3x the same fight's XP; normal is unchanged (${label})`, () => {
    const fight = pool => combatLevelXp(registries, { victory: true, pool, enemies: dead(2) });
    const normal = fight('normal');
    assert.equal(normal, 50, 'a normal two-kill fight is the old number');
    assert.equal(fight('elite'), normal * 6);
    assert.equal(fight('boss'), normal * 3);
  });

  test(`the multiplier covers the win and the kill XP, and a loss's kill XP (${label})`, () => {
    const win = combatXpReceipt(registries, { victory: true, pool: 'boss', enemies: dead(2) });
    assert.equal(win.rows.reduce((sum, row) => sum + row.amount, 0), win.total, 'every row adds to the receipt total');
    assert.ok(win.rows.some(row => row.kind === 'tier' && row.pool === 'boss' && row.amount === 100));
    assert.equal(combatLevelXp(registries, { victory: false, pool: 'boss', enemies: dead(2) }), 60, 'loss: two level-5 kills at 10 each, tripled');
    assert.equal(combatLevelXp(registries, { victory: false, pool: 'elite', enemies: dead(3) }), 180);
  });
}

test('a missing tierMultiplier or tier is neutral, and the character multiplier stacks on top', () => {
  const bare = { balance: { xp: { ...plain.balance.xp, tierMultiplier: undefined } } };
  assert.equal(combatLevelXp(bare, { victory: true, pool: 'boss', enemies: dead(2) }), 50);
  assert.equal(combatLevelXp(plain, { victory: true, pool: 'boss', enemies: dead(2), characterMultiplier: 1.5 }), 225);
  assert.equal(combatLevelXp(plain, { victory: true, pool: 'unknown', enemies: dead(2) }), 50);
});
