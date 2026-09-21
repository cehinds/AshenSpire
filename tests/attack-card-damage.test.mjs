import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigRows } from '../src/model/advancedConfig.js';
import { attackCardBaseDamage, attackCardDamageConfigProblems, cardIsMagical } from '../src/model/attackCardDamage.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { evaluate } from '../src/model/formulas.js';

const defaults = contentBundle.balance.damage.attackCards;

test('cost-derived damage matches the configured formula and counts a status type once', () => {
  const bloodySlash = {
    cost: 2,
    manaCost: 1,
    staminaCost: 1,
    effects: [
      { op: 'applyStatus', status: 'bleed', stacks: 1 },
      { op: 'applyStatus', status: 'bleed', stacks: 3 },
    ],
  };
  assert.equal(attackCardBaseDamage(bloodySlash, defaults), 4);
});

test('every status has a configurable non-negative multiplier', () => {
  assert.deepEqual(attackCardDamageConfigProblems(contentBundle), []);
  const rowKeys = new Set(advancedConfigRows(contentBundle).map((row) => row.key));
  for (const configName of ['attackCards', 'defenseCards', 'potencyCards', 'poiseCards', 'wardCards']) {
    assert.deepEqual(
      Object.keys(contentBundle.balance.damage[configName].statusMultipliers).sort(),
      contentBundle.statuses.map((status) => status.id).sort(),
    );
    for (const status of contentBundle.statuses) {
      assert(rowKeys.has(`gameConfig.balance.damage.${configName}.statusMultipliers.${status.id}`), `${configName}/${status.id}`);
    }
  }
  for (const [configName, config] of Object.entries(contentBundle.balance.damage)) {
    for (const cardId of Object.keys(config.cardBonuses)) {
      assert(rowKeys.has(`gameConfig.balance.damage.${configName}.cardBonuses.${cardId}`), `${configName}/${cardId}`);
    }
  }
});

test('registry projection recalculates every fixed-cost attack and both card faces', () => {
  const registries = createRegistries(contentBundle);
  for (const authored of contentBundle.cards.filter((card) => card.type === 'attack' && card.cost !== 'X')) {
    for (const upgraded of [false, true]) {
      if (upgraded && !authored.upgrade) continue;
      const face = resolveCard(registries, { cardId: authored.id, upgraded });
      const config = cardIsMagical(face)
        ? registries.balance.damage.potencyCards
        : registries.balance.damage.attackCards;
      const expected = attackCardBaseDamage(face, config);
      const primary = face.effects.find((effect) => effect.op === 'damage' && !effect.if);
      const conditional = face.effects.filter((effect) => effect.op === 'damage' && typeof effect.amount === 'number');
      const baseAmounts = authored.effects
        .filter((effect) => effect.op === 'damage' && typeof effect.amount === 'number');
      const authoredBase = baseAmounts.find((effect) => !effect.if)?.amount
        ?? (baseAmounts.length ? Math.min(...baseAmounts.map((effect) => effect.amount)) : null);
      const authoredEffects = upgraded ? authored.upgrade.effects ?? authored.effects : authored.effects;
      const faceAmounts = authoredEffects
        .filter((effect) => effect.op === 'damage' && typeof effect.amount === 'number');
      const authoredFace = faceAmounts.find((effect) => !effect.if)?.amount
        ?? (faceAmounts.length ? Math.min(...faceAmounts.map((effect) => effect.amount)) : null);
      const expectedWithAuthoredDelta = expected
        + (authoredBase !== null && authoredFace !== null ? authoredFace - authoredBase : 0);
      assert(primary || conditional.length, `${authored.id}: projected base damage`);
      if (primary) assert.deepEqual(primary.amount, expectedWithAuthoredDelta, `${authored.id}${upgraded ? '+' : ''}`);
      else assert.equal(Math.min(...conditional.map((effect) => effect.amount)), expectedWithAuthoredDelta, `${authored.id}${upgraded ? '+' : ''}`);
    }
  }
});

