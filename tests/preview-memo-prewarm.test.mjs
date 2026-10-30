// Pre-warm: the finish render's quotes are filled in idle time and dropped by any change to the fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createPreviewMemo, fightPrewarmJobs, PREWARM_MIN_IDLE_MS } from '../src/ui/models/PreviewMemoModel.js';

const registries = createRegistries(contentBundle);
function fight() {
  const deck = Array.from({ length: 10 }, (_, i) => ({ instanceId: `c${i}`, cardId: i % 2 ? 'strike' : 'defend', upcastTier: 0, upgraded: false }));
  return createCombat({ registries, rng: createRng(7), enemyIds: ['wanderingSoldier'],
    player: { id: 'p', classId: 'reaver', hp: 400, maxHp: 400, energyMax: 20, maxStamina: 20, stamina: 20, drawPerTurn: 5, relicIds: [], deck } });
}
// A manual idle clock: tests fire callbacks with a chosen budget.
function idleStub() {
  const pending = new Map(); let next = 1; const cancelled = [];
  return { pending, cancelled,
    api: { request: cb => { const h = next++; pending.set(h, cb); return h; }, cancel: h => { cancelled.push(h); pending.delete(h); } },
    // timeRemaining falls 25 ms each time it is read: the entry check, then one read per finished job.
    fire(budget = PREWARM_MIN_IDLE_MS) { const [h, cb] = [...pending][0]; pending.delete(h); let reads = 0; cb({ timeRemaining: () => budget - 25 * reads++, didTimeout: false }); return h; },
    fireStale(cb, budget = 50) { cb({ timeRemaining: () => budget, didTimeout: false }); } };
}
function setup(idle) {
  const combat = fight();
  const calls = { preview: 0, keys: [] };
  const memo = createPreviewMemo({ combat, idle: idle?.api,
    preview: (...args) => { calls.preview += 1; return previewCard(...args); }, dispatch });
  const ranks = new Map();
  const quote = (t, id, tid, r) => memo.previewCard(t, id, tid, r, { rangeRoute: 'advance' });
  const jobs = () => fightPrewarmJobs({ combat, previewCard: quote, projectIntent: (t, id) => memo.memo(`project:${id}`, () => ({ id })), upcastRanks: id => ranks.get(id) });
  return { combat, memo, calls, jobs, quote };
}

test('prewarmed hand quotes are exactly the keys the finish render asks for: zero misses afterwards', () => {
  const idle = idleStub(); const { combat, memo, calls, jobs, quote } = setup(idle);
  assert.equal(memo.prewarm(jobs()), true);
  const total = combat.piles.hand.length + combat.enemies.length;
  for (let i = 0; i < total; i += 1) idle.fire();
  assert.equal(memo.pendingPrewarm, 0);
  const warmed = calls.preview;
  assert.equal(warmed, combat.piles.hand.length);
  // renderHand / cardTargets / takeSnapshot / endTurnHasPlayableCard all ask like this:
  for (const inst of combat.piles.hand) quote(combat, inst.instanceId, undefined, undefined);
  for (const inst of combat.piles.hand) quote(combat, inst.instanceId, undefined, undefined);
  assert.equal(calls.preview, warmed, 'the finish render has 0 misses');
  let computed = 0;
  memo.memo(`project:${combat.enemies[0].id}`, () => { computed += 1; });
  assert.equal(computed, 0, 'the intent projection was kept too');
});

test('one job per callback in a minimal slot, a second only while a whole preview still fits', () => {
  const idle = idleStub(); const { memo, calls, jobs } = setup(idle);
  memo.prewarm(jobs());
  idle.fire();
  assert.equal(calls.preview, 1);
  idle.fire(PREWARM_MIN_IDLE_MS + 25); // reads 49, 24, -1: two jobs
  assert.equal(calls.preview, 3);
});

test('a job is skipped when under the budget, kept, and retried on the next idle', () => {
  const idle = idleStub(); const { memo, calls, jobs } = setup(idle);
  memo.prewarm(jobs());
  const before = memo.pendingPrewarm;
  idle.fire(PREWARM_MIN_IDLE_MS - 1);
  assert.equal(calls.preview, 0);
  assert.equal(memo.pendingPrewarm, before, 'the job stays queued');
  assert.equal(idle.pending.size, 1, 'a retry is scheduled');
  idle.fire(PREWARM_MIN_IDLE_MS);
  assert.equal(calls.preview, 1);
});

test('a dispatch cancels pending jobs and a stale callback never writes into the new fight', () => {
  const idle = idleStub(); const { combat, memo, calls, jobs } = setup(idle);
  memo.prewarm(jobs());
  const staleCb = [...idle.pending.values()][0];
  memo.dispatch(combat, { type: 'endTurn' });
  assert.equal(memo.pendingPrewarm, 0);
  assert.equal(idle.cancelled.length, 1);
  idle.fireStale(staleCb);
  assert.equal(calls.preview, 0, 'the stale job did not run');
  assert.equal(memo.size, 0);
});

test('invalidate cancels and a new prewarm replaces the old queue', () => {
  const idle = idleStub(); const { memo, jobs } = setup(idle);
  memo.prewarm(jobs());
  memo.invalidate();
  assert.equal(memo.pendingPrewarm, 0);
  memo.prewarm(jobs());
  memo.prewarm(jobs());
  assert.equal(idle.pending.size, 1);
});

test('without requestIdleCallback nothing is scheduled and the memo still works', () => {
  const saved = globalThis.requestIdleCallback; delete globalThis.requestIdleCallback;
  try {
    const { combat, memo, calls, jobs, quote } = setup(null);
    assert.equal(memo.prewarm(jobs()), false);
    assert.equal(calls.preview, 0);
    quote(combat, combat.piles.hand[0].instanceId, undefined, undefined);
    assert.equal(calls.preview, 1);
  } finally { if (saved) globalThis.requestIdleCallback = saved; }
});

test('a throwing job does not stop the queue and is not kept', () => {
  const idle = idleStub(); const { memo } = setup(idle);
  let ran = 0;
  memo.prewarm([() => { throw new Error('x'); }, () => { ran += 1; }]);
  idle.fire(); idle.fire();
  assert.equal(ran, 1);
});

test('no jobs once the fight has a result', () => {
  const { combat, jobs } = setup(null);
  combat.result = 'victory';
  assert.deepEqual(jobs(), []);
});
