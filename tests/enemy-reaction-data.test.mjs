import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TRAIT_RULES, reactionRulesProblems } from '../src/content/combatCardTraits.js';

test('the shipped rules carry enemyReactions and a rules object without it still validates', () => {
  assert.equal(CARD_TRAIT_RULES.enemyReactions, true);
  assert.deepEqual(reactionRulesProblems(CARD_TRAIT_RULES), []);
  const { enemyReactions, ...older } = CARD_TRAIT_RULES;
  assert.equal(enemyReactions, true);
  assert.deepEqual(reactionRulesProblems(older), []);
});

test('enemyReactions must be a boolean when present', () => {
  assert.ok(reactionRulesProblems({ ...CARD_TRAIT_RULES, enemyReactions: 'yes' }).some(problem => /Enemy reactions/.test(problem)));
  assert.deepEqual(reactionRulesProblems({ ...CARD_TRAIT_RULES, enemyReactions: false }), []);
});
