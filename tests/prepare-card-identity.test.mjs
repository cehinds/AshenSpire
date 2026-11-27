import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
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
for (const profileId of ['core']) {
  test(`${profileId}: the authored Draw definition reaches runtime and retains its Skill preparation identity`, () => {
    const { registries } = world(profileId), card = resolveCard(registries, { cardId: 'base.draw' });
    assert.equal(card.type, 'skill');
    const source = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/base-cards/cards.json', import.meta.url))).cards.find(row => row.definition.id === 'base.draw').definition;
    assert.equal(card.cost, source.cost); assert.equal(card.manaCost, source.manaCost);
    assert.deepEqual(card.effects, source.effects);
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
test('each Core character starts with its current authored recipe before equipment grants', () => {
  const { registries, profile } = world('core');
  const source = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/starterDeck.json', import.meta.url)));
  for (const [classId, recipe] of Object.entries(source.classDecks)) {
    const run = createRunState({ seed: 1, classId, registries, profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['one', 'two', 'three'] } } } });
    const ordinary = run.deck.filter(card => !card.grantedBy && !card.equipmentRole);
    assert.deepEqual(ordinary.map(card => card.cardId), recipe.flatMap(row => Array(row.copies).fill(row.card)), classId);
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
test('playing the configured Draw Skill enters Prepare and draws its authored number of cards', () => {
  const { registries, profile } = world('core');
  const deck = Array.from({ length: 10 }, (_, i) => ({ cardId: 'core.strike', instanceId: `draw-skill-${i}` }));
  const combat = createCombat({ registries, gameProfile: profile, rng: createRng(31), enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', hp: 100, maxHp: 100, stamina: 10, maxStamina: 10, mana: 5, maxMana: 5,
      energyMax: 10, drawPerTurn: 5, attributes: { intelligence: 1 }, deck } });
  combat.piles.hand = [{ cardId: 'base.draw', instanceId: 'draw-selected' }];
  const draw = resolveCard(registries, { cardId: 'base.draw' }).effects.filter(effect => effect.op === 'draw').reduce((sum, effect) => sum + effect.amount, 0);
  combat.piles.draw = Array.from({ length: draw + 1 }, (_, i) => ({ cardId: 'core.strike', instanceId: `available-${i}` }));
  combat.player.energy = combat.player.stamina = combat.player.maxStamina = 1000000;
  combat.player.mana = combat.player.maxMana = 1000000;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'draw-selected' });
  assert.equal(combat.player.combatStance.maneuver, 'prepared');
  assert.equal(combat.piles.hand.length, draw);
  assert.ok(combat.eventLog.some(event => event.type === 'cardResolved' && event.cardInstanceId === 'draw-selected'));
});
