// Gear play grants belong to the resolved card, including a root paused by an enemy reaction or a card choice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { ReactionCarrierProfile } from './helpers/reaction-carriers.mjs';

// Owner ruling 2026-11-28: no shipped Core card reacts, so the held Defend answers as a fixture Reaction carrier.
const profile = ReactionCarrierProfile();
// The stored 1:1 Smash is under the shipped Guard's 8 threshold, so the fixture Guard answers any hit.
const GUARD_FIXTURE_MIN_INCOMING = 1;
const configuredContent = applyGameProfileToContent(contentBundle, profile);
// Current Core enemies use decks. Keep the shipped legacy Guard move to exercise a deterministic reaction window on a Core card.
const shippedGuard = contentBundle.enemies.find(enemy => enemy.id === 'gildedKnight').moves.gildedGuard;
const guard = {
  ...shippedGuard,
  reaction: {
    ...shippedGuard.reaction,
    minIncoming: GUARD_FIXTURE_MIN_INCOMING,
  },
};
const registries = bindGameProfileRegistries(createRegistries({ ...configuredContent,
  // The gear rework replaced the former Axe type-wide Strength grant. Keep it on one fixture weapon to exercise deferred delivery.
  equipment: { ...configuredContent.equipment,
    armaments: configuredContent.equipment.armaments.map(weapon => weapon.id === 'battleaxe'
      ? { ...weapon, mods: [...weapon.mods, 'anyAttack.playStrength=+1'] }
      : weapon),
  },
  enemies: configuredContent.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, moves: { gildedGuard: guard } } : enemy),
}), profile);
const profileMeta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

function fixture({ weapon = 'battleaxe', enemy = 'gildedKnight' } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed: 31, profileMeta });
  equipPiece(registries, run.loadout, 'rightHand', 0, weapon, { has: () => true }, { inCombat: false, classId: run.class, attributes: run.attributes });
  run.reactionRulesVersion = 2;
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: [enemy, 'wanderingSoldier'] });
  for (const target of combat.enemies) Object.assign(target, { hp: 900, maxHp: 900, block: 0, stamina: 20, maxStamina: 20, statuses: {}, persistentPoise: { value: 0, max: 0 } });
  combat.player.energy = 20;
  combat.piles.hand = [{ instanceId: 'smash', cardId: 'core.smash', upgraded: false }, { instanceId: 'next', cardId: 'core.strike', upgraded: false }, { instanceId: 'answer', cardId: 'core.defend', upgraded: false }];
  primeAccuracyRolls(combat, { count: 2 });
  return combat;
}

const play = combat => dispatch(combat, { type: 'playCard', cardInstanceId: 'smash', targetId: combat.enemies[0].id });
const strength = combat => combat.player.attributes.strength;
const restore = combat => restoreCombatSnapshot({ registries, snapshot: JSON.parse(JSON.stringify(serializeCombatSnapshot(combat))), rng: createRng(combat.rng.seed, combat.rng.getCounters()) });

