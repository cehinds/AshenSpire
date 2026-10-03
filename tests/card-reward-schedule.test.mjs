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
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { rollCardRewardIds, rollCombatCardOffer } from '../src/engine/encounters.js';
import { rewardPlan, resolveContinue, rewardClaimStatus, rewardNotes, REWARD_KIND_ORDER, rowKey, cardRewardPlan, cardRewardSchedule } from '../src/model/rewardplan.js';
import { resolveCard } from '../src/model/registries.js';
import { playCard, endTurn } from '../src/engine/coopCombat.js';
import { createSession } from '../tools/session.mjs';
import { createLevelCardPicks, levelCardStrips } from '../src/ui/screens/coop.js';
import { xpToNext } from '../src/model/levelup.js';
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

test('rewardRolls is appended after every stream before it, so no existing stream moves', () => {
  // `shopOffers` (SPEC §14.2) and then `sigils` (SPEC §15.4) were appended
  // after it; tests/shop-kinds.test.mjs and tests/legendary-sigils.test.mjs hold those.
  const at = STREAM_NAMES.indexOf('rewardRolls');
  assert.deepEqual(STREAM_NAMES.slice(at + 1), ['shopOffers', 'sigils']);
  assert.deepEqual(STREAM_NAMES.slice(0, at), [
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
    onLevelUp: true,
    onLevelUpMaxPerFight: 1,
  });
  // An older bundle without the block keeps its historical card schedule.
  const bare = { ...REG.balance, rewards: { ...REG.balance.rewards, cardRewards: undefined } };
  assert.equal(cardRewardSchedule(bare).onLevelUp, false);
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
    assert.equal(offer.cardMissed, false, 'a chance of 0 is "never", not a miss "this time"');
    assert.deepEqual(rewardNotes(offer.rewards), []);
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
    else {
      assert.equal(rng.getCounters().cardRewards, 0, 'a miss rolls no cards');
      assert.equal(offer.cardMissed, true, 'a real roll that misses says so');
      assert.deepEqual(rewardNotes(offer.rewards), ['cardMissed']);
    }
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
  // Off by choice: a level gained adds nothing and rolls nothing more.
  const rng = createRng(4);
  const off = rollCombatCardOffer(withSchedule({ onLevelUp: false }), rng, args('normal', { levelUps: 2 }));
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
  // Shipped schedule: always offer and never roll, including the level card.
  const shipped = createRng(9);
  assert.deepEqual(cardRewardPlan(REG.balance, { pool: 'boss', levelsGained: 4 }, shipped), { offerCard: true, cardMissed: false, levelCards: 1 });
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
  // This test is about the reward door. Prime the ledger so one modest fight
  // crosses the level threshold regardless of the currently tuned XP rate.
  host.livingMembers()[0].run.level.xp = xpToNext(reg, 1) - 1;
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
  // The shipped schedule offers the ordinary card and a level card.
  const shipped = coopFirstSpoils(REG, 'SCHEDULE');
  assert.equal(shipped.scene.offers.p1.cardIds.length, REG.balance.rewards.cardChoices);
  assert.equal(shipped.scene.offers.p1.levelCards.length, 1);
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

test('Falsify: with level cards switched off, 50 fixed seeds retain the old card offer bytes', () => {
  // THE BASELINE is the roll main.js made before the schedule: the draft
  // seat, else rollCardRewardIds straight — no chance, no level card. The
  // switched-off schedule must reproduce its ids AND leave every stream counter where it
  // left them, so every later roll in the seed is unchanged too.
  const before = (rng, a) => (a.draftWaiting ? [] : rollCardRewardIds(REG, rng, { classId: a.classId, pool: a.pool, relicIds: a.relicIds, flatRarity: a.flatRarity }));
  const withoutLevelCards = withSchedule({ onLevelUp: false });
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
      const offer = rollCombatCardOffer(withoutLevelCards, rng, a);
      assert.equal(JSON.stringify(offer.rewards), JSON.stringify(baseRewards), `seed ${seed} ${pool}: same offer bytes`);
      assert.deepEqual(rng.getCounters(), baseRng.getCounters(), `seed ${seed} ${pool}: same draws on every stream`);
    }
  }
});

