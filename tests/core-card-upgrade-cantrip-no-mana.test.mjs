// Cantrips and basics cost no Mana: a rank-down upgrade zeroes it, and the generator never offers a Mana cut on one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpgradeSteps, RANK_DOWN_TAG } from '../src/model/cardUpgrade.js';
import { rollUpgradeStep, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { upgradeBasic } from '../src/model/cardUpgradeLimits.js';

const spell = (extra = {}) => ({ id: 't.bolt', name: 'Bolt', type: 'attack', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 2, keywords: [],
  tags: ['source:spell', 'camp:spell', 'school:fire'], effects: [{ op: 'damage', target: 'enemy', amount: 8 }], ...extra });
const tagStep = { k: 'tag', tag: RANK_DOWN_TAG };

test('a rank-down step takes the Mana cost from 2 to 0 and keeps Stamina', () => {
  const out = applyUpgradeSteps(spell(), [tagStep]);
  assert.equal(out.manaCost, 0);
  assert.equal(out.staminaCost, 1);
  assert.ok(out.tags.includes(RANK_DOWN_TAG));
});

test('a saved instance with the step resolves to 0 Mana whatever the step order', () => {
  const saved = [{ k: 'cost', pool: 'mp' }, tagStep, { k: 'dmg', n: 2 }];
  const out = applyUpgradeSteps(spell(), saved);
  assert.equal(out.manaCost, 0);
  assert.equal(upgradeBasic(spell(), { upgradeSteps: saved }), true);
  assert.equal(applyUpgradeSteps(spell(), [{ k: 'cost', pool: 'mp' }]).manaCost, 1);
});

test('the generator never offers a Mana cut on a cantrip or a card that became one', () => {
  const pools = (card, applied = []) => {
    const seen = new Set();
    for (let i = 0; i < 300; i += 1) { const s = rollUpgradeStep(card, applied, applied.length, upgradeStepRng(i, 'x', i)); if (s?.k === 'cost') seen.add(s.pool); }
    return seen;
  };
  assert.ok(pools(spell()).has('mp'), 'a plain spell still gets the Mana cut');
  assert.ok(!pools(spell({ tags: ['source:spell', 'camp:spell', RANK_DOWN_TAG] })).has('mp'));
  assert.ok(!pools(spell({ rarity: 'common', tags: ['camp:physical'] })).has('mp'));
  const becameOne = applyUpgradeSteps(spell(), [tagStep]);
  assert.ok(!pools(becameOne, [tagStep]).has('mp'));
});
