import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardClassification, cardPreparationCategory } from '../src/model/cardClassification.js';
import { playingCardModel, combatCardType } from '../src/model/playingCard.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { stanceForCard } from '../src/model/alternativeStance.js';
import { cardActionFor } from '../src/model/alternativeCardAnimation.js';
import { configuredStance } from '../src/engine/gameProfileCombat.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
const world = id => {
  const profile = resolveGameProfile(id);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  return { profile, registries };
};
for (const profileId of ['core', 'current']) {
  test(`${profileId}: Draw remains a one-SP zero-MP Skill with its existing Draw Two effect and Prepare stance`, () => {
    const { registries } = world(profileId), card = resolveCard(registries, { cardId: 'base.draw' });
    assert.equal(card.type, 'skill');
    assert.equal(card.cost, 1); assert.equal(card.manaCost, 0);
    assert.deepEqual(card.effects, [{ op: 'draw', amount: 2 }]);
    assert.deepEqual(cardClassification(card), { cardCategory: 'skill', stanceType: 'prepare', stanceGroups: [] });
    assert.equal(combatCardType(card), 'Skill', 'the visible card kind remains distinct from its stance');
    assert.equal(playingCardModel(registries, { cardId: card.id }).type.label, 'SKILL');
    assert.equal(stanceOf(card).maneuver, 'casting');
    assert.equal(configuredStance(card), 'prepared');
    assert.equal(stanceForCard(card), 'casting');
    for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) assert.equal(cardActionFor(card, classId), 'spell');
  });
  test(`${profileId}: martial Defend and Counter stay stance cards while Spell, Skill and Power keep distinct kinds`, () => {
    const { registries } = world(profileId);
    for (const [id, expected] of [[profileId === 'core' ? 'core.defend' : 'defend', 'defense'], [profileId === 'core' ? 'core.counter' : 'guardCounter', 'counter']]) {
      assert.equal(cardClassification(resolveCard(registries, { cardId: id })).stanceType, expected);
    }
    for (const card of registries.cards.all()) {
      const classification = cardClassification(card);
      if (['spell', 'skill', 'power'].includes(classification.cardCategory)) {
        assert.equal(classification.stanceType, 'prepare', card.id);
        assert.equal(stanceForCard(card), 'casting', card.id);
        assert.equal(cardActionFor(card, 'rogue'), 'spell', card.id);
      }
    }
  });
}
test('spell Counter and defensive payloads remain authored while their public stance is Prepare', () => {
  const { registries } = world('current');
  for (const id of ['barrageCounter', 'frostCounter', 'crystalBarrier']) {
    const card = resolveCard(registries, { cardId: id }), before = structuredClone(card);
    assert.equal(cardClassification(card).cardCategory, 'spell');
    assert.equal(stanceOf(card).maneuver, 'casting');
    assert.equal(stanceForCard(card), 'casting');
    assert.equal(cardActionFor(card, 'starseer'), 'spell');
    assert.deepEqual(card, before, 'presentation/stance resolution does not rewrite counter or guard effects');
  }
});
test('each core character starts with exactly two Defends, one Counter and Draw in a ten-card deck', () => {
  const { registries, profile } = world('core');
  for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
    const run = createRunState({ seed: 1, classId, registries, profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['one', 'two', 'three'] } } } });
    assert.equal(run.deck.length, 10);
    assert.equal(run.deck.filter(card => card.cardId === 'core.defend').length, 2);
    assert.equal(run.deck.filter(card => card.cardId === 'core.counter').length, 1);
    assert.equal(run.deck.filter(card => card.cardId === 'base.draw').length, 1);
  }
});
test('untyped spell-camp moves retain their role and resolved tag objects support Prepare', () => {
  assert.equal(cardPreparationCategory({ id: 'enemy-support', camp: 'spell', maneuver: 'casting' }), null);
  assert.equal(cardPreparationCategory({ camp: 'spell', maneuver: 'counter' }), null);
  const card = { type: 'skill', tags: [{ id: 'camp:physical' }, { id: 'maneuver:casting' }] };
  assert.equal(cardPreparationCategory(card), 'skill');
  assert.equal(stanceOf(card).maneuver, 'casting');
  assert.equal(configuredStance(card), 'prepared');
  assert.equal(stanceOf({ camp: 'physical', maneuver: 'casting' }).maneuver, 'casting');
});
test('playing the configured Draw Skill actually enters Prepare and draws two cards', () => {
  const { registries, profile } = world('core');
  const deck = Array.from({ length: 10 }, (_, i) => ({ cardId: 'core.strike', instanceId: `draw-skill-${i}` }));
  const combat = createCombat({ registries, gameProfile: profile, rng: createRng(31), enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', hp: 100, maxHp: 100, stamina: 10, maxStamina: 10, mana: 5, maxMana: 5,
      energyMax: 10, drawPerTurn: 5, attributes: { intelligence: 1 }, deck } });
  combat.piles.hand = [{ cardId: 'base.draw', instanceId: 'draw-selected' }];
  combat.piles.draw = deck.slice(0, 3);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'draw-selected' });
  assert.equal(combat.player.combatStance.maneuver, 'prepared');
  assert.equal(combat.piles.hand.length, 2);
  assert.ok(combat.eventLog.some(event => event.type === 'cardResolved' && event.cardInstanceId === 'draw-selected'));
});
