import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TRAIT_RULES, reactionRulesProblems } from '../src/content/combatCardTraits.js';

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
