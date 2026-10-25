import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';
import { createRunState } from '../../src/model/state.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
export const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
export const baseRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// Moves are compiled from shared authored sources by createRegistries; alter the
// final registered move so this fixture fixes an exact 5-per-hit contract.
export const registries = Object.freeze({ ...baseRegistries, enemies: {
  ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id), get: id => {
    const row = baseRegistries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage: 5, hits: 3 } } } : row;
  }
} });
export function live() {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const entity of [combat.player, ...combat.enemies]) {
    Object.assign(entity, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, ratings: { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 }, ratingSources: [], persistentPoise: { value: 0, max: 0 } });
    delete entity.combatStance; delete entity.combatCounter;
  }
  // This fixture authors three contacts; fund its two-SP minimum and select
  // that move explicitly instead of inheriting the one-SP native plan.
  const enemy = combat.enemies[0];
  Object.assign(enemy, { maxStamina: 2, stamina: 2 });
  enemy.intent = { ...enemy.intent, moveId: 'slash' };
  enemy.plannedMoves = [];
  return combat;
}

