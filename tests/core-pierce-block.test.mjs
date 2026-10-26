// Owner bug 2026-10-26: "Attacks are bypassing block". In Core a piercing hit (Rogue daggers, spears, many enemies) skipped all Block.
// Owner ruling the same day: "pierce should be about floor(.2 * damage)": each pierce hit lets floor(0.2 x its own damage) past Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { live, baseRegistries, registries } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { guardHitFloatParts } from '../src/ui/fx.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const unlocks = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const settle = combat => { while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); };
const plain = { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 };

test('Rogue dagger strike (12) against Block 50 loses floor(0.2 x 12) = 2 HP', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 50, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  const strike = combat.piles.hand.find(c => c.cardId === 'core.strike');
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.equal(hit.amount, 12, 'fixture: the dagger strike deals 12');
  assert.equal(500 - enemy.hp, 2);
  assert.equal(hit.blocked, 10);
  assert.equal(enemy.block, 40, 'Block was spent');
});

// An enemy whose Slash is a piercing action of `damage` x `hits`.
const pierceRegistries = (damage, hits) => Object.freeze({ ...baseRegistries, enemies: { ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id),
  get: id => {
    const row = baseRegistries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage, hits, damageType: 'piercing',
      tags: [...(row.moves.slash.tags || []).filter(tag => !tag.startsWith('damage:')), 'damage:piercing'] } } } : row;
  } } });

function enemyPierce({ damage, hits, block, poise }) { return enemyHit(pierceRegistries(damage, hits), { hits, block, poise }); }
function enemyHit(regs, { hits, block, poise }) {
  const run = createRunState({ registries: regs, classId: 'reaver', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries: regs, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(combat.player, { hp: 100, maxHp: 100, block, barrier: 0, statuses: {}, ratings: { ...plain, poise: 10 }, ratingSources: [{ name: 'Fixture', kind: 'attribute', ...plain, poise: 10 }],
    persistentPoise: { value: poise, max: Math.max(poise, 10) } });
  delete combat.player.combatStance;
  Object.assign(enemy, { maxStamina: hits, stamina: hits, statuses: {}, ratings: { ...plain }, ratingSources: [], basePrecisionBonus: 1000 });
  enemy.intent = { ...enemy.intent, moveId: 'slash' }; enemy.plannedMoves = [];
  combat.piles.hand = [];
  primeAccuracyRolls(combat, { count: hits });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const forecast = combat.eventLog.slice(start).find(e => e.type === 'enemyActorTurnStarted')?.intentPreview?.hitDamages;
  settle(combat);
  const events = combat.eventLog.slice(start);
  return { combat, forecast, events, hits: events.filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id) };
}

test('dispatch: an enemy 5x3 piercing action on Block 40 loses 3 x floor(1) = 3 HP, and the forecast matches', () => {
  const { combat, forecast, hits } = enemyPierce({ damage: 5, hits: 3, block: 40, poise: 0 });
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map(e => e.amount), [5, 5, 5], 'fixture: three 5-damage hits');
  assert.deepEqual(hits.map(e => e.hpLoss), [1, 1, 1]);
  assert.equal(100 - combat.player.hp, 3);
  assert.deepEqual(forecast, [1, 1, 1], 'preview matches apply');
});

// Owner, 2026-10-26: the pierced amount meets Poise first, 1:1; only what Poise cannot cover reaches HP.
test('owner example: a 15 pierce hit, fully Blocked otherwise, vs Poise 8 -> pierce 3, Poise 5, HP loss 0', () => {
  const { combat, forecast, hits } = enemyPierce({ damage: 14, hits: 1, block: 40, poise: 8 });
  assert.equal(hits[0].damageReceipt.hits[0].incoming, 18, 'fixture: the hit arrives as 18 (14 + Attack + stance), pierce floor(3.6) = 3');
  assert.equal(hits[0].pierced, 3); assert.equal(hits[0].piercePoise, 3);
  assert.equal(hits[0].hpLoss, 0);
  assert.equal(combat.player.persistentPoise.value, 5);
  assert.deepEqual(forecast, [0], 'preview matches apply');
});

test('owner example: the same hit vs Poise 2 -> Poise 0, Poise broken, HP loss 1', () => {
  const { combat, forecast, hits, events } = enemyPierce({ damage: 14, hits: 1, block: 40, poise: 2 });
  assert.equal(hits[0].pierced, 3); assert.equal(hits[0].piercePoise, 2);
  assert.equal(hits[0].hpLoss, 1);
  assert.equal(combat.player.persistentPoise.value, 0);
  assert.ok(events.some(e => e.type === 'poiseBroken' || e.type === 'staggered' || /stagger/i.test(e.type)), 'Poise broke');
  assert.deepEqual(forecast, [1]);
});

test('no Poise pool: the pierce goes straight to HP', () => {
  const { combat, forecast, hits } = enemyPierce({ damage: 14, hits: 1, block: 40, poise: 0 });
  assert.equal(hits[0].pierced, 3); assert.equal(hits[0].piercePoise, 0);
  assert.equal(hits[0].hpLoss, 3);
  assert.equal(combat.player.hp, 97);
  assert.deepEqual(forecast, [3]);
});

