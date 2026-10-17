import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateGameSchema, mergeGameSettings } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyAttackDamage, executeAction } from '../src/engine/actions.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { enemyMoveCarrier } from '../src/engine/combatCardTactics.js';
import { stanceMitigation } from '../src/engine/stanceMitigation.js';
import { previewTacticalAction } from '../src/engine/combatMatchups.js';
import { defensiveCombatStance } from '../src/engine/concurrentStances.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const defaults = json('../engine/modules/stances/defaults.json');
const schema = json('../engine/modules/stances/settings.schema.json');
const carrier = maneuver => ({ combatProfile: { camp: 'physical', maneuver, range: 'melee' } });
function context(mode = 'core') {
  const gameProfile = structuredClone(resolveGameProfile(mode));
  gameProfile.modules.stances = { ...defaults, mode: mode === 'core' ? 'configured' : 'legacy' };
  return { gameProfile };
}
const fighter = (id, combatStance) => ({ id, kind: id === 'player' ? 'player' : 'enemy', alive: true, hp: 100, maxHp: 100, statuses: {}, block: 0, ratings: { ar: 0, dr: 0, poise: 0 }, combatStance });

test('editable JSON default resolves to 25%; zero disables and invalid fractions reject', () => {
  assert.equal(mergeGameSettings(defaults, {}).defenseMitigation, 0.25);
  assert.doesNotThrow(() => validateGameSchema(defaults, schema));
  for (const invalid of [-0.01, 1.01, '0.25', NaN]) assert.throws(() => validateGameSchema({ ...defaults, defenseMitigation: invalid }, schema));
  assert.doesNotThrow(() => validateGameSchema({ ...defaults, defenseMitigation: 0 }, schema));
});

test('Core winning defense mitigates exactly once before configured Block/Poise, matching actual damage', () => {
  const ctx = { ...context(), registries: createRegistries(contentBundle), emit() {}, enqueue() {} };
  const source = { ...fighter('enemy'), enemyId: 'wanderingSoldier' }, player = fighter('player', { maneuver: 'counter', camp: 'physical' });
  ctx.player = player; ctx.enemies = [source];
  let receipt = profileDamageReceipt(ctx, source, player, 20, carrier('attack'));
  assert.equal(receipt.hpLoss, 15); assert.equal(receipt.stanceMitigation, 0.25); assert.equal(receipt.defenseAdvantage, true);
  applyAttackDamage(ctx, source, player, 20, [], carrier('attack'));
  assert.equal(player.hp, 85, 'live application uses the same 0.75 stage once');
  player.block = 4; player.gameProfilePoise = 1;
  receipt = profileDamageReceipt(ctx, source, player, 20, carrier('attack'));
  assert.equal(receipt.blocked, 4); assert.equal(receipt.hpLoss, 8, '20*.75=15, minus4 Block=11, floor11*.75 Poise=8');
  ctx.gameProfile.modules.stances.defenseMitigation = 0.5;
  assert.equal(profileDamageReceipt(ctx, source, { ...player, block: 0, gameProfilePoise: 0 }, 20, carrier('attack')).hpLoss, 10);
  ctx.gameProfile.modules.stances.defenseMitigation = 0;
  assert.equal(profileDamageReceipt(ctx, source, { ...player, block: 0, gameProfilePoise: 0 }, 20, carrier('attack')).hpLoss, 20);
  ctx.gameProfile.modules.stances = false;
  assert.equal(profileDamageReceipt(ctx, source, { ...player, block: 0, gameProfilePoise: 0 }, 20, carrier('attack')).hpLoss, 20);
});

