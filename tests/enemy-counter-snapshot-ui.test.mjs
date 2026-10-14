import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';

test('restored enemy Counter catalog uses saved coefficients and default reply over changed live tuning', () => {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(449), enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 500, hp: 500, energyMax: 3, drawPerTurn: 1,
      deck: [{ instanceId: 'c1', cardId: 'strike' }], relicIds: [] } });
  Object.assign(combat.combatMatchupRules.counter, { defaultDamage: 9, incomingMultiplier: 0.25,
    retaliationMultiplier: 1.75, retaliationFlat: 13, poiseMultiplier: 2.5 });
  const snapshot = serializeCombatSnapshot(combat);
  const changed = structuredClone(contentBundle.balance);
  Object.assign(changed.combatMatchups.counter, { defaultDamage: 33, incomingMultiplier: 0.9,
    retaliationMultiplier: 3, retaliationFlat: 99, poiseMultiplier: 4 });
  const loaded = restoreCombatSnapshot({ registries: createRegistries({ ...contentBundle, balance: changed }),
    rng: createRng(449, combat.rng.getCounters()), snapshot });
  const enemy = loaded.enemies[0];
  enemy.damageMult = 2;
  const move = { intent: 'block', block: 4, counterPoiseDamage: 2,
    tags: ['camp:physical', 'maneuver:counter', 'counter:melee'] };
  primeEnemyCounter(loaded, enemy, move, 'parry');
  const definition = { id: enemy.enemyId, moves: { parry: move } };
  const [saved] = enemyMoveCards(definition, { enemy, registries: loaded.registries,
    combatMatchupRules: loaded.combatMatchupRules });
  assert.equal(enemy.combatCounter.damage, 18);
  assert.match(saved.detail, /18 base counter damage/);
  assert.match(saved.detail, /Incoming eligible damage × 0.25/);
  assert.match(saved.detail, /floor\(base × 1.75\) \+ 13 \+ bonus/);
  assert.match(saved.detail, /2 base counter Poise damage × 2.5/);
  assert.doesNotMatch(saved.detail, /66 base counter damage|× 0.9|\+ 99/);
  const hint = saved.combatTags.find(tag => tag.id === 'maneuver:counter').blurb;
  assert.match(hint, /Reduce damage from one eligible hit/);
  assert.doesNotMatch(hint, /half damage|50%/);
  // Non-fight callers and legacy saves still use the supplied live registry.
  const [live] = enemyMoveCards(definition, { enemy, registries: loaded.registries });
  assert.match(live.detail, /66 base counter damage/);
  assert.match(live.detail, /Incoming eligible damage × 0.9/);
});

test('generic Smash hint remains accurate when the Guard damage multiplier is tuned', () => {
  const balance = structuredClone(contentBundle.balance);
  balance.combatMatchups.smash.guardedMultiplier = 2;
  const registries = createRegistries({ ...contentBundle, balance });
  const [card] = enemyMoveCards({ id: 'smashTuningFixture', moves: { smash: {
    intent: 'attack', damage: 5, tags: ['camp:physical', 'maneuver:smash'] } } }, { registries });
  const hint = card.combatTags.find(tag => tag.id === 'maneuver:smash').blurb;
  assert.match(hint, /extra damage against physical Guard/);
  assert.doesNotMatch(hint, /50%/);
  assert.equal(balance.combatMatchups.smash.guardedMultiplier, 2);
});
