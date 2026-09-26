// tests/card-reward-schedule.test.mjs — SPEC §15.1, the card reward schedule.
//
// One test per Falsify line of §15.1, plus the doors the schedule passes
// through: the RNG stream order, the reward menu's new `levelCard` row, the
// pending-reward save shape (old saves without the new fields still load),
// validation of the balance block, and the generated Settings rows.

import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { rollCardRewardIds, rollCombatCardOffer, cardRewardSchedule } from '../src/engine/encounters.js';
import { rewardPlan, resolveContinue, rewardClaimStatus, rewardNotes, REWARD_KIND_ORDER, rowKey, cardRewardPlan } from '../src/model/rewardplan.js';
import { resolveCard } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession } from '../tools/session.mjs';
import { advancedConfigRows } from '../src/model/advancedConfig.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { t } from '../src/ui/strings.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const REG = createRegistries(contentBundle);

/** The registries with `balance.rewards.cardRewards` patched. */
function withSchedule(patch) {
  const base = structuredClone(REG.balance.rewards.cardRewards);
  const merged = {
    ...base,
    ...patch,
    afterCombat: { ...base.afterCombat, ...(patch.afterCombat || {}) },
    chancePct: { ...base.chancePct, ...(patch.chancePct || {}) },
  };
  return { ...REG, balance: { ...REG.balance, rewards: { ...REG.balance.rewards, cardRewards: merged } } };
}

const args = (pool, extra = {}) => ({ classId: 'reaver', pool, relicIds: [], flatRarity: false, draftWaiting: false, levelUps: 0, ...extra });

test('rewardRolls is appended to the END of STREAM_NAMES, so no existing stream moves', () => {
  assert.equal(STREAM_NAMES.at(-1), 'rewardRolls');
  assert.deepEqual(STREAM_NAMES.slice(0, -1), [
    'map', 'shuffle', 'cardRewards', 'relicRewards', 'flaskRewards', 'armaments', 'enemyAI', 'enemyHP',
    'events', 'shop', 'misc', 'smith', 'combatProcs', 'seats',
  ]);
  // A save written before the stream existed restores it at 0.
  assert.equal(createRng(7, { cardRewards: 3 }).getCounters().rewardRolls, 0);
});

test('the shipped schedule is the §15.1 table', () => {
  assert.deepEqual(cardRewardSchedule(REG.balance), {
    afterCombat: { normal: true, elite: true, boss: true },
    chancePct: { normal: 100, elite: 100, boss: 100 },
    onLevelUp: false,
    onLevelUpMaxPerFight: 1,
  });
  // A bundle without the block reads as the defaults.
  const bare = { ...REG.balance, rewards: { ...REG.balance.rewards, cardRewards: undefined } };
  assert.deepEqual(cardRewardSchedule(bare), cardRewardSchedule(REG.balance));
});

test('Falsify: with afterCombat.normal false, a normal win offers no card row and an elite win still offers one', () => {
  const reg = withSchedule({ afterCombat: { normal: false } });
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    const normal = rollCombatCardOffer(reg, rng, args('normal'));
    assert.deepEqual(normal.cardIds, [], `seed ${seed}: no card row`);
    assert.equal(normal.cardMissed, false, 'off is not a missed roll: nothing to say');
    assert.equal(rng.getCounters().cardRewards, 0, 'and nothing was rolled');
    assert.equal(rewardPlan(normal.rewards).rows.some((r) => r.kind === 'card'), false);
    const elite = rollCombatCardOffer(reg, createRng(seed), args('elite'));
    assert.equal(elite.cardIds.length, REG.balance.rewards.cardChoices, `seed ${seed}: elite still offers`);
    assert.equal(rewardPlan(elite.rewards).rows.filter((r) => r.kind === 'card').length, 1);
  }
});

