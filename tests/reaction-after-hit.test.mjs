// Owner 2026-11-07, an enemy attack the player can react to: "do reaction prompt and calculations before hit/miss, then
// show hit or miss, then show reaction animation". On screen: Hit/Miss word -> the chosen reaction card's animation ->
// damage numbers. The engine logs the reaction card's receipts before the attack's, so fx.js splits the attack beat at
// its accuracy receipt (reactionAfterResult). Drives the shipped playTimeline under mocked timers, as beat-order does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, groupBeats, setAnimSpeed, setBeatOrder } from '../src/ui/fx.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { setCombatPacing as pinCombatPacing } from '../src/ui/animationPace.js';
pinCombatPacing({ combatSpeed: 1 });

const reaction = [
  { type: 'combatReactionChosen', offerId: 'o1', optionId: 'gp5:0:default' },
  { type: 'cardPreparing', cardId: 'core.defend', sourcePlayerId: 'player' },
  { type: 'staminaSpent', amount: 1 },
  { type: 'cardPlayed', cardId: 'core.defend', cardType: 'defense', cardInstanceId: 'c1', sourcePlayerId: 'player' },
  { type: 'blockGained', sourceId: 'player', targetId: 'player', amount: 14 },
  { type: 'cardResolved', cardId: 'core.defend' },
];
const move = { type: 'enemyMoveStarted', sourceId: 'e1', moveId: 'slash', kind: 'attack', contactPrepared: true };

function drive(t, events, fn) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  withKitDom(dom => {
    const timeline = [];
    const at = what => timeline.push({ what, at: Date.now() });
    const mk = id => { const e = dom.document.createElement('div'); e.className = 'sprite'; e.id = id; return e; };
    const anchors = { player: mk('player'), e1: mk('e1') };
    const layer = dom.document.createElement('div');
    const append = layer.appendChild.bind(layer);
    layer.appendChild = node => {
      const cls = String(node.className || '');
      if (/\bfx-callout\b/.test(cls)) at(`word:${node.dataset.calloutKind}`);
      if (/\bfloat-num\b/.test(cls)) at(`float:${node.textContent}`);
      return append(node);
    };
    const ctx = { layer, combatEl: dom.document.createElement('div'), anchorFor: id => anchors[id] || null,
      // The player's card beat is the reaction animation; the enemy's own swing was already played before the prompt.
      animateActor: beat => { at(`anim:${beat.actorId}`); return { impactMs: 100, totalMs: 300, hold() {}, cancel() {} }; },
      onBeatApplied() {}, onFlush() {} };
    let done = 0;
    playTimeline(events, ctx, () => done++);
    try {
      for (let i = 0; i < 40000 && !done; i++) t.mock.timers.tick(1);
      assert.equal(done, 1, 'the timeline completes');
      fn(timeline);
    } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
  });
}
const when = (timeline, what) => timeline.find(row => row.what === what)?.at;

test('a chosen reaction plays after the Hit word and before the damage number', t => {
  const events = [...reaction, move, { type: 'attackHit', sourceId: 'e1', targetId: 'player' },
    { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 5, blocked: 0 }, { type: 'enemyMoveEnded', sourceId: 'e1' }];
  drive(t, events, timeline => {
    const hit = when(timeline, 'word:hit'), anim = when(timeline, 'anim:player'), dmg = when(timeline, 'float:−5') ?? timeline.find(r => /^float:.*5$/.test(r.what) && r.what !== 'float:−1 SP')?.at;
    assert.ok(hit != null && anim != null && dmg != null, JSON.stringify(timeline));
    assert.ok(hit < anim, `Hit word (${hit}) precedes the reaction animation (${anim})`);
    assert.ok(anim < dmg, `the reaction animation (${anim}) precedes the damage number (${dmg})`);
    assert.equal(timeline.filter(r => r.what === 'word:hit').length, 1, 'the Hit word shows once');
  });
});

test('a dodge turning the hit into a Miss: Miss word, then the reaction animation, then DODGED, no damage', t => {
  const events = [...reaction, move, { type: 'attackMissed', sourceId: 'e1', targetId: 'player', missReason: 'accuracy', evadeActive: true },
    { type: 'enemyMoveEnded', sourceId: 'e1' }];
  drive(t, events, timeline => {
    const miss = when(timeline, 'word:missed'), anim = when(timeline, 'anim:player'), dodged = when(timeline, 'word:dodged');
    assert.ok(miss != null && anim != null && dodged != null, JSON.stringify(timeline));
    assert.ok(miss < anim && anim < dodged, `Miss ${miss} < animation ${anim} < Dodged ${dodged}`);
    assert.equal(timeline.filter(r => r.what === 'word:missed').length, 1);
    assert.ok(!timeline.some(r => /^float:/.test(r.what) && !/SP/.test(r.what) && !/14/.test(r.what)), 'no damage number');
  });
});

test('a declined reaction (no card played) keeps the attack beat whole', () => {
  const events = [{ type: 'combatReactionChosen', offerId: 'o1', optionId: null }, move, { type: 'attackHit', sourceId: 'e1', targetId: 'player' },
    { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 5, blocked: 0 }];
  const beats = groupBeats(events);
  assert.equal(beats.filter(beat => beat.actorId === 'e1').length, 1);
  assert.ok(!beats.some(beat => beat.resultSaid));
});
