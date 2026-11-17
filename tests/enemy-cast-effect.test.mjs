// Playtest 2026-11-17: an enemy that casts a spell or a buff shows a cast effect over itself, as the player's spell and
// buff cards do. A plain physical attack or block shows none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyCastEffectPlan, ENEMY_CAST_EFFECT_KINDS } from '../src/model/combatEffects.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { combatEffectFrames } from '../src/ui/assets.js';

const planFor = (enemyId, moveId, intent) => EnemyCastEffectPlan({ enemyId, moveId, intent, profile: combatProfileFor({ enemyId, moveId }) });

test('a spell, a divine spell and a physical buff each glow over the caster', () => {
  assert.equal(planFor('briarHermit', 'briarCast', 'attack')?.kind, 'focusMotes');
  assert.equal(planFor('briarHermit', 'sapMend', 'buff')?.kind, 'sacredAura');
  assert.equal(planFor('wanderingSoldier', 'warcry', 'buff')?.kind, 'focusMotes');
});

test('a physical attack or block casts nothing', () => {
  assert.equal(planFor('wanderingSoldier', 'slash', 'attack'), null);
  assert.equal(planFor('wanderingSoldier', 'guard', 'block'), null);
});

test('the cast plays on the caster, never travels, and every kind has frames', () => {
  const plan = planFor('briarHermit', 'briarCast', 'attack');
  assert.equal(plan.projectile, false);
  assert.notEqual(plan.at, 'target');
  assert.equal(plan.bindingContext.kind, 'enemyMove');
  for (const kind of Object.values(ENEMY_CAST_EFFECT_KINDS)) assert.ok(combatEffectFrames(kind).length > 0, kind);
});
