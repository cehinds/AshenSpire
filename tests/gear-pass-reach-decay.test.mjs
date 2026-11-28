import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { applyStatus, getStacks, decayAtTurnEnd, decayAtTurnStart } from '../src/engine/statuses.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { ReactionCarrierProfile } from './helpers/reaction-carriers.mjs';

// Owner ruling 2026-11-28: no shipped Core card reacts, so the held Defend and Jab are fixture Reaction carriers.
const REACTION_PROFILE = ReactionCarrierProfile();

function fixture({ weapon = 'straightSword', armor, classId = 'reaver', profile = resolveGameProfile('default') } = {}) {
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId, seed: 31,
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  equipPiece(registries, run.loadout, 'rightHand', 0, weapon, { has: () => true }, { inCombat: false, classId: run.class, attributes: run.attributes });
  if (armor) assert.ok(equipPiece(registries, run.loadout, 'armor', 0, armor, { has: () => true }, { inCombat: false, classId, attributes: run.attributes }));
  run.relics = [];
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  combat.player.energy = combat.player.stamina = 30;
  combat.piles.hand = [{ instanceId: 'defend', cardId: 'core.defend', upgraded: false }, { instanceId: 'jab', cardId: 'core.jab', upgraded: false }];
  const enemy = combat.enemies[0];
  enemy.intent = { ...enemy.intent, kind: 'attack', moveId: 'slash', damage: 8, hits: 1,
    combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing', range: 'melee', targeting: 'single', traits: [], stanceTrigger: false } };
  enemy.plannedMoves = []; enemy.stamina = enemy.maxStamina = 3;
  return combat;
}
const restored = combat => restoreCombatSnapshot({ registries: combat.registries,
  rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: JSON.parse(JSON.stringify(serializeCombatSnapshot(combat))) });
const jabRange = combat => resolveCombatCard(combat, { cardId: 'core.jab', instanceId: 'jab', upgraded: false }).range;

for (const save of [false, true]) test(`current Reach expires before the enemy-phase reaction window${save ? ' across save/restore' : ''}`, () => {
  let combat = fixture({ profile: REACTION_PROFILE });
  assert.notEqual(jabRange(combat), 'reach', 'the Sword card has no inherent Reach');
  applyStatus(combat, combat.player, 'reach', 1, combat.player);
  assert.equal(jabRange(combat), 'reach');
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction, 'the real turn loop pauses before the enemy hit');
  assert.equal(getStacks(combat.player, 'reach'), 0);
  assert.notEqual(jabRange(combat), 'reach', 'an enemy-turn reaction cannot reuse the expired range grant');
  if (save) combat = restored(combat);
  assert.equal(getStacks(combat.player, 'reach'), 0);
  assert.notEqual(jabRange(combat), 'reach');
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  assert.equal(getStacks(combat.player, 'reach'), 0);
});

for (const holder of ['player', 'enemy']) test(`current ${holder} Reach loses one stack at owner end and none at owner start`, () => {
  const combat = fixture(), entity = holder === 'player' ? combat.player : combat.enemies[0];
  applyStatus(combat, entity, 'reach', 2, entity);
  decayAtTurnEnd(combat, entity);
  assert.equal(getStacks(entity, 'reach'), 1);
  combat.turn += 1; delete entity.fixCoreDecayRound;
  decayAtTurnStart(combat, entity);
  assert.equal(getStacks(entity, 'reach'), 1, 'no second decay at owner start');
});

test('Waywatcher Coat grants a fresh whole Reach stack at the next owner start', () => {
  const combat = fixture({ armor: 'waywatcher', classId: 'rogue' });
  dispatch(combat, { type: 'setReactions', enabled: false });
  assert.equal(getStacks(combat.player, 'reach'), 1);
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.turn, 2);
  assert.equal(getStacks(combat.player, 'reach'), 1);
  const events = combat.eventLog.slice(start);
  assert.ok(events.some(event => event.type === 'statusExpired' && event.status === 'reach' && event.reason === 'ownerTurnEnd'));
  assert.ok(events.some(event => event.type === 'statusApplied' && event.status === 'reach'));
});

test('Reach changes neither Ward, Precision, Evade nor Counter clocks', () => {
  const combat = fixture(), player = combat.player;
  player.statuses = { reach: { stacks: 2 }, ward: { stacks: 3 }, precision: { stacks: 3 }, evade: { stacks: 3 } };
  player.counterStacks = 3;
  decayAtTurnEnd(combat, player);
  assert.deepEqual(['reach', 'ward', 'precision', 'evade'].map(id => getStacks(player, id)), [1, 3, 3, 3]);
  assert.equal(player.counterStacks, 3);
  combat.turn += 1; delete player.fixCoreDecayRound;
  decayAtTurnStart(combat, player);
  assert.deepEqual(['reach', 'ward', 'precision', 'evade'].map(id => getStacks(player, id)), [1, 2, 0, 2], 'Precision retains its existing three-stack start decay');
  assert.equal(player.counterStacks, 3, 'the separate Counter consumer is not altered by status decay');
});

for (const decay of ['none', 'ownerTurnStart']) test(`custom Reach decay ${decay} remains authoritative`, () => {
  const combat = fixture(), statuses = combat.registries.statuses;
  combat.registries = { ...combat.registries, statuses: { ...statuses,
    get: id => id === 'reach' ? { ...statuses.get(id), decay } : statuses.get(id) } };
  applyStatus(combat, combat.player, 'reach', 2, combat.player);
  decayAtTurnEnd(combat, combat.player);
  assert.equal(getStacks(combat.player, 'reach'), 2);
  combat.turn += 1; delete combat.player.fixCoreDecayRound;
  decayAtTurnStart(combat, combat.player);
  assert.equal(getStacks(combat.player, 'reach'), decay === 'none' ? 2 : 0);
});

test('a genuine pre-type-effects saved profile retains the old start clock after save/restore', () => {
  const profile = resolveGameProfile(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url)))));
  let combat = fixture({ profile });
  assert.equal(combat.gameProfile.modules.gear.typeEffectsVersion, undefined);
  applyStatus(combat, combat.player, 'reach', 2, combat.player);
  combat = restored(combat);
  decayAtTurnEnd(combat, combat.player);
  assert.equal(getStacks(combat.player, 'reach'), 2);
  combat.turn += 1; delete combat.player.fixCoreDecayRound;
  decayAtTurnStart(combat, combat.player);
  assert.equal(getStacks(combat.player, 'reach'), 1);
});

test('an explicit zero type-effects version retains the old Reach clock', () => {
  const combat = fixture();
  combat.gameProfile = { ...combat.gameProfile, modules: { ...combat.gameProfile.modules, gear: { ...combat.gameProfile.modules.gear, typeEffectsVersion: 0 } } };
  applyStatus(combat, combat.player, 'reach', 2, combat.player);
  decayAtTurnEnd(combat, combat.player);
  assert.equal(getStacks(combat.player, 'reach'), 2);
  combat.turn += 1; delete combat.player.fixCoreDecayRound;
  decayAtTurnStart(combat, combat.player);
  assert.equal(getStacks(combat.player, 'reach'), 1);
});
