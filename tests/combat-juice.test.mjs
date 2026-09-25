// SPEC §7.4 combat juice — the DECISIONS behind hit-stop, kill cam and the
// continuous damage-number scale. Headless: CombatJuiceModel is pure, and
// every expectation is read through the authored config, never restated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_JUICE, damageTier, damageNumberScale, hitStopMs, hitStopForEvent,
  killCamGatesOpen, killCamPlan, pickKillCam, rankForStature, maxKillCamMs,
} from '../src/ui/models/CombatJuiceModel.js';

const T = COMBAT_JUICE.sizing.damageTiers;
const H = COMBAT_JUICE.motion.hitStop;
const K = COMBAT_JUICE.motion.killCam;
const OPEN = { paced: true, reducedMotion: false, killCam: true };
const hit = (amount, blocked = 0) => ({ type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount, blocked });
const died = (targetId) => ({ type: 'enemyDied', targetId, enemyId: targetId });

test('damage tiers keep the four float classes at their authored thresholds', () => {
  assert.equal(damageTier(0), 'chip');
  assert.equal(damageTier(T.chipBelow - 1), 'chip');
  assert.equal(damageTier(T.chipBelow), 'normal');
  assert.equal(damageTier(T.heavyAt - 1), 'normal');
  assert.equal(damageTier(T.heavyAt), 'heavy');
  assert.equal(damageTier(T.critAt - 1), 'heavy');
  assert.equal(damageTier(T.critAt), 'crit');
  assert.equal(damageTier(-5), 'chip', 'garbage reads as no damage');
  assert.equal(damageTier('nope'), 'chip');
});

test('damage numbers grow continuously inside a tier and clamp at the cap', () => {
  const S = COMBAT_JUICE.sizing.damageScale;
  assert.equal(damageNumberScale(0), 1, 'zero edge');
  assert.equal(damageNumberScale(T.chipBelow - 1), 1, 'chip never scales');
  for (const [lo, top, boost] of [[T.chipBelow, T.heavyAt - 1, S.normalBoost], [T.heavyAt, T.critAt - 1, S.heavyBoost], [T.critAt, T.capAt, S.critBoost]]) {
    assert.equal(damageNumberScale(lo), 1, `tier floor ${lo} is the plain tier size`);
    assert.equal(damageNumberScale(top), Math.round((1 + boost) * 1000) / 1000, `tier top ${top} carries the whole boost`);
    let prev = 0;
    for (let a = lo; a <= top; a++) {
      const s = damageNumberScale(a);
      assert.ok(s >= prev, `${a} is not smaller than ${a - 1}`);
      prev = s;
    }
  }
  assert.equal(damageNumberScale(T.capAt * 10), damageNumberScale(T.capAt), 'overflow clamps at capAt');
});

test('only heavy and crit residual hits stop time, ramping inside 40–120 ms', () => {
  assert.equal(hitStopMs(0), 0);
  assert.equal(hitStopMs(T.heavyAt - 1), 0, 'a normal hit never stops');
  assert.equal(hitStopMs(T.heavyAt), H.minMs, 'the first heavy hit stops for minMs');
  assert.equal(hitStopMs(T.critAt), H.critMs, 'the first crit stops for critMs');
  assert.equal(hitStopMs(T.capAt), H.maxMs);
  assert.equal(hitStopMs(T.capAt * 20), H.maxMs, 'overflow clamps at maxMs');
  let prev = 0;
  for (let a = T.heavyAt; a <= T.capAt; a++) {
    const ms = hitStopMs(a);
    assert.ok(ms >= prev && ms >= H.minMs && ms <= H.maxMs, `${a} → ${ms} ms, monotone and bounded`);
    prev = ms;
  }
  assert.ok(H.minMs >= 40 && H.maxMs <= 120, 'the authored bounds honour SPEC §7.4');
});