test('only what Block would have soaked is pierced: with Block 0 a pierce hit is an ordinary hit (no float, Poise 25% rule)', () => {
  const pierceHit = enemyPierce({ damage: 14, hits: 1, block: 0, poise: 8 });
  assert.equal(pierceHit.hits[0].pierced, undefined);
  assert.equal(guardHitFloatParts(pierceHit.hits[0]).pierced, null);
  // The same 14 slashing hit: identical HP loss and Poise.
  const plainRegistries = Object.freeze({ ...baseRegistries, enemies: { ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id),
    get: id => { const row = baseRegistries.enemies.get(id); return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage: 14, hits: 1 } } } : row; } } });
  assert.equal(pierceHit.hits[0].hpLoss, enemyHit(plainRegistries, { hits: 1, block: 0, poise: 8 }).hits[0].hpLoss, 'a pierce hit never deals less HP than the same hit without pierce');
});

test('the pierced part is not double-counted by Poise: what Block leaves of the rest takes the ordinary rule', () => {
  // 18 incoming, bypass 3, Block 17: Block soaks 15, so 2 of the 17 Block would have soaked are pierced and meet Poise 1:1 (8 -> 6).
  // The 1 left meets the ordinary rule against the 6 left.
  const { combat, hits } = enemyPierce({ damage: 14, hits: 1, block: 17, poise: 8 });
  assert.equal(hits[0].pierced, 2); assert.equal(hits[0].piercePoise, 2);
  assert.equal(hits[0].blocked, 15);
  assert.equal(hits[0].hpLoss, 0, 'the 1 left is absorbed by Poise');
  assert.equal(combat.player.persistentPoise.value, 5, '8 - 2 pierced - 1 absorbed');
});

test('the Pierced float and the log line show the pierced amount and what Poise took', () => {
  const { hits } = enemyPierce({ damage: 14, hits: 1, block: 40, poise: 8 });
  assert.equal(guardHitFloatParts(hits[0]).pierced.text, 'Pierced 3');
  const line = JSON.stringify(combatLogEntries([hits[0]], { registries: baseRegistries }));
  assert.match(line, /Pierced 3 \(Poise took 3\)/);
});

test('dispatch: a player multi-hit pierce card on Block 40 loses floor(0.2 x each hit) per hit', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 40, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  combat.player.statuses.weak = { stacks: 1 }; // smaller hits, so floor(0.2 x hit) differs from a flat bypass
  combat.piles.hand.push({ instanceId: 'multi', cardId: 'twinPrick', upgraded: false });
  Object.assign(combat.player, { stamina: 10, mana: 10, maxStamina: 10, maxMana: 10 });
  primeAccuracyRolls(combat, { count: 6 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'multi', targetId: enemy.id });
  settle(combat);
  const hits = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.ok(hits.length >= 2, `fixture: a multi-hit card (${hits.length} hits)`);
  assert.deepEqual(hits.map(e => e.amount - e.blocked), hits.map(e => Math.floor(0.2 * e.amount)));
  assert.equal(500 - enemy.hp, hits.reduce((sum, e) => sum + Math.floor(0.2 * e.amount), 0));
});

// Invariant: a pierce hit never deals less HP than the same hit without pierce, and the forecast equals the applied hit.
test('property: over a grid of damage, Block and Poise, pierce never lowers HP loss (Smash vs defensive included) and preview equals apply', () => {
  const ctxs = [live(), live(), live(), live()];
  for (const ctx of ctxs) ctx.enemies[0].basePrecisionBonus = 1000; // never misses, so apply is comparable to the forecast
  const stances = [null, { maneuver: 'defend', camp: 'physical', range: 'melee' }];
  for (const maneuver of ['attack', 'smash']) for (const stance of stances) for (const dmg of [3, 5, 10, 15, 22, 40])
    for (const block of [0, 1, 3, 8, 14, 20, 50]) for (const poise of [0, 2, 8, 30]) {
      const mk = damageType => ({ combatProfile: { camp: 'physical', maneuver, damageType, range: 'melee' }, skipRatingBonus: true });
      const target = ctx => {
        Object.assign(ctx.player, { block, hp: 100, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: 30 } });
        if (stance) ctx.player.combatStance = { ...stance }; else delete ctx.player.combatStance;
        return ctx;
      };
      const label = `${maneuver} ${stance ? 'vs defend ' : ''}dmg ${dmg} Block ${block} Poise ${poise}`;
      const a = target(ctxs[0]), b = target(ctxs[1]);
      const plainHit = profileDamageReceipt(a, a.enemies[0], a.player, dmg, mk('slashing'), { roll: 0 });
      const pierceHit = profileDamageReceipt(b, b.enemies[0], b.player, dmg, mk('piercing'), { roll: 0 });
      assert.ok(pierceHit.hpLoss >= plainHit.hpLoss, `pierce lowered HP loss: ${label} (${pierceHit.hpLoss} < ${plainHit.hpLoss})`);
      if (block === 0) assert.ok(!pierceHit.pierceBypassed, `nothing to pierce with no Block: ${label}`);
      // Preview equals apply.
      const c = target(ctxs[2]), d = target(ctxs[3]);
      const preview = previewDamageHits(c, c.enemies[0], c.player, dmg, [], mk('piercing')).hitDamages[0];
      primeAccuracyRolls(d);
      const before = d.player.hp;
      applyAttackDamage(d, d.enemies[0], d.player, dmg, [], { ...mk('piercing'), tags: ['camp:physical', 'damage:piercing'] });
      assert.equal(before - d.player.hp, preview, `preview != apply: ${label} (${preview} vs ${before - d.player.hp})`);
    }
});
