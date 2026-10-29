// The Blacksmith's copy says "1 Smithing Stone" and "2 Smithing Stones", never "stone(s)", and does not repeat a
// tile's name under its own title.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { t } from '../src/ui/strings.js';
import { plural } from '../src/model/blacksmith.js';

test('plural() is empty for exactly one and s otherwise', () => {
  assert.deepEqual([0, 1, 2, 3].map(plural), ['s', '', 's', 's']);
});

test('the Blacksmith purse and prices pluralise', () => {
  assert.equal(t('blacksmith.purse.core', { stones: 1, plural: plural(1), cinders: 2000 }), '1 Smithing Stone · 2000 cinders');
  assert.equal(t('blacksmith.purse.core', { stones: 12, plural: plural(12), cinders: 5 }), '12 Smithing Stones · 5 cinders');
  assert.equal(t('blacksmith.purse', { stones: 0, plural: plural(0), refined: 1, refinedPlural: plural(1), cinders: 9 }), '0 Smithing Stones · 1 Refined Stone · 9 cinders');
  assert.equal(t('blacksmith.action.upgrade', { cost: 1, plural: plural(1) }), 'Upgrade (1 stone)');
  assert.equal(t('blacksmith.action.upgrade', { cost: 3, plural: plural(3) }), 'Upgrade (3 stones)');
  assert.equal(t('blacksmith.slots.line', { count: 0, max: 3, plural: plural(3) }), '0 of 3 slots');
  assert.equal(t('blacksmith.refuse.stones', { cost: 1, have: 0, plural: plural(1) }), 'That costs 1 Smithing Stone; you have 0.');
  assert.equal(t('blacksmith.refuse.stones', { cost: 2, have: 0, plural: plural(2) }), 'That costs 2 Smithing Stones; you have 0.');
});

test('a tile line does not repeat the name that is already its title', () => {
  for (const [id, tokens] of [['blacksmith.upgrade.line', { from: 0, to: 1 }], ['blacksmith.stack.line', { owned: 2 }], ['blacksmith.armament.line', { cost: 9 }], ['blacksmith.art.line', {}]]) {
    assert.doesNotMatch(t(id, tokens), /\{name\}|\(s\)/, id);
  }
  assert.equal(t('blacksmith.upgrade.line', { from: 0, to: 1 }), 'Tier 0 to 1');
});
