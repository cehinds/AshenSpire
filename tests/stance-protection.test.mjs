import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { executeAction } from '../src/engine/actions.js';
import { setCombatStance } from '../src/engine/combatMatchups.js';
import { syncWardMaximum, syncPoiseMaximum } from '../src/engine/combatPools.js';

const registries = createRegistries(contentBundle);
function fixture(camp = 'physical', school) {
  const ctx = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2,
    ratingsRules: resolveCombatRatings({}, contentBundle), enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 20, mana: 20,
      maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1, deck: [] } });
  const actor = ctx.player;
  actor.ratings = { ar: 0, dr: 12, pr: 13, poise: 20, ward: 20 };
  const carrier = { cardId: camp === 'spell' ? 'crystalBarrier' : 'defend', type: 'skill',
    tags: ['camp:' + camp, 'maneuver:defend'],
    combatProfile: { camp, maneuver: 'defend', range: 'melee', ...(school ? { school } : {}) } };
  const drain = () => { while (ctx.queue.length) executeAction(ctx, ctx.queue.shift()); };
  return { ctx, actor, carrier, drain };
}

for (const camp of ['physical', 'spell']) test(camp + ' Defense overflow keeps its exact configured protection lanes', () => {
  const { ctx, actor, carrier, drain } = fixture(camp, 'fire');
  setCombatStance(ctx, actor, carrier);
  drain();
  syncWardMaximum(ctx, actor); syncPoiseMaximum(ctx, actor);
  for (const amount of [5, 7]) {
    ctx.stanceRules = { defenseRestore: amount };
    actor.block = 0; actor.barrier = 0;
    actor.persistentPoise.value = actor.persistentPoise.max;
    actor.persistentWard.value = actor.persistentWard.max;
    setCombatStance(ctx, actor, carrier); drain();
    assert.equal(actor.block, 2 * amount, 'full Poise and full Ward both overflow into Block without DR, PR or guard modifiers (the old Barrier overflow is Block)');
    assert.equal(actor.barrier || 0, 0, 'no numeric Barrier pool (SPEC 4.1a)');
    actor.block = 0; actor.barrier = 0;
    actor.persistentPoise.value = actor.persistentPoise.max - 2;
    actor.persistentWard.value = actor.persistentWard.max - 3;
    setCombatStance(ctx, actor, carrier); drain();
    assert.equal(actor.persistentPoise.value, actor.persistentPoise.max);
    assert.equal(actor.persistentWard.value, actor.persistentWard.max);
    assert.equal(actor.block, (amount - 2) + (amount - 3));
    assert.equal(actor.barrier || 0, 0);
  }
});

for (const [school, block, barrier] of [['fire', 1, 2], ['frost', 2, 1], ['force', 2, 1]]) {
  test(school + ' stance entry preserves its pre-split Block (the old Barrier share is Block) with missing Ward', () => {
    const { ctx, actor, carrier, drain } = fixture('spell', school);
    ctx.stanceRules = { defenseRestore: 0 };
    actor.block = 0; actor.barrier = 0;
    setCombatStance(ctx, actor, carrier);
    assert.ok(actor.persistentWard.max > 0, 'fixture has a rated Ward pool');
    actor.persistentWard.value = 0;
    drain();
    assert.equal(actor.block, block + barrier);
    assert.equal(actor.barrier || 0, 0);
    assert.equal(actor.persistentWard.value, 0, 'entry protection never refills Ward');
  });
}