test('the reward menu: levelCard is ordered after card, is a choice, is taken and skipped like the card offer', () => {
  assert.ok(REWARD_KIND_ORDER.indexOf('levelCard') > REWARD_KIND_ORDER.indexOf('card'));
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

test('two level cards are taken, and both picks persist in chosenDraftCardIds[<rowKey>] across a reload', () => {
  const reg = withSchedule({ onLevelUp: true, onLevelUpMaxPerFight: 2 });
  const offer = rollCombatCardOffer(reg, createRng(21), args('normal', { levelUps: 3 }));
  assert.equal(offer.levelCards.length, 2);
  const run = createRunState({ registries: REG, classId: 'reaver', seed: 21 });
  run.pendingReward = {
    schemaVersion: 1, source: 'normal', after: 'map', rewards: structuredClone(offer.rewards),
    states: {}, chosenCardId: null, chosenDraftCardIds: {}, chosenDraftNodeIds: {},
  };
  const deckBefore = run.deck.length;
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const mount = (r) => {
      const app = document.createElement('main'); document.body.append(app);
      mountRewards(app, { registries: REG, run: r, checkpoint: r.pendingReward, rewards: r.pendingReward.rewards, onDone() {}, onPersist() {} });
      return app;
    };
    const app = mount(run);
    const picks = {};
    for (const key of ['levelCard:0', 'levelCard:1']) {
      app.querySelector(`[data-key="${key}"]`).click();
      app.querySelectorAll('.reward-row .card')[2].click();
      picks[key] = app.querySelectorAll('.reward-row .card')[2].dataset.cardId;
      app.querySelector('#reward-card-confirm').click();
    }
    app.remove();
    assert.deepEqual(run.pendingReward.chosenDraftCardIds, picks, 'each pick is kept under its own row key');
    assert.deepEqual(run.deck.slice(deckBefore).map((c) => c.cardId), Object.values(picks));
    // The reload: the bytes a save holds, read back through the load door.
    const back = deserializeRun(serializeRun(run));
    assert.deepEqual(validateRunShape(back).filter((m) => m.startsWith('pendingReward')), []);
    assert.deepEqual(back.pendingReward.chosenDraftCardIds, picks);
    assert.deepEqual(back.pendingReward.states, { 'levelCard:0': 'taken', 'levelCard:1': 'taken' });
    const again = mount(back);
    assert.deepEqual(again.querySelectorAll('.reward-kind[data-kind="levelCard"]').map((row) => row.dataset.state), ['taken', 'taken'], 'the resumed door shows both rows taken');
    again.remove();
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
});

test('a Taken levelCard row with no chosenDraftCardIds map at all is refused by name', () => {
  const run = createRunState({ registries: REG, classId: 'reaver', seed: 3 });
  const pendingReward = {
    schemaVersion: 1, source: 'normal', after: 'map', chosenCardId: null, chosenDraftNodeIds: {},
    rewards: { cardIds: [], levelCards: [{ ordinal: 0, cardIds: ['stomp', 'rend', 'gildedOath'] }] },
    states: { 'levelCard:0': 'taken' },
  };
  assert.ok(validateRunShape({ ...run, pendingReward }).some((m) => /levelCard:0 Taken state requires its chosen card/.test(m)));
});

test('a co-op seat that was away claims its level card through the catch-up', () => {
  const reg = withSchedule({ onLevelUp: true });
  const host = createSession({ registries: reg, seedString: 'AWAY' });
  for (const id of ['p1', 'p2']) host.addMember({ id, name: id, classId: 'reaver' });
  host.start();
  for (const member of host.livingMembers()) member.run.level.xp = xpToNext(reg, 1) - 1;
  for (const id of ['p1', 'p2']) host.chooseNode(id, host.session.mapGraph.startIds[0]);
  for (const enemy of host.live.combat.enemies) enemy.hp = 1;
  host.setConnected('p2', false);
  host.autoResolveCombat(botTurn);
  const p2 = host.livingMembers().find((m) => m.id === 'p2');
  const debt = p2.catchup.find((item) => item.type === 'reward');
  assert.ok(debt, 'the away seat owes a reward');
  assert.equal(debt.offer.levelCards?.length, 1, "the away seat levelled in the fight and is owed a level card");
  const picked = debt.offer.levelCards[0].cardIds[0];
  const before = p2.run.deck.length;
  host.setConnected('p2', true);
  assert.equal(host.resolveCatchup('p2', p2.catchup.indexOf(debt), { levelCardIds: { 0: picked } }).ok, true);
  assert.equal(p2.run.deck.length, before + 1);
  assert.equal(p2.run.deck.at(-1).cardId, picked);
});

test('co-op: a level-card pick survives a redraw, and a row left unpicked is picked for the seat on close', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const offer = { cardIds: ['stomp'], levelCards: [{ ordinal: 0, cardIds: ['rend', 'gildedOath', 'stomp'] }] };
    const store = createLevelCardPicks();
    const draw = (snapshotOffer) => {
      const app = document.createElement('main'); document.body.append(app);
      app.append(...levelCardStrips(REG, snapshotOffer, store.picksFor('p1|reward|1', snapshotOffer)));
      return app;
    };
    const first = draw(offer);
    first.querySelectorAll('.coop-level-card .card')[1].click();
    first.remove();
    // Another seat chooses: a fresh snapshot (a new object, same offer) redraws the door.
    const redrawn = draw(structuredClone(offer));
    assert.deepEqual(redrawn.querySelectorAll('.coop-level-card .is-chosen').map((c) => c.dataset.cardId), ['gildedOath'], 'the tap is still lit');
    assert.deepEqual(store.picksFor('p1|reward|1', offer), { 0: 'gildedOath' }, 'and still rides with the close');
    redrawn.remove();
    // A new offer starts clean.
    assert.deepEqual(store.picksFor('p1|reward|2', { levelCards: [{ ordinal: 0, cardIds: ['rend'] }] }), {});
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
  // The host: closing with the plain card only still grants the level card.
  const host = coopFirstSpoils(withSchedule({ onLevelUp: true }), 'SCHEDULE');
  const spoils = host.scene.offers.p1;
  const deck = host.livingMembers()[0].run.deck;
  const before = deck.length;
  assert.equal(host.chooseReward('p1', { cardId: spoils.cardIds[0] }).ok, true);
  assert.equal(deck.length, before + 2, 'the card and the auto-picked level card');
  assert.ok(spoils.levelCards[0].cardIds.includes(deck.at(-1).cardId));
});

test('a taken level card never reuses an instance id a sideboarded card holds', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    // The id `r0_rend` is what a naive `r${deck.length}_…` would mint into an empty deck.
    const run = { cinders: 0, deck: [], sideboard: [{ instanceId: 'r0_rend', cardId: 'rend', upgraded: false }], flasks: [], relics: [], loadout: { storage: [] } };
    const checkpoint = { states: {}, chosenCardId: null, chosenDraftCardIds: {} };
    const app = document.createElement('main'); document.body.append(app);
    mountRewards(app, { registries: REG, run, checkpoint, onDone() {}, onPersist() {}, rewards: { cardIds: [], levelCards: [{ ordinal: 0, cardIds: ['rend', 'stomp'] }] } });
    app.querySelector('[data-kind="levelCard"]').click();
    app.querySelectorAll('.reward-row .card')[0].click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(run.deck.length, 1);
    assert.equal(run.deck[0].cardId, 'rend');
    assert.notEqual(run.deck[0].instanceId, 'r0_rend', 'the sideboarded id is not reused');
    const ids = [...run.deck, ...run.sideboard].map((c) => c.instanceId);
    assert.equal(new Set(ids).size, ids.length, 'every instance id is unique across deck and sideboard');
    app.remove();
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
});

