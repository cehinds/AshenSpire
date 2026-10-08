// tests/card-rank.test.mjs — SPEC §13.4o card ranks (phase B2a): a card
// instance carries a rank, each rank past 1 adds 1 to its primary number, a
// skill draft rolls the rank, and the rank survives combat, saves and takes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard, primaryEffectIndex } from '../src/model/registries.js';
import { serializeRun, deserializeRun } from '../src/model/state.js';
import { moveToSideboard } from '../src/model/deckRules.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { validateRunShape, createRunState } from '../src/model/state.js';
import { rollDraftRank } from '../src/model/skills.js';
import { playingCardModel } from '../src/model/playingCard.js';

const registries = createRegistries(contentBundle);

test('each rank past 1 adds 1 to the primary number, on play and on the face alike', () => {
  const strike = resolveCard(registries, { cardId: 'strike' });
  const ranked = resolveCard(registries, { cardId: 'strike', rank: 5 });
  const i = primaryEffectIndex(strike);
  assert.equal(strike.effects[i].op, 'damage');
  assert.equal(ranked.effects[i].amount, strike.effects[i].amount + 4);
  assert.equal(ranked.rank, 5);
  assert.notEqual(resolveCard(registries, { cardId: 'strike', rank: 3 }), ranked, 'each rank is its own cached face');
  const defend = resolveCard(registries, { cardId: 'defend', rank: 2 });
  assert.equal(defend.effects[primaryEffectIndex(defend)].amount, resolveCard(registries, { cardId: 'defend' }).effects[0].amount + 1);
  const upgraded = resolveCard(registries, { cardId: 'strike', upgraded: true, rank: 3 });
  assert.equal(upgraded.effects[i].amount, resolveCard(registries, { cardId: 'strike', upgraded: true }).effects[i].amount + 2, 'the rank stacks on the upgrade');
  const model = playingCardModel(registries, { cardId: 'strike', rank: 5 });
  assert.equal(model.rank, 5);
  assert.equal(model.tokens.damage, strike.effects[i].amount + 4, 'the face text reads the ranked number');
});

test('a ranked Strike hits for its ranked damage in combat', () => {
  const deck = Array.from({ length: 8 }, (_, n) => ({ instanceId: `c${n}`, cardId: 'strike', upgraded: false, rank: 4 }));
  const player = { id: 'p1', classId: 'reaver', maxHp: 1000, maxMana: 10, maxStamina: 3, energyMax: 3, drawPerTurn: 5, relicIds: [], deck };
  const combat = createCombat({ registries, rng: createRng(5), player, enemyIds: ['wanderingSoldier'] });
  const card = combat.piles.hand[0];
  assert.equal(card.rank, 4, 'the combat copy keeps the rank');
  const enemy = combat.enemies[0];
  const before = enemy.hp + (enemy.block || 0);
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  const base = resolveCard(registries, { cardId: 'strike' }).effects[0].amount;
  assert.ok(before - (enemy.hp + (enemy.block || 0)) >= base + 3, 'the hit carries the three extra points');
});

test('a rank must be a whole number of at least 1', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  run.deck[0].rank = 3;
  assert.deepEqual(validateRunShape(run).filter((p) => /rank/.test(p)), []);
  for (const bad of [0, 1.5, '2']) {
    run.deck[0].rank = bad;
    assert.ok(validateRunShape(run).some((p) => /deck\[0\]\.rank/.test(p)), `rank ${JSON.stringify(bad)} is refused`);
  }
});

test('a draft rank runs 1 to the skill level, capped at rankMax, weighted toward the level', () => {
  const rng = createRng(11);
  assert.equal(rollDraftRank(registries, rng, 0), 1);
  assert.equal(rollDraftRank(registries, rng, 1), 1);
  const counts = {};
  for (let n = 0; n < 3000; n += 1) {
    const rank = rollDraftRank(registries, rng, 5);
    assert.ok(rank >= 1 && rank <= 5);
    counts[rank] = (counts[rank] || 0) + 1;
  }
  assert.ok(counts[5] > counts[1] * 2.5, `rank 5 (${counts[5]}) is about five times rank 1 (${counts[1]})`);
  for (let n = 0; n < 200; n += 1) assert.ok(rollDraftRank(registries, rng, 20) <= registries.balance.skill.rankMax);
  assert.equal(rollDraftRank(registries, createRng(42), 7), rollDraftRank(registries, createRng(42), 7), 'a seeded run rolls the same rank');
});

