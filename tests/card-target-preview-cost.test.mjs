import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, cardNeedsEnemyTargetNow } from '../src/engine/combat.js';
import { createCoopCombat, playCard, cardNeedsEnemyTargetForPlayer } from '../src/engine/coopCombat.js';
import { emitEvent, hasEventTriggers, triggerOwnerKey } from '../src/engine/triggers.js';
import { grantAbilityCharge } from '../src/engine/abilityRiders.js';
import { getStacks } from '../src/engine/statuses.js';
import { botCardTargetId } from '../tools/simbot.mjs';
import { firstAffordableCard, refusalsFor } from '../tools/simbot.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { cardChoicePlan } from '../src/engine/combat.js';

const base = createRegistries(contentBundle);
const charge = { op: 'grantCardCharge', target: 'self', key: 'target-probe', buildupStatus: 'frost', buildup: 2 };
const mount = triggers => ({ kind: 'feat', id: 'target-probe', rules: [{ tag: 'probe', triggers }] });
function fixture(coop = false) {
  const def = { ...base.cards.get('defend'), gradeProfiles: undefined, legacyFace: undefined, cost: 1, manaCost: 0,
    effects: [{ op: 'block', target: 'self', amount: 4 }], upgrade: {} };
  const registries = { ...base, cards: { ...base.cards, get: id => id === 'defend' ? def : base.cards.get(id) } };
  const player = id => ({ id, classId: 'reaver', hp: 80, maxHp: 80, energyMax: 20, maxStamina: 20,
    stamina: 20, drawPerTurn: 3, relicIds: [], deck: Array.from({ length: 5 }, (_, i) => ({ instanceId: id + i, cardId: 'defend', upgraded: false })) });
  const combat = coop
    ? createCoopCombat({ registries, rng: createRng(91), players: [player('a'), player('b')], enemyIds: ['wanderingSoldier'] })
    : createCombat({ registries, rng: createRng(91), player: player('a'), enemyIds: ['wanderingSoldier'] });
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
  return combat;
}
function data(combat) {
  return structuredClone(Object.fromEntries(Object.entries(combat)
    .filter(([key, value]) => typeof value !== 'function' && !['registries', 'rng'].includes(key))));
}
function countFullClones(fn) {
  const clone = globalThis.structuredClone;
  let fullClones = 0;
  globalThis.structuredClone = (value, ...args) => {
    // Count detached combat graphs, not the small status/source snapshots
    // that actual card resolution must still capture.
    if (Array.isArray(value?.enemies) && Array.isArray(value?.queue) && value?.triggerState instanceof Map) fullClones++;
    return clone(value, ...args);
  };
  try { return { value: fn(), fullClones }; }
  finally { globalThis.structuredClone = clone; }
}
function assertPreviewParity(combat, expectedClones) {
  const id = combat.piles.hand[0].instanceId, before = data(combat), rng = combat.rng.getCounters();
  const expected = previewCard(combat, id).needsTarget;
  const actual = countFullClones(() => cardNeedsEnemyTargetNow(combat, id));
  assert.equal(actual.value, expected);
  assert.equal(actual.fullClones, expectedClones);
  assert.deepEqual(data(combat), before);
  assert.deepEqual(combat.rng.getCounters(), rng);
  return actual.value;
}

for (const coop of [false, true]) test(`an ordinary friendly play retains only its real transaction clone, coop=${coop}`, () => {
  const combat = fixture(coop), id = combat.piles.hand[0].instanceId, owner = combat.playerKey;
  assert.equal(hasEventTriggers(combat, 'cardPreparing'), false);
  assert.equal(assertPreviewParity(combat, 0), false);
  const target = countFullClones(() => botCardTargetId(combat.registries, combat, combat.piles.hand[0], 'e1', owner));
  assert.equal(target.value, undefined);
  assert.equal(target.fullClones, coop ? 1 : 0, 'co-op owner binding needs one detached graph; solo needs none');
  const actual = countFullClones(() => coop ? playCard(combat, owner, id) : dispatch(combat, { type: 'playCard', cardInstanceId: id }));
  assert.equal(actual.fullClones, 1, 'actual play remains atomic; the target guard adds no nested preview');
  assert.ok(combat.player.block > 0);
});

