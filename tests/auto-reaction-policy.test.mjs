import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseReaction, perceivedManeuver, recordManualReaction, manualReactionPicks } from '../src/model/autoCombatPolicy.js';

const matchups = { defend: ['attack'], counter: ['smash'], evade: ['sweep'] };
const options = [{ id: 'a', kind: 'defend' }, { id: 'b', kind: 'counter' }, { id: 'c', kind: 'evade' }];
const read = (maneuver, extra = {}) => ({ hidden: false, revealed: true, profile: { maneuver }, ...extra });
const state = (own, seat = 'player') => ({ matchups, seats: { [seat]: own } });

test('the reaction that counters the perceived intent is chosen', () => {
  assert.equal(chooseReaction(state({ intent: read('attack') }), 'player', options).id, 'a');
  assert.equal(chooseReaction(state({ intent: read('smash') }), 'player', options).id, 'b');
  assert.equal(chooseReaction(state({ intent: read('sweeping') }), 'player', options).id, 'c');
});
test('with no perceived intent the last stance type picks the reaction', () => {
  assert.equal(chooseReaction(state({ intent: null, lastStance: 'counter' }), 'player', options).id, 'b');
  assert.equal(chooseReaction(state({ intent: read('attack', { hidden: true }), lastStance: 'evade' }), 'player', options).id, 'c');
  assert.equal(chooseReaction(state({ intent: null }), 'player', options), null);
});
test('a perceived intent outranks the last stance', () => {
  assert.equal(chooseReaction(state({ intent: read('attack'), lastStance: 'evade' }), 'player', options).id, 'a');
});
test('manual picks break ties, most picked first, then source order', () => {
  const tied = [{ id: 'x', kind: 'defend' }, { id: 'y', kind: 'counter' }];
  assert.equal(chooseReaction(state({ intent: read('wait'), picks: { counter: 3, defend: 1 } }), 'player', tied).id, 'y');
  assert.equal(chooseReaction(state({ intent: read('wait'), picks: { counter: 2, defend: 2 } }), 'player', tied).id, 'x');
  const both = [{ id: 'x', kind: 'defend' }, { id: 'y', kind: 'defend' }];
  assert.equal(chooseReaction(state({ lastStance: 'defend' }), 'player', both).id, 'x');
});
test('manual picks never override a counter to the perceived intent', () => {
  assert.equal(chooseReaction(state({ intent: read('attack'), picks: { counter: 9 } }), 'player', options).id, 'a');
});
test('hidden or unrevealed intents are never used', () => {
  for (const intent of [read('attack', { hidden: true }), read('attack', { revealed: false })]) {
    assert.equal(perceivedManeuver(intent), null);
    assert.equal(chooseReaction(state({ intent }), 'player', options), null);
  }
  const trap = { hidden: true, get profile() { throw Error('hidden intent read'); }, get stance() { throw Error('hidden intent read'); } };
  assert.doesNotThrow(() => chooseReaction(state({ intent: trap, lastStance: 'defend' }), 'player', options));
});
test('each seat decides from its own perception only', () => {
  const shared = { matchups, seats: { one: { intent: read('attack') }, two: { intent: read('smash', { hidden: true }), lastStance: 'evade' } } };
  assert.equal(chooseReaction(shared, 'one', options).id, 'a');
  assert.equal(chooseReaction(shared, 'two', options).id, 'c');
  assert.equal(chooseReaction(shared, 'three', options), null);
});
test('the chooser is pure and returns one of the offered options', () => {
  const before = structuredClone([state({ intent: read('attack') }), options]);
  const pick = chooseReaction(before[0], 'player', before[1]);
  assert.ok(before[1].includes(pick));
  assert.deepEqual(before, structuredClone([state({ intent: read('attack') }), options]));
  assert.equal(chooseReaction(state({}), 'player', []), null);
});
test('manual picks are tallied per run and seat, in memory only', () => {
  const run = { id: 'r1' }, other = { id: 'r2' };
  recordManualReaction(run, 'one', 'counter'); recordManualReaction(run, 'one', 'counter'); recordManualReaction(run, 'two', 'defend');
  assert.deepEqual(manualReactionPicks(run, 'one'), { counter: 2 });
  assert.deepEqual(manualReactionPicks(run, 'two'), { defend: 1 });
  assert.deepEqual(manualReactionPicks(other, 'one'), {});
  assert.equal(JSON.stringify(run), '{"id":"r1"}');
});

import { reactionAnswer } from '../src/model/autoCombatPolicy.js';
import { readFileSync } from 'node:fs';
const autoSource = () => { const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  return screen.slice(screen.indexOf('function autoReactionChoice'), screen.indexOf('// ---------- rendering')); };
test('a deliberate decline is submitted with a null option', () => {
  assert.deepEqual(reactionAnswer({ id: 'o1' }, null), { offerId: 'o1', optionId: null });
  assert.deepEqual(reactionAnswer({ id: 'o1' }, { id: 'b' }), { offerId: 'o1', optionId: 'b' });
  assert.equal(chooseReaction(state({}), 'player', options), null);
  assert.match(autoSource(), /option !== undefined/);
});
