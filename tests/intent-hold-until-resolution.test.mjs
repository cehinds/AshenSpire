import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCombatIntentReceipt, flushDeferredIntentClears } from '../src/ui/models/CombatIntentProjectionModel.js';

const known = { kind: 'attack', moveId: 'bite', damage: 7, revealed: true, hidden: false };
const next = { kind: 'attack', moveId: 'claw', damage: 4, revealed: true, hidden: false };
const ents = () => ({ e1: { kind: 'enemy', intentPreview: known } });

test('without deferral a hit clears the intent at once (legacy behaviour)', () => {
  const e = ents();
  applyCombatIntentReceipt(e, { type: 'enemyMoveStarted', sourceId: 'e1' });
  applyCombatIntentReceipt(e, { type: 'damageDealt', sourceId: 'e1' });
  assert.equal(e.e1.intentPreview.kind, 'unknown');
});

test('with deferral the intent stays through the hit until the resolution flush', () => {
  const e = ents(), parked = new Map();
  applyCombatIntentReceipt(e, { type: 'enemyMoveStarted', sourceId: 'e1' }, parked);
  applyCombatIntentReceipt(e, { type: 'damageDealt', sourceId: 'e1' }, parked);
  applyCombatIntentReceipt(e, { type: 'enemyMoveEnded', sourceId: 'e1' }, parked);
  assert.equal(e.e1.intentPreview, known, 'still showing after damage and move end');
  assert.equal(parked.size, 1);
  assert.equal(flushDeferredIntentClears(e, parked), true);
  assert.equal(e.e1.intentPreview.kind, 'unknown');
  assert.equal(parked.size, 0);
  assert.equal(flushDeferredIntentClears(e, parked), false);
});

test('a queued next action replaces the parked clear and shows its own intent', () => {
  const e = ents(), parked = new Map();
  applyCombatIntentReceipt(e, { type: 'enemyMoveStarted', sourceId: 'e1' }, parked);
  applyCombatIntentReceipt(e, { type: 'damageDealt', sourceId: 'e1' }, parked);
  applyCombatIntentReceipt(e, { type: 'enemyActorTurnStarted', sourceId: 'e1', intentPreview: next }, parked);
  assert.equal(parked.size, 0);
  assert.equal(e.e1.intentPreview, next);
  flushDeferredIntentClears(e, parked);
  assert.equal(e.e1.intentPreview, next, 'the next intent survives the earlier action resolving');
});

test('a miss and an evade also wait for resolution', () => {
  for (const type of ['attackMissed', 'attackEvaded']) {
    const e = ents(), parked = new Map();
    applyCombatIntentReceipt(e, { type: 'combatHitStarted', sourceId: 'e1' }, parked);
    applyCombatIntentReceipt(e, { type, sourceId: 'e1' }, parked);
    assert.equal(e.e1.intentPreview, known, type);
    flushDeferredIntentClears(e, parked);
    assert.equal(e.e1.intentPreview.kind, 'unknown', type);
  }
});

test('through the action timeline the intent is still up at the hit apply and clears at the resolution beat', async () => {
  const { runActionTimeline } = await import('../src/ui/actionTimeline.js');
  const events = [{ type: 'enemyMoveStarted', sourceId: 'e1' }, { type: 'damageDealt', sourceId: 'e1', targetId: 'p' }, { type: 'enemyMoveEnded', sourceId: 'e1' }];
  const beat = { actorId: 'e1', kind: 'attack', events };
  const ents = ents_();
  const parked = new Map(), seen = [];
  const timers = new Map(); let nextId = 1;
  const hooks = {
    onApply: b => { for (const e of b.events) applyCombatIntentReceipt(ents, e, parked); seen.push(['apply', ents.e1.intentPreview.kind]); },
    onNumbers: () => seen.push(['numbers', ents.e1.intentPreview.kind]),
    onResolution: () => { flushDeferredIntentClears(ents, parked); seen.push(['resolution', ents.e1.intentPreview.kind]); },
    onSprite: () => ({ impactMs: 0, totalMs: 0, cancel() {} }),
    onDone: () => seen.push(['done']),
  };
  let t = 0;
  const setTimer = (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: t + ms }); return id; };
  const clearTimer = id => timers.delete(id);
  runActionTimeline([beat], hooks, { wordMs: 50, afterSpriteMs: 50, resultMs: 50, reactionMs: 50, damageMs: 50, resetMs: 50, stepMs: 50 }, { setTimer, clearTimer, now: () => t });
  for (let i = 0; i < 200 && timers.size && !seen.some(s => s[0] === 'done'); i++) {
    const [id, row] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    timers.delete(id); t = row.at; row.fn();
  }
  assert.deepEqual(seen.map(s => s.join(':')), ['numbers:attack', 'apply:attack', 'resolution:unknown', 'done']);
});
function ents_() { return { e1: { kind: 'enemy', intentPreview: known } }; }
