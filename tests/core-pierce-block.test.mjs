// Owner bug 2026-10-26: "Attacks are bypassing block". In Core a piercing hit (Rogue daggers, spears, many enemies) skipped all Block.
// It now lets only the Piercing guard bypass (once per action and target, spent over the contacts in order) past Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { live } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import * as Matchups from '../src/engine/combatMatchups.js';
import { pierceGuardBypass } from '../src/engine/gameProfileCombat.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

test('Rogue dagger strike against Block 50 loses only the Piercing bypass to HP', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 50, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  const strike = combat.piles.hand.find(c => c.cardId === 'core.strike');
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  const bypass = pierceGuardBypass(combat);
  assert.ok(hit.amount > bypass, 'fixture: the strike is bigger than the bypass');
  assert.equal(500 - enemy.hp, bypass, 'HP lost is the bypass only');
  assert.equal(hit.blocked, hit.amount - bypass);
  assert.equal(enemy.block, 50 - hit.blocked, 'Block was spent');
});

test('a multi-hit pierce action spends the bypass once, over its contacts in order', () => {
  const combat = live();
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 500; enemy.block = 40;
  const carrier = { tags: ['camp:physical', 'damage:piercing'], skipRatingBonus: true, physicalDamageType: 'piercing',
    combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'piercing', range: 'melee', targeting: 'single' } };
  const contacts = [5, 5, 5].map(amount => ({ camp: 'physical', maneuver: 'attack', damageType: 'piercing', physicalDamageType: 'piercing', magicShare: 0, amount, splitBase: amount }));
  primeAccuracyRolls(combat, { count: 3 });
  const receipt = Matchups.beginTacticalAction(combat, combat.player, enemy, carrier, contacts);
  const lost = contacts.map((contact, index) => {
    const before = enemy.hp;
    applyAttackDamage(combat, combat.player, enemy, contact.amount, carrier.tags, { ...carrier, expansionContact: { receipt, index } });
    return before - enemy.hp;
  });
  const bypass = pierceGuardBypass(combat);
  assert.ok(bypass > 0 && bypass < 15);
  assert.equal(lost.reduce((a, b) => a + b, 0), bypass, 'one bypass for the whole action, not one per hit');
  assert.equal(enemy.block, 40 - (15 - bypass));
});
