import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel, visibleBadges } from '../src/ui/models/CombatHealthModel.js';
import { combatHealthRow, badgeTipHtml } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/kit-dom.mjs';

// Owner 2026-11-01: badge order is Block > Poise > Evade > Ward, Precision, Counter, Reflect > stance, at most 3 slots, a 3rd-slot "+N" overflow.
const stance = { maneuver: 'counter', label: 'Counter', help: 'Stance: Counter' };
const all = { defense: 5, poise: 3, poiseMax: 8, evasion: 2, ward: 4, precision: 3, counterStacks: 2, reflectStacks: 1, stance };
const hp = () => meter({ id: 'hp', value: '18/20', cur: 18, max: 20 });
const kinds = row => [...row.querySelectorAll('.combat-health-badge')].map(n => n.dataset.defenseKind);

test('the model orders badges Block, Poise, Evade, Ward, Precision, Counter, Reflect, stance', () => {
  assert.deepEqual(combatHealthModel(all).badges.map(b => b.kind), ['shield', 'poise', 'evade', 'ward', 'precision', 'counter', 'reflect', 'stance']);
});

test('three badges all show, with no overflow badge', () => withKitDom(() => {
  const values = { defense: 5, poise: 3, evasion: 2 };
  assert.equal(visibleBadges(combatHealthModel(values).badges).overflow, null);
  const row = combatHealthRow(hp(), values, { tooltips: false });
  assert.deepEqual(kinds(row), ['shield', 'poise', 'evade']);
  assert.equal(row.querySelector('.combat-health-overflow'), null);
}));

test('five badges show the first two plus a +3 overflow badge, and the model keeps all five', () => withKitDom(() => {
  const values = { defense: 5, poise: 3, evasion: 2, ward: 4, precision: 3 };
  assert.equal(combatHealthModel(values).badges.length, 5);
  const split = visibleBadges(combatHealthModel(values).badges);
  assert.deepEqual(split.shown.map(b => b.kind), ['shield', 'poise']);
  assert.equal(split.overflow.label, '+3');
  const row = combatHealthRow(hp(), values, { tooltips: false });
  assert.deepEqual(kinds(row), ['shield', 'poise', 'overflow']);
  const node = row.querySelector('.combat-health-badge.combat-health-overflow');
  assert.equal(node.dataset.defenseKind, 'overflow');
  assert.equal(node.querySelector('.combat-health-badge-value').textContent, '+3');
}));

test('the overflow aria-label and tooltip list the hidden badges as "label value"', () => withKitDom(() => {
  const values = { defense: 5, poise: 3, evasion: 2, ward: 4, precision: 3 };
  const badges = combatHealthModel(values).badges;
  const row = combatHealthRow(hp(), values, { tooltips: false });
  const aria = row.querySelector('.combat-health-overflow').getAttribute('aria-label');
  const hidden = badges.slice(2).map(b => `${b.label} ${b.value}`);
  assert.equal(hidden.length, 3);
  assert.equal(aria, hidden.join(', '));
  const tip = badgeTipHtml(visibleBadges(badges).overflow, {});
  for (const text of hidden) assert.ok(tip.includes(text), `${text} in the tooltip`);
  assert.match(tip, /\+3/);
}));
