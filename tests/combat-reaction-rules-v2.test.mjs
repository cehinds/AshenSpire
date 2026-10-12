import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TRAIT_RULES, reactionRulesProblems } from '../src/content/combatCardTraits.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

test('the shipped card-trait rules validate and are frozen', () => {
  assert.deepEqual(reactionRulesProblems(CARD_TRAIT_RULES), []);
  assert.equal(Object.isFrozen(CARD_TRAIT_RULES), true);
  assert.equal(Object.isFrozen(CARD_TRAIT_RULES.advantage), true);
});

test('reactionRulesProblems flags a bad maxDepth', () => {
  for (const maxDepth of [0, -1, 1.5, '4', null]) {
    const rules = { ...CARD_TRAIT_RULES, stack: { ...CARD_TRAIT_RULES.stack, maxDepth } };
    assert.ok(reactionRulesProblems(rules).some(problem => /maxDepth/.test(problem)), `maxDepth ${maxDepth}`);
  }
});

test('reactionRulesProblems flags percentages outside (0, 1] and malformed advantage maps', () => {
  for (const pct of [0, -0.5, 1.2, NaN, '0.5']) {
    const rules = { ...CARD_TRAIT_RULES, counterstrike: { ...CARD_TRAIT_RULES.counterstrike, pct } };
    assert.ok(reactionRulesProblems(rules).some(problem => /Counterstrike/.test(problem)), `pct ${pct}`);
  }
  assert.ok(reactionRulesProblems({ ...CARD_TRAIT_RULES, advantage: { attack: 'smash' } }).length > 0);
  assert.ok(reactionRulesProblems(null).length > 0);
});

const registries = createRegistries(contentBundle);
function fixture(extra = {}) {
  return createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, ...extra,
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2,
      deck: [{ cardId: 'guardCounter', instanceId: 'r0', upgraded: false }, { cardId: 'sweepingBlow', instanceId: 'r1', upgraded: false }] } });
}

test('expanded fights without an explicit reaction version take reaction rules version 2', () => {
  const combat = fixture();
  assert.equal(combat.reactionRulesVersion, 2);
  assert.deepEqual(combat.reactionRules, CARD_TRAIT_RULES);
  assert.notEqual(combat.reactionRules, CARD_TRAIT_RULES, 'the fight carries its own copy');
});

test('explicit reaction rules version 1 carries no reactionRules tuning', () => {
  const combat = fixture({ reactionRulesVersion: 1 });
  assert.equal(combat.reactionRulesVersion, 1);
  assert.equal('reactionRules' in combat, false);
});

test('snapshots round-trip reaction rules version 2 and version 1 exactly', () => {
  for (const version of [2, 1]) {
    const combat = fixture({ reactionRulesVersion: version });
    const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
    assert.equal(saved.reactionRulesVersion, version);
    if (version === 2) assert.deepEqual(saved.reactionRules, CARD_TRAIT_RULES);
    else assert.equal('reactionRules' in saved, false);
    const restored = restoreCombatSnapshot({ registries, rng: createRng(701), snapshot: saved });
    assert.equal(restored.reactionRulesVersion, version);
    assert.deepEqual(restored.reactionRules, version === 2 ? CARD_TRAIT_RULES : undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(serializeCombatSnapshot(restored))), saved);
  }
});

test('a versionless snapshot restores with no reaction rules', () => {
  const combat = fixture({ reactionRulesVersion: null });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  assert.equal('reactionRulesVersion' in saved, false);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(701), snapshot: saved });
  assert.equal(restored.reactionRulesVersion, undefined);
  assert.equal('reactionRules' in restored, false);
});

test('reaction tuning magnitudes are capped so Impact and Flux stay small', async () => {
  const { CARD_TRAIT_RULES, reactionRulesProblems } = await import('../src/content/combatCardTraits.js');
  const rules = structuredClone(CARD_TRAIT_RULES);
  assert.deepEqual(reactionRulesProblems(rules), []);
  for (const edit of [r => { r.impact.base.smash = Number.MAX_SAFE_INTEGER; }, r => { r.flux.perTwoTiers = 21; }, r => { r.stack.maxDepth = 1000; }]) {
    const bad = structuredClone(CARD_TRAIT_RULES); edit(bad);
    assert.ok(reactionRulesProblems(bad).length > 0);
  }
});