test('default formulas preserve authored numeric card values and upgrade-only effects', () => {
  const registries = createRegistries(contentBundle);
  const amounts = (effects, op) => (effects || [])
    .filter((effect) => effect.op === op && typeof effect.amount === 'number')
    .map((effect) => effect.amount);
  for (const authored of contentBundle.cards) {
    for (const upgraded of [false, true]) {
      if (upgraded && !authored.upgrade) continue;
      const projected = resolveCard(registries, { cardId: authored.id, upgraded });
      const authoredEffects = upgraded ? authored.upgrade.effects ?? authored.effects : authored.effects;
      for (const op of [
        ...(authored.type === 'attack' ? ['damage', 'poiseDamage'] : []),
        'block',
      ]) {
        const authoredAmounts = amounts(authoredEffects, op);
        if (authoredAmounts.length) {
          assert.deepEqual(amounts(projected.effects, op), authoredAmounts,
            `${authored.id}${upgraded ? '+' : ''}/${op}`);
        }
      }
    }
  }
});

test('advanced settings deterministically change costs and per-status reductions', () => {
  const configured = configuredContentBundle(contentBundle, {
    'gameConfig.balance.damage.attackCards.globalMultiplier': 2,
    'gameConfig.balance.damage.attackCards.actionCostMultiplier': 3,
    'gameConfig.balance.damage.attackCards.manaCostMultiplier': 4,
    'gameConfig.balance.damage.attackCards.staminaCostMultiplier': 5,
    'gameConfig.balance.damage.attackCards.statusEffectReductionMultiplier': 2,
    'gameConfig.balance.damage.attackCards.statusMultipliers.bleed': 3,
    'gameConfig.balance.damage.attackCards.cardBonuses.gorefireSlash': 7,
  });
  const registries = createRegistries(configured);
  const slash = registries.cards.get('gorefireSlash');
  assert.equal(slash.effects.find((effect) => effect.op === 'damage').amount, 25);
  assert.equal(createRegistries(configured).cards.get('gorefireSlash').effects[0].amount, 25);
});

test('X-cost attacks use one Action of value per repeated hit', () => {
  const registries = createRegistries(contentBundle);
  const supernova = registries.cards.get('supernova');
  const damage = supernova.effects.find((effect) => effect.op === 'damage');
  assert.deepEqual(damage.hits, { f: 'energySpent' });
  assert.equal(evaluate(damage.hits, { energySpent: 3 }), 3);
  assert.equal(damage.amount, attackCardBaseDamage(supernova, registries.balance.damage.potencyCards));
});

test('DR and PR calculate physical and magical Block from card costs', () => {
  const registries = createRegistries(contentBundle);
  const physical = registries.cards.get('defend');
  const magical = registries.cards.get('crystalBarrier');
  assert.equal(
    physical.effects.find((effect) => effect.op === 'block').amount,
    attackCardBaseDamage(physical, registries.balance.damage.defenseCards),
  );
  assert.equal(
    magical.effects.find((effect) => effect.op === 'block').amount,
    attackCardBaseDamage(magical, registries.balance.damage.potencyCards),
  );
  assert(cardIsMagical(registries.cards.get('vesperWard')));
  assert('vesperWard' in registries.balance.damage.potencyCards.cardBonuses);
  assert(!('vesperWard' in registries.balance.damage.defenseCards.cardBonuses));
});

test('Poise and Ward card values drive physical and magical impact', async () => {
  const { attackImpact } = await import('../src/model/combatRatings.js');
  const registries = createRegistries(contentBundle);
  const ctx = { registries, ratingsRules: { attackImpact: {}, impact: {} } };
  const physical = registries.cards.get('strike');
  const magical = registries.cards.get('supernova');
  assert.equal(
    attackImpact(ctx, null, { cardId: physical.id, upgraded: false }),
    physical.cardRatingValues.poise,
  );
  assert.equal(
    attackImpact(ctx, null, { cardId: magical.id, upgraded: false, energySpent: 3 }),
    evaluate(magical.cardRatingValues.ward, { energySpent: 3 }),
  );
});
