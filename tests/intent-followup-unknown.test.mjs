// The "?" rule for an actor's remaining actions (owner, 2026-10-18): after an actor has acted this turn and still
// has SP for more actions, an observer who failed the Perception check on its intent sees each as "?"; one who
// passed sees them normally. No re-roll, and a failed read never lets a move reach the DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { advanceFollowUps, followUpPlan, remainingFollowUps } from '../src/ui/models/IntentFollowUpModel.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { combatantIntent } from '../src/ui/components/combatantOverhead.js';

const POOL_STATS = { strength: 6, dexterity: 4, constitution: 4, wisdom: 2, intelligence: 2 };
const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === 'wanderingSoldier' ? { ...e, attributes: POOL_STATS } : e)) });
const DEF = { moves: { slash: { intent: 'attack', damage: 5 }, guard: { intent: 'defend', block: 4 }, bash: { intent: 'attack', tags: ['smash'], damage: 9 } } };
const QUEUE = [{ moveId: 'slash' }, { moveId: 'guard' }, { moveId: 'bash' }];

test('failed read, SP left: every remaining action is "?" and the plan keeps no move', () => {
  const plan = followUpPlan({ passed: false, queue: QUEUE, def: DEF });
  assert.equal(plan.icons, null, 'a failed read never stores an icon');
  assert.doesNotMatch(JSON.stringify(plan), /slash|guard|bash/);
  assert.deepEqual(remainingFollowUps(plan, 2), [{ kind: 'unknown' }, { kind: 'unknown' }]);
  assert.deepEqual(remainingFollowUps(plan, 3).map((s) => s.kind), ['unknown', 'unknown', 'unknown']);
});

test('passed read, SP left: the remaining actions show normally, in play order', () => {
  const plan = followUpPlan({ passed: true, queue: QUEUE, def: DEF });
  assert.deepEqual(remainingFollowUps(plan, 3).map((s) => s.icon), ['attack', 'defend', 'smash']);
  assert.deepEqual(remainingFollowUps(plan, 2).map((s) => s.icon), ['defend', 'smash'], 'the actions already played are not shown again');
});

test('no SP left (nothing queued): nothing shows, read or no read', () => {
  assert.deepEqual(remainingFollowUps(followUpPlan({ passed: false, queue: QUEUE, def: DEF }), 0), []);
  assert.deepEqual(remainingFollowUps(followUpPlan({ passed: true, queue: QUEUE, def: DEF }), 0), []);
  assert.deepEqual(remainingFollowUps(followUpPlan({ passed: false, queue: [], def: DEF }), 1), []);
  assert.deepEqual(remainingFollowUps(null, 2), []);
});

test('each action event of the actor consumes one planned move, so the "?" row shrinks as it acts', () => {
  const failed = followUpPlan({ passed: false, queue: QUEUE, def: DEF });
  // Head starts (3 left), a follow-up starts (2), one is refused for SP (1), the last starts (0).
  assert.deepEqual([advanceFollowUps(failed), advanceFollowUps(failed), advanceFollowUps(failed), advanceFollowUps(failed)].map((row) => row.length), [3, 2, 1, 0]);
  const passed = followUpPlan({ passed: true, queue: QUEUE, def: DEF });
  assert.deepEqual(advanceFollowUps(passed).map((s) => s.icon), ['attack', 'defend', 'smash']);
  assert.deepEqual(advanceFollowUps(passed).map((s) => s.icon), ['defend', 'smash']);
  assert.deepEqual(advanceFollowUps(null), []);
});

test('the engine event stays count-free: the saved golden event log is unchanged', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, profileMeta: { settings: {} } });
  const c = createRunCombat({ registries, rng: createRng(5), run, enemyIds: ['wanderingSoldier'], settings: {} });
  const planned = c.enemies[0].plannedMoves.length;
  assert.ok(planned >= 1, 'the fixture soldier plans follow-ups');
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const acts = c.eventLog.filter((e) => (e.type === 'enemyMoveStarted' && !e.reaction) || e.type === 'enemyMoveUnavailable');
  assert.equal(acts.length, planned + 1, 'one action event for the head and one per planned move');
  assert.ok(c.eventLog.filter((e) => e.type === 'enemyMoveStarted').every((e) => !('queued' in e)));
});

test('the intent renders "?" for a failed read and icons for a passed one, and no move reaches the DOM', () => {
  withKitDom(() => {
    const base = { kind: 'attack', moveId: 'slash', damage: 5, hits: 1, profile: {}, stance: 'attacking', revealed: true, hidden: false };
    const unread = combatantIntent({ ...base, followUps: remainingFollowUps(followUpPlan({ passed: false, queue: QUEUE, def: DEF }), 2) });
    const marks = unread.querySelectorAll('.intent-followup');
    assert.equal(marks.length, 2);
    assert.ok([...marks].every((node) => node.dataset.unknown === 'true' && node.textContent === '?'));
    assert.doesNotMatch(unread.outerHTML, /guard|bash|defend|smash/);
    assert.match(unread.getAttribute('aria-label'), /2 more actions unread/);
    const read = combatantIntent({ ...base, followUps: remainingFollowUps(followUpPlan({ passed: true, queue: QUEUE, def: DEF }), 2) });
    assert.equal(read.querySelectorAll('.intent-followup').length, 2);
    assert.equal(read.querySelectorAll('.intent-followup[data-unknown="true"]').length, 0);
    assert.deepEqual([...read.querySelectorAll('.intent-followup .intent-icon')].map((node) => node.dataset.intent), ['defend', 'smash']);
    assert.equal(combatantIntent(base).querySelectorAll('.intent-followup').length, 0, 'no follow-ups, no symbols');
  });
});
