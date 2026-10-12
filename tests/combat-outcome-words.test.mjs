// OUTCOME WORDS, STATUS POPUPS and the word queue (owner, 2026-10-12). A hit that does
// no HP damage shows one word over the target; a hostile status applied shows its past-tense
// word; at most three words show on a fighter at once and the rest queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { outcomeKindForEvent, statusPopupFor, planWordQueue, stackPriority, CALLOUT_KINDS, STACK_STEP_MS } from '../src/ui/fx.js';
import { t } from '../src/ui/strings.js';

const hit = (over = {}) => ({ type: 'damageDealt', targetId: 'e1', amount: 0, blocked: 0, ...over });

test('barrier takes a whole hit and holds: RESISTED (blue); a broken Barrier keeps its BREAK', () => {
  assert.equal(outcomeKindForEvent(hit({ barrierAbsorbed: 4, barrierRemaining: 2 })), 'resisted');
  assert.equal(CALLOUT_KINDS.resisted.tone, 'barrier');
  assert.equal(outcomeKindForEvent(hit({ barrierAbsorbed: 4, barrierRemaining: 0 })), null, 'the break shows BREAK as before');
});

test('ward takes a whole hit: RESISTED in ward purple', () => {
  assert.equal(outcomeKindForEvent(hit({ wardAbsorbed: 3, wardRemaining: 0 })), 'wardResisted');
  assert.equal(CALLOUT_KINDS.wardResisted.tone, 'ward');
});

test('Block takes a whole hit: BLOCKED (silver), whether or not it broke', () => {
  assert.equal(outcomeKindForEvent(hit({ amount: 5, blocked: 5, blockRemaining: 0 })), 'blocked');
  assert.equal(outcomeKindForEvent(hit({ amount: 5, blocked: 5, blockRemaining: 3 })), 'blocked');
  assert.equal(CALLOUT_KINDS.blocked.tone, 'block');
});

test('any HP damage keeps the per-layer floats: no outcome word', () => {
  assert.equal(outcomeKindForEvent(hit({ amount: 6, blocked: 2 })), null);
  assert.equal(outcomeKindForEvent(hit({ amount: 3, blocked: 0, barrierAbsorbed: 4, barrierRemaining: 0 })), null);
});

test('an immune target: IMMUNE (pale grey), from a flagged hit or a refused status', () => {
  assert.equal(outcomeKindForEvent(hit({ immune: true })), 'immune');
  assert.equal(outcomeKindForEvent({ type: 'statusImmune', targetId: 'e1', status: 'burn' }), 'immune');
  assert.equal(CALLOUT_KINDS.immune.string, 'combat.callout.immune');
  assert.equal(t(CALLOUT_KINDS.immune.string), 'IMMUNE');
});

test('an evaded hit is MISSED, the one existing miss word', () => {
  assert.equal(outcomeKindForEvent({ type: 'attackEvaded', targetId: 'e1' }), 'evaded');
  assert.equal(outcomeKindForEvent({ type: 'combatAvoidanceResolved', avoided: true }), 'evaded');
  assert.equal(outcomeKindForEvent({ type: 'combatAvoidanceResolved', avoided: false }), null);
  assert.equal(t(CALLOUT_KINDS.evaded.string), 'MISSED');
});

test('a hostile status applied names its past-tense word in its colour', () => {
  const popup = statusPopupFor({ type: 'statusApplied', targetId: 'e1', status: 'burn', stacks: 2 });
  assert.equal(popup.word, 'BURNED');
  assert.equal(popup.colour, 'var(--ember)', 'the status row tint');
  assert.equal(statusPopupFor({ type: 'statusApplied', targetId: 'e1', status: 'venom', stacks: 1 }).word, 'POISONED');
  assert.equal(statusPopupFor({ type: 'statusApplied', targetId: 'e1', status: 'frozen', stacks: 1 }).colour, '#9fe3ff');
  assert.equal(statusPopupFor({ type: 'statusApplied', targetId: 'e1', status: 'sleep', stacks: 1 }).word, 'ASLEEP');
});

test('no popup for a buff, a zero-stack event, or a fighter-less event', () => {
  assert.equal(statusPopupFor({ type: 'statusApplied', targetId: 'p1', status: 'strength', stacks: 1 }), null);
  assert.equal(statusPopupFor({ type: 'statusApplied', targetId: 'e1', status: 'burn', stacks: 0 }), null);
  assert.equal(statusPopupFor({ type: 'statusApplied', status: 'burn', stacks: 1 }), null);
});

test('priority: STATUS > MISSED > IMMUNE > BREAKS > BLOCKED > RESISTED', () => {
  const order = ['status:burn', 'evaded', 'immune', 'barrierBreak', 'blocked', 'resisted'].map(stackPriority);
  assert.deepEqual(order, [...order].sort((a, b) => b - a), 'each is above the one after it');
  assert.ok(stackPriority('status:venom') > stackPriority('evaded'));
  assert.ok(stackPriority('evaded') > stackPriority('immune'));
  assert.ok(stackPriority('immune') > stackPriority('barrierBreak'));
  assert.ok(stackPriority('wardBreak') === stackPriority('poiseBreak'), 'BREAKS share one tier');
  assert.ok(stackPriority('barrierBreak') > stackPriority('blocked'));
  assert.ok(stackPriority('blocked') > stackPriority('resisted'));
});

test('six words start at 0, d, 2d, T, T+d, T+2d in priority order, and none is dropped', () => {
  const T = 900, d = STACK_STEP_MS;
  const items = [
    { id: 'resisted', kind: 'resisted' }, { id: 'burn', kind: 'status:burn' }, { id: 'barrierBreak', kind: 'barrierBreak' },
    { id: 'evaded', kind: 'evaded' }, { id: 'blocked', kind: 'blocked' }, { id: 'immune', kind: 'immune' },
  ];
  const plan = planWordQueue(items, { lanes: [0, 0, 0], stepMs: d, lifeMs: T });
  assert.deepEqual(plan.map((row) => row.id), ['burn', 'evaded', 'immune', 'barrierBreak', 'blocked', 'resisted']);
  assert.deepEqual(plan.map((row) => row.start), [0, d, 2 * d, T, T + d, T + 2 * d]);
  assert.equal(plan.length, items.length, 'nothing is dropped');
  assert.deepEqual([...new Set(plan.map((row) => row.lane))].sort(), [0, 1, 2], 'three lanes in use');
});

test('the queue waits for the earliest visible word, not for all of them', () => {
  const plan = planWordQueue([{ id: 'a', kind: 'evaded' }, { id: 'b', kind: 'immune' }, { id: 'c', kind: 'blocked' },
    { id: 'd', kind: 'blocked' }], { lanes: [300, 0, 0], stepMs: 150, lifeMs: 900 });
  const start = Object.fromEntries(plan.map((row) => [row.id, row.start]));
  assert.equal(start.a, 0, 'a free lane takes the first word at once');
  assert.equal(start.b, 150, 'the next starts one step later');
  assert.equal(start.c, 300);
  assert.equal(start.d, 900, 'the fourth waits for the lane of the first to free');
});
