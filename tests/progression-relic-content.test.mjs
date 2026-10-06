import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, relicPropertyRules } from '../src/model/registries.js';
import { progressionRelics, progressionRelicUnlocks } from '../src/content/progression/relics.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { getStacks } from '../src/engine/statuses.js';

const id = name => `progression-${name}`;
const hit = [{ op: 'damage', target: 'enemy', amount: 3 }];
function fixture(relic, cards = {}, coop = false) {
  const base = createRegistries(contentBundle);
  const definitions = new Map(Object.entries(cards).map(([key, card]) => [key, {
    ...base.cards.get('defend'), id: key, name: key, cost: 1, manaCost: 0,
    gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, upgrade: {},
    abilityFamily: key, abilityKind: 'maneuver', cardTags: ['blade'],
    kindIds: ['classification.attack'], effects: hit, ...card,
  }]));
  const registries = { ...base, cards: { ...base.cards, get: key => definitions.get(key) || base.cards.get(key) } };
  const player = { id: 'p1', classId: 'herald', maxHp: 100, hp: 50, maxMana: 30, mana: 20,
    maxStamina: 30, stamina: 30, energyMax: 30, drawPerTurn: 5, relicIds: [id(relic)],
    deck: Array.from({ length: 20 }, (_, n) => ({ instanceId: `f${n}`, cardId: 'defend', upgraded: false })) };
  const combat = coop
    ? createCoopCombat({ registries, rng: createRng(9), players: [{ ...player, id: 'a' }, { ...player, id: 'b', relicIds: [] }], enemyIds: ['wanderingSoldier', 'wanderingSoldier'] })
    : createCombat({ registries, rng: createRng(9), player, enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  combat.enemies.forEach(enemy => { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; });
  return combat;
}
let sequence = 0;
function play(combat, cardId, target = combat.enemies[0]) {
  const instance = { instanceId: `play${sequence++}`, cardId, upgraded: false };
  const piles = combat.players ? combat.players.get('a').piles : combat.piles;
  piles.hand.push(instance);
  if (combat.players) playCard(combat, 'a', instance.instanceId, target?.id);
  else dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: target?.id });
  return instance;
}
const spell = { abilityKind: 'spell', cardTags: ['starstone', 'source:spell'], manaCost: 2, kindIds: ['classification.skill'], effects: [] };

test('all ten relics mount authored rules and class level gates', () => {
  const reg = createRegistries(contentBundle);
  assert.equal(progressionRelics.length, 10); assert.equal(progressionRelicUnlocks.length, 10);
  for (const relic of progressionRelics) {
    assert.equal(relicPropertyRules(reg, reg.relics.get(relic.id)).length, 1, relic.id);
    assert.ok(progressionRelicUnlocks.some(unlock => unlock.ref === relic.id));
  }
});

test('Emberjaw adds two Bleed to the first Blade hit only and retains its combat limit after reload', () => {
  let combat = fixture('emberjaw-token', { blade: { effects: [{ ...hit[0], hits: 2 }] } });
  play(combat, 'blade'); assert.equal(getStacks(combat.enemies[0], 'bleed'), 2);
  combat = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(9, combat.rng.getCounters()), snapshot: serializeCombatSnapshot(combat) });
  play(combat, 'blade'); assert.equal(getStacks(combat.enemies[0], 'bleed'), 2);
});

test('Cracked War Anvil spends its Break bonus on the first Heavy attack each turn', () => {
  const combat = fixture('cracked-war-anvil', { heavy: { cardTags: ['heavy'], effects: [{ ...hit[0], hits: 2 }] } });
  const before = combat.enemies[0].poiseMeter.value;
  play(combat, 'heavy'); const first = combat.enemies[0].poiseMeter.value;
  play(combat, 'heavy'); assert.equal(combat.enemies[0].poiseMeter.value, first);
  assert.equal(first - before, 1);
  dispatch(combat, { type: 'endTurn' });
  const next = combat.enemies[0].poiseMeter.value;
  play(combat, 'heavy'); assert.equal(combat.enemies[0].poiseMeter.value, next + 1);
});

test('Cinderbound Crown reads Bleed immediately before the credited fatal hit and heals once', () => {
  const combat = fixture('cinderbound-crown', { kill: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 1 }, { ...hit[0], amount: 2000 }] } });
  play(combat, 'kill'); assert.equal(combat.player.hp, 54);
  play(combat, 'kill', combat.enemies[1]); assert.equal(combat.player.hp, 54);
});