for (const saved of [false, true]) test(`Axe Strength waits for the reaction-paused Smash and grants once${saved ? ' after save/restore' : ''}`, () => {
  let combat = fixture();
  const base = strength(combat);
  play(combat);
  assert.ok(combat.pendingReaction, 'the real Gilded Guard pauses the root');
  assert.equal(combat.reactionStack.entries[0].moveId, 'gildedGuard');
  assert.equal(strength(combat), base, 'the paused hit cannot gain its own Axe Strength');
  assert.deepEqual(combat.reactionRootPlay.gearStrengthGrants, [1]);
  if (saved) combat = restore(combat);
  assert.equal(strength(combat), base);
  assert.deepEqual(combat.reactionRootPlay.gearStrengthGrants, [1]);
  const response = { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null };
  dispatch(combat, response);
  assert.equal(strength(combat), base + 1);
  assert.deepEqual(combat.eventLog.filter(row => row.type === 'attributeChanged' && row.attribute === 'strength').map(row => row.amount), [1]);
  assert.throws(() => dispatch(combat, response), /reaction choice is unavailable/);
  assert.equal(strength(combat), base + 1, 'a repeated response cannot grant again');
  assert.equal(combat.reactionRootPlay, undefined);
  assert.equal(combat.pendingAbilityPlay, undefined);
  assert.equal(combat.eventLog.filter(row => row.type === 'cardResolved' && row.cardInstanceId === 'smash').length, 1);
  const ownHit = combat.eventLog.find(row => row.type === 'damageDealt' && row.cardId === 'core.smash');
  assert.equal(ownHit.damageReceipt.hits[0].sources.find(row => row.id === 'ar:0').amount, base, 'the resumed hit uses the pre-grant Strength');
  const control = fixture();
  control.player.itemProps.playGrants = [];
  play(control);
  dispatch(control, { type: 'chooseReaction', offerId: control.pendingReaction.id, optionId: null });
  const controlHit = control.eventLog.find(row => row.type === 'damageDealt' && row.cardId === 'core.smash');
  assert.equal(ownHit.amount, controlHit.amount, 'the resolved hit exactly matches the same play without its post-play grant');
  // Quote the next attack against an untouched enemy, isolating the grant from the root's reaction and Poise effects.
  const target = combat.enemies[1];
  const next = previewCard(combat, 'next', target.id).values.find(row => row.op === 'damage');
  const quoted = next.perTarget[target.id];
  const hp = target.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'next', targetId: target.id });
  assert.equal(hp - combat.enemies[1].hp, quoted, 'the next live quote includes the resolved grant');
  assert.equal(strength(combat), base + 2, 'each resolved card grants exactly once');
});

test('non-Axe reaction-paused cards do not acquire a gear Strength field', () => {
  const combat = fixture({ weapon: 'straightSword' });
  const before = strength(combat);
  play(combat);
  assert.ok(combat.pendingReaction);
  assert.equal(Object.hasOwn(combat.reactionRootPlay, 'gearStrengthGrants'), false);
  dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  assert.equal(strength(combat), before);
});

for (const saved of [false, true]) test(`a card-choice pause preserves separate Strength grants until resolution${saved ? ' after save/restore' : ''}`, () => {
  let combat = fixture({ enemy: 'wanderingSoldier' });
  const base = strength(combat);
  // Shipped choice card plus test-only matching grants exercise the same pending-play contract without inventing a new card.
  combat.piles.hand[0].cardId = 'base.exhaust-choose';
  combat.player.itemProps.playGrants = [1, 2].map(amount => ({ selector: 'any', arg: null, conds: [], grant: 'strength', amount }));
  dispatch(combat, { type: 'playCard', cardInstanceId: 'smash', targetId: combat.player.id });
  assert.ok(combat.pendingCardChoice);
  assert.equal(strength(combat), base);
  assert.deepEqual(combat.pendingAbilityPlay.gearStrengthGrants, [1, 2]);
  if (saved) combat = restore(combat);
  // Only the amounts captured at play time are owned by this play; later gear state is not re-read on resume.
  combat.player.itemProps.playGrants = [];
  const response = { type: 'chooseCards', cardInstanceIds: ['answer'] };
  dispatch(combat, response);
  assert.equal(strength(combat), base + 3);
  assert.equal(combat.pendingAbilityPlay, undefined);
  assert.equal(combat.pendingCardChoice, undefined);
  const changes = combat.eventLog.filter(row => row.type === 'attributeChanged' && row.attribute === 'strength');
  assert.deepEqual(changes.map(row => row.amount), [1, 2], 'grants remain separate and retain their order');
  assert.ok(changes.every(row => row.thisTurn));
  const resolved = combat.eventLog.findIndex(row => row.type === 'cardResolved' && row.cardInstanceId === 'smash');
  assert.ok(combat.eventLog.indexOf(changes[0]) > resolved, 'the grants follow card resolution');
  assert.throws(() => dispatch(combat, response), /No card-zone choice/);
  assert.equal(strength(combat), base + 3);
});