test('Falsify: with chancePct.elite 0 an elite win never offers a card row; at 100 the rewardRolls counter does not move', () => {
  const never = withSchedule({ chancePct: { elite: 0 } });
  for (let seed = 1; seed <= 50; seed++) {
    const offer = rollCombatCardOffer(never, createRng(seed), args('elite'));
    assert.deepEqual(offer.cardIds, [], `seed ${seed}`);
    assert.equal(offer.cardMissed, true, 'a missed chance says so');
    assert.deepEqual(rewardNotes(offer.rewards), ['cardMissed']);
    assert.equal(rewardPlan(offer.rewards).rows.some((r) => r.kind === 'card'), false);
  }
  const always = withSchedule({ chancePct: { elite: 100 } });
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    const offer = rollCombatCardOffer(always, rng, args('elite'));
    assert.equal(rng.getCounters().rewardRolls, 0, 'a chance of 100 rolls nothing');
    assert.equal(offer.cardMissed, false);
    assert.equal(offer.cardIds.length, 3);
  }
});

test('a chance between 0 and 100 rolls once on rewardRolls and lands near its odds', () => {
  const half = withSchedule({ chancePct: { normal: 50 } });
  let offered = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const rng = createRng(seed);
    const offer = rollCombatCardOffer(half, rng, args('normal'));
    assert.equal(rng.getCounters().rewardRolls, 1, 'one roll per eligible fight');
    if (offer.cardIds.length) offered++;
    else assert.equal(rng.getCounters().cardRewards, 0, 'a miss rolls no cards');
  }
  assert.ok(offered > 150 && offered < 250, `about half offer (${offered}/400)`);
});

test('Falsify: with onLevelUp true, a fight that levels offers exactly one levelCard row; one that does not offers none', () => {
  const reg = withSchedule({ onLevelUp: true });
  for (let seed = 1; seed <= 20; seed++) {
    for (const pool of ['normal', 'elite', 'boss']) {
      const levelled = rollCombatCardOffer(reg, createRng(seed), args(pool, { levelUps: 3 }));
      assert.equal(levelled.levelCards.length, 1, `${pool}/${seed}: capped at onLevelUpMaxPerFight 1 however many levels`);
      const plan = rewardPlan(levelled.rewards);
      const rows = plan.rows.filter((r) => r.kind === 'levelCard');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].key, 'levelCard:0');
      assert.equal(rows[0].cardIds.length, REG.balance.rewards.cardChoices);
      // The row sits right after the card row.
      const kinds = plan.rows.map((r) => r.kind);
      assert.equal(kinds.indexOf('levelCard'), kinds.indexOf('card') + 1);
      const flat = rollCombatCardOffer(reg, createRng(seed), args(pool, { levelUps: 0 }));
      assert.equal(flat.levelCards.length, 0);
      assert.equal(rewardPlan(flat.rewards).rows.some((r) => r.kind === 'levelCard'), false);
    }
  }
  // onLevelUpMaxPerFight caps; each row carries its own ordinal.
  const two = rollCombatCardOffer(withSchedule({ onLevelUp: true, onLevelUpMaxPerFight: 2 }), createRng(4), args('normal', { levelUps: 5 }));
  assert.deepEqual(two.levelCards.map((d) => d.ordinal), [0, 1]);
  assert.deepEqual(rewardPlan(two.rewards).rows.filter((r) => r.kind === 'levelCard').map((r) => r.key), ['levelCard:0', 'levelCard:1']);
  // Off (the default): a level gained adds nothing and rolls nothing more.
  const rng = createRng(4);
  const off = rollCombatCardOffer(REG, rng, args('normal', { levelUps: 2 }));
  assert.equal(off.levelCards.length, 0);
  assert.equal(off.rewards.levelCards, undefined);
});

