// INSTANT / REDUCED-MOTION SKIP ignores read-only controls (Codex on #1849):
// animateEvents' click-skip, like playTimeline's, must not flush when the
// pointerdown lands inside [data-combat-read-only] (the combat log, the
// Reaction switch). Anywhere else, a click still skips.

import test from 'node:test';
import assert from 'node:assert/strict';
import { animateEvents } from '../src/ui/fx.js';
import { renderQuickMenu } from '../src/ui/components/menuComponents.js';
import { quickAccessPanelHtml } from '../src/ui/components/hudmeta.js';
import { quickMenuPanelModel } from '../src/ui/models/MenuModels.js';
import { quickAccessPanelModel } from '../src/ui/models/QuickAccessPanelModel.js';
import { withKitDom } from './helpers/kit-dom.mjs';

function run(t, clickTarget) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const floats = [];
  withKitDom((dom) => {
    const anchor = dom.document.createElement('div');
    const layer = dom.document.createElement('div');
    const append = layer.appendChild.bind(layer);
    layer.appendChild = (node) => { if (/\bfloat-num\b/.test(String(node.className))) floats.push(node.textContent); return append(node); };
    const events = [1, 2, 3, 4].map((amount) => ({ type: 'blockGained', targetId: 'player', amount }));
    let done = 0;
    animateEvents(events, { layer, combatEl: dom.document.createElement('div'), anchorFor: () => anchor }, () => done++);
    const target = clickTarget(dom);
    globalThis.dispatchEvent(new dom.Event('pointerdown', { target }));
    for (let i = 0; i < 1000 && !done; i++) t.mock.timers.tick(10);
    assert.equal(done, 1);
  });
  return floats;
}

function renderMenuRow(dom, act) {
  const { veil, panel } = renderQuickMenu(quickMenuPanelModel({
    context: 'combat', mode: 'mirror', caption: 'Menu',
    rows: [{ act, icon: act === 'console' ? 'historic-eye' : 'inventory', label: act === 'console' ? 'Console' : 'Inventory', tip: 'Test row' }],
  }), { onActivate() {} });
  dom.document.body.append(veil);
  return panel.querySelector(`.qn-row[data-act="${act}"]`);
}

function renderCombatMenuLauncher(dom) {
  const model = quickAccessPanelModel({ armouryId: 'combat-armoury', menuId: 'combat-menu', menuHint: 'Menu' });
  const host = dom.document.createElement('div');
  host.innerHTML = quickAccessPanelHtml(model);
  return host.querySelector('#combat-menu');
}

test('the rendered Console row does not flush animateEvents on pointerdown', (t) => {
  const floats = run(t, (dom) => {
    const row = renderMenuRow(dom, 'console');
    assert.ok(row.hasAttribute('data-combat-read-only'));
    const label = row.querySelector('.qn-label');
    assert.ok(label, 'the renderer returns the Console label inside its marked row');
    return label;
  });
  assert.deepEqual(floats, ['+1', '+2', '+3', '+4'], 'every float still plays');
});

test('the rendered combat Menu launcher does not flush animateEvents on pointerdown', (t) => {
  const floats = run(t, (dom) => {
    const button = renderCombatMenuLauncher(dom);
    assert.ok(button, 'the HUD renderer returns the combat launcher');
    assert.ok(button.hasAttribute('data-combat-read-only'));
    return button;
  });
  assert.deepEqual(floats, ['+1', '+2', '+3', '+4'], 'opening the launcher leaves the playback backlog intact');
});

test('a rendered mutating quick-menu row remains eligible to skip', (t) => {
  const floats = run(t, (dom) => {
    const row = renderMenuRow(dom, 'inventory');
    assert.ok(!row.hasAttribute('data-combat-read-only'));
    return row;
  });
  assert.ok(floats.length < 4, 'the skip flushed the backlog');
});

test('a callout between hits never pulls the next hit into the same Instant tick (crit multi-hit steps per hit)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom((dom) => {
    const anchor = dom.document.createElement('div');
    const layer = dom.document.createElement('div');
    const floats = [];
    const append = layer.appendChild.bind(layer);
    layer.appendChild = (node) => { if (/\bfloat-num\b/.test(String(node.className))) floats.push(node.textContent); return append(node); };
    const hit = (amount) => [{ type: 'critHit', sourceId: 'enemy', targetId: 'player' },
      { type: 'damageDealt', sourceId: 'enemy', targetId: 'player', amount, isAttack: true }];
    let done = 0;
    animateEvents([...hit(3), ...hit(4), ...hit(5)], { layer, combatEl: dom.document.createElement('div'), anchorFor: () => anchor }, () => done++);
    assert.equal(floats.length, 1, `first tick plays one hit, not ${floats.length}`);
    for (let i = 0; i < 1000 && !done; i++) t.mock.timers.tick(10);
    assert.equal(done, 1);
    assert.equal(floats.length, 3, 'every hit still plays its float');
  });
});
