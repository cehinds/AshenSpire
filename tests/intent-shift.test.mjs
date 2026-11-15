// An enemy's intent row advances when each action RESOLVES (owner, 2026-11-13): the next planned move leaves the follow-up
// row and takes the head slot, as its own icon if the Perception read of it passed, else "?". Headless: model events only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCombatIntentReceipt, flushDeferredIntentClears } from '../src/ui/models/CombatIntentProjectionModel.js';
import { createFollowMemo, CreateFollowUpReduction, followUpPlan, PromoteFollowUpRow } from '../src/ui/models/IntentFollowUpModel.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';

const ID = 'e1';
const def = { moves: { m1: { intent: 'attack' }, m2: { intent: 'block' }, m3: { intent: 'attack' } } };
const head = moveId => ({ kind: 'attack', moveId, damage: 7, hits: 1, profile: {}, stance: 'attacking', revealed: true, hidden: false });
const started = moveId => ({ type: 'enemyMoveStarted', sourceId: ID, moveId, intentPreview: head(moveId) });
const ended = moveId => ({ type: 'enemyMoveEnded', sourceId: ID, moveId });

// Plays move events the way ApplyCombatBeat does: the reducer and the intent receipt per event (with the receipts after
// it), and the resolution hook once per beat. `followIds` are the planned follow-ups after the head; `reads` their reads.
function rig(followIds, reads) {
  const ents = { [ID]: { kind: 'enemy', intentPreview: head('m1'), followUps: null } };
  const memo = createFollowMemo(), reduce = CreateFollowUpReduction(memo);
  const plan = followUpPlan({ queue: followIds.map(moveId => ({ moveId })), def });
  const disp = { ents, followPlans: { [ID]: plan }, intentClears: new Map() };
  const trace = reads.map(read => ({ read }));
  const log = [];
  return {
    ents, plan, disp, log,
    beat(events, upcoming = []) {
      reduce(events, disp, { [ID]: trace });
      events.forEach((event, i) => applyCombatIntentReceipt(ents, event, disp.intentClears, [...events.slice(i + 1), ...upcoming]));
    },
    resolve() { return flushDeferredIntentClears(ents, disp.intentClears, id => PromoteFollowUpRow({ disp, followMemo: memo, followTrace: { [ID]: trace } }, id)); },
    row: () => (ents[ID].followUps || []).map(s => (s.kind === 'unknown' ? '?' : s.icon)),
    shown: () => combatIntentPresentation(ents[ID].intentPreview),
  };
}

test('after move 1 resolves, the head is the promoted follow-up and the row has one fewer entry', () => {
  const r = rig(['m2', 'm3'], [true, true]);
  r.beat([started('m1'), ended('m1')], [started('m2')]);
  assert.equal(r.row().length, 2, 'the whole plan shows while the first action plays');
  assert.equal(r.ents[ID].intentPreview.moveId, 'm1', 'its own intent stays until it resolves');
  assert.equal(r.resolve(), true);
  assert.equal(r.row().length, 1, 'one fewer entry');
  assert.equal(r.ents[ID].intentPreview.promoted, true);
  assert.equal(r.shown().parts.length, 1, 'the head is one glyph');
  assert.equal(r.shown().parts[0].value, null, 'with no value');
  assert.equal(r.shown().parts[0].icon, 'defend', 'its own icon: the read passed');
});

test('an unread follow-up promotes as "?" with no icon anywhere in the presentation', () => {
  const r = rig(['m2', 'm3'], [false, true]);
  r.beat([started('m1'), ended('m1')], [started('m2')]);
  r.resolve();
  assert.equal(r.ents[ID].intentPreview.icon, null);
  const text = JSON.stringify([r.shown(), r.ents[ID].intentPreview]);
  assert.equal(r.shown().title, '?');
  assert.deepEqual(r.shown().parts, []);
  assert.ok(!text.includes('defend'), 'the unread move (a block) leaves no icon');
  assert.ok(!JSON.stringify(r.ents[ID].intentPreview).includes('m2'), 'nor its id');
});

test('the next enemyMoveStarted reveals the real intent and does not advance the row a second time', () => {
  const r = rig(['m2', 'm3'], [true, true]);
  r.beat([started('m1'), ended('m1')], [started('m2')]);
  r.resolve();
  assert.equal(r.row().length, 1);
  r.beat([started('m2'), ended('m2')], [started('m3')]);
  assert.equal(r.row().length, 1, 'the row did not shrink again');
  assert.equal(r.ents[ID].intentPreview.moveId, 'm2', 'the reveal replaced the promoted head');
  assert.equal(r.ents[ID].intentPreview.promoted, undefined);
  r.resolve();
  assert.equal(r.row().length, 0, 'the second resolution promotes the last one');
  assert.equal(r.ents[ID].intentPreview.promoted, true);
  r.beat([started('m3'), ended('m3')], []);
  assert.equal(r.row().length, 0);
  assert.equal(r.ents[ID].intentPreview.moveId, 'm3');
});

