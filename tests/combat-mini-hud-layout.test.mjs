import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatHealthRow } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { resourceBars } from '../src/ui/components/resbars.js';
import { RESOURCE_SOURCES } from '../src/model/resources.js';
import { PoiseBarRemaining, PoiseNearBreak, PoiseLeft } from '../src/ui/models/CombatHealthModel.js';
import { FORM_FACTORS } from '../tools/hud-layout-tokens.mjs';

// Owner 2026-11-07 (backlog #11/#4/#5/#6): every combatant's mini HUD is one fixed-width layout: a Block shield (HP and Poise rows tall) on the
// left, then the HP bar, the Poise bar (always drawn, the HP bar's width and height) and one badge row.
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const hpBar = (max, lengthPct) => meter({ id: 'hp', value: `${max}/${max}`, cur: max, max, pct: 100, lengthPct, inset: true });
const poiseBar = (cur, max) => meter({ id: 'poise', value: `${cur}/${max}`, cur, max, pct: max ? (cur / max) * 100 : 0, lengthPct: 100, inset: true, skinny: true });
const shape = row => row.children.map(child => child.className.split(' ').slice(0, 2).join('.'));

test('the row is built the same for every max HP and for Block 0 or more: no inline width, one fixed structure', () => withKitDom(() => {
  const cases = [
    [hpBar(10, 12), { defense: 0 }], [hpBar(400, 100), { defense: 0 }],
    [hpBar(10, 12), { defense: 9 }], [hpBar(400, 100), { defense: 9, ward: 4, precision: 2 }],
  ];
  for (const [hp, values] of cases) {
    const poise = poiseBar(0, 0);
    const row = combatHealthRow(hp, values, { tooltips: false, persistent: true, poise, statuses: null });
    assert.ok(!row.style.width, 'the row no longer copies the max-HP trough width');
    assert.ok(!hp.querySelector('.m-track').style.width, 'the HP track is sized by the layout token, not by max HP');
    assert.ok(!poise.querySelector('.m-track').style.width);
    // shield (always present when persistent), HP bar, Poise bar, badge row.
    assert.deepEqual(shape(row), ['combat-health-badge.combat-health-shield', 'as-meter.inset', 'as-meter.skinny', 'combat-health-badges']);
    assert.equal(row.children[0].hidden, !values.defense, 'Block 0 keeps the slot, hidden');
    assert.equal(row.children[2].dataset.res, 'poise');
  }
}));

test('Poise is a plain bar row under HP, empty at 0/0: no Poise badge, no HP-bar trim', () => withKitDom(() => {
  const hp = hpBar(40, 100);
  const row = combatHealthRow(hp, { defense: 0, poise: 0, poiseMax: 0 }, { tooltips: false, poise: poiseBar(0, 0) });
  const poise = row.querySelector('.combat-health-poise-bar');
  assert.ok(poise, 'the Poise bar row exists at 0/0');
  assert.equal(poise.dataset.res, 'poise');
  assert.equal(poise.querySelector('.m-fill').style.width, '0.00%');
  assert.equal(row.querySelector('.combat-health-poise'), null, 'no Poise badge');
  assert.equal(hp.dataset.poised, 'false', 'no Poise trim on the HP bar');
  assert.equal(row.children.indexOf(poise), row.children.indexOf(hp) + 1, 'the Poise bar sits right under the HP bar');
}));

test('the badge row holds every badge kind and the status tray, after the bars', () => withKitDom(() => {
  const tray = document.createElement('div');
  tray.className = 'as-pips icon-tray statuses';
  const row = combatHealthRow(hpBar(20, 50), { defense: 3, evasion: 2 }, { tooltips: false, persistent: true, poise: poiseBar(2, 5), statuses: tray });
  const badges = row.children.find(child => child.className.includes('combat-health-badges'));
  assert.equal(row.children.at(-1), badges, 'the badge row is last');
  assert.equal(badges.children.at(-1), tray, 'the status tray shares the badge row');
  assert.deepEqual(badges.children.slice(0, -1).map(node => node.dataset.defenseKind), ['evade', 'ward', 'precision', 'counter', 'reflect', 'overflow']);
  assert.equal(row.querySelector('.combat-health-shield').parentNode, row, 'Block is the shield beside the bars, not in the badge row');
}));

test('persistent rows keep their node count whatever the values', () => withKitDom(() => {
  const count = node => 1 + node.children.reduce((sum, child) => sum + count(child), 0);
  const build = values => count(combatHealthRow(hpBar(30, 60), values, { tooltips: false, persistent: true, poise: poiseBar(1, 4) }));
  assert.equal(build({ defense: 0 }), build({ defense: 12, ward: 5, evasion: 3 }));
}));

test('the layout sheet sizes the bars from the HUD layout tokens and the tokens exist for every form factor', () => {
  const css = read('styles/combat-mini-hud.css');
  assert.match(css, /--mh-bar-w: var\(--hud-mini-bar-width, 150px\)/);
  assert.match(css, /--mh-bar-h: var\(--hud-mini-bar-height, 10px\)/);
  assert.match(css, /\.combat-health-poise-bar\.combat-health-poise-bar \{[^}]*width: var\(--mh-bar-w\)/, 'Poise is the HP bar\'s width');
  assert.match(css, /\.combat-health-meter > \.m-well \{[^}]*width: var\(--mh-bar-w\)/, 'the HP trough is that width');
  assert.match(css, /\.combat-health-badges \{[^}]*width: var\(--mh-bar-w\); max-width: 100%[^}]*overflow: hidden/, 'the badge row is capped at the bar width (the browser test counts 8 statuses)');
  assert.match(css, /grid-row: 1 \/ 3/, 'the shield spans the HP and Poise rows only');
  assert.match(css, /> :is\(\.intent, \.player-action-intent\) \{[^}]*margin: 0 0 0 calc\(var\(--mh-shield-w\) \+ var\(--mh-gap\) \+ var\(--mh-bar-w\) \/ 2\) !important; translate: -50% 0 !important; justify-content: center/, 'the intent control is centred over the HP bar');
  for (const form of FORM_FACTORS) {
    const { tokens } = JSON.parse(read(`content/hud-layout/${form}.json`));
    assert.match(tokens['--hud-mini-bar-width'], /^\d+px$/, `${form} bar width`);
    assert.match(tokens['--hud-mini-bar-height'], /^\d+px$/, `${form} bar height`);
  }
});

