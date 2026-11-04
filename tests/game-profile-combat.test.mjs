import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, resolvedCardPlayCosts } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt, profileCardCosts, setProfileStance } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const author = modules => ({ formatVersion: 1, core: 'ashen.core@1.0.0', modules });
const profile = modules => resolveGameProfile(author(modules || {}));
const carrier = maneuver => ({ combatProfile: { maneuver, camp: 'physical' } });
function world(modules = {}) {
  const gameProfile = profile(modules);
  const events = [];
  return { gameProfile, turn: 1, rng: createRng(17), emit: (type, payload) => events.push({ type, ...payload }), events };
}
const fighter = (id, extra = {}) => ({ id, kind: id === 'player' ? 'player' : 'enemy', hp: 80, maxHp: 80,
  alive: true, block: 0, statuses: {}, ratings: { ar: 2, dr: 1, poise: 0 }, ...extra });
function live(modules = {}, selectedProfile = null, moves = null) {
  const gameProfile = selectedProfile || profile(modules);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(moves ? { ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier' ? { ...enemy, id: 'profileTestSoldier', firstMove: 'slash', attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 }, equipmentSp: 0, moves } : enemy) } : contentBundle, gameProfile)), gameProfile);
  const deck = Array.from({ length: 10 }, (_, i) => ({ instanceId: `core-${i}`, cardId: i < 6 ? 'core.strike' : 'core.defend', upgraded: false }));
  const combat = createCombat({ registries, rng: createRng(311), gameProfile, enemyIds: [moves ? 'profileTestSoldier' : 'wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxStamina: 10, stamina: 10, maxMana: 5, mana: 5,
      energyMax: 10, drawPerTurn: 5, poiseMax: 4, attributes: { intelligence: 1, strength: 2, dexterity: 1 }, deck } });
  return { combat, registries };
}



















const counterMoves = {
  slash: { intent: 'attack', damage: 1, hits: 2, weight: 1,
    tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] },
};
const answerReaction = (combat, cardId = null) => dispatch(combat, { type: 'chooseReaction',
  offerId: combat.pendingReaction.id,
  optionId: cardId ? combat.pendingReaction.options.find(option => option.cardId === cardId)?.id : null });
const addCounter = combat => combat.piles.hand.push({ instanceId: 'deferred-counter', cardId: 'core.counter', upgraded: false });