test('a single-move plan behaves as before: no promotion, the head clears at resolution', () => {
  const r = rig([], []);
  r.beat([started('m1'), ended('m1')], []);
  assert.equal(r.row().length, 0);
  assert.equal(r.resolve(), true, 'the deferred clear applies');
  assert.equal(r.ents[ID].intentPreview.promoted, undefined);
  assert.equal(r.ents[ID].intentPreview.kind, 'unknown');
  assert.equal(r.ents[ID].intentPreview.moveId, null);
});

test('the later hits of one move never promote', () => {
  const r = rig(['m2'], [true]);
  const hit = { type: 'combatHitStarted', sourceId: ID, intentPreview: head('m1') };
  r.beat([started('m1'), { type: 'damageDealt', sourceId: ID, targetId: 'player', amount: 3 }], [hit]);
  assert.equal(r.resolve(), false, 'nothing parked: the next contact is the same move');
  assert.equal(r.ents[ID].intentPreview.promoted, undefined);
  assert.equal(r.row().length, 1);
});

for (const [icon, family, real] of [
  ['attack', 'attacking', { kind: 'attack', stance: 'attacking' }],
  ['smash', 'smashing', { kind: 'attack', stance: 'smashing' }],
  ['counter', 'countering', { kind: 'block', stance: 'countering', block: 5 }],
  ['defend', 'defending', { kind: 'block', stance: 'defending', block: 5 }],
  ['evade', 'defending', { kind: 'block', stance: 'defending', profile: { maneuver: 'evade' }, dodgeCharges: 1 }],
  ['buff', 'buffing', { kind: 'buff', stance: 'preparing' }],
  ['cast', 'casting', { kind: 'cast', stance: 'preparing', profile: { camp: 'spell' } }],
  ['prepare', 'preparing', null],
]) {
  test(`a promoted ${icon} head reads as the ${family} family, like its real intent`, () => {
    const shown = combatIntentPresentation({ kind: 'unknown', promoted: true, icon, revealed: true, hidden: false });
    assert.equal(shown.stance, family);
    assert.equal(shown.title, family[0].toUpperCase() + family.slice(1));
    assert.deepEqual(shown.parts, [{ icon, value: null }]);
    if (real) {
      const actual = combatIntentPresentation({ moveId: 'x', damage: 4, hits: 1, revealed: true, hidden: false, profile: {}, ...real });
      assert.equal(shown.stance, actual.stance, 'the same family as the real intent');
      assert.equal(shown.title, actual.title, 'and the same title');
    }
  });
}

test('early application: the promoted head becomes the real intent at the move\'s start; applying the beat again changes nothing', () => {
  const r = rig(['m2', 'm3'], [true, false]);
  r.beat([started('m1'), ended('m1')], [started('m2')]);
  r.resolve();
  assert.equal(r.ents[ID].intentPreview.promoted, true);
  assert.equal(r.row().length, 1);
  // The onIntent hook applies the announcing receipt before the animation.
  const second = started('m2');
  r.beat([second], [ended('m2')]);
  assert.equal(r.ents[ID].intentPreview.moveId, 'm2', 'the real intent shows at the start of the move');
  assert.equal(r.ents[ID].intentPreview.promoted, undefined);
  assert.equal(r.row().length, 1, 'no second advance');
  // onBeatApplied then applies the whole beat, the same receipt object included.
  r.beat([second, ended('m2')], [started('m3')]);
  assert.equal(r.ents[ID].intentPreview.moveId, 'm2', 'the repeat is idempotent');
  assert.equal(r.row().length, 1, 'still no second advance');
  r.resolve();
  assert.equal(r.ents[ID].intentPreview.promoted, true, 'the next promotion still happens at resolution');
  assert.equal(r.row().length, 0);
});

test('the engine gives every non-reaction move of a plan an intentPreview (a buff or defend move too)', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { dispatch } = await import('../src/engine/combat.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const regs = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries: regs, classId: 'reaver', seed: 4, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const c = createRunCombat({ registries: regs, run, rng: createRng(4), enemyIds: ['ashheartDragon', 'wyrmAspirant', 'fellWarden'] });
  dispatch(c, { type: 'endTurn' });
  for (let i = 0; c.pendingReaction && i < 20; i++) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  const starts = c.eventLog.filter(e => e.type === 'enemyMoveStarted' && !e.reaction);
  assert.ok(starts.length >= 4);
  assert.ok(starts.every(e => e.intentPreview), 'the dragon\'s second (buff) move announces its intent');
});
