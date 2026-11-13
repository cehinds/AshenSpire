import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatHealthModel } from '../src/ui/models/CombatHealthModel.js';
import { tagSymbolSvg } from '../src/ui/components/cardTagSymbols.js';
import { combatHealthRow, badgeTipHtml } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/dom.mjs';
import { mechanics } from '../src/framework/data/mechanics.js';
import { CounterStackPercent } from '../src/ui/models/CounterStackPercentModel.js';

test('protection badges are independent, Defense (Block) is first, then Ward, and broken protection disappears', () => {
  for (const [defense, ward, kinds] of [[12, 8, ['shield', 'ward']], [12, 0, ['shield']], [0, 8, ['ward']], [0, 0, []]]) {
    const model = combatHealthModel({ defense, ward });
    assert.deepEqual(model.badges.map(b => b.kind), kinds);
    assert.equal(model.protected, defense > 0);
    assert.equal(model.warded, ward > 0);
  }
  assert.deepEqual(combatHealthModel({ defense: NaN, ward: -3 }).badges, []);
});

test('the compact row preserves health facts; its width is a layout token, not the max-HP trough length', () => withKitDom(() => {
  const hp = meter({ id: 'hp', value: '64/80', cur: 64, max: 80, pct: 80, lengthPct: 72, inset: true });
  const row = combatHealthRow(hp, { defense: 12, ward: 8 }, { tooltips: false });
  assert.ok(!row.style.width, 'no inline width on the row');
  assert.ok(!hp.querySelector('.m-track').style.width, 'no max-HP width on the track');
  assert.equal(hp.querySelector('.m-fill').style.width, '80.00%');
  assert.equal(hp.querySelector('.m-value').textContent, '64/80');
  const badges = row.querySelector('.combat-health-badges');
  assert.equal(row.children.length, 3, 'shield, HP bar, badge row');
  assert.equal(row.children[0].dataset.defenseKind, 'shield');
  assert.equal(badges.children.length, 1);
  assert.equal(badges.children[0].dataset.defenseKind, 'ward');
  assert.equal(hp.dataset.protected, 'true');
  assert.equal(hp.dataset.warded, 'true');
}));

test('Ward alone keeps its border while health returns to red', () => withKitDom(() => {
  const hp = meter({ id: 'hp', cur: 64, max: 80, pct: 80, inset: true });
  const row = combatHealthRow(hp, { defense: 0, ward: 8 }, { tooltips: false });
  assert.equal(hp.dataset.protected, 'false');
  assert.equal(hp.dataset.warded, 'true');
  assert.equal(row.children.length, 2, 'HP bar and badge row');
  assert.equal(row.querySelector('.combat-health-badges').children.length, 1, 'Ward alone');
}));

test('Poise is not a badge or trim on the HP row: no badge, no trim, no accessible poise label (owner 2026-11-07; the bar row is separate)', () => withKitDom(() => {
  const hp = meter({ id: 'hp', value: '64/80', cur: 64, max: 80, pct: 80, lengthPct: 72, inset: true });
  const row = combatHealthRow(hp, { defense: 0, ward: 0, poise: 7, poiseMax: 10 }, { tooltips: false });
  assert.equal(row.querySelectorAll('.combat-health-badge').length, 0);
  assert.equal(row.querySelector('.combat-health-poise'), null);
  assert.equal(hp.dataset.poised, 'false');
  assert.doesNotMatch(hp.querySelector('.m-value').getAttribute('aria-label'), /Poise/);
}));

test('PIP badges preserve actual Evasion stacks independently of other defenses (Poise is not drawn)', () => withKitDom(() => {
  const row = combatHealthRow(meter({ id: 'hp', value: '18/20', cur: 18, max: 20 }),
    { evasion: 2, poise: 3, poiseMax: 8, ward: 4, defense: 5 }, { tooltips: false });
  assert.deepEqual(row.querySelectorAll('.combat-health-badge').map(node =>
    [node.dataset.defenseKind, node.querySelector('.combat-health-badge-value').textContent]),
  [['shield', '5'], ['evade', '2'], ['ward', '4']]);
  assert.equal(row.querySelector('.combat-health-meter .m-value').textContent, '18/20');
}));

