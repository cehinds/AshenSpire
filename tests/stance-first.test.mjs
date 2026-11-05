// Stance settlement precedes the shared intent and action-word waits. Every
// actor starts its sprite after those waits; an unknown expansion stage still
// receives settle(), without inserting a separate stance timer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed, setBeatOrder, stanceState } from '../src/ui/fx.js';
import { actionPacing, setCombatPacing } from '../src/ui/animationPace.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

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
  setCombatPacing();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  let swing = null, settled = 0, settledAt = null, completed = 0;
  withKitDom((dom) => {
    const anchor = dom.document.createElement('div');
    const e1 = dom.document.createElement('div');
    registerStage(anchor, { ...stage, settle: () => { settled++; settledAt = Date.now(); stage.settle?.(); } , play: () => true, hold() {} });
    registerStage(e1, { play: () => true, hold() {}, settle() {} });
    try {
      playTimeline([{ type: 'cardPlayed', cardType: 'attack', cardId: 's', cardInstanceId: 'c', targetId: 'e1' },
        { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 3, blocked: 0 }], {
        layer: dom.document.createElement('div'), combatEl: dom.document.createElement('div'),
        anchorFor: (id) => (id === 'player' ? anchor : e1),
        animateActor: () => { swing ??= Date.now(); return { impactMs: 100, totalMs: 300, hold() {}, cancel() {} }; },
        onBeatApplied() {}, onFlush() {},
      }, () => completed++);
      for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1);
    } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
  });
  assert.equal(completed, 1);
  return { swing, settled, settledAt };
}

test('a painted outfit caught in a hurt pose settles before the intent and action-word waits', (t) => {
  const { swing, settled, settledAt } = swingAt(t, { get presentation() { return { rest: 'idle', pose: 'hit', transition: null }; } });
  assert.equal(settled, 1);
  assert.equal(settledAt, 0, 'the stance is restored before either wait begins');
  assert.equal(swing, actionPacing().intentMs + actionPacing().wordMs);
});

test('a painted outfit at rest retains the same ordered waits', (t) => {
  const { swing, settled } = swingAt(t, { get presentation() { return { rest: 'idle', pose: 'idle', transition: null }; } });
  assert.equal(settled, 0);
  assert.equal(swing, actionPacing().intentMs + actionPacing().wordMs);
});

test('an expansion stage with only settle/play settles before the ordered waits', (t) => {
  const { swing, settled } = swingAt(t, {});
  assert.equal(settled, 1, 'settle() is still called');
  assert.equal(swing, actionPacing().intentMs + actionPacing().wordMs, 'no additional lead for an unknown stage');
});


test('a stance-changing attack plays stance change, then the action animation, then the hit', (t) => {
  setCombatPacing();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  const order = [];
  let completed = 0;
  withKitDom((dom) => {
    const anchor = dom.document.createElement('div'), e1 = dom.document.createElement('div');
    registerStage(anchor, { play: () => true, hold() {}, settle() {} });
    registerStage(e1, { play: () => { order.push('hit'); return true; }, hold() {}, settle() {} });
    try {
      playTimeline([{ type: 'cardPlayed', cardType: 'attack', cardId: 's', cardInstanceId: 'c', targetId: 'e1' },
        { type: 'stanceEntered', stance: 'smash', playerId: 'player' },
        { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 3, blocked: 0 }], {
        layer: dom.document.createElement('div'), combatEl: dom.document.createElement('div'),
        anchorFor: (id) => (id === 'player' ? anchor : e1),
        onStanceLead: () => order.push('stance'),
        animateActor: () => { order.push('action'); return { impactMs: 100, totalMs: 300, hold() {}, cancel() {} }; },
        onBeatApplied() {}, onFlush() {},
      }, () => completed++);
      for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1);
    } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
  });
  assert.equal(completed, 1);
  assert.deepEqual(order.filter((step, i) => step !== 'hit' || i === order.lastIndexOf('hit')).slice(0, 3), ['stance', 'action', 'hit']);
});

// Core 2 card plays change stance through prepareTacticalCard / setCombatStance, which emit combatStanceChanged
// (stanceEntered belongs to the legacy enterStance effect). The receipts here come from the engine, not by hand.
function core2CardEvents() {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', hp: 100, maxHp: 100, mana: 20, maxMana: 20, stamina: 20, maxStamina: 20, energyMax: 20,
      drawPerTurn: 1, deck: [{ cardId: 'strike', instanceId: 'x' }] } });
  const enemyId = combat.enemies[0].id;
  const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: 'x', targetId: enemyId });
  assert.ok(events.some(e => e.type === 'combatStanceChanged'), 'Core 2 emits combatStanceChanged');
  assert.ok(!events.some(e => e.type === 'stanceEntered'), 'and not the legacy stanceEntered');
  return { events, enemyId };
}

function leadOrder(t, events) {
  setCombatPacing();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  const order = [];
  let completed = 0, applied = 0;
  withKitDom((dom) => {
    const anchor = dom.document.createElement('div'), e1 = dom.document.createElement('div');
    registerStage(anchor, { play: () => true, hold() {}, settle() {} });
    registerStage(e1, { play: () => { order.push('hit'); return true; }, hold() {}, settle() {} });
    try {
      playTimeline(events, {
        layer: dom.document.createElement('div'), combatEl: dom.document.createElement('div'),
        anchorFor: (id) => (id === 'player' ? anchor : e1),
        onStanceLead: (beat, event) => order.push(`stance:${event.type}`),
        animateActor: () => { order.push('action'); return { impactMs: 100, totalMs: 300, hold() {}, cancel() {} }; },
        onBeatApplied: () => { applied++; }, onFlush() {},
      }, () => completed++);
      for (let i = 0; i < 20000 && !completed; i++) t.mock.timers.tick(1);
    } finally { setAnimSpeed('normal'); setBeatOrder('sequential'); }
  });
  assert.equal(completed, 1);
  assert.ok(applied > 0);
  return order.filter((step, i) => step !== 'hit' || i === order.lastIndexOf('hit'));
}

test('a Core 2 card play emits combatStanceChanged and leads with the stance before the action and the hit', (t) => {
  const { events } = core2CardEvents();
  const order = leadOrder(t, events);
  assert.deepEqual(order.slice(0, 3), ['stance:combatStanceChanged', 'action', 'hit']);
  assert.equal(order.filter(step => step.startsWith('stance')).length, 1, 'the stance leads exactly once');
});

test('an ordinary card play with no stance receipt still leads on cardPlayed, before the action and the hit', (t) => {
  // The stance sprite follows every cardPlayed through the held-stance ledger, so that receipt must lead too.
  const { events } = core2CardEvents();
  const order = leadOrder(t, events.filter(e => e.type !== 'combatStanceChanged'));
  assert.deepEqual(order.slice(0, 3), ['stance:cardPlayed', 'action', 'hit']);
});
