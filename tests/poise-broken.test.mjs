// Owner, 2026-11-14 (Wave 3, "a Poise break is the payoff"): under `poise.breakRule: "broken"` a Poise break makes its owner Broken.
//   node --test tests/poise-broken.test.mjs
// An enemy loses its next action (a charging move too) and takes x1.5 from every hit until the turn whose action it lost ends, then its
// Poise refills to full; the player starts the next turn 1 Stamina short and takes x1.5 through that round. A fight saved without the key
// keeps the Staggered stance exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';
import { applyAttackDamage, drainFixCorePoise } from '../src/engine/actions.js';
import { syncPoiseMaximum } from '../src/engine/combatPools.js';
import { restorePersistentPoise } from '../src/engine/combatStatusControl.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules, FixCoreBrokenRules, fixCoreProtectionDescription } from '../src/model/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { withoutStanceBenefitDefaults } from './legacyHitRules.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const carrier = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

// `noStance` builds the fight as one created before the Wave 2.5 stance benefits, so a test can read the bare Broken x1.5.
function fight(enemyIds = ['wanderingSoldier'], { legacy = false, seed = 511, noStance = false } = {}) {
  if (noStance) return withoutStanceBenefitDefaults(() => fight(enemyIds, { legacy, seed }));
  const run = createRunState({ registries: reg, classId: 'reaver', seed, profileMeta: META });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds });
  if (legacy) { combat.fixCoreRules = { ...combat.fixCoreRules, poise: { drain: 'prevented' } }; }
  return combat;
}
// `amount` is the hit after Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so it is dealt from twice that base.
const hit = (combat, target, amount) => { primeAccuracyRolls(combat); const before = target.hp; applyAttackDamage(combat, combat.player, target, amount * 2, [], carrier); return before - target.hp; };
const endTurn = combat => {
  dispatch(combat, { type: 'endTurn' });
  for (let safety = 0; combat.pendingReaction && safety < 20; safety++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
};
const sandbag = (target, poise = 5) => { Object.assign(target, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: poise } }); };

test('shipped Core data names the Broken rule; validation accepts it; a rules object without it is the Staggered rule', () => {
  assert.deepEqual(shipped.poise, { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1, breakStatusStacks: 2 });
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  assert.throws(() => validateFixCoreRules({ ...shipped, poise: { drain: 'prevented', breakRule: 'other' } }), /poise/);
  assert.throws(() => validateFixCoreRules({ ...shipped, poise: { drain: 'prevented', brokenDamageMultiplier: 0.5 } }), /poise/);
  assert.equal(FixCoreBrokenRules(fight()).damageMultiplier, 1, 'a break no longer multiplies damage (owner 2026-11-18, 3a): its Vulnerable stacks do');
  assert.equal(FixCoreBrokenRules(fight(['wanderingSoldier'], { legacy: true })), null);
});

test('a 1-SP enemy that breaks loses its next action: the player takes nothing and Poise refills to full', () => {
  const combat = fight(); const enemy = combat.enemies[0];
  assert.equal(enemy.intent.kind, 'attack');
  const hp = combat.player.hp;
  drainFixCorePoise(combat, combat.player, enemy, 99);
  assert.ok(enemy.broken, 'Broken is recorded');
  assert.equal(enemy.broken.cancelledMove, 'slash');
  assert.equal(enemy.intent.kind, 'staggered', 'the intent reads Broken at once, with no number');
  assert.equal(enemy.intent.damage, undefined);
  assert.equal(enemy.persistentPoise.value, 0);
  endTurn(combat);
  assert.equal(combat.player.hp, hp, 'its action was cancelled');
  assert.equal(enemy.broken, undefined, 'Broken ended with the turn whose action it lost');
  assert.equal(enemy.persistentPoise.value, enemy.persistentPoise.max, 'Poise refilled to full');
  assert.ok(combat.eventLog.some(row => row.type === 'brokenEnded' && row.targetId === enemy.id));
  assert.ok(!combat.eventLog.some(row => row.type === 'enemyMoveStarted' && row.enemyId === enemy.enemyId && row.turn === 1), 'no move was started');
});