for (const mode of ['core', 'current']) test(`${mode} actual grouped damage matches green HP projection without double mitigation`, () => {
  const { gameProfile } = context(mode);
  const original = resolveGameProfile(mode);
  const registries = mode === 'core' ? bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, original)), original) : createRegistries(contentBundle);
  const combat = createCombat({ registries, gameProfile, rng: createRng(73), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 100, maxHp: 100, maxMana: 5, mana: 5, maxStamina: 5, stamina: 5, energyMax: 5, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.intent = { kind: 'attack', moveId: 'slash', damage: 8, hits: 3, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  enemy.proposalIntentRevealedUntil = 99;
  combat.player.block = 4; combat.player.gameProfilePoise = 0; combat.player.poise = 0; combat.player.ratings = { ar: 0, dr: 0, poise: 0 };
  delete combat.player.persistentPoise; delete combat.player.persistentWard;
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  const before = JSON.stringify({ player: combat.player, enemies: combat.enemies, counters: combat.rng.getCounters() });
  const projected = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(projected.max, 14); assert.equal(projected.baseline.max, 20); assert.equal(projected.tone, 'green');
  assert.equal(JSON.stringify({ player: combat.player, enemies: combat.enemies, counters: combat.rng.getCounters() }), before);
  const card = enemyMoveCarrier(enemy, registries.enemies.get(enemy.enemyId).moves.slash, 'slash', combat);
  combat.rng.int = () => 20; combat.rng.float = () => 0;
  const hp = combat.player.hp;
  enqueueExpandedAction(combat, [{ effect: { op: 'damage', target: 'player', amount: 8, hits: 3 }, source: enemy, owner: enemy, target: combat.player, card, meta: {} }], { source: enemy, target: combat.player, carrier: card });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  assert.equal(hp - combat.player.hp, projected.max);
});

test('missing resolved setting preserves old saves and concurrent stance chooses real mitigation', () => {
  const ctx = context();
  assert.equal(stanceMitigation(ctx, 'attack', 'counter').multiplier, 0.75);
  delete ctx.gameProfile.modules.stances.defenseMitigation;
  assert.equal(stanceMitigation(ctx, 'attack', 'counter').multiplier, 1);
  // Current's old offensive bonus is not itself a defender mitigation stage.
  assert.equal(stanceMitigation(context('current'), 'smash', 'defend').multiplier, 1);
  const live = context();
  live.registries = { proposalStatusRules: { rules: { capacity: { behaviors: [{ kind: 'stanceCapacity', additionalPerStack: 1, maxStances: 2 }] } } } };
  const player = fighter('player', { maneuver: 'counter', camp: 'physical' });
  player.statuses.capacity = { stacks: 1 }; player.concurrentStances = [{ maneuver: 'prepared', camp: 'physical' }];
  assert.equal(defensiveCombatStance(live, player, carrier('defend')).maneuver, 'prepared');
});

test('Current preserves its offensive stance factor and applies defensive mitigation only once', () => {
  const ctx = { ...context('current'), combatExpansionVersion: 2, registries: createRegistries(contentBundle) };
  const source = fighter('enemy');
  const player = fighter('player', { maneuver: 'defend', camp: 'physical', range: 'melee' });
  ctx.player = player; ctx.enemies = [source];
  assert.equal(previewTacticalAction(ctx, source, player, carrier('smash'), [{ amount: 20 }]).amount, 30, 'existing Smash bonus survives');
  player.combatStance.maneuver = 'counter';
  assert.equal(previewTacticalAction(ctx, source, player, carrier('attack'), [{ amount: 20 }]).amount, 15, 'defender reduction applies exactly once');
  ctx.gameProfile.modules.stances.defenseMitigation = 0;
  assert.equal(previewTacticalAction(ctx, source, player, carrier('attack'), [{ amount: 20 }]).amount, 20);
  ctx.gameProfile.modules.stances = false;
  assert.equal(previewTacticalAction(ctx, source, player, carrier('attack'), [{ amount: 20 }]).amount, 20);
  delete ctx.gameProfile;
  assert.equal(previewTacticalAction(ctx, source, player, carrier('attack'), [{ amount: 20 }]).amount, 20, 'unconfigured historic contexts retain their rules');
});
