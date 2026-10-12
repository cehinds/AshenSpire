// INSTANT / REDUCED-MOTION SKIP ignores read-only controls (Codex on #1849):
// animateEvents' click-skip, like playTimeline's, must not flush when the
// pointerdown lands inside [data-combat-read-only] (the combat log, the
// Reaction switch). Anywhere else, a click still skips.

import test from 'node:test';
import assert from 'node:assert/strict';
import { animateEvents } from '../src/ui/fx.js';
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

test('a pointerdown inside [data-combat-read-only] during animateEvents does not flush', (t) => {
  const floats = run(t, (dom) => {
    const tools = dom.document.createElement('aside');
    tools.setAttribute('data-combat-read-only', '');
    const toggle = dom.document.createElement('button');
    tools.append(toggle);
    return toggle;
  });
  assert.deepEqual(floats, ['+1', '+2', '+3', '+4'], 'every float still plays');
});

test('a pointerdown elsewhere still skips the rest', (t) => {
  const floats = run(t, (dom) => dom.document.createElement('div'));
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
