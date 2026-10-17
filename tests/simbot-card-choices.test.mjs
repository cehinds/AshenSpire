import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { botControlAction } from '../tools/simbot.mjs';

function fixture(effects) {
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined,
    costRule: 'fixed', cost: 0, manaCost: 0, effects, upgrade: {} };
  const registries = { ...base, cards: { ...base.cards, get: id => id === 'defend' ? card : base.cards.get(id) } };
  return createCombat({ registries, rng: createRng(9), enemyIds: ['wanderingSoldier'],
    player: { id: 'player', classId: 'herald', maxHp: 80, hp: 50, maxMana: 20, mana: 20,
      maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 5, relicIds: [],
      deck: Array.from({ length: 10 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'defend', upgraded: false })) } });
}
for (const [label, effect, action] of [
  ['chosen discard', { op: 'discard', amount: 1, choose: true }, 'chooseDiscard'],
  ['chosen zone transfer', { op: 'moveCards', from: 'hand', to: 'exhaust', amount: 1, selection: 'choose' }, 'chooseCards'],
]) test(`bot resolves ${label} before continuing the paused card`, () => {
  const combat = fixture([effect, { op: 'block', target: 'self', amount: 5 }]);
  dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId });
  assert.equal(combat.player.block, 0, 'later effects wait for the player choice');
  const before = JSON.stringify(combat.piles);
  const choice = botControlAction(combat);
  assert.equal(choice.type, action);
  assert.equal(JSON.stringify(combat.piles), before, 'planning never moves cards');
  dispatch(combat, choice);
  assert.equal(combat.player.block, 5, 'choice resumes the real engine queue');
  assert.equal(combat.pendingAbilityDiscard, undefined);
  assert.equal(combat.pendingCardChoice, undefined);
  assert.equal(combat.eventLog.filter(e => e.type === 'cardResolved').length, 1);
});

test('the bot never discards cards already committed to the reaction stack', () => {
  const combat = fixture([]);
  const stacked = combat.piles.hand[0];
  combat.reactionStack = { entries: [{ side: 'player', ownerId: 'player', play: { cardInstanceId: stacked.instanceId } }] };
  combat.pendingAbilityDiscard = { count: 1 };
  assert.notEqual(botControlAction(combat).cardInstanceIds[0], stacked.instanceId);
});