test('Moonwell Lens requires Mana spent before this Starstone spell and limits its Block to once per turn', () => {
  const combat = fixture('moonwell-lens', { star: spell });
  play(combat, 'star'); assert.equal(combat.player.block, 0);
  play(combat, 'star'); assert.equal(combat.player.block, 2);
  play(combat, 'star'); assert.equal(combat.player.block, 2);
});

test('Nightglass Rosary distinguishes repeated card ID from a different Starstone spell', () => {
  const combat = fixture('nightglass-rosary', { one: spell, two: spell });
  play(combat, 'one'); play(combat, 'two'); assert.equal(combat.player.mana, 16);
  play(combat, 'one'); assert.equal(combat.player.mana, 15);
  play(combat, 'two'); assert.equal(combat.player.mana, 13);
});

test('Third Sky counts distinct Starstone IDs and grants Block on the third only', () => {
  const combat = fixture('fragment-of-the-third-sky', { one: spell, two: spell, three: spell, four: spell });
  play(combat, 'one'); play(combat, 'one'); play(combat, 'two'); assert.equal(combat.player.block, 0);
  play(combat, 'three'); assert.equal(combat.player.block, 5);
  play(combat, 'four'); assert.equal(combat.player.block, 5);
});

test('Whisperglass preview and execution add five to only the first hit of the first combat card', () => {
  const combat = fixture('whisperglass-die', { blade: { effects: [{ ...hit[0], hits: 2 }] }, quiet: { effects: [], kindIds: ['classification.skill'], cardTags: [] } });
  const card = { instanceId: 'preview', cardId: 'blade', upgraded: false }; combat.piles.hand.push(card);
  const before = JSON.stringify(serializeCombatSnapshot(combat));
  const preview = previewCard(combat, card.instanceId, combat.enemies[0].id);
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), before);
  assert.ok(preview); const hp = combat.enemies[0].hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  assert.equal(hp - combat.enemies[0].hp, 11);
  play(combat, 'blade'); assert.equal(hp - combat.enemies[0].hp, 17);
  const other = fixture('whisperglass-die', { blade: {}, quiet: { effects: [], kindIds: ['classification.skill'], cardTags: [] } });
  play(other, 'quiet'); play(other, 'blade'); assert.equal(other.enemies[0].hp, 997);
});

test('Purse rewards an explicit chosen discard after restoration but excludes turn cleanup', () => {
  let combat = fixture('purse-of-borrowed-shadows', { choose: { kindIds: ['classification.skill'], effects: [{ op: 'draw', amount: 1 }, { op: 'discard', amount: 1, choose: true }] } });
  play(combat, 'choose'); assert.equal(combat.player.block, 0);
  combat = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(9, combat.rng.getCounters()), snapshot: serializeCombatSnapshot(combat) });
  dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: [combat.piles.hand[0].instanceId] });
  assert.equal(combat.player.block, 2);
  play(combat, 'choose'); dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: [combat.piles.hand[0].instanceId] });
  assert.equal(combat.player.block, 2);
  const other = fixture('purse-of-borrowed-shadows'); dispatch(other, { type: 'endTurn' });
  assert.equal(other.player.block, 0);
});

test('Ember Alms Bowl pays a nonlethal offering before granting Block and rejects lethal payment atomically', () => {
  const combat = fixture('ember-alms-bowl', { offer: { kindIds: ['classification.skill'], effects: [{ op: 'loseHp', target: 'self', amount: 3, nonlethal: true, offering: true }] } });
  play(combat, 'offer'); assert.equal(combat.player.hp, 47); assert.equal(combat.player.block, 2);
  play(combat, 'offer'); assert.equal(combat.player.hp, 44); assert.equal(combat.player.block, 2);
  combat.player.hp = 3;
  const instance = { instanceId: 'refuse', cardId: 'offer', upgraded: false }; combat.piles.hand.push(instance);
  const before = JSON.stringify(serializeCombatSnapshot(combat));
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId }), /nonlethal offering/);
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), before);
});

test('Ossuary Prayer Wheel restores the credited co-op owner Mana once using predeath Blight', () => {
  const combat = fixture('ossuary-prayer-wheel', { kill: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 1 }, { ...hit[0], amount: 2000 }] } }, true);
  const a = combat.players.get('a').entity; const b = combat.players.get('b').entity;
  const mana = a.mana; const otherMana = b.mana;
  play(combat, 'kill'); assert.equal(a.mana, mana + 1); assert.equal(b.mana, otherMana);
  play(combat, 'kill', combat.enemies[1]); assert.equal(a.mana, mana + 1);
});
