import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { enqueueExpandedAction, previewExpandedActions } from '../src/engine/combatExpansionActions.js';
import { beforeReactionAction } from '../src/engine/combatReactions.js';
import { executeAction } from '../src/engine/actions.js';
import { counterAttackPreview, counterBaseEvasion } from '../src/engine/counterReturn.js';
import { counterEffectPreview } from '../src/engine/combatCardTactics.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const registries = createRegistries(contentBundle);
function fight() {
  const ctx = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10,
      maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  ctx.player.ratings = { ar: 9, dr: 0, pr: 3, ward: 30, poise: 30 };
  ctx.player.statuses = {};
  const target = ctx.enemies[0];
  target.evasion = 0; target.statuses = {};
  target.persistentWard = { max: 30, value: 30 };
  target.poiseMeter = { value: 0, max: 100, growths: 0 };
  return ctx;
}
function returnCarrier(range = 'reach', requiredRange = 'melee') {
  return { cardId: 'frostCounter', type: 'skill', damageSchool: 'magic',
    tags: ['camp:spell', 'school:frost', 'maneuver:counter', `range:${range}`],
    combatReaction: true, skipRatingBonus: true, counterReturnAttack: true, counterRequiredRange: requiredRange,
    combatProfile: { camp: 'spell', school: 'frost', maneuver: 'attack', damageType: 'frost', range, targeting: 'single' } };
}
function returnActions(ctx, carrier, hp = 0) {
  return [...(hp > 0 ? [{ op: 'damage', amount: hp }] : []),
    { op: 'poiseDamage', amount: 2 }, { op: 'wardDamage', amount: 3 }].map(effect => ({
      effect, source: ctx.player, owner: ctx.player, target: ctx.enemies[0], card: carrier, meta: { combatCounterReaction: true } }));
}
function drain(ctx) { while (ctx.queue.length) executeAction(ctx, ctx.queue.shift()); }

test('counter offensive reach is independent of ranged protection, with preview probability and no RNG', () => {
  const ctx = fight(), target = ctx.enemies[0], before = ctx.rng.getCounters();
  for (const [range, requiredRange, inRange] of [['melee', 'melee', true], ['melee', 'reach', false],
    ['reach', 'melee', true], ['reach', 'reach', true], ['reach', 'ranged', false], ['ranged', 'ranged', true]]) {
    const result = counterAttackPreview(ctx, ctx.player, target, returnCarrier(range, requiredRange));
    assert.equal(result.inRange, inRange);
    assert.equal(result.range, range); assert.equal(result.requiredRange, requiredRange);
    assert.equal(result.hitChance > 0, inRange);
  }
  const carrier = returnCarrier('reach', 'ranged');
  const preview = previewExpandedActions(ctx, returnActions(ctx, carrier), { source: ctx.player, target, carrier });
  assert.equal(preview[0][0].receipt.counterAttack.missReason, 'range');
  assert.deepEqual(ctx.rng.getCounters(), before);
});

test('range and accuracy misses gate HP, Poise and Ward together without spending prepared Evade', () => {
  for (const [range, requiredRange, die, expectedDraws, reason] of [
    ['melee', 'ranged', 20, 0, 'range'], ['ranged', 'melee', 1, 1, 'accuracy'],
  ]) for (const hp of [0, 5]) {
    const ctx = fight(), target = ctx.enemies[0], startHp = target.hp;
    target.combatEvade = { charges: 1, bonus: 100, advantage: false, disadvantage: false, expiresOnOwnerCycle: 1 };
    let draws = 0;
    ctx.rng.int = stream => { if (stream === 'counterAccuracy') draws++; return die; };
    const carrier = returnCarrier(range, requiredRange);
    enqueueExpandedAction(ctx, returnActions(ctx, carrier, hp), { source: ctx.player, target, carrier });
    drain(ctx);
    assert.equal(target.hp, startHp); assert.equal(target.persistentWard.value, 30);
    assert.equal(target.poiseMeter.value, 0); assert.equal(target.combatEvade.charges, 1);
    assert.equal(draws, expectedDraws);
    assert.ok(ctx.eventLog.some(event => event.type === 'combatCounterMissed' && event.reason === reason));
  }
});

