// Authored drawbacks and upgrades follow JSON. Mechanics use deliberate small cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cards, allyIds, registries, profile, fresh, fight, withScoring } from './helpers/drawback-contract.mjs';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { applyUpgradeSteps, upgradedDefinition } from '../src/model/cardUpgrade.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { NonlethalHpRefusal } from '../src/model/cardHpCost.js';
import { affordableCards } from '../tools/simbot.mjs';
import { gameProfileRewardPools } from '../src/model/gameProfileRewards.js';
import { playingCardDefinition, playingCardModel } from '../src/model/playingCard.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { cardUpgradeChanges } from '../src/ui/models/CardUpgradeModel.js';

const contractTest = (name, body) => test(name, () => withScoring(body));
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const ref = (id, cardId, steps) => ({ instanceId: id, cardId, upgraded: !!steps, ...(steps ? { upgradeSteps: steps } : {}) });
const locations = (combat, id) => Object.entries(combat.piles).filter(([, pile]) => pile.some(card => card.instanceId === id)).map(([name]) => name);

// These current fields are authoring choices: neither every Evade nor every
// high-damage card needs a particular penalty, and upgrades need not remove one.
test('current authored costs, drawbacks and upgrade definitions reach the profile unchanged and validate', () => {
  const current = resolveGameProfile('core');
  const currentReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, current)), current);
  const source = [...read('games/ashenspire/packs/core/cards.json'),
    ...read('games/ashenspire/packs/base-cards/cards.json').cards.map(row => row.definition)];
  for (const card of source) {
    const actual = current.content.cards.find(row => row.id === card.id) || currentReg.cards.get(card.id);
    assert.ok(actual, card.id);
    for (const key of ['cost', 'staminaCost', 'manaCost', 'keywords', 'costGrowth', 'effects']) assert.deepEqual(actual[key], card[key], `${card.id}.${key}`);
    for (const [key, value] of Object.entries(card.upgrade || {})) assert.deepEqual(actual.upgrade?.[key], value, `${card.id}.upgrade.${key}`);
    assert.deepEqual(upgradedDefinition(actual).effects, card.upgrade?.effects || card.effects, `${card.id}: inherited upgrade effects`);
  }
  const validation = validateContent(applyGameProfileToContent(contentBundle, current));
  assert.deepEqual(validation.errors.filter(row => row.path.startsWith('cards.')), []);
});

contractTest('authored HP-cost upgrades can remove the cost without changing the damage payload', () => {
  assert.ok(cards.hp.effects.some(effect => effect.op === 'loseHp'));
  const after = upgradedDefinition(cards.hp);
  assert.ok(!after.effects.some(effect => effect.op === 'loseHp'));
  assert.deepEqual(after.effects, cards.hp.effects.filter(effect => effect.op !== 'loseHp'));
});

contractTest('an Ethereal fixture offers applicable upgrades and removal steps change only their fields', () => {
  const run = { seed: 3, gameProfile: profile, rangePolicy: {}, level: { level: 3 } };
  const offered = nextUpgradeOptions(run, { instanceId: 'ethereal', cardId: cards.ethereal.id, rank: 2 }, cards.ethereal, registries, 40, { noAuthored: true, everyFamily: true });
  const first = step => step.k === 'combo' ? step.steps[0] : step;
  assert.ok(offered.some(step => first(step).k === 'blk'), 'Block can improve with sufficient controlled budget');
  assert.ok(offered.some(step => first(step).fx === 'unethereal'));
  const kept = applyUpgradeSteps(cards.ethereal, [{ k: 'fx', fx: 'unethereal' }]);
  assert.ok(!kept.keywords.includes('ethereal'));
  assert.deepEqual(kept.effects, cards.ethereal.effects);
  assert.ok(applyUpgradeSteps(cards.ethereal, [{ k: 'fx', fx: 'reaction' }]).tags.includes('trait:reaction'));
});

contractTest('explicit reward exclusions keep ally cards out while an ordinary card remains eligible', () => {
  const run = fresh();
  run.gameProfile.content.cards = [cards.plain, ...Object.values(cards).filter(card => allyIds.includes(card.id))];
  run.gameProfile.content.rewards = { offerCount: 1, takeCount: 1, categories: ['combatCards'], eligibility: {
    playableOnly: false, excludeCardIds: allyIds, weapons: { groups: [] }, armor: { groups: [] }, weaponArts: { cardIds: [] },
    combatCards: { skipOwned: false, minRank: 0, rankOfRarity: { common: 0 }, stanceCoverage: { enabled: false, reservedSlots: 0 } },
  } };
  const pool = gameProfileRewardPools(registries, run).combatCards;
  assert.ok(pool.includes(cards.plain.id));
  assert.ok(allyIds.every(id => !pool.includes(id)));
  assert.ok(allyIds.every(id => registries.cards.has(id)), 'definitions remain available for older decks');
});

