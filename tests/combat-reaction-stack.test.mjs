import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCoopCombat, endTurn, chooseReaction, chooseDiscard, playCard } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';

// `strike` is tagged `trait:reaction` in this bundle only (the real projection is separate work).
function fixture({ version = 2, cardIds = ['guardCounter', 'sweepingBlow'], enemyCount = 1 } = {}) {
  const registries = createRegistries({ ...contentBundle,
    tagging: [...contentBundle.tagging, { family: 'card', scope: '', objectId: 'strike', tagId: 'trait:reaction' }],
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 1, hits: 2, weight: 1,
        tags: ['camp:physical', 'maneuver:attack', 'reach:contact', 'targeting:single'] } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: Array(enemyCount).fill('wanderingSoldier'), player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: cardIds.length,
      deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `r${index}`, upgraded: false })) } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) { enemy.intentRevealed = false; enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 }; }
  return { combat, registries };
}

test('version 2 offers a trait:reaction card by tag, and version 1 does not', () => {
  const v2 = fixture({ cardIds: ['strike'] });
  dispatch(v2.combat, { type: 'endTurn' });
  assert.ok(v2.combat.pendingReaction?.options.some(option => option.cardId === 'strike'));
  const v1 = fixture({ version: 1, cardIds: ['strike'] });
  dispatch(v1.combat, { type: 'endTurn' });
  assert.equal(v1.combat.pendingReaction, undefined);
});
