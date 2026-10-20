import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRng } from '../src/engine/rng.js';
import { applyStatus, removeStatus, decayAtTurnStart, decayAtTurnEnd } from '../src/engine/statuses.js';
import { executeAction, applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { attackHitPreview } from '../src/engine/stanceHit.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { validateEffects } from '../src/model/validate.js';
import { persistentPoiseMaximum, persistentWardMaximum } from '../src/model/combatRatings.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { live, registries } from './helpers/fixcore-combat-rules.mjs';

test('temporary Precision expires at its owner turn end, not another owner boundary', () => {
  const ctx = live(), enemy = ctx.enemies[0];
  applyStatus(ctx, ctx.player, 'precision', 4, ctx.player);
  applyStatus(ctx, enemy, 'precision', 3, enemy);
  decayAtTurnEnd(ctx, ctx.player);
  assert.equal(ctx.player.statuses.precision, undefined);
  assert.equal(enemy.statuses.precision.stacks, 3);
  decayAtTurnEnd(ctx, enemy);
  assert.equal(enemy.statuses.precision, undefined);
});

test('Precision expiry preserves valid spent Ward and Poise pools', () => {
  const ctx = live();
  ctx.fixCoreRules = { ...ctx.fixCoreRules, ward: { enabled: true } };
  ctx.player.ratings.poise = 20;
  ctx.player.ratings.ward = 12;
  applyStatus(ctx, ctx.player, 'precision', 3, ctx.player);
  const poiseMax = persistentPoiseMaximum(ctx, ctx.player), wardMax = persistentWardMaximum(ctx, ctx.player);
  assert.ok(poiseMax > 3 && wardMax > 2);
  ctx.player.persistentPoise = { max: poiseMax, value: poiseMax - 3 };
  ctx.player.persistentWard = { max: wardMax, value: wardMax - 2 };
  const before = structuredClone({ poise: ctx.player.persistentPoise, ward: ctx.player.persistentWard });
  decayAtTurnEnd(ctx, ctx.player);
  assert.equal(ctx.player.statuses.precision, undefined);
  assert.deepEqual({ poise: ctx.player.persistentPoise, ward: ctx.player.persistentWard }, before);
});

test('Persistent effect tags use the authored tag vocabulary and reject unknown tags', () => {
  const errors = [];
  const context = { ids: { statuses: new Set(['precision']) }, tagIds: new Set(contentBundle.tags.map(row => row.id)),
    err: (path, message) => errors.push(`${path}: ${message}`) };
  const effect = { op: 'applyStatus', target: 'self', status: 'precision', stacks: 2, tags: ['trait:persistent'] };
  validateEffects([effect], 'effects', context);
  assert.deepEqual(errors, []);
  validateEffects([{ ...effect, tags: ['trait:misspelled'] }], 'effects', context);
  assert.ok(errors.some(error => error.includes('unknown effect tag')));
});

test('effect and carrier Persistent tags retain only their Precision through save/load and cleanse', () => {
  let ctx = live();
  const grant = (stacks, tags, card = null, status = 'precision') => executeAction(ctx, {
    source: ctx.player, owner: ctx.player, target: ctx.player, card,
    effect: { op: 'applyStatus', target: 'self', status, stacks, ...(tags ? { tags } : {}) }, meta: {}
  });
  grant(2, ['trait:persistent']);
  grant(3, null, { cardTags: ['trait:persistent'] });
  grant(4);
  grant(2, ['trait:persistent'], null, 'weak');
  assert.deepEqual(ctx.player.statuses.precision, { stacks: 9, persistentStacks: 5 });
  const snapshot = serializeCombatSnapshot(ctx);
  ctx = restoreCombatSnapshot({ registries, rng: createRng(511), snapshot: JSON.parse(JSON.stringify(snapshot)) });
  decayAtTurnEnd(ctx, ctx.player);
  assert.deepEqual(ctx.player.statuses.precision, { stacks: 5, persistentStacks: 5 });
  ctx.turn++; decayAtTurnStart(ctx, ctx.player);
  assert.deepEqual(ctx.player.statuses.precision, { stacks: 5, persistentStacks: 5 });
  assert.equal(ctx.player.statuses.weak.stacks, 1, 'Persistent does not silently change other statuses');
  removeStatus(ctx, ctx.player, 'precision', { amount: 3 });
  assert.deepEqual(ctx.player.statuses.precision, { stacks: 2, persistentStacks: 2 });
  decayAtTurnEnd(ctx, ctx.player);
  assert.equal(ctx.player.statuses.precision.stacks, 2);
  removeStatus(ctx, ctx.player, 'precision');
  grant(1); decayAtTurnEnd(ctx, ctx.player);
  assert.equal(ctx.player.statuses.precision, undefined, 'cleansed persistent stacks never return');
});

test('save validation refuses persistent Precision outside its total stack count', () => {
  const ctx = live(); applyStatus(ctx, ctx.player, 'precision', 2, ctx.player);
  for (const value of [-1, 3, 0.5, '1']) {
    const snapshot = serializeCombatSnapshot(ctx);
    snapshot.player.statuses.precision.persistentStacks = value;
    assert.ok(combatSnapshotProblems(snapshot).some(problem => problem.includes('persistentStacks')), String(value));
  }
});

test('Precision affects hit chance but never per-hit damage or live damage on a landed hit', () => {
  const ctx = live(), target = ctx.enemies[0];
  ctx.player.attributes = { dexterity: 2, strength: 0, wisdom: 0, intelligence: 0 };
  const card = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  const before = profileDamageReceipt(ctx, ctx.player, target, 5, card);
  const chance = attackHitPreview(ctx, ctx.player, target, card).hitChance;
  applyStatus(ctx, ctx.player, 'precision', 10, ctx.player);
  assert.ok(attackHitPreview(ctx, ctx.player, target, card).hitChance > chance);
  const after = profileDamageReceipt(ctx, ctx.player, target, 5, card);
  assert.equal(after.raw, before.raw); assert.equal(after.amount, before.amount);
  primeAccuracyRolls(ctx); applyAttackDamage(ctx, ctx.player, target, 5, [], card);
  assert.equal(100 - target.hp, 5);
});

