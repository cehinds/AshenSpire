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
import { prepareTacticalCard, tacticalCarrier, enemyMoveCarrier } from '../src/engine/combatCardTactics.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
// Fund the authored three-contact Slash before the planner selects its head.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
  characters: { tagRules: { 'tier.minion': { pools: { sp: 4 } } } },
} });
const baseRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// Moves are compiled from shared authored sources by createRegistries; alter the
// final registered move so this fixture fixes an exact 5-per-hit contract.
const registries = Object.freeze({ ...baseRegistries, enemies: {
  ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id), get: id => {
    const row = baseRegistries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage: 5, hits: 3 } } } : row;
  }
} });
function live(damage = 5, effects = undefined, enemyIds = ['wanderingSoldier']) {
  const selected = damage === 5 && effects === undefined ? registries : { ...registries, enemies: { ...registries.enemies, get(id) {
    const row = registries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, moves: { ...row.moves, slash: { ...row.moves.slash, damage, ...(effects ? { effects } : {}) } } } : row;
  } } };
  const run = createRunState({ registries: selected, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: selected, run, rng: createRng(511), enemyIds });
  assert.equal(combat.enemies[0].maxStamina, 2, 'the native pool is two SP');
  // A three-contact move costs 1 SP per hit (owner, 2026-10-25): fund the fixture's slash.
  Object.assign(combat.enemies[0], { maxStamina: 3, stamina: 3, plannedMoves: [] });
  const enemy = combat.enemies[0], move = selected.enemies.get(enemy.enemyId).moves.slash;
  enemy.intent = { kind: 'attack', moveId: 'slash', damage, hits: 3,
    combatProfile: enemyMoveCarrier(enemy, move, 'slash', combat).combatProfile };
  enemy.actorIntentRevealed = true;
  assert.equal(combat.enemies[0].intent.moveId, 'slash');
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
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatReactionUnavailable' && row.reason === 'alreadyAnswered').length, 0,
    'settling one contact never says the later hits cannot be answered');
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

test('ancillary contacts never turn a per-hit answer into a whole-root refusal notice', () => {
  const ctx = live(5, [{ op: 'applyStatus', target: 'player', status: 'vulnerable', stacks: 2 }]);
  counters(ctx); primeAccuracyRolls(ctx, { count: 3 }); dispatch(ctx, { type: 'endTurn' });
  for (let hit = 0; hit < 3; hit++) {
    assert.ok(ctx.pendingReaction, `hit${hit} still has its own response`);
    primeAccuracyRolls(ctx, { count: 3 });
    answer(ctx, ctx.pendingReaction.options.find(row => row.play.cardInstanceId === `counter-${hit}`).id);
  }
  assert.equal(ctx.eventLog.filter(row => row.type === 'combatReactionUnavailable' && row.reason === 'alreadyAnswered').length, 0);
});

test('three live 5-damage contacts lose 15 HP and paint three -5 readouts', t => {
  const ctx = live(); primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'setReactions', enabled: false });
  const before = ctx.eventLog.length;
  dispatch(ctx, { type: 'endTurn' });
  const events = ctx.eventLog.slice(before);
  assert.equal(ctx.player.hp, 85);
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  // The scheduler's monotonic clock must advance with these mocked timers.
  t.mock.method(globalThis.performance, 'now', () => Date.now());
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