contractTest('older ally cards never affect the acting player through ally targets, while self effects still resolve', () => {
  const outcomes = {};
  for (const cardId of allyIds) {
    const combat = fight([ref('old-ally', cardId)]);
    combat.player.mana = 10;
    const before = { hp: combat.player.hp, mana: combat.player.mana };
    assert.doesNotThrow(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'old-ally' }), cardId);
    assert.equal(locations(combat, 'old-ally').includes('hand'), false);
    outcomes[cardId] = { hp: before.hp - combat.player.hp, mana: combat.player.mana - before.mana,
      block: combat.player.block, strength: combat.player.statuses.strength?.stacks || 0 };
  }
  assert.deepEqual(outcomes[cards.allyBuff.id], { hp: 0, mana: 0, block: 0, strength: 0 });
  assert.deepEqual(outcomes[cards.allyGuard.id], { hp: 0, mana: 0, block: 0, strength: 0 });
  assert.equal(outcomes[cards.allyDrain.id].hp, 0, 'the actor never pays an ally HP cost');
  assert.equal(outcomes[cards.allyDrain.id].mana, 2, 'the own restore still resolves');
  assert.equal(outcomes[cards.allySelf.id].strength, 1, 'only the explicit self buff reaches the actor');
});

const lowHp = hp => { const combat = fight([ref('paid', cards.hp.id)]); combat.player.hp = hp; return combat; };
contractTest('lethal HP costs are refused atomically by model and engine, while a funded play pays exactly once', () => {
  const combat = lowHp(2);
  assert.match(NonlethalHpRefusal(cards.hp, combat.player), /Not enough HP: it costs 2 HP/);
  const before = JSON.stringify(serializeCombatSnapshot(combat));
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'paid', targetId: combat.enemies[0].id }), /Not enough HP/);
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), before, 'hand, resources, HP, enemies, RNG and queue stay unchanged');
  const enough = lowHp(3), enemyHp = enough.enemies[0].hp;
  assert.equal(NonlethalHpRefusal(cards.hp, enough.player), '');
  const preview = previewCard(enough, 'paid', enough.enemies[0].id);
  const display = playingCardModel(registries, ref('paid', cards.hp.id), { preview });
  assert.equal(display.costs.stamina, preview.staminaCost);
  assert.equal(display.costs.mana, preview.manaCost);
  dispatch(enough, { type: 'playCard', cardInstanceId: 'paid', targetId: enough.enemies[0].id });
  assert.equal(enough.player.hp, 1);
  assert.ok(enough.enemies[0].hp < enemyHp);
  const paid = enough.eventLog.find(event => event.type === 'cardPlayed' && event.cardInstanceId === 'paid');
  assert.deepEqual([paid.staminaSpent, paid.manaSpent], [preview.staminaCost, preview.manaCost]);
});

contractTest('the simbot refuses lethal HP costs before proposing a play', () => {
  assert.deepEqual(affordableCards(registries, lowHp(2)).map(card => card.cardId), []);
  assert.deepEqual(affordableCards(registries, lowHp(10)).map(card => card.cardId), [cards.hp.id]);
});

contractTest('drawback-removal steps update rules text, rendered faces and picker change labels', () => {
  // The authored-template renderer is used by the preserved base-card face path.
  const rules = { gameProfile: profile };
  const cases = [[cards.ethereal, 'unethereal', /Ethereal/, 'keywords'], [cards.hold, 'steady', /Stamina each play/, 'COST'],
    [cards.rising, 'steady', /Stamina each play/, 'COST'], [cards.exhaust, 'unexhaust', /Exhaust/, 'keywords']];
  for (const [base, fx, words, label] of cases) {
    const step = { k: 'fx', fx }, after = applyUpgradeSteps(base, [step]);
    const text = steps => cardPlainText(registries, ref('text', base.id, steps), { rules });
    assert.match(text(), words, `${base.id}: before`);
    assert.doesNotMatch(text([step]), words, `${base.id}: after`);
    assert.doesNotMatch(after.textTemplate || '', words);
    for (const line of after.faceTemplate || []) assert.doesNotMatch(line, words);
    const changes = cardUpgradeChanges(registries, base, after);
    assert.ok(changes.some(row => row.label.toLowerCase().includes(label.toLowerCase())), JSON.stringify(changes));
  }
});

contractTest('grade text keeps its drawback and the upgrade menu offers only changes the grade applies', () => {
  for (const abilityRank of [0, 3]) {
    const def = playingCardDefinition(registries, { cardId: cards.grade.id, abilityRank }, { rules: { combatExpansionVersion: 2, gameProfile: profile } });
    assert.match(def.textTemplate, /Exhaust[.]$/);
    const offered = nextUpgradeOptions({ seed: 3, level: { level: 5 }, gameProfile: profile, rangePolicy: {} },
      { instanceId: 'grade-offer', cardId: cards.grade.id, abilityRank }, cards.grade, registries, 40, { noAuthored: true, everyFamily: true });
    assert.deepEqual(offered.map(step => `${step.k}:${step.fx}`), ['fx:unexhaust']);
  }
  const combat = fight([{ ...ref('plain', cards.grade.id), abilityRank: 3 },
    { ...ref('eased', cards.grade.id, [{ k: 'fx', fx: 'unexhaust' }]), abilityRank: 3 }]);
  for (const cardInstanceId of ['plain', 'eased']) dispatch(combat, { type: 'playCard', cardInstanceId });
  assert.deepEqual(locations(combat, 'plain'), ['exhaust']);
  assert.equal(locations(combat, 'eased').length, 1);
  assert.ok(!locations(combat, 'eased').includes('exhaust'));
});

contractTest('controlled ally-card text renders its own solo-play explanation', () => {
  for (const cardId of allyIds) assert.match(cardPlainText(registries, ref('ally-text', cardId), { rules: { gameProfile: profile } }), /with no allies/i);
});