test('the level card rolls through rollCardRewardIds on cardRewards at the door\'s own rarity odds', () => {
  const reg = withSchedule({ onLevelUp: true });
  for (let seed = 1; seed <= 20; seed++) {
    const offer = rollCombatCardOffer(reg, createRng(seed), args('elite', { levelUps: 1 }));
    const replay = createRng(seed);
    const first = rollCardRewardIds(reg, replay, { classId: 'reaver', pool: 'elite', relicIds: [] });
    const second = rollCardRewardIds(reg, replay, { classId: 'reaver', pool: 'elite', relicIds: [] });
    assert.deepEqual(offer.cardIds, first);
    assert.deepEqual(offer.levelCards[0].cardIds, second);
  }
});

test('cardRewardPlan is the one door: rowKey spells levelCard, and a waiting draft never displaces the level card', () => {
  assert.equal(rowKey('levelCard', { ordinal: 2 }), 'levelCard:2');
  const on = withSchedule({ onLevelUp: true, chancePct: { normal: 50 } }).balance;
  // A draft takes the plain card row's seat: no offer, no chance roll…
  const rng = createRng(9);
  const drafted = cardRewardPlan(on, { pool: 'normal', levelsGained: 2, draftWaiting: true }, rng);
  assert.deepEqual(drafted, { offerCard: false, cardMissed: false, levelCards: 1 }, '…but the level card stays');
  assert.equal(rng.getCounters().rewardRolls, 0);
  // Shipped schedule: always offer, never roll, never a level card.
  const shipped = createRng(9);
  assert.deepEqual(cardRewardPlan(REG.balance, { pool: 'boss', levelsGained: 4 }, shipped), { offerCard: true, cardMissed: false, levelCards: 0 });
  assert.equal(shipped.getCounters().rewardRolls, 0);
  // Through the offer roller too: a drafted, levelling fight has a level card row and no card row.
  const offer = rollCombatCardOffer(withSchedule({ onLevelUp: true }), createRng(5), args('elite', { draftWaiting: true, levelUps: 1 }));
  assert.deepEqual(offer.cardIds, []);
  assert.equal(offer.levelCards.length, 1);
});

// One member's greedy turn in a live co-op fight: play what can be paid for
// at the first living enemy, else end the turn.
function botTurn(combat, memberId) {
  const P = combat.players.get(memberId);
  if (!P || !P.connected || !P.entity.alive || P.ended) return;
  let guard = 0;
  while (combat.phase === 'player' && !P.ended && !combat.result && guard++ < 50) {
    const card = P.piles.hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= P.entity.energy && (def.manaCost || 0) <= P.entity.mana && (def.staminaCost || 0) <= (P.entity.stamina || 0);
    });
    const def = card ? resolveCard(REG, { cardId: card.cardId, upgraded: card.upgraded }) : null;
    const tgt = def && (def.effects || []).some((eff) => eff.target === 'enemy') ? combat.enemies.find((e) => e.alive) : null;
    try {
      if (card) playCard(combat, memberId, card.instanceId, tgt ? tgt.id : undefined);
      else { endTurn(combat, memberId); break; }
    } catch { endTurn(combat, memberId); break; }
  }
  if (!P.ended && combat.phase === 'player' && !combat.result) endTurn(combat, memberId);
}

/** A one-seat co-op session through its first fight, won, with `reg`'s schedule. */
function coopFirstSpoils(reg, seedString) {
  const host = createSession({ registries: reg, seedString });
  host.addMember({ id: 'p1', name: 'p1', classId: 'reaver' });
  host.start();
  host.chooseNode('p1', host.session.mapGraph.startIds[0]);
  for (const enemy of host.live.combat.enemies) enemy.hp = 1;
  host.autoResolveCombat(botTurn);
  return host;
}