test('a paid Counter with a nested discard resumes its one contact exactly after JSON reload', async () => {
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
  const { projectCombatIntent } = await import('../src/ui/models/CombatIntentProjectionModel.js');
  const paused = projectCombatIntent(ctx, ctx.enemies[0].id);
  assert.equal(paused.damageScope, 'contact'); assert.equal(paused.hits, 1); assert.equal(paused.contactIndex, 0);
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

// The overhead forecast is the next unresolved contact of this exact actor.
// Exercise production engine receipts and the screen's reducer together.
test('Core2 next-contact forecasts survive reaction pauses and JSON reload without replaying full damage', async () => {
  const { projectCombatIntent, applyCombatIntentReceipt } = await import('../src/ui/models/CombatIntentProjectionModel.js');
  let ctx = live(8); counters(ctx);
  ctx.player.block = 12;
  ctx.enemies[0].intent.damage = 8; ctx.enemies[0].intent.hits = 3;
  const whole = projectCombatIntent(ctx, ctx.enemies[0].id);
  let totalLoss = 0;
  const id = ctx.enemies[0].id;
  const entities = { [id]: { kind: 'enemy', intentPreview: projectCombatIntent(ctx, id) } };
  primeAccuracyRolls(ctx, { count: 3 }); dispatch(ctx, { type: 'endTurn' });
  for (let hit = 0; hit < 3; hit++) {
    assert.ok(ctx.pendingReaction);
    const before = JSON.stringify({ player: ctx.player, enemies: ctx.enemies, events: ctx.eventLog, counters: ctx.rng.getCounters() });
    const shown = projectCombatIntent(ctx, id);
    assert.equal(JSON.stringify({ player: ctx.player, enemies: ctx.enemies, events: ctx.eventLog, counters: ctx.rng.getCounters() }), before);
    assert.equal(shown.damageScope, 'contact'); assert.equal(shown.hits, 1);
    assert.equal(shown.contactIndex, hit); assert.equal(shown.contactCount, 3);
    const prepared = ctx.eventLog.findLast(event => event.type === 'combatContactPrepared');
    assert.deepEqual(shown.projectedDamage, prepared.intentPreview.projectedDamage, 'the snapshot and announcing receipt use the same current HP math');
    const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
    const restored = restoreCombatSnapshot({ registries, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), snapshot: saved });
    assert.deepEqual(projectCombatIntent(restored, id), shown);
    ctx = restored;
    const start = ctx.eventLog.length;
    primeAccuracyRolls(ctx, { count: 3 }); answer(ctx);
    const events = ctx.eventLog.slice(start);
    const damage = events.find(event => event.type === 'damageDealt' && event.sourceId === id);
    totalLoss += damage.amount - damage.blocked;
    assert.equal(damage.amount - damage.blocked, shown.projectedDamage.max, 'the displayed current-contact HP matches the actual landed contact');
    for (const event of [prepared, ...events]) {
      applyCombatIntentReceipt(entities, event);
      if (event.type === 'damageDealt' && event.sourceId === id)
        assert.equal(entities[id].intentPreview.damage, undefined, 'the completed damage is no longer a forecast');
    }
  }
  assert.equal(totalLoss, whole.projectedDamage.max, 'the pre-action forecast and all landed contacts spend defenses identically');
});

test('intent playback clears only the acting instance and restores a prepared hold after a Counter', async () => {
  const { applyCombatIntentReceipt } = await import('../src/ui/models/CombatIntentProjectionModel.js');
  const hold = { kind: 'block', moveId: 'guard', block: 9, revealed: true };
  const other = { kind: 'attack', moveId: 'slash', damage: 17, revealed: true };
  const entities = { e1: { kind: 'enemy', intentPreview: hold }, e2: { kind: 'enemy', intentPreview: other } };
  applyCombatIntentReceipt(entities, { type: 'combatCounterTriggered', sourceId: 'e1', sourceKind: 'enemy', amount: 7 });
  assert.equal(entities.e1.intentPreview.damage, 7);
  applyCombatIntentReceipt(entities, { type: 'damageDealt', sourceId: 'e1' });
  assert.equal(entities.e1.intentPreview, hold);
  assert.equal(entities.e2.intentPreview, other);
  applyCombatIntentReceipt(entities, { type: 'damageDealt', sourceId: 'e2' });
  assert.equal(entities.e2.intentPreview, other, 'damage outside an announced move does not consume a future intent');
  applyCombatIntentReceipt(entities, { type: 'combatContactPrepared', sourceId: 'e2', intentPreview: other });
  applyCombatIntentReceipt(entities, { type: 'attackMissed', sourceId: 'e2' });
  assert.equal(entities.e2.intentPreview.damage, undefined, 'misses consume the contact too');
  applyCombatIntentReceipt(entities, { type: 'enemyMoveStarted', sourceId: 'e1', intentPreview: hold });
  applyCombatIntentReceipt(entities, { type: 'enemyMoveEnded', sourceId: 'e1' });
  assert.equal(entities.e1.intentPreview.block, undefined, 'finished support moves stop advertising the previous Block');
  entities.e1.intentPreview = hold;
  applyCombatIntentReceipt(entities, { type: 'enemyMoveStarted', sourceId: 'e1', reaction: true });
  applyCombatIntentReceipt(entities, { type: 'enemyMoveEnded', sourceId: 'e1', reaction: true });
  assert.equal(entities.e1.intentPreview, hold, 'support-only reactions return to their planned hold');
  applyCombatIntentReceipt(entities, { type: 'enemyMoveStarted', sourceId: 'e1', reaction: true });
  applyCombatIntentReceipt(entities, { type: 'enemyMoveStarted', sourceId: 'e1', intentPreview: other });
  applyCombatIntentReceipt(entities, { type: 'damageDealt', sourceId: 'e1' });
  assert.equal(entities.e1.intentPreview.damage, undefined, 'an unrelated move cannot resurrect the saved reaction hold');
});


test('Core2 armed Counter is priced identically before the move, at the first contact, and at impact', async () => {
  const { projectCombatIntent } = await import('../src/ui/models/CombatIntentProjectionModel.js');
  const ctx = live(20); counters(ctx); primeAccuracyRolls(ctx, { count: 3 });
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'counter-0' });
  ctx.player.block = 0; ctx.enemies[0].hp = ctx.enemies[0].maxHp = 1000;
  const id = ctx.enemies[0].id;
  ctx.enemies[0].actorIntentRevealed = true;
  const before = projectCombatIntent(ctx, id);
  assert.ok(before.projectedDamage, JSON.stringify({before, intent:ctx.enemies[0].intent}));
  dispatch(ctx, { type: 'endTurn' });
  const first = projectCombatIntent(ctx, id);
  assert.ok(first.projectedDamage, JSON.stringify({first, before, pending:ctx.pendingReaction, events:ctx.eventLog.slice(-25)}));
  const initialHp = ctx.player.hp;
  const start = ctx.eventLog.length;
  while (ctx.pendingReaction) { primeAccuracyRolls(ctx, { count: 3 }); answer(ctx); }
  const actual = ctx.eventLog.slice(start).filter(event => event.type === 'damageDealt' && event.sourceId === id);
  assert.equal(first.projectedDamage.max, actual[0].amount - actual[0].blocked);
  assert.equal(before.projectedDamage.max, initialHp - ctx.player.hp);
});