// Codex on #2709: a squeezed +N defense overflow must carry how many effects it stands for, so the tray's +N counts them all.
test('the +N defense overflow badge carries the number of effects it hides', () => withKitDom(() => {
  const row = combatHealthRow(hpBar(40, 100), { defense: 0, evasion: 2, ward: 4, precision: 3, counterStacks: 2, reflectStacks: 1 },
    { tooltips: false, persistent: true, poise: poiseBar(0, 0), statuses: null });
  const overflow = row.querySelector('.combat-health-overflow');
  assert.ok(overflow && !overflow.hidden, 'five defense badges overflow');
  // Evade and Ward show; Precision, Counter and Reflect fold into +3.
  assert.equal(overflow.dataset.count, '3');
}));

// Owner 2026-11-12: the bar under HP shows Poise LEFT. The meter counts damage toward a break, so the display inverts it.
test('PoiseBarRemaining inverts the fill: full when untouched, empty at the break, empty trough at 0/0', () => {
  const bar = (cur, max) => ({ id: 'poise', cur, max, pct: max ? (cur / max) * 100 : 0 });
  assert.equal(PoiseBarRemaining(bar(0, 10)).pct, 100);
  assert.equal(PoiseBarRemaining(bar(5, 10)).pct, 50);
  assert.equal(PoiseBarRemaining(bar(10, 10)).pct, 0);
  assert.equal(PoiseBarRemaining(bar(0, 0)).pct, 0);
  const shown = PoiseBarRemaining(bar(3, 10));
  assert.equal(shown.cur, 3, 'cur and max stay the meter own (data-cur, probes and the pulse keep reading them)');
  assert.equal(shown.max, 10);
  // The shown number follows the bar: Poise left, floored at 0.
  assert.equal(PoiseBarRemaining(bar(0, 10)).shownCur, 10);
  assert.equal(PoiseBarRemaining(bar(5, 10)).shownCur, 5);
  assert.equal(PoiseBarRemaining(bar(10, 10)).shownCur, 0);
  assert.equal(PoiseBarRemaining(bar(0, 0)).shownCur, 0);
  assert.equal(PoiseBarRemaining(bar(12, 10)).shownCur, 0);
});

test('resbars print shownCur in the value, tooltip and aria text while data-cur stays cur', () => withKitDom(() => {
  const plan = [{ id: 'poise', name: 'Poise', glyph: '', tint: '#c9a23f', weight: 'skinny', band: null, cur: 0, max: 12, shownCur: 12, pct: 100, lengthPct: 100, domain: 12, labelMax: 12 }];
  const wrap = resourceBars(plan, { surface: 'model', tooltips: false, showLabels: true });
  const html = wrap.outerHTML;
  assert.match(html, /12\/12/, 'the printed value is Poise left');
  assert.doesNotMatch(html, /0\/12/);
  assert.match(html, /Poise 12 of 12/);
  assert.match(wrap.outerHTML, /data-cur="0"/, 'data-cur is the source value');
}));

test('meterInputs applies PoiseBarRemaining to the plan', () => {
  const src = read('src/ui/screens/combat.js');
  assert.match(src, /plan\[poiseAt\] = PoiseBarRemaining\(plan\[poiseAt\]\)/);
});

test('the Poise reader prefers the Core pool (Poise left, drains) and falls back to the fill-up meter', () => {
  const read = RESOURCE_SOURCES.poise.read;
  assert.deepEqual(read({ persistentPoise: { value: 7, max: 12 }, poiseMeter: { value: 0, max: 10 } }, null), { cur: 7, max: 12, drains: true });
  assert.deepEqual(read(null, { persistentPoise: { value: 0, max: 12 } }), { cur: 0, max: 12, drains: true });
  assert.deepEqual(read({ poiseMeter: { value: 3, max: 10 } }, null), { cur: 3, max: 10 });
  assert.equal(read({ persistentPoise: { value: 3, max: 0 } }, {}), null);
  assert.equal(read({}, {}), null);
});

test('PoiseBarRemaining leaves a draining bar as it is; the pulse and inspector row follow each kind', () => {
  const drain = { id: 'poise', cur: 3, max: 12, pct: 25, drains: true };
  const shown = PoiseBarRemaining(drain);
  assert.equal(shown.pct, 25);
  assert.equal(shown.shownCur, 3);
  assert.equal(PoiseNearBreak(drain), true);
  assert.equal(PoiseNearBreak({ ...drain, cur: 4 }), false);
  assert.equal(PoiseNearBreak({ id: 'poise', cur: 9, max: 12 }), true);
  assert.equal(PoiseNearBreak({ id: 'poise', cur: 8, max: 12 }), false);
  assert.equal(PoiseNearBreak({ id: 'poise', cur: 0, max: 0, drains: true }), false);
  assert.deepEqual(PoiseLeft({ persistentPoise: { value: 5, max: 12 } }, {}), { value: 5, max: 12 });
  assert.deepEqual(PoiseLeft({ poiseMeter: { value: 4, max: 10 } }, {}), { value: 6, max: 10 });
});