test('which events hit-stop: residual damage and Stagger, never guarded damage', () => {
  assert.equal(hitStopForEvent(hit(T.critAt)), H.critMs);
  assert.equal(hitStopForEvent(hit(T.critAt, T.critAt)), 0, 'fully guarded: no residual, no stop');
  assert.equal(hitStopForEvent(hit(T.critAt, T.critAt - T.heavyAt + 1)), 0, 'guard pulls the residual under heavy');
  assert.equal(hitStopForEvent(hit(T.critAt, T.critAt * 3)), 0, 'overblocked is clamped, not negative');
  assert.equal(hitStopForEvent({ type: 'enemyStaggered', targetId: 'e1' }), H.staggerMs);
  for (const type of ['hpLost', 'healed', 'blockGained', 'enemyDied', 'procBurst']) {
    assert.equal(hitStopForEvent({ type, amount: 99 }), 0, `${type} never stops`);
  }
  assert.equal(hitStopForEvent(null), 0);
});

test('hit-stop is off in reduced motion and outside paced playback', () => {
  assert.equal(hitStopForEvent(hit(T.capAt), { reducedMotion: true }), 0);
  assert.equal(hitStopForEvent(hit(T.capAt), { paced: false }), 0, 'instant animation speed');
  assert.equal(hitStopForEvent({ type: 'enemyStaggered' }, { reducedMotion: true }), 0);
});

test('kill cam: elites and bosses by stature, the winning blow by config', () => {
  assert.equal(rankForStature('huge'), 'boss');
  assert.equal(rankForStature('large'), 'elite');
  assert.equal(rankForStature('normal'), null);
  assert.equal(rankForStature(undefined), null);
  assert.equal(killCamPlan({ rank: 'boss' }, OPEN).ms, K.bossMs);
  assert.equal(killCamPlan({ rank: 'elite' }, OPEN).ms, K.eliteMs);
  assert.equal(killCamPlan({ rank: null }, OPEN), null, 'a normal enemy mid-fight gets none');
  const last = killCamPlan({ rank: null, lastEnemy: true }, OPEN);
  assert.equal(last && last.reason, COMBAT_JUICE.behavior.killCam.lastEnemy ? 'lastEnemy' : undefined);
  const off = { ...COMBAT_JUICE, behavior: { killCam: { ...COMBAT_JUICE.behavior.killCam, lastEnemy: false } } };
  assert.equal(killCamPlan({ rank: null, lastEnemy: true }, OPEN, off), null, 'lastEnemy: false turns the winning-blow cam off');
  const plan = killCamPlan({ rank: 'boss' }, OPEN);
  assert.ok(plan.slowRate > 0 && plan.slowRate < 1, 'slow motion is slower, never stopped or reversed');
  assert.ok(plan.zoom > 1, 'the camera zooms in');
  for (const ms of [K.bossMs, K.eliteMs, K.lastEnemyMs]) assert.ok(ms >= 600 && ms <= 900, `${ms} ms sits in SPEC's 600–900 ms`);
  assert.equal(maxKillCamMs(), Math.max(K.bossMs, K.eliteMs, K.lastEnemyMs));
});

test('every kill-cam gate closes it: reduced motion, its toggle, instant speed — and only those', () => {
  assert.equal(killCamGatesOpen(OPEN), true);
  assert.equal(killCamGatesOpen({}), true, 'a sparse store reads as defaults (on)');
  for (const [k, v] of [['reducedMotion', true], ['killCam', false], ['paced', false]]) {
    const gates = { ...OPEN, [k]: v };
    assert.equal(killCamGatesOpen(gates), false, `${k}=${v}`);
    assert.equal(killCamPlan({ rank: 'boss' }, gates), null, `${k}=${v} → no boss cam`);
    assert.equal(pickKillCam([died('b')], { rankOf: () => 'boss', won: true }, gates), null, `${k}=${v} → nothing picked`);
  }
  // Screen shake is its own switch: turning the kick off leaves the kill cam on.
  assert.equal(killCamGatesOpen({ ...OPEN, screenShake: false }), true, 'Screen shake off does not close the kill cam');
  assert.equal(killCamPlan({ rank: 'boss' }, { ...OPEN, screenShake: false }).reason, 'boss');
});

