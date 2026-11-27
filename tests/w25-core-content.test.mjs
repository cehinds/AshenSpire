// Current content follows its JSON. Reaction and protection regressions use
// explicit cards, rules and an enemy rather than named balance snapshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { dispatch } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { w25Fight } from './helpers/w25-rules-contract.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const cards = read('games/ashenspire/packs/core/cards.json');
const variants = read('games/ashenspire/packs/core/resourceVariants.json');
const author = read('games/ashenspire/game.json');

test('current card effects and base/upgrade prices follow JSON under every resource profile', () => {
  for (const include of [[], ['sp'], ['mp'], ['sp', 'mp']]) {
    const profile = resolveGameProfile({ ...author, modules: { ...author.modules, resources: { include } } });
    const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const key = include.join(',') || 'none';
    for (const source of cards) {
      const installed = profile.content.cards.find(row => row.id === source.id);
      for (const field of ['class', 'rarity', 'effects', 'upgrade']) assert.deepEqual(installed[field], source[field], source.id + '.' + field);
      assert.deepEqual(profile.content.resourceVariants[source.id], variants[source.id], source.id + ' variants');
      const chosen = { ...source, ...(variants[source.id]?.[key] || {}) };
      const base = projectGameCard(profile, source.id);
      assert.equal(base.cost, chosen.cost, source.id + ' authored SP');
      assert.equal(base.manaCost || 0, chosen.manaCost || 0, source.id + ' authored MP');
      for (const upgraded of [false, true]) {
        const ref = { cardId: source.id, upgraded };
        const expected = projectGameCard(profile, ref), actual = resolveCard(reg, ref);
        for (const field of ['effects', 'cost', 'manaCost', 'keywords']) assert.deepEqual(actual[field], expected[field], source.id + '/' + upgraded + '/' + field);
      }
    }
  }
});

test('current Ward routing and spell cost/flux rules reach runtime from JSON', () => {
  const source = read('content/source/fixCoreMechanics.json');
  for (const key of ['ward', 'spellCosts', 'elementFlux']) assert.deepEqual(fixCoreMechanics[key], source[key], key);
});

function held(combat, cardId) {
  const card = Object.values(combat.piles).flat().find(row => row.cardId === cardId);
  assert.ok(card, cardId);
  for (const pile of Object.values(combat.piles)) { const at = pile.indexOf(card); if (at >= 0) pile.splice(at, 1); }
  combat.piles.hand.push(card);
  return card;
}
function reactionFight() {
  const result = w25Fight();
  const card = held(result.combat, 'fixture.reaction');
  result.combat.piles.hand = [card];
  for (const enemy of result.combat.enemies) enemy.intentRevealed = false;
  return result;
}

test('a held affordable reaction is offered against an incoming attack at its explicit price', () => {
  const { combat } = reactionFight();
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  assert.ok(offer, 'the incoming attack opens a real reaction window');
  const option = offer.options.find(row => row.cardId === 'fixture.reaction');
  assert.ok(option);
  assert.equal(option.staminaCost, 1);
});

test('the reaction pays its quote and hits the attacker before the incoming hit lands', () => {
  const { combat, enemy } = reactionFight();
  const hp = enemy.hp;
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction, option = offer.options.find(row => row.cardId === 'fixture.reaction');
  const out = dispatch(combat, { type: 'chooseReaction', offerId: offer.id, optionId: option.id });
  const played = out.events.findIndex(event => event.type === 'cardPlayed');
  const incoming = out.events.findIndex(event => event.type === 'attackHit');
  assert.ok(played >= 0 && incoming > played, 'reaction resolves before the incoming contact');
  assert.ok(enemy.hp < hp);
  assert.equal(out.events[played].staminaSpent, option.staminaCost);
});

const poiseOf = combat => ({ ...combat.player.persistentPoise });
const enemyHit = combat => {
  combat.piles.hand.length = 0;
  combat.enemies[0].intentRevealed = false;
  dispatch(combat, { type: 'setReactions', enabled: false });
  const hp = combat.player.hp, out = dispatch(combat, { type: 'endTurn' });
  return { lost: hp - combat.player.hp, dealt: out.events.find(event => event.type === 'damageDealt' && event.targetId === 'player') };
};

