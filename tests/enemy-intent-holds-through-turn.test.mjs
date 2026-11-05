// Owner 2026-11-05: "I also noticed that enemy intent would change during their turn. It is confusing and hard to gauge
// what the enemy is doing." SPEC 4.6b (#100/#101): the shown intent is committed and stays until its damage/effects
// resolve. Replays the real engine's End Turn receipts through the combat screen's beat order (groupBeats, the reveal
// at the beat's start, the receipt reducer, the deferred clear at resolution) and reads each enemy's shown intent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { groupBeats } from '../src/ui/fx.js';
import { applyCombatIntentReceipt, flushDeferredIntentClears, projectCombatIntent, announcesNextContact } from '../src/ui/models/CombatIntentProjectionModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function replay(enemyIds, seed) {
  const run = createRunState({ registries, classId: 'reaver', seed });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds });
  combat.player.hp = combat.player.maxHp = 100000;
  const ents = Object.fromEntries(combat.enemies.map(e => [e.id, { kind: 'enemy', intentPreview: projectCombatIntent(combat, e.id) }]));
  const before = Object.fromEntries(combat.enemies.map(e => [e.id, ents[e.id].intentPreview.moveId]));
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  for (let i = 0; combat.pendingReaction && i < 40; i++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const events = combat.eventLog.slice(start);
  const deferred = new Map(), shown = [];
  for (const beat of groupBeats(events)) {
    for (const e of beat.events.filter(x => x.type === 'enemyActorTurnStarted')) applyCombatIntentReceipt(ents, e, deferred); // onIntent
    for (const e of beat.events) {
      applyCombatIntentReceipt(ents, e, deferred, events.slice(events.indexOf(e) + 1));
      if (e.type === 'playerTurnStart') for (const en of combat.enemies) ents[en.id].intentPreview = projectCombatIntent(combat, en.id);
    }
    flushDeferredIntentClears(ents, deferred); // onResolution
    shown.push({ kind: beat.kind, actor: beat.actorId, types: beat.events.map(e => e.type), moves: Object.fromEntries(Object.keys(ents).map(id => [id, ents[id].intentPreview.moveId ?? ents[id].intentPreview.kind])) });
  }
  return { combat, events, shown, before };
}

test('an enemy with a plan of two attacks keeps its intent between the two, never dropping to "?"', () => {
  const { shown, events } = replay(['fellWarden', 'gildedKnight'], 511);
  const e1 = events.filter(e => e.sourceId === 'e1' && e.type === 'enemyMoveEnded');
  assert.ok(e1.length >= 2, 'the fixture really plays two moves for e1');
  const last = shown.findLastIndex(b => b.actor === 'e1');
  const first = shown.findIndex(b => b.actor === 'e1');
  for (let i = first; i < last; i++) assert.notEqual(shown[i].moves.e1, 'unknown', `e1 shows its committed intent after beat ${i} (${shown[i].types.join(',')})`);
  assert.equal(shown[last].moves.e1, 'unknown', 'it clears only once its last move has resolved');
});

test('the next turn intent appears only at the player turn start, after every enemy action and the draw', () => {
  for (const [ids, seed] of [[['fellWarden', 'gildedKnight'], 511], [['wanderingSoldier', 'wanderingSoldier'], 511], [['wanderingSoldier', 'fellWarden'], 3]]) {
    const { shown, before } = replay(ids, seed);
    const turnStart = shown.findIndex(b => b.types.includes('playerTurnStart'));
    assert.ok(turnStart > 0);
    const lastAction = shown.findLastIndex(b => b.actor && b.actor !== 'player');
    assert.ok(lastAction < turnStart);
    for (let i = 0; i < turnStart; i++) for (const id of Object.keys(before)) {
      const now = shown[i].moves[id];
      // Each enemy shows what it was committed to, or "unknown" once that has resolved; never another move.
      assert.ok(now === before[id] || now === 'unknown' || shown.slice(0, i + 1).some(b => b.types.includes('enemyActorTurnStarted') && b.actor === id),
        `${id} shows ${now} at beat ${i}, committed was ${before[id]}`);
    }
  }
});

test('announcesNextContact looks only inside the actor\'s own turn', () => {
  const next = { type: 'combatContactPrepared', sourceId: 'e1', intentPreview: { moveId: 'x' } };
  assert.equal(announcesNextContact([next], 'e1'), true);
  assert.equal(announcesNextContact([next], 'e2'), false, 'another actor');
  assert.equal(announcesNextContact([{ type: 'enemyTurnEnd' }, next], 'e1'), false, 'past the end of the enemy turn');
  assert.equal(announcesNextContact([{ ...next, reaction: true }], 'e1'), false, 'a reaction move does not hold');
  assert.equal(announcesNextContact([{ ...next, intentPreview: null }], 'e1'), false, 'no read to show: the clear stands');
});
