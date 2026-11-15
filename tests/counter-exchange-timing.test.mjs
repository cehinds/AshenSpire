// COUNTER EXCHANGE PACING (owner, 2026-11-14): "the counter is super slow ... it should do the counter animation simultaneously
// with the floaters, and then the hit/miss then reaction with damage floaters ... the time between floater and animation needs to
// be reduced to about 75ms". The gap is motion.counter.floaterToAnimMs (content/config/ui/presentation/actionPacing.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playTimeline, groupBeats, setAnimSpeed, ANIM_SPEEDS } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { CounterExchangeRoles } from '../src/ui/models/CounterExchangeModel.js';
import { withKitDom } from './helpers/dom.mjs';
import { setCombatPacing, actionPacing } from '../src/ui/animationPace.js';
import { setFloaterPolicyEnabled } from '../src/ui/models/FloaterPolicyModel.js';
import { ACTION_PACING } from '../src/model/autoCombatPolicy.js';
setFloaterPolicyEnabled(false);

const IMPACT = 100, TOTAL = 300;
const player = 'player', e1 = 'e1';
// The player answers an enemy attack with Counter; the attack lands on its Block; the Counter returns.
const playerCounter = () => [
  { type: 'combatContactPrepared', sourceId: e1, contactPrepared: true },
  { type: 'cardPlayed', cardType: 'attack', cardId: 'core.counter', cardInstanceId: 'c1', sourceId: player, targetId: e1 },
  { type: 'blockGained', targetId: player, amount: 5 },
  { type: 'enemyMoveStarted', sourceId: e1, kind: 'attack', contactPrepared: true },
  { type: 'attackHit', sourceId: e1, targetId: player },
  { type: 'damageDealt', sourceId: e1, targetId: player, amount: 5, blocked: 5 },
  { type: 'combatCounterTriggered', sourceId: player, sourceKind: 'player', targetId: e1 },
  { type: 'attackHit', sourceId: player, targetId: e1 },
  { type: 'damageDealt', sourceId: player, targetId: e1, amount: 3, blocked: 0 },
];
// The enemy answers the player's attack with its own Counter.
const enemyCounter = () => [
  { type: 'cardPlayed', cardType: 'attack', cardId: 'strike', cardInstanceId: 'c1', sourceId: player, targetId: e1 },
  { type: 'attackHit', sourceId: player, targetId: e1 },
  { type: 'damageDealt', sourceId: player, targetId: e1, amount: 4, blocked: 0 },
  { type: 'combatCounterTriggered', sourceId: e1, sourceKind: 'enemy', targetId: player },
  { type: 'attackHit', sourceId: e1, targetId: player },
  { type: 'damageDealt', sourceId: e1, targetId: player, amount: 3, blocked: 0 },
];

test('the Counter gap is the named constant, 75 ms at the default Combat speed', () => {
  assert.equal(ACTION_PACING.counter.floaterToAnimMs, 75);
  setCombatPacing({}); setAnimSpeed('normal');
  assert.equal(actionPacing().counterGapMs, 75);
  assert.equal(actionPacing({ enemy: true }).counterGapMs, 75, 'the same gap in the enemies\' turn');
  assert.equal(actionPacing({ reduced: true }).counterGapMs, 0, 'Reduced motion removes the wait');
  setCombatPacing({ combatSpeed: 2.5 });
  assert.ok(actionPacing().counterGapMs < 75, 'a faster setting is still faster');
  setCombatPacing({});
  // The wait comes from the config, not a literal in the pacing code.
  assert.match(readFileSync(new URL('../src/ui/animationPace.js', import.meta.url), 'utf8'), /ACTION_PACING\.counter\.floaterToAnimMs/);
});

test('roles: the card, the hit it answers and the return are one exchange; the enemy opening is not', () => {
  const beats = groupBeats(playerCounter());
  const roles = CounterExchangeRoles(beats);
  const kinds = beats.map((beat) => roles.get(beat) || null);
  assert.deepEqual(kinds, [null, 'card', 'hit', 'return'], beats.map((b) => `${b.kind}:${b.actorId}`).join(' '));
  const enemy = groupBeats(enemyCounter());
  const enemyRoles = CounterExchangeRoles(enemy);
  assert.deepEqual(enemy.map((beat) => enemyRoles.get(beat) || null), ['hit', 'return'], 'the player\'s attack is the hit an enemy Counter answers; no card');
  assert.equal(CounterExchangeRoles(groupBeats([enemyCounter()[0], enemyCounter()[1], enemyCounter()[2]])).size, 0, 'no Counter, no exchange');
});