for (const coop of [false, true]) test(`live buildup keeps hostile targeting, atomic refusal and one-use consumption, coop=${coop}`, () => {
  const combat = fixture(coop), owner = combat.playerKey, id = combat.piles.hand[0].instanceId;
  grantAbilityCharge(combat.player, charge);
  assert.equal(assertPreviewParity(combat, 0), true);
  const before = data(combat), rng = combat.rng.getCounters();
  const playAt = targetId => coop ? playCard(combat, owner, id, targetId)
    : dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId });
  assert.throws(() => playAt(coop ? owner : combat.player.id), /Invalid enemy target/);
  assert.deepEqual(data(combat), before);
  assert.deepEqual(combat.rng.getCounters(), rng);
  assert.equal(countFullClones(() => playAt('e1')).fullClones, 1);
  assert.equal(getStacks(combat.enemies[0], 'frost'), 2);
  assert.deepEqual(combat.player.abilityRiders.charges, {});
});

test('preparing properties, statuses, stances and enemy phases retain the detached full bus', () => {
  const cases = [
    combat => { combat.propertyMounts.player ||= {}; combat.propertyMounts.player.probe = mount([{ on: 'cardPreparing', do: [charge] }]); },
    combat => { const statuses = combat.registries.statuses; combat.registries = { ...combat.registries, statuses: { ...statuses,
      get: id => id === 'prepared' ? { ...statuses.get(id), hooks: [{ on: 'cardPreparing', do: [charge] }] } : statuses.get(id) } }; combat.player.statuses.prepared = { stacks: 1 }; },
    combat => { const stances = combat.registries.stances; combat.registries = { ...combat.registries, stances: { ...stances,
      get: id => ({ ...stances.get(id), hooks: [{ on: 'cardPreparing', do: [charge] }] }) } }; combat.player.stanceId = 'bulwark'; },
    combat => { const enemies = combat.registries.enemies; combat.registries = { ...combat.registries, enemies: { ...enemies,
      get: id => ({ ...enemies.get(id), phases: [{ on: 'cardPreparing', do: [{ ...charge, target: 'player' }] }] }) } }; },
  ];
  for (const setup of cases) {
    const combat = fixture(); setup(combat);
    assert.equal(hasEventTriggers(combat, 'cardPreparing'), true);
    assert.equal(assertPreviewParity(combat, 1), true);
  }
  const combat = fixture(), id = combat.piles.hand[0].instanceId;
  combat.propertyMounts[triggerOwnerKey(combat, combat.player)] ||= {};
  combat.propertyMounts.player.probe = mount([{ on: 'cardPreparing', do: [charge] }]);
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: 'e1' });
  assert.equal(getStacks(combat.enemies[0], 'frost'), 2, 'the actual preparing charge resolves on the selected enemy');
  assert.deepEqual(combat.player.abilityRiders.charges, {});
});

test('an inactive co-op preparing listener conservatively preserves detached target inspection', () => {
  const combat = fixture(true), inactive = [...combat.players.keys()].find(id => id !== combat.playerKey);
  combat.propertyMounts[inactive] ||= {};
  combat.propertyMounts[inactive].probe = mount([{ on: 'cardPreparing', do: [charge] }]);
  assert.equal(hasEventTriggers(combat, 'cardPreparing'), true);
  assertPreviewParity(combat, 1);
  const before = data(combat), rng = combat.rng.getCounters(), id = combat.piles.hand[0].instanceId;
  const target = countFullClones(() => cardNeedsEnemyTargetForPlayer(combat, combat.playerKey, id));
  assert.equal(target.fullClones, 2, 'owner binding plus the uncertain preparing bus both remain detached');
  assert.deepEqual(data(combat), before); assert.deepEqual(combat.rng.getCounters(), rng);
});

