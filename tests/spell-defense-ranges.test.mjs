import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCombatExpansionCard, combatExpansionNewCards } from '../src/content/combatExpansionCards.js';
import { applyCardTraits } from '../src/content/traitProjection.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';

test('spell defense covers all incoming ranges without widening camps or targets or offensive range', () => {
  for (const raw of combatExpansionNewCards.filter(card => card.counterPayload)) {
    const def = applyCombatExpansionCard(raw);
    assert.equal(def.defenseRange, 'ranged', raw.id);
    assert.deepEqual(def.counterCoverage.ranges, ['melee', 'reach', 'ranged']);
    assert.deepEqual(def.counterCoverage.camps, raw.counterCoverage.camps);
    assert.deepEqual(def.counterCoverage.targeting, raw.counterCoverage.targeting);
    assert.equal(def.range, raw.range);
    assert.equal(combatProfileFor(def).defenseRange, 'ranged');
  }
  const physical = { id: 'physical-defense', type: 'skill', tags: ['camp:physical', 'maneuver:defend'],
    range: 'melee', effects: [{ op: 'block', target: 'self', amount: 5 }] };
  assert.equal(applyCombatExpansionCard(physical).defenseRange, undefined);
});

test('every Defend card at actual rank one or higher is a Reaction; counters and evades always qualify', () => {
  const base = { id: 'custom-defense', type: 'skill', tags: ['camp:spell', 'maneuver:defend'],
    effects: [{ op: 'gainBarrier', target: 'self', amount: 5 }] };
  for (const rank of [1, 2, 3, 4, 5]) {
    assert.equal(applyCardTraits({ ...base, rank }).traitValues.reaction, true);
    assert.equal(applyCardTraits({ ...base, gradeProfiles: [], abilityRank: rank }).traitValues.reaction, true);
  }
  assert.equal(applyCardTraits({ ...base, gradeProfiles: [], abilityRank: 0 }).traitValues?.reaction, undefined);
  assert.equal(applyCardTraits(base).traitValues.reaction, true, 'an unranked ordinary card resolves at rank one');
  assert.equal(applyCardTraits({ ...base, tags: ['camp:spell', 'maneuver:counter'], gradeProfiles: [], abilityRank: 0 }).traitValues.reaction, true);
  assert.equal(applyCardTraits({ ...base, tags: ['camp:physical'], evade: { charges: 1, bonus: 0 }, gradeProfiles: [], abilityRank: 0 }).traitValues.reaction, true);
});

test('existing spell Counter overrides widen protection independently of their return range', () => {
  const registries = createRegistries(contentBundle), ctx = { registries, combatExpansionVersion: 2 };
  for (const cardId of ['umbralWard', 'wardingStar', 'progression-rime-mirror']) {
    const def = resolveCombatCard(ctx, { cardId });
    assert.equal(def.range, 'reach');
    assert.equal(def.defenseRange, 'ranged');
    assert.deepEqual(def.counterCoverage.ranges, ['melee', 'reach', 'ranged']);
    assert.deepEqual(def.counterCoverage.camps, cardId === 'wardingStar' ? ['spell'] : ['physical', 'spell']);
    assert.deepEqual(def.counterCoverage.targeting, ['single']);
    for (const [defenseRange, ranges] of [['melee', ['melee']], ['reach', ['melee', 'reach']]]) {
      const narrowed = applyCombatExpansionCard({ ...def, defenseRange });
      assert.deepEqual(narrowed.counterCoverage.ranges, ranges);
      assert.equal(narrowed.range, 'reach');
    }
  }
  const support = { id: 'support', type: 'skill', tags: ['camp:spell'], effects: [{ op: 'draw', amount: 2 }] };
  assert.equal(applyCombatExpansionCard(support).defenseRange, undefined);
});
