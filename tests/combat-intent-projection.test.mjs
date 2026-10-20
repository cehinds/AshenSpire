import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat } from '../src/engine/combat.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';
import { enemyMoveCarrier } from '../src/engine/combatCardTactics.js';

// These Core assertions preserve the archived flat-Poise and failed-Evade rules.
// Modern typed protection is covered by fixcore-live-combat/protection.
function fixture(core = false) {
  const profile = core ? resolveGameProfile('ashen.core@1.0.0') : null;
  const registries = profile ? bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile) : createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(71), gameProfile: profile, combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 100, maxHp: 100, maxMana: 5, mana: 5, maxStamina: 5, stamina: 5, energyMax: 5, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.intent = { kind: 'attack', moveId: 'slash', damage: 8, hits: 3, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', damageType: 'slashing' } };
  enemy.intentRevealed = true; enemy.proposalIntentRevealedUntil = 99;
  combat.player.block = 4;
  delete combat.player.persistentPoise; delete combat.player.persistentWard;
  delete combat.player.combatStance;
  return { combat, enemy };
}
const snapshot = combat => JSON.stringify({ player: combat.player, enemies: combat.enemies, queue: combat.queue, eventLog: combat.eventLog, counters: combat.rng.getCounters() });

test('Current projection uses grouped HP defense and action-wide hit range without mutation', () => {
  const { combat, enemy } = fixture();
  const before = snapshot(combat);
  const shown = projectCombatIntent(combat, enemy.id);
  assert.equal(snapshot(combat), before);
  assert.equal(shown.projectedDamage.basis, 'hp');
  assert.equal(shown.projectedDamage.tone, 'red');
  assert.equal(shown.projectedDamage.min, 0, 'd20 accuracy has an actual miss branch');
  assert.equal(shown.projectedDamage.max, 20, 'three hits spend four Block once');
  const carrier = enemyMoveCarrier(enemy, combat.registries.enemies.get(enemy.enemyId).moves.slash, 'slash', combat);
  combat.rng.int = () => 20;
  const hp = combat.player.hp;
  enqueueExpandedAction(combat, [{ effect: { op: 'damage', target: 'player', amount: 8, hits: 3 }, source: enemy, owner: enemy, target: combat.player, card: carrier, meta: {} }], { source: enemy, target: combat.player, carrier });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  assert.equal(hp - combat.player.hp, shown.projectedDamage.max, 'shared projection matches real landed multihit damage');
});

test('actual range stance reduces Current projected HP; unchanged pools alone never earn green', () => {
  const { combat, enemy } = fixture();
  const neutral = projectCombatIntent(combat, enemy.id).projectedDamage;
  combat.player.combatStance = { camp: 'physical', maneuver: 'ranged', range: 'ranged' };
  const before = snapshot(combat);
  const reduced = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(reduced.max, 0); assert.equal(reduced.tone, 'green'); assert.equal(reduced.stanceReduced, true); assert.equal(reduced.displayedReduction, true);
  assert.equal(reduced.baseline.max, neutral.max); assert.equal(snapshot(combat), before);
  delete combat.player.combatStance; combat.player.block = 30;
  const blocked = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(blocked.max, 0); assert.equal(blocked.tone, 'red', 'Block reduction is not credited to a favorable stance');
});

test('Core HP projection uses configured Block/Poise and reports evade uncertainty honestly', () => {
  const { combat, enemy } = fixture(true);
  combat.player.gameProfilePoise = 1;
  const before = snapshot(combat);
  const shown = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(shown.min, shown.max); assert.ok(shown.max < 20);
  assert.equal(snapshot(combat), before);
  combat.player.combatStance = { camp: 'physical', maneuver: 'evade' };
  const evade = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(evade.min, 0); assert.equal(evade.uncertain, true); assert.match(evade.label, /^0–/);
});

test('hidden gate returns before private move lookup or any projected amount', () => {
  const { combat, enemy } = fixture();
  delete combat.enemyKnowledge;
  enemy.proposalIntentRevealedUntil = 0; enemy.actorIntentRevealed = false; enemy.intentRevealed = false;
  const original = combat.registries.enemies;
  combat.registries = { ...combat.registries, enemies: { ...original, get() { throw new Error('private move lookup forbidden'); } } };
  const shown = projectCombatIntent(combat, enemy.id);
  assert.equal(shown.hidden, true); assert.equal(shown.projectedDamage, undefined); assert.equal(shown.damage, undefined);
  assert.equal(combatIntentPresentation(shown).parts[0].value, null);
});

test('known HP presentation and public Dodge charge count remain separate from hidden amounts', () => {
  const projectedDamage = { basis: 'hp', min: 0, max: 7, label: '0–7', tone: 'green', stanceReduced: true };
  const badge = combatIntentPresentation({ kind: 'attack', damage: 99, projectedDamage });
  assert.equal(badge.parts[0].value, '0–7'); assert.equal(badge.projectedDamage, projectedDamage);
  assert.deepEqual(combatIntentPresentation({ kind: 'block', profile: { maneuver: 'evade' }, dodgeCharges: 2 }).parts, [{ icon: 'evade', value: '2' }]);
  const hidden = combatIntentPresentation({ kind: 'unknown', hidden: true, stance: 'attacking', damage: 99, projectedDamage });
  assert.equal(hidden.parts[0].value, null); assert.equal(hidden.projectedDamage, undefined);
});

test('Core Counter has no fabricated mitigation and a wider Evade range stays red despite lower expected HP', () => {
  const { combat, enemy } = fixture(true);
  combat.player.gameProfilePoise = 1;
  combat.gameProfile = structuredClone(combat.gameProfile);
  delete combat.gameProfile.modules.stances.defenseMitigation;
  const baseline = projectCombatIntent(combat, enemy.id).projectedDamage;
  combat.player.combatStance = { camp: 'physical', maneuver: 'counter' };
  const counter = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(counter.max, baseline.max); assert.equal(counter.tone, 'red');
  // The authored accuracy formula can produce genuine low hit probability;
  // a wider failed-dodge range must stay red despite the lower expectation.
  combat.player.combatStance = { camp: 'physical', maneuver: 'evade' };
  combat.player.ratings = { ...combat.player.ratings, dr: 100 };
  const evade = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.ok(evade.expected < evade.baseline.expected); assert.equal(evade.stanceReduced, true);
  assert.equal(evade.tone, 'red'); assert.equal(evade.displayedReduction, false);
  assert.equal(evade.min, 0); assert.ok(evade.max > evade.baseline.max);
});
