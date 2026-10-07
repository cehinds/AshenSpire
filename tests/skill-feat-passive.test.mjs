// tests/skill-feat-passive.test.mjs — SPEC §13.4o "Passive tag effects": the
// owner's Shield example, Braced Shield (Shield level 2): every Shield (guard)
// card gains +3 on its first unconditional Block, shown on the face, once per
// card played. Stamped as the derived `passiveBlock` beside `skillBonus`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyContentBundle as contentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { awardSkillXp, xpToNext, skillFeatOptions, takeSkillFeat, stampSkillBonuses, passiveBlockFor } from '../src/model/skills.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';

const registries = createRegistries(contentBundle);
const SHIELD = 'item:shield';
const toLevel = (run, level) => awardSkillXp(registries, run, SHIELD, Array.from({ length: level }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0));
const braced = () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  toLevel(run, 2);
  assert.deepEqual(skillFeatOptions(run, SHIELD, 2), ['shieldBraced']);
  assert.ok(takeSkillFeat(run, SHIELD, 'shieldBraced'));
  return run;
};
const blocks = (card) => card.effects.filter((e) => e.op === 'block').map((e) => e.amount);

test('Braced Shield opens at Shield 2 and stamps +3 on guard cards with an unconditional Block', () => {
  const run = braced();
  stampSkillBonuses(registries, run);
  const defend = run.deck.find((c) => c.cardId === 'defend');
  assert.equal(defend.passiveBlock, 3);
  const { passiveBlock, ...plainDefend } = defend;
  assert.deepEqual(blocks(resolveCard(registries, defend)), blocks(resolveCard(registries, plainDefend)).map((n) => n + 3), 'the kit Defend\'s face reads +3');
  assert.deepEqual(blocks(resolveCard(registries, { cardId: 'defend', passiveBlock: 3 })), [8], 'a plain Defend 5 → 8 on the face');
  const bash = run.deck.find((c) => c.cardId === 'shieldBash');
  assert.deepEqual(resolveCard(registries, bash).effects, resolveCard(registries, { ...bash, passiveBlock: undefined }).effects, 'a guard card with no Block is unchanged');
  assert.equal(run.deck.find((c) => c.cardId === 'strike').passiveBlock, undefined, 'a card without the tag carries nothing');
  assert.deepEqual(blocks(resolveCard(registries, { cardId: 'bracingStance', passiveBlock: 3 })), [9, 3], 'once per card: the first unconditional Block only');
  assert.deepEqual(blocks(resolveCard(registries, { cardId: 'ironResolve', passiveBlock: 3 })), [5, 9], 'a card whose every Block is conditional has none to raise');
  assert.equal(passiveBlockFor(registries, run, { cardId: 'enterBulwark' }), 3, 'stamped by tags');
  assert.deepEqual(blocks(resolveCard(registries, { cardId: 'enterBulwark', upgraded: true, passiveBlock: 3 })), [6], 'Enter Bulwark+ gains its upgrade Block +3');
  const back = deserializeRun(serializeRun(run));
  assert.deepEqual(validateRunShape(back).filter((p) => /passiveBlock/.test(p)), []);
  for (const bad of [0, 1.5, 100, '3']) {
    back.deck[0] = { ...back.deck[0], passiveBlock: bad };
    assert.ok(validateRunShape(back).some((p) => /deck\[0\]\.passiveBlock/.test(p)), `passiveBlock ${JSON.stringify(bad)} is refused`);
  }
});

test('without the feat nothing is stamped, and a card the run no longer meets loses it at the next stamp', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  stampSkillBonuses(registries, run);
  assert.ok(run.deck.every((c) => c.passiveBlock === undefined));
  const withFeat = braced();
  stampSkillBonuses(registries, withFeat);
  withFeat.skillFeats = [];
  stampSkillBonuses(registries, withFeat);
  assert.ok(withFeat.deck.every((c) => c.passiveBlock === undefined));
});

test('in a fight a played Defend gains its +3, and the bonus rides the saved fight', async () => {
  const run = braced();
  run.deck = Array.from({ length: 10 }, (_, n) => ({ instanceId: `d${n}`, cardId: 'defend', upgraded: false }));
  const combat = createRunCombat({ registries, rng: createRng(3), run, enemyIds: ['wanderingSoldier'] });
  const card = combat.piles.hand[0];
  assert.equal(card.passiveBlock, 3, 'the fight\'s copy carries it');
  const before = combat.player.block || 0;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
  const plain = createRunCombat({ registries, rng: createRng(3), run: { ...createRunState({ seed: 5, classId: 'reaver', registries }), deck: run.deck.map(({ passiveBlock, ...c }) => c) }, enemyIds: ['wanderingSoldier'] });
  const plainCard = plain.piles.hand[0];
  const plainBefore = plain.player.block || 0;
  dispatch(plain, { type: 'playCard', cardInstanceId: plainCard.instanceId });
  assert.equal((combat.player.block - before) - (plain.player.block - plainBefore), 3, 'exactly +3 Block over the same card without the feat');
  const { serializeCombatSnapshot } = await import('../src/engine/combatSnapshot.js');
  const { combatSnapshotProblems } = await import('../src/model/combatSnapshot.js');
  const snap = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(snap).filter((p) => /passiveBlock/.test(p)), []);
  const pile = Object.keys(snap.piles || {}).find((k) => (snap.piles[k] || []).some((c) => c.passiveBlock === 3));
  assert.ok(pile, 'the saved fight keeps the bonus on its cards');
});
