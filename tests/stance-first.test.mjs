// STANCE FIRST across stage contracts (SPEC §7.4 sequential beat order; Codex
// review on #1849). An attacker caught out of its stance settles and waits
// stanceLeadMs before it swings, whichever stage shape draws it: the painted
// outfit (presentation.pose/rest/transition), the enemy pose stage (pose/rest
// getters), the alternative card stage (presentation.action), or an expansion
// stage that only has settle()/play() — which settles but is never waited for.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, setBeatOrder, ANIM_SPEEDS, stanceState } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/kit-dom.mjs';

test('stanceState reads each stage contract', () => {
  assert.equal(stanceState(null), 'in');
  assert.equal(stanceState({ presentation: { action: 'attack' } }), 'out', 'alternative card stage mid-action');
  assert.equal(stanceState({ presentation: { action: undefined, pose: 'hit', rest: 'idle' } }), 'in', 'its action field decides');
  assert.equal(stanceState({ presentation: { rest: 'idle', pose: 'hit', transition: null } }), 'out', 'painted outfit in a hurt pose');
  assert.equal(stanceState({ presentation: { rest: 'idle', pose: 'idle', transition: null } }), 'in', 'painted outfit at rest');
  assert.equal(stanceState({ presentation: { rest: 'guard', pose: 'guard', transition: { from: 'idle', to: 'guard' } } }), 'out', 'mid stance transition');
  assert.equal(stanceState({ get pose() { return 'hit'; }, get rest() { return 'idle'; } }), 'out', 'enemy pose stage');
  assert.equal(stanceState({ get pose() { return 'idle'; }, get rest() { return 'idle'; } }), 'in');
  assert.equal(stanceState({ settle() {}, play() { return true; } }), 'unknown', 'an expansion stage cannot tell');
});

function swingAt(t, stage) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let swing = null, settled = 0, completed = 0;
  withKitDom((dom) => {
    const anchor = dom.document.createElement('div');
    const e1 = dom.document.createElement('div');
    registerStage(anchor, { ...stage, settle: () => { settled++; stage.settle?.(); } , play: () => true, hold() {} });
    registerStage(e1, { play: () => true, hold() {}, settle() {} });
    try {
      playTimeline([{ type: 'cardPlayed', cardType: 'attack', cardId: 's', cardInstanceId: 'c', targetId: 'e1' },
        { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 3, blocked: 0 }], {
        layer: dom.document.createElement('div'), combatEl: dom.document.createElement('div'),
        anchorFor: (id) => (id === 'player' ? anchor : e1),
        animateActor: () => { swing ??= Date.now(); return { impactMs: 100, totalMs: 300, hold() {}, cancel() {} }; },
        onBeatApplied() {}, onFlush() {},
      }, () => completed++);
      for (let i = 0; i < 4000 && !completed; i++) t.mock.timers.tick(1);
    } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
  });
  assert.equal(completed, 1);
  return { swing, settled };
}

test('a painted outfit caught in a hurt pose settles and waits stanceLeadMs', (t) => {
  const { swing, settled } = swingAt(t, { get presentation() { return { rest: 'idle', pose: 'hit', transition: null }; } });
  assert.equal(settled, 1);
  assert.equal(swing, ANIM_SPEEDS.normal.stanceLeadMs);
});

test('a painted outfit at rest swings at once', (t) => {
  const { swing, settled } = swingAt(t, { get presentation() { return { rest: 'idle', pose: 'idle', transition: null }; } });
  assert.equal(settled, 0);
  assert.equal(swing, 0);
});

test('an expansion stage with only settle/play settles, and nothing waits for it', (t) => {
  const { swing, settled } = swingAt(t, {});
  assert.equal(settled, 1, 'settle() is still called');
  assert.equal(swing, 0, 'no stance lead for a stage that cannot tell');
});
