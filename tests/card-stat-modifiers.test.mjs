import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { createRegistries } from '../src/model/registries.js';
import { upcastCard } from '../src/model/upcasting.js';
import { CARD_STAT_MODIFIER_IDS, CardStatModifierTags } from '../src/ui/cardStatModifiers.js';

const registries = createRegistries(contentBundle);
const facts = (effects, active = registries) => CardStatModifierTags({ effects }, active);
const applyStatus = (status, stacks) => ({ op: 'applyStatus', status, stacks, target: 'self' });
const change = (attribute, amount) => ({ op: 'changeAttribute', attribute, amount, target: 'self' });
const link = card => ({ op: 'castLinkedSpell', card });

test('resolved card definitions supply legacy and direct attribute facts across camps', () => {
  const cases = {
    honedEdge: ['buff:strength'],
    aegisOfEmbers: ['buff:strength'],
    gildedOath: ['buff:strength', 'buff:dexterity'],
    acrobaticsRogue: ['buff:dexterity'],
    goreblood: ['debuff:poise'],
    emberCovenant: ['buff:poise'],
    'progression-nightstep': ['buff:intelligence'],
    'progression-nightglass-reading': ['buff:damage'],
    'progression-ashen-cleaver': ['debuff:damage'],
  };
  for (const [id, tags] of Object.entries(cases)) {
    const definition = registries.cards.get(id);
    assert.deepEqual(CardStatModifierTags(definition, registries), tags, id);
  }

  const attack = registries.cards.get('strike');
  assert.deepEqual(CardStatModifierTags(applyUpgradeSteps(attack, [
    { k: 'fx', fx: 'boost', stat: 'intelligence', n: 2, until: 'turn' },
  ]), registries), ['buff:intelligence']);
});

test('signed constant attribute formulas follow engine rounding and deduplicate', () => {
  const spell = Object.freeze({
    type: 'skill', cardTags: Object.freeze(['camp:spell']),
    effects: Object.freeze([
      change('strength', 1),
      change('strength', 2),
      change('dexterity', { f: 'mul', args: [-2, { f: 'add', args: [1, 2] }], min: -5 }),
      change('constitution', 0),
      change('intelligence', 0.9),
      change('wisdom', -0.9),
      change('dexterity', { f: 'energySpent' }),
      change('unrecognizedAttribute', 1),
    ].map(Object.freeze)),
  });
  assert.deepEqual(CardStatModifierTags(spell, registries), ['buff:strength', 'debuff:dexterity', 'debuff:wisdom']);
  assert.deepEqual(spell.cardTags, ['camp:spell']);
  assert.deepEqual(CARD_STAT_MODIFIER_IDS, [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom',
    'hp', 'mp', 'poise', 'damage', 'sp', 'handsize', 'gold', 'xp',
  ]);
});

test('capacity, future damage, and active status modifiers are distinct from resource changes', () => {
  assert.deepEqual(facts([
    { op: 'gainBarrier', amount: 1 },
    applyStatus('barrier', 2),
    { op: 'loseMaxHpPct', pct: { f: 'add', args: [10, 5] } },
    { op: 'grantCardCharge', damage: 3 },
    applyStatus('weak', 1),
    applyStatus('silenced', 1),
    applyStatus('goreblood', 1),
  ]), ['buff:poise', 'debuff:hp', 'buff:damage', 'debuff:damage', 'debuff:poise']);
  assert.deepEqual(facts([
    applyStatus('vulnerable', 1), applyStatus('staggered', 1), applyStatus('regen', 1),
    applyStatus('strength', 0), applyStatus('dexterity', -2), applyStatus('missingStatus', 2),
    { op: 'gainBarrier', amount: 0 }, { op: 'loseMaxHpPct', pct: 0 },
    { op: 'grantCardCharge', block: 3, manaDiscount: 1, damage: 0 },
    ...['heal', 'draw', 'loseHp', 'restoreMana', 'restoreStamina', 'gainEnergy', 'restorePoise',
      'gainPoise', 'poiseDamage', 'damage', 'addCinders'].map(op => ({ op, amount: 5 })),
  ]), []);
});

test('active status rules and registry membership control derived status facts', () => {
  const statuses = new Map([
    ['neutral', { modifiers: { damageDealtMult: 1, spellDamageDealtMult: 1 } }],
    ['deckBlessing', { modifiers: { attackDamageAdd: 3 } }],
    ['curse', { modifiers: { spellDamageDealtMult: 0.8 } }],
    ['strength', { modifiers: { attackDamageAdd: -1 } }],
  ]);
  const active = { statuses, combatStatusRules: { statuses: {
    gauge: { activeStatus: 'neutral', grants: { curse: 1, deckBlessing: 0 } },
  } } };
  assert.deepEqual(facts([
    applyStatus('deckBlessing'), { op: 'buildup', status: 'gauge', amount: 4 },
    applyStatus('strength'), applyStatus('dexterity'), { op: 'gainBarrier', amount: 2 },
  ], active), ['buff:damage', 'debuff:damage', 'debuff:strength']);
  assert.deepEqual(facts([{ op: 'buildup', status: 'weak', amount: 5 }]), ['debuff:damage']);
  assert.deepEqual(facts([{ op: 'buildup', status: 'weak', amount: 5, chance: 0 }]), []);
  assert.deepEqual(facts([{ op: 'buildup', status: 'weak', amount: 5, chance: 2 }]), []);
  assert.deepEqual(facts([applyStatus('goreblood', 0)]), ['debuff:poise']);
  assert.deepEqual(facts([applyStatus('weak')], {}), []);
  assert.deepEqual(facts([applyStatus('weak')], null), ['debuff:damage']);
});

test('only selected upcast and bounded linked payloads contribute facts', () => {
  const card = {
    id: 'root', effects: [link('missing'), link('cycle'), link('depth1')],
    upcast: { baseTier: 0, maximumTier: 1, unlockedTiers: [1],
      breakpoints: [{ ranks: 1, effects: [change('constitution', 2)] }] },
    counterPayload: { pretendEffect: change('dexterity', 2) },
  };
  const cards = new Map([
    ['root', { effects: [change('wisdom', 2)] }],
    ['cycle', { effects: [link('cycle'), link('root'), change('intelligence', 1)] }],
    ['depth8', { effects: [change('strength', 1), link('depth9')] }],
    ['depth9', { effects: [change('wisdom', 1)] }],
  ]);
  for (let depth = 1; depth < 8; depth++) cards.set(`depth${depth}`, { effects: [link(`depth${depth + 1}`)] });
  assert.deepEqual(CardStatModifierTags(card, { cards }), ['buff:intelligence', 'buff:strength']);
  assert.deepEqual(CardStatModifierTags(upcastCard(card, 1), { cards }), ['buff:intelligence', 'buff:strength', 'buff:constitution']);
});