test('queued charges, paused selection and custom emitters retain exact preview semantics and purity', () => {
  const queued = fixture(); queued.queue.push({ effect: charge, source: queued.player, owner: queued.player, target: queued.player, meta: {} });
  assert.equal(assertPreviewParity(queued, 1), true);
  const paused = fixture(); paused.pendingAbilityDiscard = { count: 1 };
  paused.queue.push({ effect: charge, source: paused.player, owner: paused.player, target: paused.player, meta: {} });
  assert.equal(assertPreviewParity(paused, 1), false, 'pending selection never drains queued charges');
  const custom = fixture(); custom._emitEvent = (ctx, type, payload) => {
    if (type === 'cardPreparing') grantAbilityCharge(ctx.player, charge);
    return emitEvent(ctx, type, payload);
  };
  assert.equal(assertPreviewParity(custom, 1), true, 'unknown event buses can supply the hostile charge');
});

test('transitional terminal boards preserve full preview errors instead of bypassing endCheck', () => {
  for (const terminal of ['player', 'enemies', 'result']) {
    const combat = fixture();
    if (terminal === 'player') combat.player.alive = false;
    else if (terminal === 'enemies') for (const enemy of combat.enemies) enemy.alive = false;
    else combat.result = 'victory';
    assertPreviewParity(combat, 1);
  }
  const combat = fixture(); for (const enemy of combat.enemies) enemy.alive = false;
  combat.foundation = { rules: { triggers: { maxEvents: 1, maxDepth: 64 } }, profiles: {}, actionSerial: 0, eventSerial: 0,
    eventCount: 0, counts: {}, rolls: {} };
  const before = data(combat), id = combat.piles.hand[0].instanceId;
  assert.throws(() => previewCard(combat, id), /combat event limit exceeded/);
  assert.throws(() => cardNeedsEnemyTargetNow(combat, id), /combat event limit exceeded/);
  assert.deepEqual(data(combat), before);
});

test('real run fights retain every valid bot decision, save and RNG versus forced detached targeting', () => {
  function fight(classId, forcePreview) {
    const run = createRunState({ seed: 1, classId, registries: base });
    const combat = createRunCombat({ registries: base, run, rng: createRng(11), enemyIds: base.encounters.get('patrol').enemies });
    if (forcePreview) combat._emitEvent = (...args) => emitEvent(...args);
    const decisions = []; let guard = 0;
    while (!combat.result && combat.turn <= 150 && guard++ < 8000) {
      const refused = refusalsFor(combat), card = firstAffordableCard(base, combat, refused);
      if (!card) { dispatch(combat, { type: 'endTurn' }); decisions.push(['endTurn']); continue; }
      const targetId = botCardTargetId(base, combat, card, combat.enemies.find(enemy => enemy.alive)?.id);
      const choice = cardChoicePlan(combat, card.instanceId)?.options[0]?.id;
      try {
        dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId, choice });
        decisions.push(['play', card.instanceId, targetId, choice]);
      } catch (error) {
        assert.doesNotMatch(error.message, /Invalid (?:enemy|friendly|self|ally) target/, 'the bot must offer valid sides, including defensive plays');
        refused.add(card.instanceId); decisions.push(['refused', card.instanceId, error.message]);
      }
    }
    assert.ok(guard < 8000 && combat.result, `${classId}: the actual fight completes`);
    assert.ok(combat.eventLog.some(event => event.type === 'blockGained'), `${classId}: source-side cards actually execute`);
    return { decisions, saved: serializeCombatSnapshot(combat), rng: combat.rng.getCounters() };
  }
  for (const { id } of base.classes.all()) assert.deepEqual(fight(id, false), fight(id, true), id);
});