test('co-op reads the schedule through cardRewardPlan: a pool turned off offers no card, and a level card is offered and taken', () => {
  const off = coopFirstSpoils(withSchedule({ afterCombat: { normal: false }, onLevelUp: true }), 'SCHEDULE');
  assert.equal(off.scene.kind, 'reward');
  const offer = off.scene.offers.p1;
  assert.deepEqual(offer.cardIds, [], 'no card row at a normal door that is off');
  assert.equal(offer.levelCards.length, 1, 'the first fight levels, so one level card row');
  const deckBefore = off.livingMembers()[0].run.deck.length;
  const picked = offer.levelCards[0].cardIds[1];
  assert.equal(off.chooseReward('p1', { levelCardIds: { 0: picked } }).ok, true);
  const deck = off.livingMembers()[0].run.deck;
  assert.equal(deck.length, deckBefore + 1);
  assert.equal(deck.at(-1).cardId, picked);
  // The shipped schedule: the co-op offer is the one it always was.
  const shipped = coopFirstSpoils(REG, 'SCHEDULE');
  assert.equal(shipped.scene.offers.p1.cardIds.length, REG.balance.rewards.cardChoices);
  assert.equal(shipped.scene.offers.p1.levelCards, undefined);
  assert.equal(shipped.scene.offers.p1.cardMissed, undefined);
  assert.equal(shipped.livingMembers()[0].rng.getCounters().rewardRolls, 0);
});

test('a waiting draft still takes the card row\'s seat, and rolls no chance', () => {
  const reg = withSchedule({ chancePct: { normal: 50 } });
  const rng = createRng(3);
  const offer = rollCombatCardOffer(reg, rng, args('normal', { draftWaiting: true }));
  assert.deepEqual(offer.cardIds, []);
  assert.equal(offer.cardMissed, false);
  assert.equal(rng.getCounters().rewardRolls, 0);
  assert.equal(rng.getCounters().cardRewards, 0);
});

test('Falsify: with every key at its default, 50 fixed seeds offer byte-identical rewards to the ones before this section', () => {
  // THE BASELINE is the roll main.js made before the schedule: the draft
  // seat, else rollCardRewardIds straight — no chance, no level card. The
  // schedule must reproduce its ids AND leave every stream counter where it
  // left them, so every later roll in the seed is unchanged too.
  const before = (rng, a) => (a.draftWaiting ? [] : rollCardRewardIds(REG, rng, { classId: a.classId, pool: a.pool, relicIds: a.relicIds, flatRarity: a.flatRarity }));
  const classes = ['reaver', 'rogue', 'starseer', 'herald'].filter((id) => REG.classes.has(id));
  for (let seed = 1; seed <= 50; seed++) {
    for (const pool of ['normal', 'elite', 'boss']) {
      const a = args(pool, {
        classId: classes[seed % classes.length],
        relicIds: seed % 5 === 0 ? ['feralEye'] : [],
        flatRarity: seed % 7 === 0,
        levelUps: seed % 3,
        draftWaiting: seed % 11 === 0,
      });
      const baseRng = createRng(seed * 7919, { cardRewards: seed });
      const baseRewards = { cardIds: before(baseRng, a) };
      const rng = createRng(seed * 7919, { cardRewards: seed });
      const offer = rollCombatCardOffer(REG, rng, a);
      assert.equal(JSON.stringify(offer.rewards), JSON.stringify(baseRewards), `seed ${seed} ${pool}: same offer bytes`);
      assert.deepEqual(rng.getCounters(), baseRng.getCounters(), `seed ${seed} ${pool}: same draws on every stream`);
    }
  }
});

