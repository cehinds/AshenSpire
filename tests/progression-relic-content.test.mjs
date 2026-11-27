import { botCardTargetId } from '../tools/simbot.mjs';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { matchupContent } from './helpers/matchup-contract.mjs';
import { relicTokens } from '../src/model/validate.js';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, relicPropertyRules } from '../src/model/registries.js';
import { progressionRelics, progressionRelicUnlocks } from '../src/content/progression/relics.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { getStacks } from '../src/engine/statuses.js';

const id = name => `progression-${name}`;
const hit = [{ op: 'damage', target: 'enemy', amount: 3 }];
// Each representative rule supplies only the predicates/effects used by its
// mechanics regression. None of these amounts comes from the live relic catalog.
const all = (...preds) => ({ p: 'all', preds: [{ p: 'eventSourceIsOwner' }, ...preds] });
const tag = tag => ({ p: 'cardTagIs', tag });
const metric = (metric, extra) => ({ p: 'turnMetric', metric, ...extra });
const trigger = (on, predicate, effect, limit = { limitPerTurn: 1 }) => ({ on, if: predicate, do: [effect], ...limit });
const block = amount => ({ op: 'block', target: 'owner', amount });
const once = { once: true };
const controlled = {
  'emberjaw-token': trigger('damageDealt', all(tag('blade'), { p: 'eventIsAttack' }), { op: 'applyStatus', status: 'bleed', stacks: 2 }, once),
  'cracked-war-anvil': trigger('cardPreparing', all(tag('heavy'), { p: 'cardTypeIs', type: 'attack' }),
    { op: 'grantCardCharge', target: 'owner', key: 'fixture-break', cardType: 'attack', break: 1 }),
  'cinderbound-crown': trigger('enemyDied', all({ p: 'enemyKilledWithStatus', status: 'bleed' }), { op: 'heal', target: 'owner', amount: 4 }, once),
  'moonwell-lens': trigger('cardPlayed', all(tag('starstone'), tag('source:spell'), metric('manaSpent', { atLeast: 2 })), block(2)),
  'nightglass-rosary': trigger('cardPlayed', all(tag('starstone'), metric('sameCardPlays', { atLeast: 1, atMost: 1, cardId: 'event' })),
    { op: 'restoreMana', target: 'owner', amount: 1 }),
  'fragment-of-the-third-sky': trigger('cardPlayed', all(tag('starstone'), metric('distinctTagPlays', { atLeast: 2, atMost: 2, tag: 'starstone' }),
    metric('sameCardPlays', { atLeast: 0, atMost: 0, cardId: 'event' })), block(5)),
  'whisperglass-die': trigger('cardPreparing', all(tag('blade'), { p: 'cardTypeIs', type: 'attack' }, metric('cardPlaysCombat', { atLeast: 0, atMost: 0 })),
    { op: 'grantCardCharge', target: 'owner', key: 'fixture-damage', cardType: 'attack', damage: 5 }, once),
  'purse-of-borrowed-shadows': trigger('cardDiscarded', all({ p: 'eventDiscardExplicit' }, metric('discarded', { atLeast: 1, snapshot: 'current' })), block(2)),
  'ember-alms-bowl': trigger('hpOfferingPaid', { p: 'eventSourceIsOwner' }, block(2)),
};

// Fixture cards pin their own Stamina and Mana: costRule 'fixed' opts them out of the cost formula (SPEC §4.3a).
function fixture(relic, cards = {}) {
  const base = createRegistries(matchupContent);
  const definitions = new Map(Object.entries(cards).map(([key, card]) => [key, {
    id: key, name: key, class: 'colorless', type: 'attack', rarity: 'common', costRule: 'fixed', cost: 1, manaCost: 0,
    gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, upgrade: {},
    abilityFamily: key, abilityKind: 'maneuver', cardTags: ['blade'],
    kindIds: ['classification.attack'], effects: hit, ...card,
  }]));
  definitions.set('defend', { id: 'defend', name: 'Fixture filler', class: 'colorless', type: 'skill', rarity: 'common',
    costRule: 'fixed', cost: 0, manaCost: 0, effects: [], kindIds: ['classification.skill'] });
  const relicDefinition = { id: id(relic), name: 'Fixture relic', rarity: 'common', passives: {}, propertyTags: [id(relic)] };
  const rule = { tag: id(relic), requires: [], excludes: [], triggers: [controlled[relic]] };
  assert.ok(controlled[relic], relic);
  const registries = { ...base,
    relics: { ...base.relics, get: key => key === id(relic) ? relicDefinition : base.relics.get(key) },
    propertyRules: { ...base.propertyRules, get: key => key === id(relic) ? rule : base.propertyRules.get(key) },
    cards: { ...base.cards, has: key => definitions.has(key) || base.cards.has(key), get: key => definitions.get(key) || base.cards.get(key) },
  };
  const player = { id: 'p1', classId: 'herald', maxHp: 100, hp: 50, maxMana: 30, mana: 20,
    maxStamina: 30, stamina: 30, energyMax: 30, drawPerTurn: 5, relicIds: [id(relic)],
    deck: Array.from({ length: 20 }, (_, n) => ({ instanceId: `f${n}`, cardId: 'defend', upgraded: false })) };
  const combat = createCombat({ registries, rng: createRng(9), player, enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  combat.enemies.forEach(enemy => { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; });
  return combat;
}
let sequence = 0;
function play(combat, cardId, target = combat.enemies[0]) {
  const instance = { instanceId: `play${sequence++}`, cardId, upgraded: false };
  combat.piles.hand.push(instance);
  dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: botCardTargetId(combat.registries, combat, instance, target?.id) });
  return instance;
}
const spell = { abilityKind: 'spell', cardTags: ['starstone', 'source:spell'], manaCost: 2, kindIds: ['classification.skill'], effects: [] };

test('current progression relic definitions, unlocks and trigger tokens follow authored JSON', () => {
  const read = name => JSON.parse(readFileSync(new URL('../content/source/' + name + '.json', import.meta.url), 'utf8'));
  assert.deepEqual(progressionRelics, read('progressionRelics'));
  assert.deepEqual(progressionRelicUnlocks, read('progressionRelicUnlocks'));
  const values = read('balanceProgressionRelics');
  const reg = createRegistries(contentBundle);
  for (const relic of progressionRelics) {
    const def = reg.relics.get(relic.id);
    const tokens = relicTokens(def, relicPropertyRules(reg, def), reg);
    for (const [key, value] of Object.entries(values[relic.id] || {})) assert.equal(tokens[key], value, relic.id + '.' + key);
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
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: botCardTargetId(combat.registries, combat, card, combat.enemies[0].id) });
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