test('a 3-SP boss loses the head of its plan, whatever the SP cost, and the cancelled move leaves movesHistory', () => {
  const combat = fight(['fellWarden']); const boss = combat.enemies[0];
  const head = boss.intent.moveId, planBefore = boss.plannedMoves.map(row => row.moveId);
  const historyBefore = [...boss.movesHistory];
  drainFixCorePoise(combat, combat.player, boss, 999);
  assert.equal(boss.broken.cancelledMove, head);
  assert.equal(boss.intent.kind, 'staggered');
  assert.deepEqual(boss.plannedMoves.map(row => row.moveId), planBefore, 'the follow-ups stay');
  assert.equal(boss.movesHistory.length, historyBefore.length - 1, 'the dropped head left the history');
  assert.deepEqual(boss.movesHistory, [...historyBefore.slice(0, historyBefore.length - planBefore.length - 1), ...planBefore], 'history is the plan that will play');
  endTurn(combat);
  assert.equal(boss.broken, undefined);
  assert.equal(boss.persistentPoise.value, boss.persistentPoise.max);
});

test('a charging move is cancelled and its charge lost', () => {
  const combat = fight(['bellKeeper']); const boss = combat.enemies[0];
  boss.pendingMove = { moveId: 'bronzeToll', turnsLeft: 1 };
  boss.plannedMoves = []; boss.planDue = false;
  boss.intent = { ...boss.intent, kind: 'smash', moveId: 'bronzeToll', pending: true, delayed: true };
  const hp = combat.player.hp;
  drainFixCorePoise(combat, combat.player, boss, 999);
  assert.equal(boss.pendingMove, null, 'the charge is gone');
  assert.equal(boss.broken.cancelledMove, 'bronzeToll');
  assert.equal(boss.intent.kind, 'staggered');
  endTurn(combat);
  assert.equal(combat.player.hp, hp, 'the toll never landed');
  assert.ok(!combat.eventLog.some(row => row.type === 'combatContactPrepared' && /bronzeToll/.test(JSON.stringify(row))));
});

test('a hit on a Broken enemy takes only the break\'s Vulnerable x1.25 (no x1.5), and only while Broken', () => {
  const combat = fight(); const enemy = combat.enemies[0]; sandbag(enemy, 1); enemy.ratings = { ...(enemy.ratings || {}), dr: 0 };
  const before = hit(combat, enemy, 10); // the Attack stance's x1.2 is in every figure here
  assert.equal(enemy.broken && true, true, 'the 1-Poise bar broke on that hit');
  assert.equal(enemy.statuses.vulnerable?.stacks, 2, 'the break grants 2 Vulnerable');
  const broken = hit(combat, enemy, 10), second = hit(combat, enemy, 10);
  assert.equal(broken, Math.floor(10 * 1.2 * 1.25), 'x1.25 Vulnerable once, no x1.5');
  assert.equal(second, broken);
  assert.ok(broken > before, 'bigger than the hit that broke it');
  endTurn(combat);
  assert.equal(enemy.broken, undefined);
  assert.equal(enemy.statuses.vulnerable, undefined, 'the break statuses leave with Broken');
});

test('with the shipped Attack stance benefit a hit on a Broken enemy is 10 x 1.25 (the break\'s own Vulnerable) x 1.2', () => {
  const combat = fight(); const enemy = combat.enemies[0]; sandbag(enemy, 1); enemy.ratings = { ...(enemy.ratings || {}), dr: 0 };
  hit(combat, enemy, 10);
  assert.equal(hit(combat, enemy, 10), 15, 'floor(10 x 1.25 x 1.2): the break grants Vulnerable (owner 2026-11-18, breakStatusStacks); no x1.5');
});

