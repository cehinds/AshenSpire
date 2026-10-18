import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';

// Use main's real compiled import order: native ESM bindings hide this cycle.
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { createCombat, dispatch } = require('src/engine/combat.js');
const { createRng } = require('src/engine/rng.js');
const { resolveCombatRatings } = require('src/model/combatRatings.js');
const { reactionPaused } = require('src/engine/combatReactions.js');

for (const cardId of ['starSpark', 'strike']) test(`bundled Starseer ${cardId} resolves Gilded Guard and a second spell`, () => {
  const registries = createRegistries(contentBundle);
  const card = instanceId => ({ cardId, instanceId, ...(cardId === 'strike' ? {
    damageSchool: 'magic', magicShare: 0.4, physicalDamageType: 'blunt',
    ratingId: 'pr', ratingValue: 4, equipmentRole: 'attack', profileId: 'staffMagicAttack', sourceHand: 'right', weaponId: 'ashStaff',
  } : {}) });
  const combat = createCombat({ registries, rng: createRng(42), enemyIds: ['gildedKnight'],
    combatExpansionVersion: 2, reactionRulesVersion: 2, ratingsRules: resolveCombatRatings({}, contentBundle),
    player: { classId: 'starseer', attributes: { strength: 1, dexterity: 1, constitution: 1, wisdom: 6, intelligence: 6 }, hp: 100, maxHp: 100, energyMax: 10,
      stamina: 20, maxStamina: 20, mana: 20, maxMana: 20, drawPerTurn: 2,
      deck: [card('spell1'), card('spell2')] } });
  const enemy = combat.enemies[0];
  const before = { hp: enemy.hp, energy: combat.player.energy, mana: combat.player.mana, stamina: combat.player.stamina };
  assert.doesNotThrow(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'spell1', targetId: enemy.id }));
  assert.ok(combat.eventLog.some(e => e.type === 'enemyMoveStarted' && e.reaction && e.moveId === 'gildedGuard'), 'authored Knight reaction executes');
  assert.equal(reactionPaused(combat), false);
  assert.equal(combat.queue.length, 0);
  assert.doesNotThrow(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'spell2', targetId: enemy.id }));
  const receipts = combat.eventLog.filter(e => e.type === 'cardPlayed');
  assert.equal(receipts.length, 2);
  assert.equal(combat.player.energy, before.energy - receipts.reduce((n, e) => n + e.energySpent, 0));
  assert.equal(combat.player.mana, before.mana - receipts.reduce((n, e) => n + e.manaSpent, 0));
  assert.equal(combat.player.stamina, before.stamina - receipts.reduce((n, e) => n + e.staminaSpent, 0));
  assert.ok(combat.eventLog.some(e => e.type === 'damageDealt' && e.sourceId === 'player' && e.targetId === enemy.id));
  assert.ok(enemy.hp < before.hp, 'spells damage the Knight after its defenses');
  assert.equal(reactionPaused(combat), false);
  assert.equal(combat.queue.length, 0);
});
