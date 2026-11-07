// A chosen ability discard is its own root action outside a reaction, and stays
// inside the paused reaction's action otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { combatRules } from '../src/content/combatRules.js';
import { createFoundation } from '../src/engine/combatRules.js';
import { armCombatCounter } from '../src/engine/combatMatchups.js';

const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => card.id === 'sweepingBlow'
  ? { ...card, effects: [{ op: 'discard', choose: true, amount: 1 }, ...card.effects] } : card) });

function setup() {
  const player = { id: 'a', classId: 'reaver', hp: 100, maxHp: 100, mana: 20, maxMana: 20,
    stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 3, combatExpansionVersion: 2,
    deck: [{ cardId: 'guardCounter', instanceId: 'filler', upgraded: false },
      { cardId: 'strike', instanceId: 'strike', upgraded: false }, { cardId: 'sweepingBlow', instanceId: 'sweep', upgraded: false }] };
  const combat = createCombat({ registries, rng: createRng(701), player, enemyIds: ['wanderingSoldier'], combatExpansionVersion: 2, reactionRulesVersion: 1 });
  combat.foundation = createFoundation(combatRules);
  (combat.player).block = 100;
  const enemy = combat.enemies[0]; enemy.block = 100;
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 };
  return { combat, enemy,
    play: (id, targetId) => dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId }),
    discard: ids => dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: ids }) };
}
const roots = out => [...new Set(out.events.map(event => event.rootActionId))];

test('a discard chosen outside a reaction starts a new root action', () => {
  const { combat, enemy, play, discard } = setup();
  const played = play('sweep', enemy.id);
  assert.ok(combat.pendingAbilityDiscard); assert.equal(combat.reactionResume, undefined);
  const playRoot = combat.foundation.actionSerial;
  assert.deepEqual(roots(played), [playRoot]);
  // A limitPerAction counter spent during the play must not carry into the discard.
  combat.foundation.counts = { spentDuringPlay: 99 };
  combat.foundation.rolls = { spentDuringPlay: 0.5 };
  const out = discard(['filler']);
  assert.deepEqual(roots(out), [playRoot + 1]);
  assert.equal(combat.foundation.actionSerial, playRoot + 1);
  assert.equal(combat.foundation.counts.spentDuringPlay, undefined);
  assert.equal(combat.foundation.rolls.spentDuringPlay, undefined);
  assert.equal(combat.pendingAbilityDiscard, undefined);
});

test('a discard chosen while a reaction is paused stays inside the reaction action', () => {
  const { combat, enemy, play, discard } = setup();
  // The reaction-lifecycle fixture needs a landed root and return. Keep real
  // seeded draws; their ordinary non-fumble threshold is deliberately trivial.
  const owner = combat.player;
  for (const actor of [owner, enemy]) { actor.accuracy = 100; actor.evasion = 0; }
  enemy.combatStance = { camp: 'physical', maneuver: 'counter', range: 'melee', targeting: 'single' };
  armCombatCounter(combat, enemy, { moveId: 'returnCarrier',
    tags: ['camp:physical', 'maneuver:counter', 'range:melee', 'targeting:single'],
    combatProfile: { ...enemy.combatStance, damageType: 'blunt' } }, { payload: { hp: 1, poise: 0, ward: 0 } });
  play('strike', enemy.id);
  const offer = combat.pendingReaction;
  const optionId = offer.options.find(option => option.cardId === 'sweepingBlow').id;
  dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId });
  assert.ok(combat.reactionResume); assert.ok(combat.pendingAbilityDiscard);
  const reactionRoot = combat.foundation.actionSerial;
  const savedRoot = combat.reactionResume.foundation.actionSerial;
  assert.ok(reactionRoot > savedRoot);
  const out = discard(['filler']);
  // Discard events belong to the reaction play; the interrupted action resumes after.
  const discardEvent = out.events.find(event => event.cardInstanceId === 'filler');
  assert.ok(discardEvent);
  assert.equal(discardEvent.rootActionId, reactionRoot);
  assert.ok(!roots(out).includes(reactionRoot + 1));
  assert.equal(combat.reactionResume, undefined);
});