test('Vulnerable multiplies a Broken target once (x1.25), however many stacks', () => {
  const combat = fight(); const enemy = combat.enemies[0]; sandbag(enemy, 1);
  hit(combat, enemy, 10);
  enemy.statuses.vulnerable = { stacks: 7 };
  assert.equal(hit(combat, enemy, 10), Math.floor(10 * 1.2 * 1.25), 'Vulnerable still multiplies once however many stacks (Attack stance x1.2 included); no x1.5');
});

test('a Broken enemy cannot be broken again and its Poise cannot be refilled until Broken ends', () => {
  const combat = fight(); const enemy = combat.enemies[0]; sandbag(enemy, 5);
  drainFixCorePoise(combat, combat.player, enemy, 99);
  const brokenAt = enemy.broken;
  assert.equal(drainFixCorePoise(combat, combat.player, enemy, 5), 0);
  hit(combat, enemy, 12);
  assert.equal(combat.eventLog.filter(row => row.type === 'poiseBroken').length, 1, 'one break');
  assert.equal(enemy.broken, brokenAt, 'the same Broken record');
  restorePersistentPoise(combat, enemy, 4, { source: 'block-card' });
  assert.equal(enemy.persistentPoise.value, 0, 'Block does not refill a Broken bar');
});

test('Barrier gained while Broken raises the maximum without refilling Poise; Ward grants HP buffer independently', () => {
  const combat = fight(); const enemy = combat.enemies[0]; sandbag(enemy, 8);
  drainFixCorePoise(combat, combat.player, enemy, 99);
  assert.ok(enemy.broken); assert.equal(enemy.persistentPoise.value, 0);
  enemy.statuses.barrier = { stacks: 1 };
  syncPoiseMaximum(combat, enemy);
  assert.equal(enemy.persistentPoise.barrierBonus, 5, 'barrier: +5 maximum, kept as the bonus');
  assert.ok(enemy.persistentPoise.max >= 5, 'barrier: +5 maximum');
  assert.equal(enemy.persistentPoise.value, 0, 'barrier: Broken Poise is not refilled');
  drainFixCorePoise(combat, combat.player, enemy, 99);
  assert.equal(combat.eventLog.filter(row => row.type === 'poiseBroken').length, 1, 'barrier: one break only');

  const combat2 = fight(); const enemy2 = combat2.enemies[0]; sandbag(enemy2, 8);
  drainFixCorePoise(combat2, combat2.player, enemy2, 99);
  assert.ok(enemy2.broken); assert.equal(enemy2.persistentPoise.value, 0);
  enemy2.statuses.ward = { stacks: 1 };
  syncPoiseMaximum(combat2, enemy2);
  assert.equal(enemy2.persistentPoise.value, 0, 'ward does not refill Broken Poise');
  assert.equal(enemy2.persistentPoise.barrierBonus || 0, 0, 'ward adds no Poise bonus');
});

test('after Broken ends the full bar must be broken again for a second break', () => {
  const combat = fight(); const enemy = combat.enemies[0]; sandbag(enemy, 3);
  drainFixCorePoise(combat, combat.player, enemy, 99); endTurn(combat);
  // The refill is to the soldier's rated Poise, 5 (1 + CON 4: owner 2026-11-18 §13, gear Poise counts only while guarding), not the sandbagged 3 stand-in.
  assert.equal(enemy.persistentPoise.value, 5);
  hit(combat, enemy, 4); assert.equal(enemy.broken, undefined, 'a part of the bar is not a break');
  drainFixCorePoise(combat, combat.player, enemy, 99);
  assert.ok(enemy.broken, 'the second break');
});

