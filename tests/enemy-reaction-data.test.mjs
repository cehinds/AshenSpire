import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TRAIT_RULES, reactionRulesProblems } from '../src/content/combatCardTraits.js';
import { STREAM_NAMES } from '../src/engine/rng.js';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';

// A copy of the shipped bundle with one extra move on Gilded Knight.
function bundleWithMove(move) {
  const enemies = contentBundle.enemies.map(enemy => (enemy.id === 'gildedKnight' ? { ...enemy, moves: { ...enemy.moves, probeMove: move } } : enemy));
  return { ...contentBundle, enemies };
}
const errorsFor = move => validateContent(bundleWithMove(move)).errors.map(error => error.path);

test('a reaction move validates without a weight, and a rolled move still needs one', () => {
  assert.deepEqual(validateContent(contentBundle).errors, []);
  assert.deepEqual(errorsFor({ intent: 'block', block: 6, damage: 3, reaction: { on: ['playerAction'], minIncoming: 8 } }), []);
  assert.deepEqual(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], chance: 0.5 } }), []);
  assert.ok(errorsFor({ intent: 'block', block: 6 }).some(path => /moves\.probeMove\.weight/.test(path)));
});

test('reaction bounds: non-empty on, a weight-free move, minIncoming >= 1, chance in (0, 1]', () => {
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: [] } }).some(path => /reaction\.on/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, weight: 5, reaction: { on: ['playerAction'] } }).some(path => /probeMove\.weight/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerAction'], minIncoming: 0 } }).some(path => /minIncoming/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], chance: 0 } }).some(path => /chance/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], chance: 1.5 } }).some(path => /chance/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['onKill'] } }).length > 0);
});

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