function drive(t, events, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  setCombatPacing({}); setAnimSpeed('normal');
  withKitDom((dom) => {
    const trace = [];
    const at = (what) => trace.push({ what, at: Date.now() });
    const el = (id) => { const e = dom.document.createElement('div'); e.className = 'sprite'; e.id = id; return e; };
    const anchors = { player: el('player'), e1: el('e1') };
    for (const [id, anchor] of Object.entries(anchors)) registerStage(anchor, { play: (pose) => { at(`pose:${pose}:${id}`); return true; }, hold() { return true; }, settle() {} });
    const layer = dom.document.createElement('div');
    const append = layer.appendChild.bind(layer);
    layer.appendChild = (node) => {
      const cls = String(node.className || '');
      if (/\bfloat-num\b/.test(cls)) at(`float:${node.textContent}`);
      if (/\bfx-callout\b/.test(cls)) at(`word:${node.dataset.calloutKind}@${node.dataset.calloutFor}`);
      return append(node);
    };
    let completed = 0;
    const ctx = { layer, combatEl: dom.document.createElement('div'), anchorFor: (id) => anchors[id] || null,
      animateActor: (beat) => { at(`swing:${beat.actorId}`); return { impactMs: IMPACT, totalMs: TOTAL, hold() {}, cancel() {} }; },
      onStage: (name, beat) => at(`stage:${name}:${beat.actorId}`), onBeatApplied() {}, onFlush() {} };
    playTimeline(events, ctx, () => completed++);
    for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1);
    assert.equal(completed, 1, 'the timeline completes');
    try { fn({ trace, at: (what) => trace.filter((e) => e.what === what).map((e) => e.at) }); } finally { setAnimSpeed('normal'); }
  });
}

test('the Counter card animates at once; the hit, then the return, each follow by one Counter gap', (t) => {
  drive(t, playerCounter(), ({ trace, at }) => {
    const G = actionPacing().counterGapMs;
    const names = trace.map((e) => e.what);
    // (1) the card: cost, word, stance and animation start together (no intent or word wait).
    const [intent] = at('stage:intent:player'), [swing] = at('swing:player');
    assert.ok(swing - intent <= 2, `the Counter animation starts with its floaters (${swing - intent} ms after them)`);
    // (2) the hit it answers (the enemy's, on the Block), (3) then the return: hit word, reaction, damage floater.
    const firstResult = at('stage:result:player')[0], firstReaction = at('stage:reaction:player')[0], firstDamage = at('stage:damage:player')[0];
    assert.equal(firstReaction - firstResult, G, 'result -> reaction is one Counter gap');
    assert.equal(firstDamage - firstReaction, G, 'reaction -> damage is one Counter gap');
    const order = ['stage:intent:player', 'swing:player', 'stage:result:player', 'stage:damage:player', 'swing:e1'];
    // the enemy's hit on the Block comes before the Counter return, and the return's damage floater is last.
    assert.ok(names.indexOf('stage:result:e1') > names.indexOf('stage:result:player'), order.join(' < '));
    assert.ok(names.lastIndexOf('float:-3') > names.indexOf('stage:result:e1'), 'the return\'s damage floater comes after the enemy hit resolved');
    // every number is still shown: the return's red number appears once.
    assert.equal(names.filter((n) => n === 'float:-3').length, 1);
  });
});

test('a Counter exchange is at least 50% shorter than the old sequence', (t) => {
  // Old stage waits were five gaps of 400 ms at the default pace plus the intent and word leads (owner's 9.7 s measurement).
  drive(t, playerCounter(), ({ trace }) => {
    const end = Math.max(...trace.map((e) => e.at));
    const G = 400;
    const oldGaps = 2 * G /* lead */ + 5 * G /* after sprite .. reset */;
    const oldSequence = 3 * (oldGaps + TOTAL);
    assert.ok(end <= oldSequence / 2, `${end} ms vs ${oldSequence} ms`);
  });
});