test('run schema 12: a schema-11 save (the captured corpus bytes) loads unchanged, and a pending level card rides a v12 save', async () => {
  const { readFileSync } = await import('node:fs');
  const { RUN_SCHEMA_VERSION } = await import('../src/model/state.js');
  // 12 is this section's bump; later ones (13: the refined-stone purse, §15.3) sit above it.
  assert.ok(RUN_SCHEMA_VERSION >= 12);
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const v11 = JSON.parse(corpus.versions['11'].bytes);
  assert.equal(v11.schemaVersion, 11);
  const loaded = deserializeRun(corpus.versions['11'].bytes);
  // 11 → 12 is a no-op: every field the v11 build wrote reads back as written,
  // and only the stamp (and its migration receipt) moves.
  const { schemaVersion, migratedFromRunSchemaVersion, ...rest } = loaded;
  assert.equal(schemaVersion, RUN_SCHEMA_VERSION);
  assert.equal(migratedFromRunSchemaVersion, 11);
  const { schemaVersion: _was, ...writtenAt11 } = v11;
  for (const [key, value] of Object.entries(writtenAt11)) assert.deepEqual(rest[key], value, `field '${key}' is unchanged`);
  // A v12 save with a pending level card round-trips.
  const run = createRunState({ registries: REG, classId: 'reaver', seed: 5 });
  run.pendingReward = { schemaVersion: 1, source: 'normal', after: 'map', chosenCardId: null, chosenDraftNodeIds: {},
    rewards: { cardIds: [], levelCards: [{ ordinal: 0, cardIds: ['stomp', 'rend'] }] }, states: {}, chosenDraftCardIds: {} };
  const back = deserializeRun(serializeRun(run));
  assert.equal(back.schemaVersion, RUN_SCHEMA_VERSION);
  assert.deepEqual(back.pendingReward.rewards.levelCards, run.pendingReward.rewards.levelCards);
});

