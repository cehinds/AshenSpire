// SOUND AND HAPTIC follow the number (SPEC §7.4, beatOrder 'sequential'; Codex
// on #1849): a hit's sound and the damage buzz fire reactionMs after the
// reaction starts, with the float; the contact keeps only its spark and slash.
// 'impact' keeps them at the contact.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, setBeatOrder, ANIM_SPEEDS } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { sfx } from '../src/ui/sfx.js';
import { haptic } from '../src/ui/haptics.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const IMPACT = 100, TOTAL = 300;

function drive(t, events, beatOrder) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const trace = [];
  const at = (what) => trace.push({ what, at: Date.now() });
  const oldSfx = sfx.sink, oldHaptic = haptic.sink;
  sfx.sink = (id) => at(`sound:${id}`);
  haptic.sink = (id) => at(`haptic:${id}`);
  try {
    withKitDom((dom) => {
      const el = () => dom.document.createElement('div');
      const anchors = { player: el(), e1: el() };
      for (const anchor of Object.values(anchors)) registerStage(anchor, { play: () => true, hold() { return true; }, settle() {} });
      const layer = el();
      const append = layer.appendChild.bind(layer);
      layer.appendChild = (node) => {
        const cls = String(node.className || '');
        if (/\bfx-(slash|spark)\b/.test(cls)) at('contact');
        if (/\bfloat-num\b/.test(cls)) at(`float:${node.textContent}`);
        return append(node);
      };
      let completed = 0;
      playTimeline(events, { layer, combatEl: el(), beatOrder, anchorFor: (id) => anchors[id] || null,
        animateActor: () => ({ impactMs: IMPACT, totalMs: TOTAL, hold() {}, cancel() {} }),
        onBeatApplied() {}, onFlush() {} }, () => completed++);
      for (let i = 0; i < 4000 && !completed; i++) t.mock.timers.tick(1);
      assert.equal(completed, 1);
    });
  } finally { sfx.sink = oldSfx; haptic.sink = oldHaptic; setAnimSpeed('normal'); setBeatOrder('sequential'); }
  return trace;
}

const timeOf = (trace, pred) => trace.find((e) => pred(e.what))?.at;
const enemyHit = (amount, blocked = 0) => [{ type: 'enemyMoveStarted', sourceId: 'e1', kind: 'attack' },
  { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount, blocked }];
const isHitSound = (w) => /^sound:(hit_|playerHurt)/.test(w);

test('sequential: the hit sound and the damage buzz fire with the number, not at contact', (t) => {
  const trace = drive(t, enemyHit(6), 'sequential');
  const number = timeOf(trace, (w) => w === 'float:-6');
  assert.equal(timeOf(trace, (w) => w === 'contact'), IMPACT, 'the slash stays at the contact');
  assert.equal(number, TOTAL + 60 + ANIM_SPEEDS.normal.reactionMs, 'the number waits reactionMs after the reaction');
  assert.equal(timeOf(trace, isHitSound), number, 'the hit sound comes with the number');
  assert.equal(timeOf(trace, (w) => w === 'haptic:damageTaken'), number, 'so does the damage buzz');
  assert.ok(!trace.some((e) => e.at < number && (isHitSound(e.what) || e.what === 'haptic:damageTaken')), 'nothing sounds at the contact');
});

test('sequential: a guarded hit\'s block sound comes with its number', (t) => {
  const trace = drive(t, enemyHit(5, 5), 'sequential');
  assert.equal(timeOf(trace, (w) => w === 'sound:block'), timeOf(trace, (w) => w === 'float:5'));
  assert.equal(timeOf(trace, (w) => w === 'contact'), IMPACT, 'the spark stays at the contact');
});

test('impact: the hit sound and the damage buzz stay at the contact', (t) => {
  const trace = drive(t, enemyHit(6), 'impact');
  assert.equal(timeOf(trace, isHitSound), IMPACT);
  assert.equal(timeOf(trace, (w) => w === 'haptic:damageTaken'), IMPACT);
});

test('sequential: an attack card\'s heal and Block sounds come with their numbers', (t) => {
  const trace = drive(t, [{ type: 'cardPlayed', sourceId: 'player', cardId: 'x', cardType: 'attack' },
    { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 4, blocked: 0 },
    { type: 'healed', targetId: 'player', amount: 3 },
    { type: 'blockGained', targetId: 'player', amount: 5 }], 'sequential');
  assert.equal(timeOf(trace, (w) => w === 'sound:heal'), timeOf(trace, (w) => w === 'float:+3'), 'heal sound with its number');
  assert.equal(timeOf(trace, (w) => w === 'sound:block'), timeOf(trace, (w) => w === 'float:+5'), 'block sound with its number');
});
