// Action costs on player cards (owner decisions, 2026-10-12; SPEC §4.3a): a card's Stamina and Mana come from the cost
// formula on its damage, rank and combat tags, for everyone; a card at 2 SP or more scales its effect amounts; the
// opt-outs keep their authored cost. The formula itself is pinned in tests/action-costs-formula.test.mjs.
// Replaced rule: the stance table priced every card (attack 1, block 1, smash 2, counter 2, cast 2, sweep 2) and never
// touched Mana. The expectations below that read a stance price now read the formula's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatCardSummary } from '../src/model/playingCard.js';
import { applyActionCosts, cardCostBudget } from '../src/model/actionCosts.js';
import { TWO_COST_EFFECT_MULTIPLIER } from '../src/content/actionCosts.js';

const registries = createRegistries(contentBundle);
const cardOf = (cardId) => resolveCard(registries, { cardId });
const authoredOf = (cardId) => registries.cards.get(cardId);
const amountOf = (def, op, at = 0) => def.effects.filter((e) => e.op === op)[at]?.amount;

test('a plain attack and a plain block cost 1 SP and no Mana, whatever the authored cost said', () => {
  // The authored cost is not an input: Executioner (authored 2) is priced by its damage and tags.
  assert.equal(authoredOf('executioner').cost, 2, 'fixture: an authored 2-cost plain attack');
  assert.equal(cardOf('executioner').cost, cardCostBudget(authoredOf('executioner')).sp, 'the formula prices it');
  for (const id of ['strike', 'defend']) {
    assert.equal(cardOf(id).cost, 1, id);
    assert.equal(cardOf(id).manaCost || 0, 0, `${id} is physical: no Mana`);
  }
});

test('a smash and a sweep cost 2 SP or more and scale their numbers; a ranked spell pays Mana', () => {
  for (const id of ['bashingBlow', 'sweepingBlow', 'colossusSmash']) {
    const card = cardOf(id);
    assert.ok(card.cost >= 2, `${id} costs ${card.cost}`);
    assert.equal(card.manaCost || 0, 0, `${id} is physical`);
    // A smash scales its damage; a sweep's damage stays normal (owner, 2026-10-13).
    const sweep = (authoredOf(id).tags || []).includes('maneuver:sweep');
    assert.equal(amountOf(card, 'damage'), sweep ? amountOf(authoredOf(id), 'damage') : Math.round(amountOf(authoredOf(id), 'damage') * TWO_COST_EFFECT_MULTIPLIER), id);
  }
  assert.equal(cardOf('bashingBlow').cost, 2, 'a light smash costs 2');
  const cantrip = cardOf('blightTouch');
  assert.deepEqual([cantrip.cost, cantrip.manaCost || 0], [1, 0], 'a cantrip costs 1 Stamina and no Mana');
  const ranked = resolveCard(registries, { cardId: 'cometFragment', abilityRank: 2 });
  assert.ok(ranked.manaCost >= 1 && ranked.cost >= 1, 'a rank-2 spell pays Mana, and its casting effort Stamina');
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

test('the opt-outs keep their authored cost and their numbers: costRule fixed, curses, statuses, X', () => {
  assert.equal(cardOf('warriorsVow').cost, 0, 'an explicit 0-cost opt-out');
  assert.equal(cardOf('guilt').cost, 0, 'a curse');
  assert.equal(cardOf('stitchedArms').cost, 'X', 'an X cost is variable');
  // Replaced rule: the dodge and unclassified powers kept their authored cost. The formula prices them now.
  for (const id of ['dodgeRoll', 'rallyingStandard', 'sanguinePactCard']) {
    const priced = cardCostBudget(authoredOf(id));
    assert.equal(cardOf(id).cost, priced.sp, `${id} is priced by the formula`);
    assert.equal(cardOf(id).manaCost || 0, priced.mp, `${id} is priced by the formula`);
  }
});

test('every 0-cost card is an explicit costRule opt-out in content, and no other card carries one', () => {
  const all = registries.cards.all();
  const zeros = all.filter((c) => c.cost === 0 && c.type !== 'curse' && c.type !== 'status');
  const optedOut = all.filter((c) => c.costRule === 'fixed');
  for (const c of zeros) assert.equal(c.costRule, 'fixed', `${c.id} costs 0 and must opt out explicitly`);
  for (const c of optedOut) assert.ok(c.cost === 0 || c.type === 'curse' || c.type === 'status', `${c.id} opts out without a fixed cost`);
});

test('the formula prices the face it is given: an upgrade is priced on its own effects, and Mana is derived', () => {
  // Replaced rule: the stance price plus the authored upgrade delta, with Mana untouched.
  const base = { id: 'x', type: 'attack', cost: 1, manaCost: 3, effects: [{ op: 'damage', target: 'enemy', amount: 10 }], tags: ['maneuver:smash', 'camp:physical', 'delivery:melee', 'blade'] };
  const upgraded = { ...base, cost: 5, effects: [{ op: 'damage', target: 'enemy', amount: 12 }] };
  assert.equal(applyActionCosts(upgraded, base).cost, cardCostBudget(upgraded).sp, 'the authored cost is not an input');
  assert.equal(applyActionCosts(upgraded, base).manaCost, 0, 'a physical face pays no Mana, whatever was authored');
  assert.equal(applyActionCosts({ ...base, costRule: 'fixed' }, base).cost, 1, 'the opt-out keeps its authored cost');
  assert.equal(applyActionCosts({ ...base, costRule: 'fixed' }, base).manaCost, 3, 'and its authored Mana');
});

test('costRule is the only opt-out value content may write', () => {
  for (const card of registries.cards.all()) if (card.costRule !== undefined) assert.equal(card.costRule, 'fixed', `${card.id} carries an unknown costRule`);
});

test('the derived step is one function, so every surface reads the same cost (the framework cost profile too)', () => {
  const def = cardOf('colossusSmash');
  assert.equal(registries.framework.costProfile(def).action, def.cost);
  assert.equal(registries.framework.costProfile(cardOf('strike')).action, 1);
});