test('Precision badge sits after Ward and is hidden at zero, negative or null', () => withKitDom(() => {
  const kinds = values => combatHealthModel(values).badges.map(b => b.kind);
  assert.deepEqual(kinds({ defense: 5, evasion: 2, precision: 3, poise: 3, ward: 4 }), ['shield', 'poise', 'evade', 'ward', 'precision']);
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

test('Counter explanation preserves the configured fractional percent in health and shared display values', () => {
  assert.equal(CounterStackPercent(0.1), 10);
  assert.equal(CounterStackPercent(0.29), 29);
  assert.equal(CounterStackPercent(0.304), 30.4);
  assert.equal(CounterStackPercent(0.005), 0.5);
  const original = mechanics.counter.stackFraction;
  try {
    mechanics.counter.stackFraction = 0.29;
    const badge = combatHealthModel({ counterStacks: 1 }).badges.find(row => row.kind === 'counter');
    assert.match(badge.help, /returns 1×29% of incoming/);
    mechanics.counter.stackFraction = 0.304;
    const fractional = combatHealthModel({ counterStacks: 1 }).badges.find(row => row.kind === 'counter');
    assert.match(fractional.help, /returns 1×30\.4% of incoming/);
  } finally {
    mechanics.counter.stackFraction = original;
  }
});

test('Reflect labels use the engine integer percentage points, not rounded raw fractions', () => {
  const original = {
    perStack: mechanics.reflect.reducePerStack,
    returnPerStack: mechanics.reflect.returnPerStack,
    cap: mechanics.reflect.reduceCap,
  };
  try {
    Object.assign(mechanics.reflect, { reducePerStack: 0.304, returnPerStack: 0.304, reduceCap: 0.9 });
    const badge = combatHealthModel({ reflectStacks: 2 }).badges.find(row => row.kind === 'reflect');
    assert.match(badge.help, /Cuts each hit by 60% and sends 60%/);
  } finally {
    Object.assign(mechanics.reflect, { reducePerStack: original.perStack, returnPerStack: original.returnPerStack, reduceCap: original.cap });
  }
});

test('the Evade badge tooltip shows the holder text when given and the generic line otherwise, and combatHealthRow accepts evadeHelp', () => withKitDom(() => {
  const badge = combatHealthModel({ evasion: 2 }).badges.find(b => b.kind === 'evade');
  const helps = { blockHelp: 'b', poiseHelp: 'p', wardHelp: 'w' };
  assert.match(badgeTipHtml(badge, helps), /Active Evasion stacks/);
  assert.match(badgeTipHtml(badge, { ...helps, evadeHelp: 'Each stack adds 3 (base 1, gear +2) plus the holder\'s DEX' }), /gear \+2/);
  const hp = meter({ id: 'hp', value: '18/20', cur: 18, max: 20 });
  for (const options of [{ tooltips: true }, { tooltips: true, evadeHelp: 'holder text' }, { tooltips: true, evadeHelp: null }])
    assert.doesNotThrow(() => combatHealthRow(hp, { evasion: 2 }, options));
}));

test('the Precision badge uses supplied Core wording and keeps the legacy fallback when absent', () => {
  const badge = combatHealthModel({ precision: 2 }).badges.find(row => row.kind === 'precision');
  const coreHelp = 'Each stack adds 2 Precision. Loses 5 stacks at the start of your turn.';
  assert.match(badgeTipHtml(badge, { precisionHelp: coreHelp }), /Each stack adds 2 Precision\. Loses 5 stacks/);
  assert.match(badgeTipHtml(badge, {}), /Each stack adds 1 Accuracy\./, 'non-Core surfaces keep the authored legacy wording');

  const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(screen, /precisionHelp: fixCoreEnabled\(combat\) \? registries\.statuses\.get\('precision', entity\)\?\.tooltip : undefined/);
  assert.match(screen, /const \{ hud, evadeHelp, precisionHelp, poiseHelp, wardHelp \} = hp/);
});

test('the Precision badge glyph is the reticle, not the ranged arrow the card-rail alias gives status:precision', () => withKitDom(() => {
  const reticle = tagSymbolSvg('effect:precision').outerHTML;
  assert.match(reticle, /<circle/, 'the reticle has its centre dot');
  assert.notEqual(reticle, tagSymbolSvg('status:precision').outerHTML, 'card-rail precision keeps its ranged glyph');
  const row = combatHealthRow(meter({ id: 'hp', value: '18/20', cur: 18, max: 20 }), { precision: 2 }, { tooltips: false });
  assert.equal(row.querySelector('.combat-health-precision-icon svg').outerHTML, reticle);
}));

test('the Ward status turns the Poise badge purple and marks it with its stacks', () => {
  const plain = combatHealthModel({ poise: 10, poiseMax: 20, maxHp: 50 }).badges.find(b => b.kind === 'poise');
  assert.equal(plain.ward, undefined);
  const warded = combatHealthModel({ poise: 10, poiseMax: 20, maxHp: 50, wardStacks: 2 }).badges.find(b => b.kind === 'poise');
  assert.equal(warded.ward, true);
  assert.equal(warded.wardStacks, 2);
});

test('while Ward is active, Poise is drawn over the HP bar on the HP scale (10 Poise on 50 HP covers 20%)', () => {
  assert.equal(combatHealthModel({ poise: 10, maxHp: 50, wardStacks: 1 }).poiseOverlayPct, 20);
  assert.equal(combatHealthModel({ poise: 80, maxHp: 50, wardStacks: 1 }).poiseOverlayPct, 100, 'never past the bar');
  assert.equal(combatHealthModel({ poise: 10, maxHp: 50 }).poiseOverlayPct, 0, 'no Ward, no overlay');
  assert.equal(combatHealthModel({ poise: 0, maxHp: 50, wardStacks: 1 }).poiseOverlayPct, 0);
});

test('a warded row keeps its Ward state but draws no Poise badge or overlay', () => withKitDom(() => {
  const row = combatHealthRow(meter({ id: 'hp', value: '18/50', cur: 18, max: 50 }), { poise: 10, poiseMax: 20, maxHp: 50, wardStacks: 2 }, { tooltips: false });
  assert.equal(row.querySelector('.combat-health-badge[data-defense-kind="poise"]'), null);
  assert.equal(row.querySelector('.combat-health-poise-overlay'), null);
  assert.equal(row.querySelector('.combat-health-meter').dataset.wardActive, 'true');
}));

