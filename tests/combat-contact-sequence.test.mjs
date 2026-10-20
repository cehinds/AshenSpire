import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { reactionRulesSnapshot } from '../src/content/combatCardTraits.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { playTimeline, setAnimSpeed } from '../src/ui/fx.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { startQueuedEnemy } from '../src/engine/combatReactions.js';
import { prepareTacticalCard, tacticalCarrier } from '../src/engine/combatCardTactics.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
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
function live(damage = 5, effects = undefined) {
  const selected = damage === 5 && effects === undefined ? registries : { ...registries, enemies: { ...registries.enemies, get(id) {
    const row = registries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, moves: { ...row.moves, slash: { ...row.moves.slash, damage, ...(effects ? { effects } : {}) } } } : row;
  } } };
  const run = createRunState({ registries: selected, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: selected, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
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
  const ctx = live(8); counters(ctx); primeAccuracyRolls(ctx, { count: 3 });
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
    assert.equal(events.filter(row => row.type === 'blockGained' && row.source === 'counter').length, 1, `hit${hit}: each paid advantaged Counter earns its hit Block`);
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

test('a paid Counter with a nested discard resumes its one contact exactly after JSON reload', () => {
  const base = contentBundle.cards.find(card => card.id === 'guardCounter');
  const localBase = createRegistries({ ...contentBundle,
    cards: [...contentBundle.cards, { ...base, id: 'chooseCounter', name: 'Choose Counter', gradeProfiles: undefined, legacyFace: undefined,
      effects: [{ op: 'discard', choose: true, amount: 1 }, ...base.effects] }],
    tagging: [...contentBundle.tagging,
      ...contentBundle.tagging.filter(row => row.family === 'card' && row.objectId === 'guardCounter').map(row => ({ ...row, objectId: 'chooseCounter' })),
      { family: 'card', scope: '', objectId: 'chooseCounter', tagId: 'trait:reaction' }] });
  const local = { ...localBase, enemies: { ...localBase.enemies, get(id) {
    const row = localBase.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, hits: 3 } } } : row;
  } } };
  const ctx = createCombat({ registries: local, rng: createRng(511), combatExpansionVersion: 2, reactionRulesVersion: 2,
    reactionRules: { ...reactionRulesSnapshot(), contactPolicy: 'perHit' }, enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', hp: 100, maxHp: 100, energyMax: 20, stamina: 20, maxStamina: 20, mana: 20, maxMana: 20, drawPerTurn: 4,
      deck: [{ cardId: 'chooseCounter', instanceId: 'nested-counter', upgraded: false },
        ...['filler-a', 'filler-b', 'filler-c'].map(instanceId => ({ cardId: 'strike', instanceId, upgraded: false }))] } });
  ctx.player.block = 999; ctx.player.basePrecisionBonus = 1000;
  ctx.enemies[0].basePrecisionBonus = 1000;
  ctx.enemies[0].hp = ctx.enemies[0].maxHp = 1000;
  ctx.enemies[0].persistentPoise = { value: 1000, max: 1000 };
  dispatch(ctx, { type: 'endTurn' });
  const option = ctx.pendingReaction.options.find(row => row.play.cardInstanceId === 'nested-counter');
  assert.ok(option); answer(ctx, option.id);
  assert.ok(ctx.pendingAbilityDiscard, JSON.stringify(ctx.eventLog.slice(-15))); assert.ok(ctx.reactionResume);
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
  const restored = restoreCombatSnapshot({ registries: local, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), snapshot: saved });
  for (const combat of [ctx, restored]) dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: ['filler-a'] });
  assert.deepEqual(JSON.parse(JSON.stringify(serializeCombatSnapshot(restored))), JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx))));
  assert.deepEqual(restored.rng.getCounters(), ctx.rng.getCounters());
  assert.equal(ctx.eventLog.filter(row => row.type === 'cardPlayed' && row.cardInstanceId === 'nested-counter').length, 1);
});

test('a lethal Counter cancels the rest of the multi-hit root without another prompt', () => {
  const ctx = live(); counters(ctx); ctx.enemies[0].hp = 1;
  dispatch(ctx, { type: 'endTurn' }); primeAccuracyRolls(ctx, { count: 3 });
  answer(ctx, ctx.pendingReaction.options.find(row => row.play.cardInstanceId === 'counter-0').id);
  assert.equal(ctx.result, 'victory'); assert.equal(ctx.pendingReaction, undefined); assert.equal(ctx.queue.length, 0);
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatCounterTriggered').length, 1);
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatContactPrepared').length, 1);
  assert.deepEqual(combatSnapshotProblems(serializeCombatSnapshot(ctx)), []);
});

