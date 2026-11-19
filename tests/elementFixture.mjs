// Shared fixture for tests/element-*.test.mjs (W25 element identity): a Core 2 fight on the live profile with plain enemies.
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// Owner, 2026-11-18: the Core side damage and Block scales (x0.7) and the spell Poise doubling are pinned to 1 here; these suites pin the element rules' own arithmetic.
export const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1, spellPoiseDamageMultiplier: 1 } } });
export const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
export const ATTRIBUTES = { strength: 2, dexterity: 2, constitution: 2, wisdom: 1, intelligence: 1 };

/** A fight with `enemies` plain enemies (500 HP, no Block, Poise `poise`), the player with `attributes`. */
export function fight({ classId = 'starseer', enemies = 1, enemyId = 'wanderingSoldier', poise = 0, attributes = {}, undead = false, seed = 5, legacy = false, oldCaps = false, stanceWeakness = false, profile: pinnedProfile } = {}) {
  // Explicit historical profiles retain their original policy; never rebind or mutate the shared live fixture.
  const ownProfile = pinnedProfile === undefined ? null : structuredClone(pinnedProfile);
  const registries = ownProfile === null ? reg : bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, ownProfile)), ownProfile);
  const run = createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: Array.from({ length: enemies }, () => enemyId) });
  for (const enemy of combat.enemies) {
    Object.assign(enemy, { hp: 500, maxHp: 500, block: 0, barrier: 0, persistentPoise: { value: poise, max: Math.max(20, poise) }, attributes: { ...ATTRIBUTES }, level: 1 });
    if (undead) enemy.tags = ['undead'];
    delete enemy.combatStance; delete enemy.combatCounter;
  }
  Object.assign(combat.player.attributes, attributes);
  combat.player.energy = 9; combat.player.mana = 9;
  if (legacy) delete combat.fixCoreRules.elements;
  // The plain enemies hold no stance, so they are Idle; the Idle stance weakness (theme B, 2026-11-17) has its own suite (stance-status-rules) and
  // stays out of the element numbers here unless a test asks for it.
  if (!stanceWeakness) delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
  // A fight saved before `statusCaps: "none"` (owner 2026-11-15) keeps every old hold cap; `legacy` fights predate it too.
  if (legacy || oldCaps) delete combat.fixCoreRules.statusCaps;
  return { combat, player: combat.player, enemies: combat.enemies, enemy: combat.enemies[0] };
}

/** Put `cardId` in hand, preview it against `targetId`, play it, and return what was previewed and what was lost. */
export function play(combat, cardId, targetId, { upgraded = false } = {}) {
  const hand = combat.piles.hand[0];
  hand.cardId = cardId; hand.upgraded = upgraded;
  primeAccuracyRolls(combat);
  const before = Object.fromEntries(combat.enemies.map(enemy => [enemy.id, enemy.hp]));
  const row = previewCard(combat, hand.instanceId, targetId).values.find(value => value.op === 'damage');
  dispatch(combat, { type: 'playCard', cardInstanceId: hand.instanceId, targetId });
  return { row, lost: Object.fromEntries(combat.enemies.map(enemy => [enemy.id, before[enemy.id] - enemy.hp])) };
}
