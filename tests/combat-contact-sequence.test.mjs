import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { playTimeline, setAnimSpeed } from '../src/ui/fx.js';
import { withKitDom } from './helpers/kit-dom.mjs';
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const baseRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// Moves are compiled from shared authored sources by createRegistries; alter the
// final registered move so this fixture fixes an exact 5-per-hit contract.
const registries = Object.freeze({ ...baseRegistries, enemies: {
  ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id), get: id => {
    const row = baseRegistries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage: 5, hits: 3 } } } : row;
  }
} });
function live() {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const entity of [combat.player, ...combat.enemies]) {
    Object.assign(entity, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, ratings: { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 }, ratingSources: [], basePrecisionBonus: 1000, persistentPoise: { value: 0, max: 0 } });
    delete entity.combatStance; delete entity.combatCounter;
  }
  return combat;
}


function answer(ctx, optionId = null) {
  return dispatch(ctx, { type: 'chooseReaction', offerId: ctx.pendingReaction.id, optionId });
}
function counters(ctx) {
  ctx.piles.hand = Array.from({ length: 3 }, (_, i) => ({ instanceId: `counter-${i}`, cardId: 'core.counter', upgraded: false }));
  ctx.player.energy = 10;
}
test('Core offers one Counter per hit and resolves its return before the next contact', () => {
  const ctx = live(); counters(ctx); primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'endTurn' });
  assert.equal(ctx.reactionRules.contactPolicy, 'perHit');
  assert.equal(ctx.eventLog.filter(row => row.type === 'damageDealt' && row.targetId === ctx.player.id).length, 0);
  assert.ok(ctx.eventLog.findIndex(row => row.type === 'combatContactPrepared') < ctx.eventLog.findIndex(row => row.type === 'combatReactionOffered'), 'incoming contact is public before its choice');
  for (let hit = 0; hit < 3; hit++) {
    assert.ok(ctx.pendingReaction, `contact${hit} offers its own response`);
    const before = ctx.eventLog.length;
    const picked = ctx.pendingReaction.options.find(option => option.play.cardInstanceId === `counter-${hit}`);
    assert.ok(picked);
    primeAccuracyRolls(ctx, { count: 3 });
    const out = answer(ctx, picked.id);
    const events = ctx.eventLog.slice(before);
    assert.equal(events.filter(row => row.type === 'cardPlayed').length, 1, 'choice pays and plays one card immediately');
    assert.equal(events.filter(row => row.type === 'damageDealt' && row.targetId === ctx.player.id).length, 1, `hit${hit} only one incoming contact commits: ${events.map(row => row.type).join(',')}`);
    assert.equal(events.filter(row => row.type === 'combatCounterTriggered').length, 1, 'newly paid Counter may answer its own hit');
    const incoming = events.findIndex(row => row.type === 'damageDealt' && row.targetId === ctx.player.id);
    const returned = events.findIndex(row => row.type === 'combatCounterTriggered');
    assert.ok(incoming < returned);
    const next = events.findIndex(row => row.type === 'combatContactPrepared');
    if (next >= 0) assert.ok(returned < next, 'the next contact is announced after this Counter return');
    assert.equal(ctx.reactionStack, undefined, 'no upfront multi-card stack remains');
  }
  assert.equal(ctx.pendingReaction, undefined);
  assert.equal(ctx.eventLog.filter(row => row.type === 'cardPlayed' && row.cardId === 'core.counter').length, 3);
  assert.equal(ctx.eventLog.filter(row => row.type === 'enemyMoveStarted').length, 1, 'the root move is executed and paid once');
});

test('skipping a per-hit response advances only that hit and reload preserves every pause', () => {
  let ctx = live(); counters(ctx);
  primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'endTurn' });
  const initial = ctx.player.hp;
  for (let hit = 0; hit < 3; hit++) {
    const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
    assert.deepEqual(combatSnapshotProblems(saved), []);
    const restored = restoreCombatSnapshot({ registries, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), snapshot: saved });
    answer(ctx); answer(restored);
    assert.deepEqual(JSON.parse(JSON.stringify(serializeCombatSnapshot(restored))), JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx))));
    assert.deepEqual(restored.rng.getCounters(), ctx.rng.getCounters());
    ctx = restored;
  }
  assert.equal(ctx.pendingReaction, undefined);
  assert.equal(initial - ctx.player.hp, 15);
  assert.deepEqual(ctx.eventLog.filter(row => row.type === 'damageDealt' && row.targetId === ctx.player.id).map(row => row.amount), [5, 5, 5]);
});

test('three live 5-damage contacts lose 15 HP and paint three -5 readouts', t => {
  const ctx = live(); primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'setReactions', enabled: false });
  const before = ctx.eventLog.length;
  dispatch(ctx, { type: 'endTurn' });
  const events = ctx.eventLog.slice(before);
  assert.equal(ctx.player.hp, 85);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  withKitDom(dom => {
    const layer = dom.document.createElement('div'), floats = [];
    const append = layer.appendChild.bind(layer);
    layer.appendChild = node => { if (/\bfloat-num\b/.test(node.className) && /\bdmg\b/.test(node.className)) floats.push(node.textContent); return append(node); };
    const anchors = new Map(['player', 'e1'].map(id => [id, dom.document.createElement('div')]));
    let done = false;
    setAnimSpeed('instant');
    try {
      playTimeline(events, { layer, anchorFor: id => anchors.get(id), onBeatApplied() {} }, () => { done = true; });
      for (let i = 0; i < 1000 && !done; i++) t.mock.timers.tick(1);
      assert.equal(done, true);
      assert.deepEqual(floats, ['-5', '-5', '-5']);
    } finally { setAnimSpeed('normal'); }
  });
});

test('invalid contact cursor and policy are refused at the save boundary', () => {
  const ctx = live(); counters(ctx); dispatch(ctx, { type: 'endTurn' });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
  const cursor = JSON.parse(JSON.stringify(saved));
  cursor.abilityQueue[0].meta.expansionGroup.contactSequence.index = -1;
  assert.ok(combatSnapshotProblems(cursor).includes('Invalid combat contact sequence'));
  const policy = JSON.parse(JSON.stringify(saved)); policy.reactionRules.contactPolicy = 'allAtOnce';
  assert.ok(combatSnapshotProblems(policy).some(problem => problem.includes('contact policy')));
  const next = JSON.parse(JSON.stringify(saved)); next.abilityQueue[0].meta.contactIndex = 999;
  assert.ok(combatSnapshotProblems(next).includes('Invalid queued combat contact'));
});

test('missing contact policy in a saved Core fight preserves its historical whole-root plan', () => {
  const ctx = live(); delete ctx.reactionRules.contactPolicy; counters(ctx);
  dispatch(ctx, { type: 'endTurn' });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), snapshot: saved });
  assert.equal(restored.reactionRules.contactPolicy, undefined);
  assert.equal(restored.queue[0].meta.expansionGroup.contactSequence, undefined);
  assert.equal(Object.values(restored.queue[0].meta.expansionGroup.targets)[0].contacts.length, 3);
  assert.equal(live().reactionRules.contactPolicy, 'perHit', 'the next newly created fight gets the new policy');
});