test('the player Broken: next turn starts 1 Stamina short, hits take the break\'s Vulnerable through that round, then Poise refills', () => {
  const plain = fight(); plain.player.persistentPoise.value = 0; primeAccuracyRolls(plain);
  // The plain player holds no stance, so it is Idle and takes the Idle stance weakness (theme B, 2026-11-17); a Broken player holds the
  // Staggered stance and does not. The baseline leaves the weakness out so the comparison is Broken against nothing.
  delete plain.fixCoreRules.stanceBenefits.neutral.damageTakenMultiplier;
  // Bases 20 and 16 halve to 10 and 8 (Core base-damage scale).
  const hpPlain = plain.player.hp; applyAttackDamage(plain, plain.enemies[0], plain.player, 20, [], carrier);
  const bare = hpPlain - plain.player.hp;
  const combat = fight(); const player = combat.player, enemy = combat.enemies[0];
  const full = player.energyMax;
  // Core Reaver HP is 50 now: give it room so these hits and the enemy's real turn do not end the fight before Broken does.
  player.hp = player.maxHp = 100;
  player.persistentPoise.value = 1;
  primeAccuracyRolls(combat);
  applyAttackDamage(combat, enemy, player, 16, [], carrier);
  assert.ok(player.broken, 'the player is Broken');
  assert.equal(player.persistentPoise.value, 0);
  assert.equal(player.statuses.vulnerable?.stacks, 2, 'the break grants 2 Vulnerable (owner 2026-11-18)');
  assert.equal(player.pendingActionLoss, 1, 'the next turn opens 1 short');
  const hpBefore = player.hp; primeAccuracyRolls(combat);
  applyAttackDamage(combat, enemy, player, 20, [], carrier);
  assert.equal(hpBefore - player.hp, Math.floor(bare * 1.25), 'the break\'s Vulnerable x1.25 while Broken, no x1.5');
  enemy.plannedMoves = []; enemy.planDue = false; enemy.intent = { kind: 'unknown', moveId: null };
  endTurn(combat);
  assert.equal(combat.phase, 'player');
  assert.equal(player.broken && true, true, 'Broken lasts through the short turn');
  assert.equal(player.energy, full - 1, 'the turn opens with 1 less Stamina');
  endTurn(combat);
  assert.equal(player.broken, undefined, 'it ends with the enemy phase that answers the short turn');
  assert.equal(player.persistentPoise.value, player.persistentPoise.max, 'Poise refilled to full');
});

test('a fight saved without the key keeps Staggered exactly (-1 SP, +1 Vulnerable, no skipped action)', () => {
  const combat = fight(['wanderingSoldier'], { legacy: true }); const enemy = combat.enemies[0];
  const hp = combat.player.hp;
  drainFixCorePoise(combat, combat.player, enemy, 99);
  assert.equal(enemy.broken, undefined);
  assert.equal(enemy.combatStance.maneuver, 'staggered');
  assert.equal(enemy.combatStance.broken, undefined);
  assert.equal(enemy.pendingStaminaLoss, 1);
  assert.equal(enemy.statuses.vulnerable.stacks, 1);
  assert.equal(enemy.intent.kind, 'attack', 'its plan is only trimmed by SP at the enemy phase');
  endTurn(combat);
  assert.equal(enemy.persistentPoise.value, 0, 'no refill');
  assert.ok(!combat.eventLog.some(row => row.type === 'brokenEnded'));
  void hp;
});

test('the words say Broken: the Poise tooltip, the stance row, the intent word and the BREAK callout; the saved-fight rule still says Staggered', async () => {
  const { combatStanceRow } = await import('../src/model/combatTacticsDisplay.js');
  const { t } = await import('../src/ui/strings.js');
  const combat = fight(); const enemy = combat.enemies[0];
  assert.match(fixCoreProtectionDescription(combat, enemy, 'poise'), /Broken: it loses its next action and gains 2 each of Staggered, Vulnerable, Weak and Frail/);
  assert.match(fixCoreProtectionDescription(fight(['wanderingSoldier'], { legacy: true }), enemy, 'poise'), /Staggered/);
  drainFixCorePoise(combat, combat.player, enemy, 99);
  const row = combatStanceRow(enemy);
  assert.equal(row.name, 'Broken');
  assert.match(row.detail, /Loses its next action and is Vulnerable, Weak, Frail and Staggered/);
  assert.equal(t('combat.intent.staggered'), 'Broken');
  assert.equal(t('combat.callout.poiseBreak'), 'BREAK');
});
