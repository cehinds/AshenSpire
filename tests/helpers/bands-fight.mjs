// A Core fight for the rows tests: reaver with a chosen hand, enemies by id (graveWisp starts at reach, so it stands in the back row).
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';
import { createRunState } from '../../src/model/state.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import { createRng } from '../../src/engine/rng.js';
import { dispatch } from '../../src/engine/combat.js';
import { rangePairKey } from '../../src/model/combatEngagement.js';
import { uncappedRun } from './uncapped-range.mjs';

const profile = resolveGameProfile('core');
export const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
export const pairOf = enemyId => rangePairKey('player:player', `enemy:${enemyId}`);
export function bandsFight({ enemyIds = ['wanderingSoldier', 'graveWisp'], hand = [], stamina = 6, encounter = null, seed = 777, classId = 'reaver' } = {}) {
  const run = createRunState({ registries, seed, classId, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  uncappedRun(run);
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds, encounter });
  combat.player.stamina = stamina; combat.player.energy = stamina;
  combat.player.mana = Math.max(combat.player.mana || 0, 3); // Gale Push costs 1 MP (owner 2026-11-19)
  dispatch(combat, { type: 'setReactions', enabled: false });
  combat.piles.hand.length = 0;
  hand.forEach((cardId, i) => combat.piles.hand.push({ instanceId: `qa${i}`, cardId, upgraded: false }));
  return combat;
}