test('the reward menu: levelCard is ordered after card, is a choice, is taken and skipped like the card offer', () => {
  assert.equal(REWARD_KIND_ORDER.indexOf('levelCard'), REWARD_KIND_ORDER.indexOf('card') + 1);
  const offer = { cinders: 10, cardIds: ['stomp', 'rend', 'gildedOath'], levelCards: [{ ordinal: 0, cardIds: ['guardCounter', 'executioner', 'crimsonCleave'] }] };
  const plan = rewardPlan(offer, { flaskSlotsFree: 1, armamentSlotsFree: 1 });
  const row = plan.rows.find((r) => r.kind === 'levelCard');
  assert.equal(row.choice, true);
  assert.equal(row.blockedBy, null);
  // Auto-collect picks one card from each choice row.
  const { take } = resolveContinue(plan, { cinders: 'taken' }, 'auto', () => 1);
  assert.deepEqual(take.map((r) => [r.key, r.cardId]), [['card', 'rend'], ['levelCard:0', 'executioner']]);
  // An explicit skip is respected, as for the card offer.
  const skipped = resolveContinue(plan, { cinders: 'taken', 'levelCard:0': 'skipped' }, 'auto', () => 0);
  assert.equal(skipped.take.some((r) => r.kind === 'levelCard'), false);
  // Manual leaves it.
  assert.equal(resolveContinue(plan, {}, 'manual').leave.some((r) => r.key === 'levelCard:0'), true);
  const claim = rewardClaimStatus(plan, { cinders: 'taken', card: 'taken' });
  assert.deepEqual(claim.requiredChoice, { kind: 'levelCard', key: 'levelCard:0', count: 3 });
  assert.equal(claim.total, 3);
});

test('an old offer without the new fields reads as "card row as rolled"', () => {
  const old = { cinders: 50, cardIds: ['stomp', 'rend', 'gildedOath'], flaskId: null, relicId: null };
  const plan = rewardPlan(old, { flaskSlotsFree: 1, armamentSlotsFree: 1 });
  assert.deepEqual(plan.rows.map((r) => r.key), ['cinders', 'card']);
  assert.deepEqual(rewardNotes(old), []);
});

test('the pending-reward save: levelCard states and picks are checked; an old save without them still loads', () => {
  const run = createRunState({ registries: REG, classId: 'reaver', seed: 11 });
  const pending = (extra) => ({
    schemaVersion: 1, source: 'normal', after: 'map', chosenCardId: null, chosenDraftCardIds: {}, chosenDraftNodeIds: {},
    rewards: { cinders: 50, cardIds: ['stomp', 'rend', 'gildedOath'] }, states: {}, ...extra,
  });
  const problems = (p) => validateRunShape({ ...run, pendingReward: p }).filter((m) => m.startsWith('pendingReward'));
  // Pre-§15.1 bytes: no levelCards, no cardMissed, no chosen map for them.
  const old = pending({});
  delete old.chosenDraftCardIds;
  assert.deepEqual(problems(old), []);
  // A levelled offer, its row taken with its pick.
  const levelled = pending({
    rewards: { cinders: 50, cardIds: [], cardMissed: true, levelCards: [{ ordinal: 0, cardIds: ['stomp', 'rend', 'gildedOath'] }] },
    states: { 'levelCard:0': 'taken' },
    chosenDraftCardIds: { 'levelCard:0': 'rend' },
  });
  assert.deepEqual(problems(levelled), []);
  // Refused by name: a Taken level card with no pick, a pick of a card it did not offer, a bad shape.
  assert.ok(problems({ ...levelled, chosenDraftCardIds: {} }).some((m) => /levelCard:0 Taken state requires its chosen card/.test(m)));
  assert.ok(problems({ ...levelled, chosenDraftCardIds: { 'levelCard:0': 'zzz' } }).some((m) => /levelCard:0 must name a card/.test(m)));
  assert.ok(problems({ ...levelled, rewards: { ...levelled.rewards, levelCards: 'x' } }).some((m) => /levelCards must be an array/.test(m)));
  assert.ok(problems({ ...levelled, rewards: { ...levelled.rewards, cardMissed: 'yes' } }).some((m) => /cardMissed must be a boolean/.test(m)));
  assert.ok(problems({ ...levelled, states: { 'levelCard:4': 'taken' } }).some((m) => /levelCard:4/.test(m)));
});

