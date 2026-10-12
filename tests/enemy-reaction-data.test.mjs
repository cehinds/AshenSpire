import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TRAIT_RULES, reactionRulesProblems } from '../src/content/combatCardTraits.js';
import { STREAM_NAMES } from '../src/engine/rng.js';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createHash } from 'node:crypto';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

// 200 enemy turns on a fixed seed, through the real engine (endTurn runs rollIntents).
// The digests were recorded from the pre-change intent code, so an enemy without
// reaction moves (and the two carriers, once they gain one) keeps its sequence.
function intentSequence(enemyId, seed, registries = createRegistries(contentBundle)) {
  const deck = Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'defend', upgraded: false }));
  const player = { id: 'p1', classId: 'herald', maxHp: 100000, hp: 100000, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, relicIds: [], deck };
  const combat = createCombat({ registries, rng: createRng(seed), player, enemyIds: [enemyId] });
  const seq = [];
  for (let turn = 0; turn < 200 && !combat.result; turn++) {
    dispatch(combat, { type: 'endTurn' });
    for (const enemy of combat.enemies) enemy.hp = enemy.maxHp = 1000000;
    seq.push(combat.enemies[0].intent?.moveId ?? null);
  }
  return seq;
}
const digest = seq => createHash('sha256').update(JSON.stringify(seq)).digest('hex');
const PRE_CHANGE_DIGESTS = {
  gildedKnight: ['76cd1197acb372e1df91b29586a192672c9f880a43eb5e34ab946ff90967b926', '856aa031881690adc0d8a12e3079f58af4f7db5ae46c88026ce865d698f48ec4', 'dc94f62a3930cce7892facaaeafa9de40d3bea265045124bd238a2d70cd74d10', 'ecdeb72383769682480e0d0b55517c8b8af0ddede52c772196c326ff6fba40be', 'a72a9664966eac8e19c0dd045b591177d423eecbd6a5945a5239567441449bda'],
  courtDuelist: ['b2baf9f2826d88b482d03a7e060ccbc42444d26270f17e7da082fe2aa011d29e', 'f4149dacfe0ab69638f2e8b76232daa2c0066bb0f254a28c2a8c92450f06c333', '21c478747999352674bd81407d2115b5c966022df33da4c87a8e60c852e5a894', 'a9a5da047b184b159f7c5d761faa5ad53c8235cac5cf160acec30a497d97d268', 'a9a7520276ffe2b6eeeb576022317d76beed73dc4df23f059ab2c1e50f43b46f'],
  wanderingSoldier: ['1068e533593c3746657749eb0e0c89f89d6c4f0811e8f00d16130733ed5b1c71', '99e5b7e3f8e10f0a144592740ecc611406107d491ad724d322aa226870b29718', 'b9d5bcfb3d2dbbbaee99a6ac57bee6c24e380230e73638e79e508f5b2b38eb4d', '0af08135b4a61c0fccaecc5af0d89b45e92858c497a60d0ab28b003e89cf15ca', 'c6d513a18baa0b3d2d5bded41cb6ff887a74d5eab2011440004fe19d7e9b8326'],
};

test('intent sequences of enemies without reaction moves are unchanged on fixed seeds', () => {
  for (const [enemyId, digests] of Object.entries(PRE_CHANGE_DIGESTS)) {
    [1, 2, 3, 4, 5].forEach((seed, i) => {
      assert.equal(digest(intentSequence(enemyId, seed)), digests[i], `${enemyId} seed ${seed}`);
    });
  }
});

test('a reaction move added to an enemy leaves its intent sequence unchanged (filtered before weighting)', () => {
  // A weight-free reaction probe on Gilded Knight: it must never be drawn, and
  // dropping it before weighting must not move any enemyAI draw.
  const probe = { intent: 'block', block: 6, damage: 3, reaction: { on: ['playerAction'], minIncoming: 8 } };
  const enemies = contentBundle.enemies.map(enemy => (enemy.id === 'gildedKnight' ? { ...enemy, moves: { ...enemy.moves, probeGuard: probe } } : enemy));
  const registries = createRegistries({ ...contentBundle, enemies });
  for (const [seed, digestHex] of PRE_CHANGE_DIGESTS.gildedKnight.entries()) {
    const seq = intentSequence('gildedKnight', seed + 1, registries);
    assert.equal(seq.includes('probeGuard'), false, `seed ${seed + 1} rolled the reaction probe`);
    assert.equal(digest(seq), digestHex, `gildedKnight seed ${seed + 1} with a reaction probe`);
  }
});

test('reaction moves are never rolled as intents over 200 turns', () => {
  const registries = createRegistries(contentBundle);
  for (const enemyId of ['gildedKnight', 'courtDuelist']) {
    const reactionIds = new Set(Object.entries(registries.enemies.get(enemyId).moves).filter(([, move]) => move.reaction).map(([id]) => id));
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const moveId of intentSequence(enemyId, seed)) assert.equal(reactionIds.has(moveId), false, `${enemyId} seed ${seed} rolled ${moveId}`);
    }
  }
});

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

test('reaction bounds: non-empty on, a weight-free move, minIncoming >= 0, chance in [0, 1]', () => {
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: [] } }).some(path => /reaction\.on/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, weight: 5, reaction: { on: ['playerAction'] } }).some(path => /probeMove\.weight/.test(path)));
  // minIncoming 0 is valid (no incoming damage required); negative or fractional is not.
  assert.deepEqual(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], minIncoming: 0 } }).filter(path => /minIncoming/.test(path)), []);
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerAction'], minIncoming: -1 } }).some(path => /minIncoming/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerAction'], minIncoming: 1.5 } }).some(path => /minIncoming/.test(path)));
  // chance 0 is the contract's deterministic never-taken move: valid, and it draws nothing.
  assert.ok(!errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], chance: 0 } }).some(path => /chance/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], chance: -0.1 } }).some(path => /chance/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['playerReaction'], chance: 1.5 } }).some(path => /chance/.test(path)));
  assert.ok(errorsFor({ intent: 'block', block: 6, reaction: { on: ['onKill'] } }).length > 0);
});

test('the first reaction carriers validate, carry trait:reaction, and are never rolled', () => {
  assert.deepEqual(validateContent(contentBundle).errors, []);
  const knight = contentBundle.enemies.find(enemy => enemy.id === 'gildedKnight');
  const duelist = contentBundle.enemies.find(enemy => enemy.id === 'courtDuelist');
  assert.deepEqual(knight.moves.gildedGuard.reaction, { on: ['playerAction'], minIncoming: 8 });
  assert.equal(knight.moves.gildedGuard.weight, undefined);
  assert.deepEqual(duelist.moves.bindingRiposte.reaction, { on: ['playerReaction'], chance: 0.5 });
  assert.equal(duelist.moves.bindingRiposte.weight, undefined);
  assert.ok(combatProfileFor({ enemyId: 'gildedKnight', moveId: 'gildedGuard' }).traits.includes('reaction'));
  assert.ok(combatProfileFor({ enemyId: 'courtDuelist', moveId: 'bindingRiposte' }).traits.includes('reaction'));
  assert.ok(!(combatProfileFor({ enemyId: 'gildedKnight', moveId: 'thrust' }).traits || []).includes('reaction'));
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
