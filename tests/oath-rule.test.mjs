// Oath (design elements-and-tag-mechanics §4.1, owner decision 11: PER FIGHT):
// every class card carries the `oathKept` property rule. Playing an Oath card
// grants 2 Block (balance.tagMechanics.oath.block) while its owner has not
// entered a stance earlier this fight; entering one sets the fight-long
// `stanceShifted` marker. The entering card itself still counts as kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';

const base = createRegistries(contentBundle);
// A bare Oath skill: no printed effect, so any Block it brings is the rule's.
const vow = { ...base.cards.get('defend'), id: 'vowFixture', name: 'Vow fixture', gradeProfiles: undefined, abilityRank: undefined,
  legacyFace: undefined, cost: 0, manaCost: 0, staminaCost: 0, effects: [], upgrade: {}, cardTags: ['kind.skill', 'oath'] };
const registries = { ...base, cards: { ...base.cards, get: id => id === 'vowFixture' ? vow : base.cards.get(id) } };
const deck = ['vowFixture', 'vowFixture', 'enterBulwark', 'vowFixture'].map((cardId, i) => ({ cardId, instanceId: `c${i}`, upgraded: false }));
const player = { classId: 'reaver', maxHp: 80, hp: 80, maxMana: 10, mana: 10, maxStamina: 20, stamina: 20, energyMax: 10,
  drawPerTurn: 4, relicIds: [], deck };

function solo() {
  const combat = createCombat({ registries, rng: createRng(3), enemyIds: ['wanderingSoldier'], player });
  combat.player.block = 0;
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 500; }
  return combat;
}
const play = (combat, id) => dispatch(combat, { type: 'playCard', cardInstanceId: id });

test('balance binds the Oath Block and every class card carries the rule', () => {
  assert.equal(base.balance.tagMechanics.oath.block, 2);
  for (const cls of base.classes.all()) assert.ok(cls.propertyTags.includes('oathKept'), cls.id);
});

test('an Oath card grants 2 Block until a stance is entered, then none for the rest of the fight', () => {
  const combat = solo();
  assert.ok(['c0', 'c1', 'c2', 'c3'].every(id => combat.piles.hand.some(card => card.instanceId === id)));
  previewCard(combat, 'c0');
  assert.equal(combat.player.block, 0, 'a preview grants nothing');
  play(combat, 'c0');
  assert.equal(combat.player.block, 2, 'kept Oath grants 2 Block');
  play(combat, 'c2');
  assert.equal(combat.player.block, 2 + 3 + 2, 'the entering card itself still counts as kept (3 on enter + 2)');
  assert.ok(combat.player.statuses.stanceShifted, 'entering a stance marks the fight');
  combat.player.stanceId = null; // leaving the stance does not restore the Oath
  const before = combat.player.block;
  play(combat, 'c1');
  assert.equal(combat.player.block, before, 'broken Oath grants nothing');
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.player.statuses.stanceShifted, 'the marker lasts the whole fight, not the turn');
});

test('co-op: one seat entering a stance does not break the other seat\'s Oath', () => {
  const C = createCoopCombat({ registries, rng: createRng(3), players: [{ ...player, id: 'a' }, { ...player, id: 'b' }], enemyIds: ['wanderingSoldier'] });
  for (const enemy of C.enemies) { enemy.hp = enemy.maxHp = 500; }
  const seat = id => C.players.get(id);
  seat('a').entity.block = 0; seat('b').entity.block = 0;
  playCard(C, 'a', 'c2');
  assert.ok(seat('a').entity.statuses.stanceShifted);
  assert.equal(seat('b').entity.statuses.stanceShifted, undefined);
  playCard(C, 'b', 'c0');
  assert.equal(seat('b').entity.block, 2);
  const before = seat('a').entity.block;
  playCard(C, 'a', 'c0');
  assert.equal(seat('a').entity.block, before + (seat('a').entity.stanceId === 'bulwark' ? 2 : 0), 'only the Bulwark skill Block, no Oath');
});