test('validation refuses a broken schedule by name', () => {
  assert.deepEqual(validateContent(contentBundle).errors, [], 'the shipped content validates');
  const broken = (patch) => {
    const bundle = { ...contentBundle, balance: { ...contentBundle.balance, rewards: { ...contentBundle.balance.rewards, cardRewards: { ...contentBundle.balance.rewards.cardRewards, ...patch } } } };
    return validateContent(bundle).errors.map((e) => `${e.path}: ${e.msg}`).join('\n');
  };
  assert.match(broken({ chancePct: { normal: 101, elite: 100, boss: 100 } }), /cardRewards\.chancePct\.normal/);
  assert.match(broken({ afterCombat: { normal: 'yes', elite: true, boss: true } }), /cardRewards\.afterCombat\.normal/);
  assert.match(broken({ onLevelUp: 1 }), /cardRewards\.onLevelUp/);
  assert.match(broken({ onLevelUpMaxPerFight: -1 }), /cardRewards\.onLevelUpMaxPerFight/);
  assert.match(broken({ surprise: 1 }), /cardRewards\.surprise/);
});

test('every schedule key has a generated Settings row with its own note, percents capped at 100', () => {
  const rows = advancedConfigRows(contentBundle).filter((r) => r.key.startsWith('gameConfig.balance.rewards.cardRewards.'));
  const keys = rows.map((r) => r.key.replace('gameConfig.balance.rewards.cardRewards.', '')).sort();
  assert.deepEqual(keys, [
    'afterCombat.boss', 'afterCombat.elite', 'afterCombat.normal',
    'chancePct.boss', 'chancePct.elite', 'chancePct.normal',
    'onLevelUp', 'onLevelUpMaxPerFight',
  ]);
  for (const row of rows) {
    assert.ok(!/^Authored balance value/.test(row.note), `${row.key} has its own note`);
    assert.ok(!/\{/.test(row.note), `${row.key}: every blank filled`);
  }
  for (const row of rows.filter((r) => r.key.includes('.chancePct.'))) {
    assert.equal(row.min, 0);
    assert.equal(row.max, 100);
  }
  assert.match(rows.find((r) => r.key.endsWith('afterCombat.elite')).note, /an elite fight/);
});

test('the reward screen draws the level card row, takes it through the chooser, and says a missed card in one line', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    assert.equal(t('reward.note.cardMissed'), 'No card this time.');
    assert.equal(t('reward.levelCard.title'), 'Level card');
    const app = document.createElement('main'); document.body.append(app);
    const run = { cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } };
    const checkpoint = { states: {}, chosenCardId: null, chosenDraftCardIds: {} };
    mountRewards(app, {
      registries: REG, run, checkpoint, onDone() {}, onPersist() {},
      rewards: { cardIds: [], cardMissed: true, levelCards: [{ ordinal: 0, cardIds: ['stomp', 'rend', 'gildedOath'] }] },
    });
    assert.ok(app.querySelector('.reward-note[data-note="cardMissed"]'), 'the missed chance is one line in the menu');
    assert.equal(app.querySelector('[data-kind="card"]'), null, 'and there is no card row');
    const row = app.querySelector('[data-kind="levelCard"]');
    assert.equal(row.dataset.key, 'levelCard:0');
    row.click();
    app.querySelectorAll('.reward-row .card')[1].click();
    app.querySelector('#reward-card-confirm').click();
    assert.deepEqual(run.deck.map((c) => c.cardId), ['rend']);
    assert.equal(checkpoint.states['levelCard:0'], 'taken');
    assert.deepEqual(checkpoint.chosenDraftCardIds, { 'levelCard:0': 'rend' });
    assert.equal(app.querySelector('[data-kind="levelCard"]').dataset.state, 'taken');
    // The checkpoint the screen wrote is one the save door accepts.
    const shape = createRunState({ registries: REG, classId: 'reaver', seed: 2 });
    const pendingReward = {
      schemaVersion: 1, source: 'normal', after: 'map', chosenDraftNodeIds: {},
      rewards: { cardIds: [], cardMissed: true, levelCards: [{ ordinal: 0, cardIds: ['stomp', 'rend', 'gildedOath'] }] }, ...checkpoint,
    };
    assert.deepEqual(validateRunShape({ ...shape, pendingReward }).filter((m) => m.startsWith('pendingReward')), []);
    app.remove();
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
});