test('co-op couch seats: a level-card pick on seat A survives switching to seat B and back, and ends with its door', () => {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const offerA = { cardIds: [], levelCards: [{ ordinal: 0, cardIds: ['rend', 'gildedOath', 'stomp'] }] };
    const offerB = { cardIds: [], levelCards: [{ ordinal: 0, cardIds: ['stomp', 'rend', 'gildedOath'] }] };
    const store = createLevelCardPicks();
    // renderReward's own key for a seat: `${seat}|reward|${floor}`.
    const draw = (seat, offer) => {
      const app = document.createElement('main'); document.body.append(app);
      const picks = store.picksFor(`${seat}|reward|3`, offer);
      app.append(...levelCardStrips(REG, structuredClone(offer), picks));
      return { app, picks };
    };
    const a = draw('p1', offerA);
    a.app.querySelectorAll('.coop-level-card .card')[2].click();
    a.app.remove();
    const b = draw('p2', offerB); // the Tab: seat B's door
    b.app.querySelectorAll('.coop-level-card .card')[0].click();
    b.app.remove();
    const back = draw('p1', offerA); // and back to seat A
    assert.deepEqual(back.app.querySelectorAll('.coop-level-card .is-chosen').map((c) => c.dataset.cardId), ['stomp'], 'A\'s pick is still lit');
    assert.deepEqual(back.picks, { 0: 'stomp' }, 'and is what A\'s close sends');
    assert.deepEqual(store.picksFor('p2|reward|3', offerB), { 0: 'stomp' }, 'B kept its own pick');
    back.app.remove();
    // Seat A's offer resolves (A chose): its entry goes; B's open door keeps its own.
    store.retain((key) => key !== 'p1|reward|3');
    assert.deepEqual(store.keys(), ['p2|reward|3']);
    assert.deepEqual(store.picksFor('p1|reward|3', offerA), {}, 'a resolved door leaves no pick behind');
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
});

test('co-op: a repeat choice while another seat still chooses grants nothing twice', () => {
  const host = createSession({ registries: withSchedule({ onLevelUp: true }), seedString: 'SCHEDULE' });
  host.addMember({ id: 'p1', name: 'p1', classId: 'reaver' });
  host.addMember({ id: 'p2', name: 'p2', classId: 'rogue' });
  host.setConnectedMany(['p1', 'p2'], true);
  host.start();
  for (const member of host.livingMembers()) member.run.level.xp = xpToNext(REG, 1) - 1;
  host.chooseNode('p1', host.session.mapGraph.startIds[0]);
  if (host.scene.kind !== 'reward') {
    for (const id of ['p2']) { try { host.chooseNode(id, host.session.mapGraph.startIds[0]); } catch {} }
  }
  if (host.live && host.live.combat) {
    for (const enemy of host.live.combat.enemies) enemy.hp = 1;
    host.autoResolveCombat(botTurn);
  }
  assert.equal(host.scene.kind, 'reward', 'both seats are at the spoils');
  const p1 = host.livingMembers().find((m) => m.id === 'p1');
  const before = p1.run.deck.length;
  const offer = host.scene.offers.p1;
  const picks = Object.fromEntries((offer.levelCards || []).map((row, i) => [row.ordinal ?? i, row.cardIds[0]]));
  assert.equal(host.chooseReward('p1', { levelCardIds: picks }).ok, true);
  const once = p1.run.deck.length;
  assert.ok(once > before, 'the level card is taken once');
  assert.equal(host.scene.kind, 'reward', 'p2 is still choosing');
  assert.deepEqual(host.chooseReward('p1', { levelCardIds: picks }), { ok: false, error: 'already chosen' });
  assert.equal(p1.run.deck.length, once, 'the repeat grants nothing');
});
