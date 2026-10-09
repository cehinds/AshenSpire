import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { constantFormulaValue, describeFormula, evaluate } from '../src/model/formulas.js';
import { staticCardTokens, combatCardSummary, playingCardModel } from '../src/model/playingCard.js';
import { renderCard } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const reg = createRegistries(contentBundle);

test('constant authored formulas retain fractions until the canonical outer floor', () => {
  const cases = [
    [{ f: 'add', args: [0.6, 0.6] }, 1],
    [{ f: 'mul', args: [{ f: 'add', args: [0.6, 0.6] }, 2] }, 2],
    [{ f: 'mul', args: [{ f: 'add', args: [0.6, 0.6], max: 0.8 }, 2] }, 1],
    [{ f: 'add', args: [-3, 1], min: 0 }, 0],
  ];
  for (const [formula, expected] of cases) {
    const before = JSON.stringify(formula);
    assert.equal(constantFormulaValue(formula), expected);
    assert.equal(constantFormulaValue(formula), evaluate(formula));
    assert.equal(JSON.stringify(formula), before);
  }
});

test('context defaults and malformed formulas never become guessed static values', () => {
  for (const formula of [
    { f: 'energySpent' }, { f: 'cardsPlayedThisTurn' },
    { f: 'percentMaxHp', of: 'self', pct: 15 },
    { f: 'mul', args: [{ f: 'percentMaxHp', of: 'self', pct: 15 }, 2] },
    { f: 'add', args: [1, NaN] }, { f: 'mul', args: [Number.MAX_VALUE, 2] },
    { f: 'add', args: [1], unknown: true }, { f: 'add', args: '1' },
    { f: 'random', min: 1, max: 3 },
  ]) {
    assert.equal(constantFormulaValue(formula), undefined);
    assert.equal(describeFormula(formula), undefined);
  }
});

test('stack descriptions distinguish whole-group counting from the amount cap', () => {
  const formula = { f: 'stacks', status: 'crimsonBlight', of: 'allEnemies', per: 2, max: 5 };
  assert.equal(describeFormula(formula), '1 per 2 Crimson Blight stacks across all enemies (whole groups) (maximum 5)');
  const context = n => ({ entities: { allEnemies: [{ statuses: { crimsonBlight: { stacks: n } } }] } });
  assert.equal(evaluate(formula, context(7)), 3);
  assert.equal(evaluate(formula, context(20)), 5);
  assert.equal(constantFormulaValue(formula), undefined);
  for (const invalid of [{ ...formula, per: 0 }, { ...formula, of: 'unknown' },
    { ...formula, max: Infinity }, { ...formula, unknown: true }]) {
    assert.equal(describeFormula(invalid), undefined);
  }
});

test('all authored card variants resolve their supported formula placeholders without combat', () => {
  const refs = contentBundle.cards.flatMap(c => [{ cardId: c.id }, { cardId: c.id, upgraded: true },
    ...(c.gradeProfiles || []).map((_, abilityRank) => ({ cardId: c.id, abilityRank }))]);
  for (const p of reg.equipment.basicCardProfiles || []) {
    refs.push({ cardId: p.role === 'defend' ? 'defend' : 'strike', profileId: p.id });
  }
  assert.ok(refs.length > 1000);
  for (const ref of refs) {
    const def = resolveCard(reg, ref), tokens = staticCardTokens(def);
    const text = def.textTemplate.replace(/\{([\w.]+)\}/g, (original, token) => tokens[token] ?? original);
    assert.doesNotMatch(text, /\{[\w.]+\}/, JSON.stringify(ref));
  }
  assert.equal(staticCardTokens(resolveCard(reg, { cardId: 'cometFragment', abilityRank: 2 })).starstoneCharge, 1);
});

test('summary quantities prefer explicit tokens, then matching live values, then authored values', () => {
  const def = { ...reg.cards.get('defend'), effects: [{ op: 'block', target: 'self', amount: { f: 'add', args: [1] } }] };
  assert.equal(combatCardSummary(def), 'Gain 1 Block.');
  assert.equal(combatCardSummary(def, { values: [{ op: 'block', value: 7 }] }), 'Gain 7 Block.');
  assert.equal(combatCardSummary(def, { tokens: { block: 9 }, values: [{ op: 'block', value: 7 }] }), 'Gain 9 Block.');
  assert.equal(combatCardSummary(def, { tokens: { block: 0 }, values: [{ op: 'block', value: 7 }] }), 'Gain 0 Block.');
  assert.equal(combatCardSummary(def, { values: [{ op: 'block', value: 0 }] }), 'Gain 0 Block.');
  assert.equal(combatCardSummary(def, { values: [{ op: 'heal', value: 7 }] }), 'Gain 1 Block.');
});

function cardMarkup(registries, ref, options) {
  return withKitDom(dom => {
    const prototype = Object.getPrototypeOf(dom.document.body);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML'), markup = new WeakMap();
    Object.defineProperty(prototype, 'innerHTML', { ...descriptor,
      set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
    try { return markup.get(renderCard(registries, ref, { inspection: false, ...options })); }
    finally { Object.defineProperty(prototype, 'innerHTML', descriptor); }
  });
}

test('symbolic authored quantities are escaped and live numeric tokens replace them', () => {
  const def = { ...reg.cards.get('defend'), id: 'formulaProjectionFixture',
    textTemplate: 'Heal {heal} HP.', effects: [{ op: 'heal', target: 'self',
      amount: { f: 'stacks', status: 'x</span><img src=x onerror=bad>', of: 'allEnemies', per: 2, max: 5 } }] };
  const custom = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, def] });
  const ref = { cardId: def.id }, authored = cardMarkup(custom, ref);
  assert.match(authored, /&lt;\/span&gt;&lt;img src=x onerror=bad&gt;/);
  assert.doesNotMatch(authored, /<img src=x onerror=bad>/);
  assert.doesNotMatch(authored, /class="val (?:up|down)"/);
  const preview = { tokens: { heal: 3 }, values: [{ op: 'heal', value: 3 }], cost: 1, manaCost: 0 };
  assert.equal(playingCardModel(custom, ref, { preview }).tokens.heal, 3);
  assert.match(cardMarkup(custom, ref, { preview }), /class="val">3<\/span>/);
});
