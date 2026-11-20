// Upgrade rarity, wave 2 (owner, 2026-11-19; docs/balance/buff-drawbacks-proposal-2026-11-19.md sections 6 to 11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollUpgradeOptions, upgradeStepRng, UPGRADE_KIND_WEIGHTS } from '../src/model/cardUpgradeSteps.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const byId = (id) => cards.find((c) => c.id === id);
const rollMany = (card, applied = [], n = 600, limits = {}) => {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(...rollUpgradeOptions(card, applied, applied.length, upgradeStepRng(i, 'w2', applied.length), limits, 1));
  return out;
};

test('a Sweep rolls dmg and hits: the gate is allEnemies, not only a single enemy', () => {
  const sweep = byId('core.sweep');
  assert.equal(sweep.effects[0].target, 'allEnemies');
  const steps = rollMany(sweep);
  const dmg = steps.find((s) => s.k === 'dmg');
  assert.ok(dmg, 'a Sweep offers a damage step');
  const after = applyUpgradeSteps(sweep, [dmg]);
  assert.equal(after.effects[0].target, 'allEnemies');
  assert.equal(after.effects[0].amount, 4 + dmg.n, 'the step raises the damage each target takes');
  // Core Sweep pays 1 SP, below a two-hit card's SP floor, so hits is judged on a 2 SP sweep.
  const wide = { ...sweep, id: 't.wide', cost: 2, staminaCost: 2, effects: [{ op: 'damage', target: 'allEnemies', amount: 6 }] };
  const hits = rollMany(wide).find((s) => s.k === 'hits');
  assert.ok(hits, 'a 2 SP Sweep offers a hits step');
  assert.equal(applyUpgradeSteps(wide, [hits]).effects[0].hits, hits.hits);
  assert.equal(applyUpgradeSteps(wide, [hits]).effects[0].target, 'allEnemies');
});

test('range weighs 3, half its old 6 (a Reach hit skips the Advance SP and gains Precision)', () => {
  assert.equal(UPGRADE_KIND_WEIGHTS.range, 3);
  assert.equal(UPGRADE_KIND_WEIGHTS.targeting, 6, 'the other identity kinds keep their weight');
});
