import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel } from '../src/ui/models/CombatHealthModel.js';
import { tagSymbolSvg } from '../src/ui/components/cardTagSymbols.js';
import { combatHealthRow } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('protection badges are independent, Defense (Block) is first, then Ward, and broken protection disappears', () => {
  for (const [defense, ward, kinds] of [[12, 8, ['shield', 'ward']], [12, 0, ['shield']], [0, 8, ['ward']], [0, 0, []]]) {
    const model = combatHealthModel({ defense, ward });
    assert.deepEqual(model.badges.map(b => b.kind), kinds);
    assert.equal(model.protected, defense > 0);
    assert.equal(model.warded, ward > 0);
  }
  assert.deepEqual(combatHealthModel({ defense: NaN, ward: -3 }).badges, []);
});

test('the compact row preserves health facts and the original total trough length', () => withKitDom(() => {
  const hp = meter({ id: 'hp', value: '64/80', cur: 64, max: 80, pct: 80, lengthPct: 72, inset: true });
  const row = combatHealthRow(hp, { defense: 12, ward: 8 }, { tooltips: false });
  assert.equal(row.style.width, '72.000%');
  assert.equal(hp.querySelector('.m-track').style.width, '100%');
  assert.equal(hp.querySelector('.m-fill').style.width, '80.00%');
  assert.equal(hp.querySelector('.m-value').textContent, '64/80');
  assert.equal(row.children.length, 3);
  assert.equal(row.children[0].dataset.defenseKind, 'shield');
  assert.equal(row.children[1].dataset.defenseKind, 'ward');
  assert.equal(hp.dataset.protected, 'true');
  assert.equal(hp.dataset.warded, 'true');
}));

test('Ward alone keeps its border while health returns to red', () => withKitDom(() => {
  const hp = meter({ id: 'hp', cur: 64, max: 80, pct: 80, inset: true });
  const row = combatHealthRow(hp, { defense: 0, ward: 8 }, { tooltips: false });
  assert.equal(hp.dataset.protected, 'false');
  assert.equal(hp.dataset.warded, 'true');
  assert.equal(row.children.length, 2);
}));

test('Poise has a numeric badge and retains the HP trim and accessible value', () => withKitDom(() => {
  const hp = meter({ id: 'hp', value: '64/80', cur: 64, max: 80, pct: 80, lengthPct: 72, inset: true });
  const row = combatHealthRow(hp, { defense: 0, ward: 0, poise: 7, poiseMax: 10 }, { tooltips: false });
  assert.equal(row.querySelectorAll('.combat-health-badge').length, 1, 'Poise has its gold numeric badge');
  assert.equal(row.querySelector('.combat-health-poise .combat-health-badge-value').textContent, '7');
  assert.equal(hp.dataset.poised, 'true', 'the gold trim stays while Poise is above zero');
  assert.match(hp.querySelector('.m-value').getAttribute('aria-label'), /Poise 7\/10/);
  const none = combatHealthRow(meter({ id: 'hp', value: '64/80', cur: 64, max: 80, pct: 80, lengthPct: 72, inset: true }), { poise: 0, poiseMax: 10 }, { tooltips: false });
  assert.equal(none.querySelector('.combat-health-meter').dataset.poised, 'false');
}));

test('PIP badges preserve actual Evasion stacks independently of other defenses', () => withKitDom(() => {
  const row = combatHealthRow(meter({ id: 'hp', value: '18/20', cur: 18, max: 20 }),
    { evasion: 2, poise: 3, poiseMax: 8, ward: 4, defense: 5 }, { tooltips: false });
  assert.deepEqual(row.querySelectorAll('.combat-health-badge').map(node =>
    [node.dataset.defenseKind, node.querySelector('.combat-health-badge-value').textContent]),
  [['shield', '5'], ['evade', '2'], ['poise', '3'], ['ward', '4']]);
  assert.equal(row.querySelector('.combat-health-meter .m-value').textContent, '18/20');
}));

test('Precision badge sits right after Evade and is hidden at zero, negative or null', () => withKitDom(() => {
  const kinds = values => combatHealthModel(values).badges.map(b => b.kind);
  assert.deepEqual(kinds({ defense: 5, evasion: 2, precision: 3, poise: 3, ward: 4 }), ['shield', 'evade', 'precision', 'poise', 'ward']);
  for (const precision of [0, -2, null, undefined, NaN]) assert.ok(!kinds({ precision }).includes('precision'));
  const row = combatHealthRow(meter({ id: 'hp', value: '18/20', cur: 18, max: 20 }), { evasion: 2, precision: 3 }, { tooltips: false });
  const badge = row.querySelector('.combat-health-precision');
  assert.equal(badge.querySelector('.combat-health-badge-value').textContent, '3');
  assert.ok(badge.querySelector('.combat-health-precision-icon svg'));
  assert.equal(badge.getAttribute('aria-label'), 'Precision 3');
}));

test('spent Evasion stacks disappear from the PIP instead of showing a zero rating', () => {
  for (const evasion of [0,-2,null,undefined]) assert.ok(!combatHealthModel({evasion}).badges.some(badge=>badge.kind==='evade'));
  assert.equal(combatHealthModel({evasion:3}).badges.find(badge=>badge.kind==='evade').value,3);
});

test('the Precision badge glyph is the reticle, not the ranged arrow the card-rail alias gives status:precision', () => withKitDom(() => {
  const reticle = tagSymbolSvg('effect:precision').outerHTML;
  assert.match(reticle, /<circle/, 'the reticle has its centre dot');
  assert.notEqual(reticle, tagSymbolSvg('status:precision').outerHTML, 'card-rail precision keeps its ranged glyph');
  const row = combatHealthRow(meter({ id: 'hp', value: '18/20', cur: 18, max: 20 }), { precision: 2 }, { tooltips: false });
  assert.equal(row.querySelector('.combat-health-precision-icon svg').outerHTML, reticle);
}));