test('completed enemy intent stays consumed while another instance pauses, and a pooled follow-up gets a fresh forecast', async () => {
  const { projectCombatIntent } = await import('../src/ui/models/CombatIntentProjectionModel.js');
  const ctx = live(5, undefined, ['wanderingSoldier', 'wanderingSoldier']); counters(ctx);
  const [first, second] = ctx.enemies;
  second.intent = structuredClone(first.intent);
  Object.assign(second, { maxStamina: 3, stamina: 3, plannedMoves: [], actorIntentRevealed: true });
  primeAccuracyRolls(ctx, { count: 3 }); dispatch(ctx, { type: 'endTurn' });
  for (let hit = 0; hit < 3; hit++) { primeAccuracyRolls(ctx, { count: 3 }); answer(ctx); }
  assert.equal(ctx.pendingReaction.sourceId, second.id);
  assert.equal(projectCombatIntent(ctx, first.id).damage, undefined, 'the completed instance does not repeat its last attack');
  assert.equal(projectCombatIntent(ctx, second.id).contactIndex, 0);

  const pooled = live(); counters(pooled);
  const enemy = pooled.enemies[0];
  enemy.maxStamina = enemy.stamina = 6;
  enemy.plannedMoves = [{ moveId: 'slash' }]; enemy.planDue = true;
  primeAccuracyRolls(pooled, { count: 3 }); dispatch(pooled, { type: 'endTurn' });
  for (let hit = 0; hit < 3; hit++) { primeAccuracyRolls(pooled, { count: 3 }); answer(pooled); }
  assert.ok(pooled.pendingReaction);
  const follow = projectCombatIntent(pooled, enemy.id);
  assert.equal(follow.contactIndex, 0, 'the pooled successor begins at its own first contact');
  assert.equal(follow.moveId, 'slash'); assert.equal(follow.hits, 1);
  assert.equal(enemy.intent.resolved, undefined, 'the successor replaces the spent head intent');
});