test('a lethal incoming hit emits no later swing or preparation at the fallen player', () => {
  const ctx = live(); ctx.player.hp = 1;
  dispatch(ctx, { type: 'setReactions', enabled: false });
  primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'endTurn' });
  assert.equal(ctx.result, 'defeat');
  assert.equal(ctx.eventLog.filter(row => row.type === 'damageDealt' && row.targetId === ctx.player.id).length, 1);
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatContactPrepared').length, 1);
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatHitStarted').length, 0);
  assert.equal(ctx.eventLog.filter(row => row.type === 'enemyMoveStarted').length, 1);
});

test('a final-hit lethal Counter cancels the defeated actor\'s trailing effects', () => {
  const ctx = live(5, [{ op: 'applyStatus', target: 'player', status: 'vulnerable', stacks: 2 }]);
  counters(ctx); ctx.enemies[0].hp = 1; primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'endTurn' }); answer(ctx); answer(ctx);
  primeAccuracyRolls(ctx, { count: 3 });
  answer(ctx, ctx.pendingReaction.options.find(row => row.play.cardInstanceId === 'counter-0').id);
  assert.equal(ctx.result, 'victory'); assert.equal(ctx.pendingReaction, undefined);
  assert.equal(ctx.player.statuses.vulnerable, undefined);
  assert.equal(ctx.eventLog.filter(row => row.type === 'statusApplied' && row.status === 'vulnerable').length, 0);
  assert.equal(ctx.pendingExpansionActions, 0); assert.equal(ctx.queue.length, 0);
  assert.deepEqual(combatSnapshotProblems(serializeCombatSnapshot(ctx)), []);
});

test('an enemy Counter stops a defeated player\'s later hits and trailing effects', () => {
  const base = contentBundle.cards.find(card => card.id === 'strike');
  const bundle = { ...contentBundle, cards: [...contentBundle.cards, { ...base, id: 'multiSwing', cost: 0, costRule: 'fixed', manaCost: 0,
    gradeProfiles: undefined, legacyFace: undefined, effects: [{ op: 'damage', target: 'enemy', amount: 5, hits: 3 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }] }],
  tagging: [...contentBundle.tagging, ...contentBundle.tagging.filter(row => row.family === 'card' && row.objectId === 'strike').map(row => ({ ...row, objectId: 'multiSwing' }))] };
  const ctx = live();
  ctx.registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(bundle, profile)), profile);
  ctx.player.hp = 1; ctx.enemies[0].block = 100;
  const counter = resolveCombatCard(ctx, { cardId: 'core.counter' });
  prepareTacticalCard(ctx, ctx.enemies[0], ctx.player, tacticalCarrier(counter, { instanceId: 'enemy-counter' }, ctx, ctx.enemies[0]), counter.effects, {});
  ctx.piles.hand = [{ instanceId: 'swing', cardId: 'multiSwing', upgraded: false }]; primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'swing', targetId: ctx.enemies[0].id });
  assert.equal(ctx.result, 'defeat'); assert.equal(ctx.player.alive, false);
  assert.equal(ctx.eventLog.filter(row => row.type === 'damageDealt' && row.sourceId === ctx.player.id).length, 1);
  assert.equal(ctx.enemies[0].statuses.vulnerable, undefined);
  assert.equal(ctx.eventLog.filter(row => row.type === 'cardPlayed' && row.cardInstanceId === 'swing').length, 1);
  assert.equal(ctx.piles.discard.filter(row => row.instanceId === 'swing').length, 1);
  assert.equal(ctx.pendingExpansionActions, 0); assert.equal(ctx.queue.length, 0);
  assert.deepEqual(combatSnapshotProblems(serializeCombatSnapshot(ctx)), []);
});

test('an absent contact target does not cancel a later original living target', () => {
  const events = [], source = { id: 'attacker', alive: true, statuses: {} };
  const ctx = { player: { id: 'player', alive: false }, enemies: [source, { id: 'other', alive: true }], emit: (type, event) => events.push({ type, ...event }) };
  const row = id => ({ id, contacts: [{ amount: 5 }] });
  const group = { targets: { player: row('player') }, enemyMoveStart: { sourceId: 'attacker', moveId: 'slash' }, contactSequence: { index: 1, contacts: [{}, {}, {}] } };
  const action = { source, meta: { expansionGroup: group } };
  startQueuedEnemy(ctx, action);
  assert.deepEqual(events, []); assert.equal(group.cancelled, false);
  group.targets = { other: row('other') }; group.contactSequence.index = 2; group.payloadStarted = false;
  startQueuedEnemy(ctx, action);
  assert.deepEqual(events.map(row => [row.type, row.contactIndex]), [['combatHitStarted', 2]]);
});

test('an already armed automatic Counter remains one charge when optional prompts are disabled', () => {
  const ctx = live(); counters(ctx); primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'counter-0' });
  dispatch(ctx, { type: 'setReactions', enabled: false });
  dispatch(ctx, { type: 'endTurn' });
  assert.equal(ctx.pendingReaction, undefined);
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatCounterTriggered').length, 1);
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatCounterConsumed').length, 1);
});
