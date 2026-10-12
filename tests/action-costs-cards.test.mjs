// Action costs on player cards (owner decision, 2026-10-12): a card's SP cost is derived from its stance by the
// table, for everyone; a 2-cost card scales its effect amounts; the opt-outs keep their authored cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatCardSummary } from '../src/model/playingCard.js';
import { applyActionCosts } from '../src/model/actionCosts.js';
import { TWO_COST_EFFECT_MULTIPLIER } from '../src/content/actionCosts.js';

const registries = createRegistries(contentBundle);
const cardOf = (cardId) => resolveCard(registries, { cardId });
const authoredOf = (cardId) => registries.cards.get(cardId);
const amountOf = (def, op, at = 0) => def.effects.filter((e) => e.op === op)[at]?.amount;

test('a plain attack and a plain block cost 1 SP, whatever the authored cost said', () => {
  assert.equal(authoredOf('executioner').cost, 2, 'fixture: an authored 2-cost plain attack');
  assert.equal(cardOf('executioner').cost, 1, 'the stance decides: a plain attack is 1 SP');
  assert.equal(cardOf('strike').cost, 1);
  assert.equal(cardOf('defend').cost, 1);
});

test('smash, sweep, counter and cast cards cost 2 SP, and their numbers scale by the multiplier', () => {
  const smash = cardOf('colossusSmash');
  assert.equal(smash.cost, 2);
  assert.equal(amountOf(smash, 'damage'), Math.round(amountOf(authoredOf('colossusSmash'), 'damage') * TWO_COST_EFFECT_MULTIPLIER));
  const counter = cardOf('guardCounter');
  assert.equal(counter.cost, 2);
  assert.equal(amountOf(counter, 'damage'), Math.round(amountOf(authoredOf('guardCounter'), 'damage') * TWO_COST_EFFECT_MULTIPLIER));
  const sweep = cardOf('sweepingBlow');
  assert.equal(sweep.cost, 2);
  assert.notEqual(amountOf(sweep, 'damage'), amountOf(authoredOf('sweepingBlow'), 'damage'));
  const spell = cardOf('blightTouch');
  assert.equal(spell.cost, 2, 'a spell is a cast');
});

test('a cost-1 card keeps its base values, the weaker option', () => {
  assert.equal(amountOf(cardOf('strike'), 'damage'), amountOf(authoredOf('strike'), 'damage'));
  assert.equal(amountOf(cardOf('defend'), 'block'), amountOf(authoredOf('defend'), 'block'));
  assert.equal(cardOf('defend').effects[0].amount, authoredOf('defend').effects[0].amount);
});

test('card text shows the scaled number, because the text reads the same resolved effects', () => {
  const def = cardOf('colossusSmash');
  const text = combatCardSummary(def, null, registries);
  assert.ok(text.includes(`Deal ${amountOf(def, 'damage')}`), `summary "${text}" carries the scaled damage`);
  assert.notEqual(amountOf(def, 'damage'), amountOf(authoredOf('colossusSmash'), 'damage'), 'fixture: the scaled number differs from the base');
  assert.ok(!text.includes(`Deal ${amountOf(authoredOf('colossusSmash'), 'damage')} damage`), 'the base number is not printed');
});

test('the opt-outs keep their authored cost and their numbers: 0-cost, curses, statuses, X, the dodge, unclassified', () => {
  assert.equal(cardOf('warriorsVow').cost, 0, 'an explicit 0-cost opt-out');
  assert.equal(cardOf('guilt').cost, 0, 'a curse');
  assert.equal(cardOf('stitchedArms').cost, 'X', 'an X cost is variable');
  assert.equal(cardOf('dodgeRoll').cost, authoredOf('dodgeRoll').cost, 'evade has no table price');
  assert.equal(cardOf('rallyingStandard').cost, 1, 'an unclassified power keeps its authored cost');
  assert.equal(cardOf('sanguinePactCard').cost, 2, 'an unclassified power keeps its authored cost');
  assert.equal(amountOf(cardOf('sanguinePactCard'), 'applyStatus'), amountOf(authoredOf('sanguinePactCard'), 'applyStatus'));
});

test('every 0-cost card is an explicit costRule opt-out in content, and no other card carries one', () => {
  const all = registries.cards.all();
  const zeros = all.filter((c) => c.cost === 0 && c.type !== 'curse' && c.type !== 'status');
  const optedOut = all.filter((c) => c.costRule === 'fixed');
  for (const c of zeros) assert.equal(c.costRule, 'fixed', `${c.id} costs 0 and must opt out explicitly`);
  for (const c of optedOut) assert.ok(c.cost === 0 || c.type === 'curse' || c.type === 'status', `${c.id} opts out without a fixed cost`);
});

test('a derived cost layers the authored upgrade delta under the stance, and mana is untouched', () => {
  const base = { id: 'x', type: 'attack', cost: 1, manaCost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 10 }], cardTags: ['maneuver:smash'] };
  const upgraded = { ...base, cost: 2, effects: [{ op: 'damage', target: 'enemy', amount: 12 }] };
  const out = applyActionCosts(upgraded, base);
  assert.equal(out.cost, 3, 'smash 2 plus the upgrade delta of 1');
  assert.equal(out.manaCost, 1, 'mana is never derived');
  const plainUpgrade = applyActionCosts({ ...base, cost: 0, effects: [{ op: 'damage', target: 'enemy', amount: 10 }] }, base);
  assert.equal(plainUpgrade.cost, 1, 'a delta below the stance floors at 0');
  assert.equal(applyActionCosts({ ...base, costRule: 'fixed' }, base).cost, 1, 'the opt-out ignores the stance');
});

test('costRule is the only opt-out value content may write', () => {
  for (const card of registries.cards.all()) if (card.costRule !== undefined) assert.equal(card.costRule, 'fixed', `${card.id} carries an unknown costRule`);
});

test('the derived step is one function, so every surface reads the same cost (the framework cost profile too)', () => {
  const def = cardOf('colossusSmash');
  assert.equal(registries.framework.costProfile(def).action, 2);
  assert.equal(registries.framework.costProfile(cardOf('strike')).action, 1);
});