test('a skill draft offers each card at its rolled rank, and the taken card keeps it', async () => {
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const { bankSkillXp, claimBankedSkillLevel, xpToNext } = await import('../src/model/skills.js');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = createRunState({ seed: 9, classId: 'reaver', registries });
    run.deck = [];
    bankSkillXp(registries, run, 'item:blade', xpToNext(registries, 'weapon', 0));
    mountRewards(app, { registries, run, onDone() {},
      onClaimSkill: (id) => claimBankedSkillLevel(registries, run, id),
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: { 'item:blade': 1 } },
        skillDrafts: [{ skillId: 'item:blade', level: 1, claimOrdinal: 1, cardIds: ['rend', 'stomp'], ranks: [3, 1] }] },
    });
    app.querySelector('.reward-level-up[data-track="item:blade"]').click();
    app.querySelector('.reward-kind[data-kind="skillDraft"]').click();
    const faces = app.querySelectorAll('.reward-row .card');
    assert.ok(faces[0].getAttribute('aria-label').startsWith(resolveCard(registries, { cardId: 'rend' }).name), 'the offered face names its card');
    assert.ok(faces[0].getAttribute('aria-label').includes('rank 3'), 'the offered face shows its rank');
    assert.ok(faces[0].getAttribute('aria-label').includes('Attack'), 'the offered face names its primary sigil');
    faces[0].click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(run.deck.at(-1).cardId, 'rend');
    assert.equal(run.deck.at(-1).rank, 3, 'the deck card arrives at the rank it was offered at');
  } finally { Object.assign(globalThis, saved); }
});

const amountAt = (cardId, rank, index) => resolveCard(registries, { cardId, rank }).effects[index];

test('the primary number is what the card is for, never a cost or tempo', () => {
  // A blood price stays the price: the damage ranks, the HP cost does not.
  assert.deepEqual([amountAt('bloodOfferingRite', 5, 0).amount, amountAt('bloodOfferingRite', 5, 1).amount], [6, 28]);
  // Pure tempo (energy, draw) has no primary number, so nothing moves.
  assert.equal(primaryEffectIndex(resolveCard(registries, { cardId: 'timeDilation' })), -1);
  assert.deepEqual(resolveCard(registries, { cardId: 'timeDilation', rank: 10 }).effects.map((e) => e.amount), [2, 3, undefined]);
  // A status card ranks its stacks, not its rider draw.
  assert.deepEqual([amountAt('warcry', 3, 0).stacks, amountAt('warcry', 3, 1).amount], [3, 1]);
  // Block outranks nothing but damage: a formula-damage attack ranks its Block.
  assert.equal(amountAt('shieldCrash', 4, 0).amount, 8);
});

test('a multi-hit effect splits its rank across its hits, rounded up', () => {
  assert.equal(amountAt('thousandCutsRogue', 2, 0).amount, 3, 'one step still shows a gain');
  assert.equal(amountAt('thousandCutsRogue', 10, 0).amount, 2 + Math.ceil(9 / 6));
  assert.equal(amountAt('thousandCutsRogue', 10, 1).amount, 1, 'the conditional bonus hit is not primary');
  assert.equal(amountAt('stitchedArms', 7, 0).amount, 6 + 2, 'an X-hit card splits as if three hits');
});

test('a ranked card survives a save and reload', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries });
  run.deck[0].rank = 6;
  const back = deserializeRun(serializeRun(run));
  assert.equal(back.deck[0].rank, 6);
  assert.deepEqual(validateRunShape(back).filter((p) => /rank/.test(p)), []);
  back.deck[0].rank = 100;
  assert.ok(validateRunShape(back).some((p) => /deck\[0\]\.rank/.test(p)), 'a rank past the structural ceiling is refused');
});

test('a pending skill draft must carry one valid rank per offered card', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  const pending = (ranks) => ({ rewards: { skillDrafts: [{ skillId: 'item:blade', level: 2, cardIds: ['rend', 'stomp'], ranks }] }, states: {} });
  const rankProblems = (ranks) => { run.pendingReward = pending(ranks); return validateRunShape(run).filter((p) => /ranks/.test(p)); };
  assert.deepEqual(rankProblems(undefined), [], 'an offer from before ranks is rank 1');
  assert.deepEqual(rankProblems([2, 1]), []);
  for (const bad of [[2], [0, 1], [1.5, 1], 'x', [1, 100]]) assert.ok(rankProblems(bad).length, `ranks ${JSON.stringify(bad)} is refused`);
});

test('a ranked plain basic set aside is kept, not deleted', () => {
  const run = createRunState({ seed: 6, classId: 'reaver', registries });
  delete run.loadout;
  run.deck.push({ instanceId: 'ranked-strike', cardId: 'strike', upgraded: false, rank: 3 });
  assert.ok(moveToSideboard(registries, run, 'ranked-strike'));
  assert.equal(run.sideboard.find((c) => c.instanceId === 'ranked-strike')?.rank, 3);
});