test('explicit Barrier stacks raise current/max Poise while HP-buffer Ward leaves Poise unchanged', () => {
  const { combat: barrier } = w25Fight(), beforeB = poiseOf(barrier);
  applyStatus(barrier, barrier.player, 'barrier', 2, null);
  assert.equal(poiseOf(barrier).max, beforeB.max + 10);
  assert.equal(poiseOf(barrier).value, beforeB.value + 10);
  const { combat: ward } = w25Fight(), beforeW = poiseOf(ward), hp = ward.player.wardHp || 0;
  applyStatus(ward, ward.player, 'ward', 2, null);
  assert.deepEqual(poiseOf(ward), beforeW);
  assert.equal(ward.player.wardHp, hp + 10);
  assert.equal(ward.player.persistentWard?.max || 0, 0, 'the retired Ward pool remains off');
});

test('cards apply both protection operations through the real dispatch path', () => {
  for (const [id, expectedWard] of [['fixture.protection', 5], ['fixture.barrier', 0]]) {
    const { combat } = w25Fight(), before = poiseOf(combat), hp = combat.player.wardHp || 0;
    const card = held(combat, id);
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
    assert.equal(poiseOf(combat).max, before.max + 5);
    assert.equal(poiseOf(combat).value, before.value + 5);
    assert.equal((combat.player.wardHp || 0) - hp, expectedWard);
  }
});

test('Barrier Poise mitigates before HP and HP-buffer Ward absorbs before Poise and HP', () => {
  const { combat: barrier } = w25Fight();
  barrier.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  applyStatus(barrier, barrier.player, 'barrier', 3, null);
  const poise = poiseOf(barrier).value, blocked = enemyHit(barrier);
  assert.ok(blocked.dealt.poiseAbsorbed > 0);
  assert.equal(blocked.dealt.hpLoss, blocked.lost);
  assert.ok(blocked.dealt.damageReceipt.hits[0].poiseReduced <= poise);
  assert.ok(blocked.lost < blocked.dealt.damageReceipt.hits[0].incoming);
  const { combat: ward } = w25Fight();
  ward.player.ratings.poise = 20;
  ward.player.persistentPoise = { value: 20, max: 20 };
  ward.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  applyStatus(ward, ward.player, 'ward', 3, null);
  const beforeWard = { poise: poiseOf(ward), hp: ward.player.wardHp };
  const absorbed = enemyHit(ward);
  assert.ok(absorbed.dealt.wardAbsorbed > 0);
  assert.equal(absorbed.dealt.wardHpBuffer, true);
  assert.equal(absorbed.lost, absorbed.dealt.hpLoss);
  const wardHit = absorbed.dealt.damageReceipt.hits[0];
  assert.ok(beforeWard.hp >= wardHit.incoming, 'the explicit Ward buffer covers this whole contact');
  assert.equal(wardHit.wardReduced, wardHit.incoming, 'Ward absorbs the full incoming amount before Poise');
  assert.equal(wardHit.poiseReduced, 0, 'the available mitigating Poise is not spent ahead of Ward');
  assert.equal(wardHit.hpLoss, 0);
  assert.equal(ward.player.wardHp, beforeWard.hp - wardHit.incoming);
  assert.deepEqual(poiseOf(ward), beforeWard.poise, 'Ward-first routing preserves the available Poise vessel');
});

test('a retained fight without Ward Poise rules grants no Ward Poise while Barrier still works', () => {
  const { combat } = w25Fight();
  combat.fixCoreRules.ward = { enabled: false };
  const before = poiseOf(combat);
  applyStatus(combat, combat.player, 'ward', 2, null);
  assert.deepEqual(poiseOf(combat), before);
  applyStatus(combat, combat.player, 'barrier', 1, null);
  assert.equal(poiseOf(combat).max, before.max + 5);
});


test('an outgoing spell meets the target Poise before Health', () => {
  const { combat, enemy } = w25Fight();
  enemy.hp = enemy.maxHp = 500;
  enemy.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  enemy.ratings.poise = 20;
  enemy.persistentPoise = { value: 20, max: 20 };
  const card = held(combat, 'fixture.fire');
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  const dealt = out.events.find(event => event.type === 'damageDealt'), hit = dealt.damageReceipt.hits[0];
  assert.equal(hit.sources.find(row => row.id === 'base').amount, 8);
  assert.ok(dealt.poiseAbsorbed > 0);
  assert.equal(hit.hpLoss, hit.incoming - hit.poiseReduced);
  assert.equal(500 - enemy.hp, dealt.hpLoss);
});