test('pickKillCam: one per dispatch, boss > elite > winning blow, latest wins ties', () => {
  const ranks = { n1: null, n2: null, el: 'elite', el2: 'elite', bo: 'boss' };
  const rankOf = (id) => ranks[id];
  assert.equal(pickKillCam([], { rankOf }, OPEN), null, 'empty log');
  assert.equal(pickKillCam([hit(30)], { rankOf }, OPEN), null, 'no deaths');
  assert.equal(pickKillCam([died('n1')], { rankOf, won: false }, OPEN), null, 'a normal kill that does not end the fight');
  assert.equal(pickKillCam([died('n1'), died('n2')], { rankOf, won: true }, OPEN).event.targetId, 'n2',
    'the winning blow is the LAST death of a won dispatch');
  const log = [died('n1'), died('bo'), died('el'), died('n2')];
  const picked = pickKillCam(log, { rankOf, won: true }, OPEN);
  assert.equal(picked.event, log[1], 'the boss outranks a later elite and the winning blow');
  assert.equal(picked.plan.reason, 'boss');
  assert.equal(pickKillCam([died('el'), died('el2')], { rankOf }, OPEN).event.targetId, 'el2', 'tie → latest');
  assert.equal(pickKillCam([died('el'), died('n2')], { rankOf, won: true }, OPEN).event.targetId, 'el', 'elite > winning blow');
  assert.equal(pickKillCam('nope', { rankOf }, OPEN), null, 'garbage log');
});

// ---- the stage clock: hit-stop reaches JS-timer painted poses -------------
import { stageTimeout, clearStageTimeout, freezeStageTimers, setStageClock, pendingStageSteps } from '../src/ui/services/stageClock.js';

function fakeClock() {
  let now = 0, seq = 0;
  const due = new Map();
  return {
    set: (fn, ms) => { const id = ++seq; due.set(id, { fn, at: now + ms }); return id; },
    clear: (id) => { due.delete(id); },
    now: () => now,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...due.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        due.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
  };
}
const figure = (...kids) => ({ contains: (el) => kids.includes(el) });

test('a frozen figure holds its painted frame steps and resumes each with its remainder', () => {
  const fake = fakeClock();
  const prev = setStageClock(fake);
  try {
    const host = {}, other = {};
    const fired = [];
    stageTimeout(host, () => fired.push(['host', fake.now()]), 100);
    stageTimeout(other, () => fired.push(['other', fake.now()]), 100);
    fake.advance(40);
    freezeStageTimers([figure(host)], 80);
    fake.advance(70); // t=110: the unfrozen figure's step fires on time
    assert.deepEqual(fired, [['other', 100]]);
    fake.advance(100); // released at t=120, 60 ms were left → fires at 180
    assert.deepEqual(fired, [['other', 100], ['host', 180]], 'delayed by exactly the hold');
    assert.equal(pendingStageSteps(), 0);
  } finally { setStageClock(prev); }
});

test('stage clock edges: zero hold, steps scheduled mid-freeze, cancel, early release', () => {
  const fake = fakeClock();
  const prev = setStageClock(fake);
  try {
    const host = {};
    const fig = figure(host);
    const fired = [];
    assert.equal(typeof freezeStageTimers([fig], 0), 'function', 'a zero hold is a no-op release');
    const release = freezeStageTimers([fig], Infinity);
    stageTimeout(host, () => fired.push(fake.now()), 30); // scheduled while frozen: waits
    const cancelled = stageTimeout(host, () => fired.push('cancelled'), 10);
    clearStageTimeout(cancelled);
    clearStageTimeout(null); // null-safe, like clearTimeout
    fake.advance(500);
    assert.deepEqual(fired, [], 'nothing fires while the figure is held');
    release(); release(); // idempotent
    fake.advance(30);
    assert.deepEqual(fired, [530], 'resumes with its full 30 ms once released');
    assert.equal(pendingStageSteps(), 0);
  } finally { setStageClock(prev); }
});
