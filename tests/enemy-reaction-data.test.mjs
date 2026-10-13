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
// Re-recorded at the merge into feature/AlternativeCombatRounds: the stat-driven enemy SP pool (SPEC §4.6a) plans
// several weighted picks a turn, so every sequence moves. The reaction probe below still must not move any of them.
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
  gildedKnight: ['b2f410a59916c6794df40f32a2733cef2a735dd520fd80c9449624dbeac09433', 'd6b987e7c1ccab58384ddd5dd33ab4b6226d1fda78353ca963266526b46212cd', '9a5ca58382b3960bd88f9ef048b3e35a9e78f4c7a8e41132907a43fa2c06aee9', '68bf2f9c79a0dfb626b33961c6c9d9397bfba0f85a9c27129c32ddd0060ef1eb', '174a9534ac1d8040783d4cdbf6807f8fe315be63a76ec543a0ed1437de0c0999'],
  courtDuelist: ['b2eb0d2aca982aeeb2b9805c7569e0e53e61050468c3c3cc832b378266399b8b', '407b6e852be6ba308d0dfbab6c6edf13050cae3586f337c5528e8019e41dfab7', '8d228239b1cd82b191fe2deb85ff54c13c6a55b9819a503c937c5dcc0d0e42af', '9f55be3eb7b9deaf428b3a1021a69cdb86cf8a2caabd3d3dc979bea27c066dac', '9beeb5412efebcf8f81861d3042854f719d886b3c08fb7f07bc115164d9e7da3'],
  wanderingSoldier: ['e685f94118b79ac50dbf65b2cb0c18bd8535055c5de97261ccac13755ad960e5', 'a36bbbc1a0bb7a22e01cdf4f66da451170054bb001cf6d413bbdcda24028621a', '89e00ff8a9f81b2d8ed03c01e1dac22995b258bdf9a564db5a718aeaed131155', '199cd41d5d9f5697e7c1850ea6a7ad1608746d828330d5f7fae6debd3bcd631b', '72f91f9464ce7fbcc39975497dd14f0f501ecb9518b828b16040ca5daf450881'],
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
  assert.deepEqual(duelist.moves.bindingRiposte.reaction, { on: ['playerReaction'], minIncoming: 0, chance: 0.5 });
  assert.equal(duelist.moves.bindingRiposte.weight, undefined);
  assert.ok(combatProfileFor({ enemyId: 'gildedKnight', moveId: 'gildedGuard' }).traits.includes('reaction'));
  assert.ok(combatProfileFor({ enemyId: 'courtDuelist', moveId: 'bindingRiposte' }).traits.includes('reaction'));
  assert.ok(!(combatProfileFor({ enemyId: 'gildedKnight', moveId: 'thrust' }).traits || []).includes('reaction'));
});

test('the enemyReaction stream is appended after enemyIntentClue (the Combat Rounds Preview stream follows it)', () => {
  assert.equal(STREAM_NAMES.at(-2), 'enemyReaction');
  assert.equal(STREAM_NAMES.at(-1), 'combatRounds');
  assert.equal(STREAM_NAMES.indexOf('enemyIntentClue'), STREAM_NAMES.length - 3);
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
