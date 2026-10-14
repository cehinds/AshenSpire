import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, resolvedCardPlayCosts } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { stanceOf, stanceEntryBonuses, stanceRatingBonus } from '../src/model/stanceRules.js';
import { createRng } from '../src/engine/rng.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

for (const cardId of ['hex', 'gravityWell']) test(`${cardId} resolves and plays in Spell stance, including costs and entry grants`, () => {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', hp: 100, maxHp: 100,
      mana: 100, maxMana: 100, stamina: 100, maxStamina: 100, energyMax: 100, drawPerTurn: 1,
      deck: [{ cardId, instanceId: cardId, rank: 3 }] } });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 1000;
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
  enemy.persistentWard = { value: 0, max: 0 };
  enemy.persistentPoise = { value: 0, max: 0 };
  enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  const inst = combat.piles.hand.find(row => row.instanceId === cardId);
  assert.ok(inst);
  const def = resolveCombatCard(combat, inst);
  assert.equal(combatProfileFor(def).maneuver, 'casting');
  assert.equal(stanceOf(def).maneuver, 'casting');
  assert.equal(stanceEntryBonuses(def, combat).precision, 1);
  const before = resolvedCardPlayCosts(combat, def).stamina;
  primeAccuracyRolls(combat);
  dispatch(combat, { type: 'playCard', cardInstanceId: cardId, targetId: enemy.id });
  assert.equal(combat.player.combatStance.maneuver, 'casting');
  assert.equal(stanceRatingBonus(combat, combat.player, 'pr'), 1);
  assert.ok(combat.player.statuses.precision?.stacks >= 1);
  assert.equal(resolvedCardPlayCosts(combat, def).stamina, Math.max(before - 1, 0));
  const entries = combat.eventLog.filter(event => event.type === 'statusApplied' && event.targetId === combat.player.id
    && event.status === 'precision' && event.triggeredBy?.kind === 'stance');
  assert.equal(entries.length, 1, 'the real card play applies exactly one entry grant');
});

test('hostile inference preserves explicit defensive roles and support opt-outs', () => {
  const hostile = { id: 'testSpell', type: 'skill', range: 'reach', tags: ['camp:spell'],
    effects: [{ op: 'removeStatus', target: 'enemy', status: 'strength', amount: 1 }] };
  assert.equal(combatProfileFor(applyCombatExpansionCard(hostile)).maneuver, 'casting');
  for (const maneuver of ['defend', 'counter']) {
    assert.equal(combatProfileFor(applyCombatExpansionCard({ ...hostile, tags: [...hostile.tags, `maneuver:${maneuver}`] })).maneuver, maneuver);
  }
  assert.equal(stanceOf(applyCombatExpansionCard({ ...hostile, stanceTrigger: false })), null);
  assert.equal(stanceOf(applyCombatExpansionCard({ ...hostile, effects: [{ op: 'gainWard', target: 'self', amount: 1 }] })), null);
});
