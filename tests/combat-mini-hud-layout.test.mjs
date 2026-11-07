import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combatHealthRow } from '../src/ui/components/combatHealth.js';
import { meter } from '../src/ui/kit/index.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { FORM_FACTORS } from '../tools/hud-layout-tokens.mjs';

// Owner 2026-11-07 (backlog #11/#4/#5/#6): every combatant's mini HUD is one fixed-width layout: a tall Block shield on the
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
  assert.match(css, /grid-row: 1 \/ 4/, 'the shield spans the HP, Poise and badge rows');
  for (const form of FORM_FACTORS) {
    const { tokens } = JSON.parse(read(`content/hud-layout/${form}.json`));
    assert.match(tokens['--hud-mini-bar-width'], /^\d+px$/, `${form} bar width`);
    assert.match(tokens['--hud-mini-bar-height'], /^\d+px$/, `${form} bar height`);
  }
});