test('a pressure-only return can be evaded; a successful hit spends its one accuracy roll and both payload lanes land', () => {
  for (const evade of [true, false]) {
    const ctx = fight(), target = ctx.enemies[0];
    if (evade) target.combatEvade = { charges: 1, bonus: 100, advantage: false, disadvantage: false, expiresOnOwnerCycle: 1 };
    let accuracyDraws = 0;
    ctx.rng.int = stream => { if (stream === 'counterAccuracy') accuracyDraws++; return 20; };
    const carrier = returnCarrier();
    enqueueExpandedAction(ctx, returnActions(ctx, carrier), { source: ctx.player, target, carrier });
    drain(ctx);
    assert.equal(accuracyDraws, 1);
    if (evade) {
      assert.equal(target.combatEvade.charges, 0);
      assert.equal(target.persistentWard.value, 30); assert.equal(target.poiseMeter.value, 0);
    } else {
      assert.equal(target.persistentWard.value, 27); assert.equal(target.poiseMeter.value, 2);
    }
  }
});

test('base Evasion uses the target seat equipment, explicit ratings override it, and prepared Evade adds no base rating', () => {
  const ctx = fight(), target = ctx.player;
  ctx.attributes = { dexterity: 3 };
  const armor = { id: 'default', classId: 'rogue', kind: 'armor' }, buckler = { id: 'buckler', kind: 'shield' };
  const equipment = { armour: [armor], armaments: [buckler], slots: [{ id: 'armor', kinds: ['armor'] }, { id: 'left', kinds: ['shield'] }] };
  const scoped = { ...ctx, registries: { ...registries, equipment },
    players: new Map([['target-seat', { classId: 'rogue', attributes: { dexterity: 3 },
      loadout: { sets: { armor: ['default'], left: ['buckler'] }, active: {} } }]]),
    playerIdForEntity: entity => entity === target ? 'target-seat' : null };
  target.classId = 'rogue';
  assert.equal(counterBaseEvasion(scoped, target), 3, 'Leather DEX term two plus buckler one');
  target.combatEvade = { charges: 5, bonus: 100 };
  assert.equal(counterBaseEvasion(scoped, target), 3, 'prepared charge/card bonus is separate');
  target.evasion = 9;
  assert.equal(counterBaseEvasion(scoped, target), 9, 'explicit value is full base Evasion');
});

test('spell Counter HP uses PR for both physical and magical types, while pressure has no invented PR or HP', () => {
  const ctx = fight();
  for (const damageType of ['blunt', 'fire']) {
    const carrier = { ...returnCarrier(), combatReaction: false, skipRatingBonus: false,
      combatProfile: { camp: 'spell', maneuver: 'counter', damageType }, attack: { source: 'spell', damageType } };
    assert.equal(counterEffectPreview(ctx, ctx.player, ctx.enemies[0], carrier, { op: 'damage', amount: 5 }).value, 8);
    assert.equal(counterEffectPreview(ctx, ctx.player, ctx.enemies[0], carrier, { op: 'wardDamage', amount: 2 }).value, 2);
  }
});

test('queued return range and hit metadata survive snapshots; version-one actions keep their original path', () => {
  const ctx = fight(), carrier = returnCarrier();
  ctx.piles.hand.push({ instanceId: 'snapshot-defense', cardId: 'crystalBarrier', abilityRank: 1 });
  const enemy = ctx.enemies[0];
  const actions = returnActions(ctx, carrier, 5).map(action => ({
    ...action, source: enemy, owner: enemy, target: ctx.player,
  }));
  enqueueExpandedAction(ctx, actions, { source: enemy, target: ctx.player, carrier });
  assert.equal(beforeReactionAction(ctx, ctx.queue[0], {
    play: (candidate, play) => dispatch(candidate, { type: 'playCard', ...play }),
  }), true, 'a real Reaction offer pauses the queued return');
  assert.ok(ctx.pendingReaction);
  const saved = serializeCombatSnapshot(ctx);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(5), snapshot: saved });
  assert.ok(restored.queue.some(action => action.card?.counterReturnAttack === true && action.card.counterRequiredRange === 'melee'));
  const legacy = fight(); legacy.combatExpansionVersion = 1;
  assert.equal(counterAttackPreview(legacy, legacy.player, legacy.enemies[0], carrier), null);
  enqueueExpandedAction(legacy, returnActions(legacy, carrier), { source: legacy.player, target: legacy.enemies[0], carrier });
  assert.equal(legacy.queue[0].meta.expansionGroup, undefined);
});
