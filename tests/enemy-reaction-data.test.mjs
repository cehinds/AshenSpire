import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TRAIT_RULES, reactionRulesProblems } from '../src/content/combatCardTraits.js';
import { STREAM_NAMES } from '../src/engine/rng.js';

test('the enemyReaction stream is appended last', () => {
  assert.equal(STREAM_NAMES.at(-1), 'enemyReaction');
  assert.equal(STREAM_NAMES.indexOf('enemyIntentClue'), STREAM_NAMES.length - 2);
});

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
