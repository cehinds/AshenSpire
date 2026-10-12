// alternative-combat-rounds: tests for the timeline model (node:test).
// Owner's round model, 2026-10-11. Run: node --test docs/alternative-combat-rounds/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as timeline from './timeline.mjs';
import {
  makeCombatant,
  plannedSpeed,
  buildTimeline,
  createRound,
  makeFight,
  adaptEnemyQueues,
  adaptChance,
  MERGE_MODES,
} from './timeline.mjs';
import { parseStanceAdvantage, parseEvasionCards, targetOutline } from './resolver.mjs';

// Rng helpers. d4 = floor(u*4)+1: u 0 -> 1, 0.3 -> 2, 0.5 -> 3, 0.75 -> 4.
const constRng = (u) => () => u;
function seqRng(values) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng overrun');
    return values[i++];
  };
}
function countingRng(u) {
  const box = { calls: 0 };
  const rng = () => {
    box.calls += 1;
    return u;
  };
  return { rng, box };
}

const card = (id, kind, target, speed, extra = {}) => ({ id, kind, target, speed, ...extra });
const atk = (id, target, speed, extra = {}) => card(id, 'attack', target, speed, { damage: 1, ...extra });

// DEX 1 gives base floor(1/2) = 0 and accuracy/evasion 1/0, so only d4 and
// momentum move initiative in these cases.
const mk = (id, extra = {}) => makeCombatant({ id, attrs: { DEX: 1 }, hp: 10, sp: 3, ...extra });

function trio() {
  return {
    player: mk('player', { hp: 20 }),
    goblin: mk('goblin'),
    wolf: mk('wolf', { hp: 8 }),
  };
}
const TRIO_RNG = [0, 0.75, 0.3]; // d4: player 1, goblin 4, wolf 2
const trioQueues = () => ({
  player: [atk('jab', 'goblin', 6), atk('slash', 'wolf', 3)],
  goblin: [atk('stab', 'player', 2)],
  wolf: [atk('bite', 'player', 1), atk('claw', 'player', 2)],
});
const ids = (entries) => entries.map((e) => e.cardId);

test('makeCombatant validates side and id and reads DEX for evasion', () => {
  const p = mk('player');
  assert.equal(p.side, 'player');
  assert.equal(mk('goblin').side, 'enemy');
  assert.throws(() => makeCombatant({ id: 'goblin', side: 'player', hp: 1 }), TypeError);
  assert.throws(() => makeCombatant({ id: 'player', side: 'enemy', hp: 1 }), TypeError);
  assert.equal(p.evasion, 0); // Cloth: min(DEX - 1, 4) = 0 at DEX 1
});

test('MERGE_MODES lists the three owner modes', () => {
  assert.deepEqual([...MERGE_MODES], ['speed', 'roundRobin', 'wholeQueue']);
});

test("merge 'speed' orders all queued actions by action speed, descending", () => {
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(trioQueues(), {
    combatants: { player, goblin, wolf }, rng: seqRng(TRIO_RNG), merge: 'speed',
  });
  // Totals: jab 6+1=7, stab 2+4=6, slash 3+1=4, bite 1+2=3, claw 2+2=4 (effective 3).
  assert.deepEqual(ids(tl.entries), ['jab', 'stab', 'slash', 'bite', 'claw']);
  assert.equal(tl.merge, 'speed');
});

test("merge 'roundRobin' takes each combatant's pass in initiative order", () => {
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(trioQueues(), {
    combatants: { player, goblin, wolf }, rng: seqRng(TRIO_RNG), merge: 'roundRobin',
  });
  // Lead initiative: goblin 4, wolf 2, player 1. Pass 0: stab, bite, jab. Pass 1: claw, slash.
  assert.deepEqual(ids(tl.entries), ['stab', 'bite', 'jab', 'claw', 'slash']);
});

test("merge 'wholeQueue' plays the highest-initiative combatant's whole queue first", () => {
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(trioQueues(), {
    combatants: { player, goblin, wolf }, rng: seqRng(TRIO_RNG), merge: 'wholeQueue',
  });
  assert.deepEqual(ids(tl.entries), ['stab', 'bite', 'claw', 'jab', 'slash']);
});

test('the three modes give three different orders for the same known case', () => {
  const orders = MERGE_MODES.map((merge) => {
    const { player, goblin, wolf } = trio();
    return ids(buildTimeline(trioQueues(), {
      combatants: { player, goblin, wolf }, rng: seqRng(TRIO_RNG), merge,
    }).entries).join(',');
  });
  assert.equal(new Set(orders).size, 3);
});

test("merge 'speed' never puts a later card before its earlier card in the same queue", () => {
  // Both player cards, d4 1 each. A targets goblin (M -2, term -1), B targets wolf
  // (M +2, term +1). A totals 6 + (1 - 1) = 6. B totals 4 + (1 + 1) = 6, and B has the
  // higher initiative, so a plain sort by initiative would put B first. The queue must not break.
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(
    { player: [atk('A', 'goblin', 6), atk('B', 'wolf', 4)] },
    {
      combatants: { player, goblin, wolf },
      rng: constRng(0),
      momentum: { goblin: -2, wolf: 2 },
      merge: 'speed',
    },
  );
  assert.deepEqual(ids(tl.entries), ['A', 'B']);
  assert.equal(tl.entries[1].speed.effective, 6);
});

test('ties on action speed: higher initiative first, then player first', () => {
  const goblinHigherInit = buildTimeline(
    { player: [atk('p', 'goblin', 4)], goblin: [atk('g', 'player', 2)] },
    {
      combatants: { player: mk('player'), goblin: mk('goblin') },
      rng: seqRng([0, 0.5]), // player d4 1 -> total 5; goblin d4 3 -> total 5
      merge: 'speed',
    },
  );
  assert.deepEqual(ids(goblinHigherInit.entries), ['g', 'p']);

  const fullTie = buildTimeline(
    { player: [atk('p', 'goblin', 3)], goblin: [atk('g', 'player', 3)] },
    {
      combatants: { player: mk('player'), goblin: mk('goblin') },
      rng: seqRng([0.3, 0.3]), // both d4 2 -> both total 5
      merge: 'speed',
    },
  );
  assert.deepEqual(ids(fullTie.entries), ['p', 'g']);
});

test('each entry breaks its speed into card, base, d4 and momentum terms', () => {
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(trioQueues(), {
    combatants: { player, goblin, wolf },
    rng: seqRng(TRIO_RNG),
    momentum: { goblin: 2 }, // momentumSpeed(2) = 1
    merge: 'speed',
  });
  const jab = tl.entries.find((e) => e.cardId === 'jab');
  assert.deepEqual(
    { card: jab.speed.card, base: jab.speed.base, d4: jab.speed.d4, momentum: jab.speed.momentum, total: jab.speed.total },
    { card: 6, base: 0, d4: 1, momentum: 1, total: 8 },
  );
  const stab = tl.entries.find((e) => e.cardId === 'stab');
  // Enemy action: the momentum term is -momentumSpeed(M_goblin) = -1.
  assert.equal(stab.speed.momentum, -1);
  assert.equal(stab.speed.d4, 4);
  assert.equal(stab.speed.total, 5);
  assert.equal(tl.initiative.goblin.d4, 4);
  assert.equal(tl.initiative.player.base, 0);
});

test('a preemptive defensive card reports its raw speed; the buff is a separate term', () => {
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(
    { player: [card('guard', 'guard', 'self', 5)], goblin: [atk('stab', 'player', 5)], wolf: [] },
    {
      combatants: { player, goblin, wolf },
      rng: seqRng(TRIO_RNG),
      momentum: { goblin: 2 }, // momentumSpeed(2) = 1, so the enemy term is -1
      merge: 'speed',
    },
  );
  const sumTerms = (s) => s.card + s.buff + s.base + s.d4 + s.momentum;
  const guard = tl.entries.find((e) => e.cardId === 'guard');
  assert.equal(guard.speed.card, 5);
  assert.equal(guard.speed.buff, 1);
  assert.equal(sumTerms(guard.speed), guard.speed.total);
  assert.equal(guard.speed.total, 7); // 5 + 1 + (base 0 + d4 1 + momentum 0)

  const stab = tl.entries.find((e) => e.cardId === 'stab');
  assert.equal(stab.speed.card, 5);
  assert.equal(stab.speed.buff, 0);
  assert.equal(sumTerms(stab.speed), stab.speed.total);
  assert.equal(stab.speed.total, 8); // 5 + 0 + (base 0 + d4 4 + momentum -1)
});

test('momentum term keeps its sign for the player and the enemy', () => {
  const { player, goblin, wolf } = trio();
  const tl = buildTimeline(trioQueues(), {
    combatants: { player, goblin, wolf },
    rng: seqRng(TRIO_RNG),
    momentum: { goblin: -3 }, // momentumSpeed(-3) = -1
    merge: 'speed',
  });
  assert.equal(tl.entries.find((e) => e.cardId === 'jab').speed.momentum, -1);
  assert.equal(tl.entries.find((e) => e.cardId === 'stab').speed.momentum, 1);
});

test('d4 is rolled exactly once per combatant, from the injected rng', () => {
  const { player, goblin, wolf } = trio();
  const { rng, box } = countingRng(0.1);
  buildTimeline(trioQueues(), { combatants: { player, goblin, wolf }, rng });
  assert.equal(box.calls, 3);
});

test('a seeded rng gives the same timeline every time', () => {
  const seeded = (seed) => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  };
  const run = () => {
    const { player, goblin, wolf } = trio();
    return buildTimeline(trioQueues(), { combatants: { player, goblin, wolf }, rng: seeded(42), merge: 'roundRobin' });
  };
  assert.deepEqual(run(), run());
});

test('buildTimeline rejects a queue whose SP costs exceed the combatant SP', () => {
  const { player, goblin, wolf } = trio();
  const queues = { player: [atk('a', 'goblin', 1, { sp: 2 }), atk('b', 'goblin', 1, { sp: 2 })] };
  // A 2-SP card and another 2-SP card cost 4; player has 3.
  assert.throws(
    () => buildTimeline(queues, { combatants: { player, goblin, wolf }, rng: constRng(0) }),
    RangeError,
  );
});

test('a card with no sp costs 1, so three 1-SP cards fit in 3 SP', () => {
  const { player, goblin, wolf } = trio();
  const queues = { player: [atk('a', 'goblin', 1), atk('b', 'goblin', 1), atk('c', 'goblin', 1)] };
  const tl = buildTimeline(queues, { combatants: { player, goblin, wolf }, rng: constRng(0) });
  assert.equal(tl.entries.length, 3);
  assert.deepEqual(tl.entries.map((e) => e.card.sp), [1, 1, 1]);
});

test('a Strike (1 SP) and a Smash (2 SP) fit in 3 SP; adding a 1-SP card does not', () => {
  const { player, goblin, wolf } = trio();
  const strike = atk('strike', 'goblin', 1, { sp: 1 });
  const smash = atk('smash', 'goblin', 1, { sp: 2 });
  const fits = buildTimeline({ player: [strike, smash] }, { combatants: { player, goblin, wolf }, rng: constRng(0) });
  assert.deepEqual(fits.entries.map((e) => e.cardId), ['strike', 'smash']);
  assert.throws(
    () => buildTimeline({ player: [strike, smash, atk('extra', 'goblin', 1, { sp: 1 })] }, {
      combatants: { player, goblin, wolf }, rng: constRng(0),
    }),
    RangeError,
  );
});

test('SP defaults: DEFAULT_SP is 3 and the old CARD_SP_COST export is gone', () => {
  assert.equal(timeline.DEFAULT_SP, 3);
  assert.equal(Object.hasOwn(timeline, 'CARD_SP_COST'), false);
  assert.equal(makeCombatant({ id: 'goblin', hp: 1 }).sp, 3);
});

test('buildTimeline rejects a target that is not a foe of the actor', () => {
  const { player, goblin, wolf } = trio();
  assert.throws(
    () => buildTimeline({ player: [atk('x', 'nobody', 1)] }, { combatants: { player, goblin, wolf }, rng: constRng(0) }),
    TypeError,
  );
  assert.throws(
    () => buildTimeline({ goblin: [atk('y', 'goblin', 1)] }, { combatants: { player, goblin, wolf }, rng: constRng(0) }),
    TypeError,
  );
  assert.throws(
    () => buildTimeline({}, { combatants: { player, goblin, wolf }, rng: constRng(0), merge: 'nope' }),
    RangeError,
  );
});

// ---- Round resolution (step API, hit roll, block, evade, intangible, hp) ----

// Constant u = 0.45: d4 2, d20 10 (hits need 7 at DEX 1), evade roll 45.
const HIT_RNG = constRng(0.45);
const fightOf = (specs) => makeFight(specs);
const duo = (goblinExtra = {}, playerExtra = {}) => fightOf([
  { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 3, ...playerExtra },
  { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 3, ...goblinExtra },
]);

test('makeFight builds combatants keyed by id, with empty momentum and charges', () => {
  const st = duo();
  assert.deepEqual(Object.keys(st.combatants), ['player', 'goblin']);
  assert.deepEqual(st.momentum, {});
  assert.equal(st.combatants.goblin.hp, 10);
});

test('a landed attack reduces the target hp by its damage', () => {
  const round = createRound(duo(), {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 5 })] },
    rng: HIT_RNG,
  });
  const out = round.resolveAll();
  const hit = out.events.find((e) => e.type === 'hit');
  assert.deepEqual([hit.by, hit.target, hit.d20, hit.hit], ['player', 'goblin', 10, true]);
  const dmg = out.events.find((e) => e.type === 'damage');
  assert.deepEqual([dmg.target, dmg.amount, dmg.hp], ['goblin', 5, 5]);
  assert.equal(out.state.combatants.goblin.hp, 5);
});

test('a miss leaves hp unchanged (natural 1 always misses)', () => {
  const round = createRound(duo(), {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 5 })] },
    rng: constRng(0),
  });
  const out = round.resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').hit, false);
  assert.equal(out.events.some((e) => e.type === 'damage'), false);
  assert.equal(out.state.combatants.goblin.hp, 10);
});

test('next() resolves one action and returns the state after it', () => {
  const round = createRound(duo(), {
    queues: {
      player: [atk('jab', 'goblin', 6, { damage: 5 })],
      goblin: [atk('stab', 'player', 2, { damage: 3 })],
    },
    rng: HIT_RNG,
  });
  const first = round.next();
  assert.equal(first.entry.cardId, 'jab');
  assert.equal(first.done, false);
  assert.equal(first.state.combatants.goblin.hp, 5);
  assert.equal(first.state.combatants.player.hp, 20);
  const second = round.next();
  assert.equal(second.entry.cardId, 'stab');
  assert.equal(second.state.combatants.player.hp, 17);
  const end = round.next();
  assert.equal(end.done, true);
  assert.equal(end.entry, null);
  // resolveAll on a finished round adds no events.
  assert.deepEqual(round.resolveAll().events, []);
});

test('a state snapshot is a copy, not a live view of the round', () => {
  const round = createRound(duo(), {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 5 })] },
    rng: HIT_RNG,
  });
  const r = round.next();
  r.state.combatants.goblin.hp = 999;
  assert.equal(round.state.combatants.goblin.hp, 5);
});

test('a defeated combatant skips its remaining actions; a dead target is skipped too', () => {
  const round = createRound(
    duo({ hp: 3 }),
    {
      queues: {
        player: [atk('jab', 'goblin', 6, { damage: 5 }), atk('jab2', 'goblin', 1, { damage: 1 })],
        goblin: [atk('stab', 'player', 0, { damage: 3 })],
      },
      rng: HIT_RNG,
    },
  );
  const out = round.resolveAll();
  // Order: jab (total 8), jab2 (total 3), stab (total 2).
  assert.deepEqual(out.timeline.entries.map((e) => e.cardId), ['jab', 'jab2', 'stab']);
  assert.ok(out.events.some((e) => e.type === 'defeated' && e.id === 'goblin'));
  assert.deepEqual(
    out.events.filter((e) => e.type === 'skipped').map((e) => [e.cardId, e.reason]),
    [['jab2', 'targetDefeated'], ['stab', 'defeated']],
  );
  assert.equal(out.state.combatants.goblin.hp, 0);
  assert.equal(out.state.combatants.player.hp, 20);
});

test('an intangible charge avoids a hit that would land, and is spent', () => {
  const st = duo({ tags: ['intangible'], intangibleCharges: 1 });
  const out = createRound(st, {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 5 })] },
    rng: HIT_RNG,
  }).resolveAll();
  const ev = out.events.find((e) => e.type === 'evaded');
  assert.deepEqual([ev.reason, ev.charges], ['intangible', 0]);
  assert.equal(out.state.combatants.goblin.hp, 10);
  assert.equal(out.state.charges.goblin, 0);
});

test('a base evadePct roll below the percent avoids the hit', () => {
  // Roll is floor(0.45 * 100) = 45. 45 < 50, so the attack is evaded.
  const out = createRound(duo({ evadeBasePct: 50 }), {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 5 })] },
    rng: HIT_RNG,
  }).resolveAll();
  const roll = out.events.find((e) => e.type === 'evadeRoll');
  assert.deepEqual([roll.evadePct, roll.roll, roll.success], [50, 45, true]);
  assert.equal(out.events.find((e) => e.type === 'evaded').reason, 'evasion');
  assert.equal(out.state.combatants.goblin.hp, 10);
});

test('an evadePct roll at or above the percent lets the hit land', () => {
  // Roll 45 is not below 40, so the hit lands.
  const out = createRound(duo({ evadeBasePct: 40 }), {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 5 })] },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'evadeRoll').success, false);
  assert.equal(out.state.combatants.goblin.hp, 5);
});

// ---- Defensive cards: preemptive (queued) and reaction (in hand) ----

// Draws `values` in order, then `fallback` forever.
function rngThen(values, fallback) {
  let i = 0;
  return () => (i < values.length ? values[i++] : fallback);
}
const guardCard = (id = 'guard', extra = {}) => card(id, 'guard', 'self', 5, extra);
const stab = (speed, damage) => atk('stab', 'player', speed, { damage });

test('a preemptive guard gets +1 speed and +2 block; a reaction guard uses base 6', () => {
  // d4 2 each. Guard: 5 + 1 + 2 = 8. Stab: 1 + 2 = 3. The guard resolves first.
  const st = duo({}, { hp: 20 });
  const round = createRound(st, {
    queues: { player: [guardCard()], goblin: [stab(1, 10)] },
    rng: HIT_RNG,
  });
  const out = round.resolveAll();
  assert.deepEqual(out.timeline.entries.map((e) => e.cardId), ['guard', 'stab']);
  assert.equal(out.timeline.entries[0].speed.buff, 1);
  assert.equal(out.events.find((e) => e.type === 'guardUp').block, 8);
  // Block 8 absorbs 8 of the 10 damage.
  assert.equal(out.state.combatants.player.hp, 18);

  const reaction = createRound(duo({}, { hp: 20, hand: [guardCard()] }), {
    queues: { goblin: [stab(1, 10)] },
    rng: HIT_RNG,
    onReaction: () => ({ id: 'guard' }),
  }).resolveAll();
  assert.equal(reaction.events.find((e) => e.type === 'reaction').cardId, 'guard');
  // Reaction block is the base 6, so 4 of the 10 damage lands.
  assert.equal(reaction.state.combatants.player.hp, 16);
});

test('a guard block that covers the whole hit absorbs it and keeps the rest', () => {
  // A trailing 'other' card (total 2) keeps the round open after the stab (total 3).
  const round = createRound(duo({}, { hp: 20 }), {
    queues: { player: [guardCard(), card('x', 'other', 'self', 0)], goblin: [stab(1, 6)] },
    rng: HIT_RNG,
  });
  round.next(); // guard: block 8
  assert.equal(round.state.active.player.guard, 8);
  const hit = round.next(); // stab 6: fully absorbed, 2 left
  assert.ok(hit.events.some((e) => e.type === 'absorbed' && e.amount === 6));
  assert.equal(hit.state.active.player.guard, 2);
  assert.equal(hit.state.combatants.player.hp, 20);
  assert.equal(round.resolveAll().state.active.player.guard, 0); // the round ends and clears it
});

test('a reaction guard covers only its own attack: its leftover block is discarded', () => {
  // Reaction guard block 6 meets a 2-damage attack: 4 is left over. A later 4-damage attack
  // must not be absorbed by that leftover (owner, Codex finding, 2026-10-11).
  const round = createRound(duo({}, { hp: 20, hand: [guardCard()] }), {
    queues: { goblin: [atk('a', 'player', 3, { damage: 2 }), atk('b', 'player', 1, { damage: 4 })] },
    rng: HIT_RNG,
    onReaction: () => ({ id: 'guard' }),
  });
  const first = round.next();
  assert.equal(first.entry.cardId, 'a');
  assert.equal(first.events.find((e) => e.type === 'reaction').cardId, 'guard');
  assert.equal(first.state.active.player.guard, 0);
  assert.deepEqual(first.state.active.player.guardCards, []);
  assert.equal(first.state.combatants.player.hp, 20);
  const out = round.resolveAll();
  assert.equal(out.events.some((e) => e.type === 'reaction'), false);
  assert.equal(out.state.combatants.player.hp, 16);
});

test('a reaction guard block is spent before a queued guard block; the queued block is kept', () => {
  // Queued guard qg: block 8 (5 + 1 + 2). Reaction guard rg: base block 6. The 5-damage attack
  // is absorbed by the reaction first: 5 of its 6 is used and 1 is discarded. The queued 8 is
  // untouched, so the 8-damage attack after it is fully absorbed too.
  const round = createRound(duo({}, { hp: 20, hand: [guardCard('rg')] }), {
    queues: {
      player: [guardCard('qg')],
      goblin: [atk('a', 'player', 1, { damage: 5 }), atk('b', 'player', 1, { damage: 8 })],
    },
    rng: HIT_RNG,
    onReaction: () => ({ id: 'rg' }),
  });
  round.next(); // queued guard: block 8
  const first = round.next(); // a: 5 damage
  assert.equal(first.events.find((e) => e.type === 'reaction').cardId, 'rg');
  assert.ok(first.events.some((e) => e.type === 'absorbed' && e.amount === 5));
  assert.ok(first.events.some((e) => e.type === 'guardDiscard' && e.cardId === 'rg' && e.amount === 1));
  assert.equal(first.state.active.player.guard, 8);
  assert.deepEqual(first.state.active.player.guardCards.map((g) => [g.cardId, g.left]), [['qg', 8]]);
  assert.equal(first.state.combatants.player.hp, 20);
  const out = round.resolveAll(); // b: 8 damage against the queued 8
  assert.equal(out.events.some((e) => e.type === 'guardDiscard' && e.cardId === 'qg'), false);
  assert.equal(out.state.active.player.guard, 0);
  assert.equal(out.state.combatants.player.hp, 20);
});

test('a reaction guard keeps the queued counter, and its remainder gives no block to a later attack', () => {
  // The reaction guard (block 6) answers the 2-damage attack a, so the queued counter (speed 6)
  // does not cancel a; it waits and cancels b. The guard's remainder 4 is discarded after a.
  const st = duo({}, { hp: 20, hand: [guardCard()] });
  const out = createRound(st, {
    queues: {
      player: [card('counter', 'counter', 'goblin', 6)],
      goblin: [atk('a', 'player', 3, { damage: 2 }), atk('b', 'player', 1, { damage: 4 })],
    },
    rng: HIT_RNG,
    onReaction: (attack) => (attack.cardId === 'a' ? { id: 'guard' } : null),
  }).resolveAll();
  const at = (type, cardId) => out.events.findIndex((e) => e.type === type && e.cardId === cardId);
  assert.equal(out.events.some((e) => e.type === 'reaction' && e.cardId === 'guard'), true);
  assert.ok(out.events.some((e) => e.type === 'guardDiscard' && e.cardId === 'guard' && e.amount === 4));
  assert.ok(at('countered', 'counter') > at('action', 'b'));
  assert.equal(out.state.active.player.guard, 0);
  assert.equal(out.state.combatants.player.hp, 20);
});

test('onReaction is offered only to the player, and only when SP is left for the card', () => {
  const calls = [];
  const onReaction = (attack, eligible) => {
    calls.push({ attack, eligible: eligible.map((c) => c.id) });
    return null;
  };
  // Three queued 1-SP cards use all 3 SP, so no reaction is offered.
  const spent = createRound(duo({}, { hand: [guardCard()] }), {
    queues: {
      player: [card('x', 'other', 'self', 1), card('y', 'other', 'self', 1), card('z', 'other', 'self', 1)],
      goblin: [stab(1, 4)],
    },
    rng: HIT_RNG,
    onReaction,
  }).resolveAll();
  assert.equal(calls.length, 0);
  assert.equal(spent.state.combatants.player.hp, 16);

  // Two queued 1-SP cards leave 1 SP: the guard (cost 1) is eligible and offered.
  createRound(duo({}, { hand: [guardCard()] }), {
    queues: { player: [card('x', 'other', 'self', 1), card('y', 'other', 'self', 1)], goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction,
  }).resolveAll();
  assert.deepEqual(calls.map((c) => c.eligible), [['guard']]);
  assert.deepEqual(
    [calls[0].attack.attacker, calls[0].attack.target, calls[0].attack.damage],
    ['goblin', 'player', 4],
  );

  // Enemies never react: the goblin is hit, but the player's hand is not offered.
  const enemyHand = createRound(duo({ hand: [guardCard()] }), {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 1 })] },
    rng: HIT_RNG,
    onReaction,
  }).resolveAll();
  assert.equal(enemyHand.events.some((e) => e.type === 'reaction'), false);
  assert.equal(calls.length, 1);
});

test('a hand card aimed at a foe is not a reaction: the same target rule as queues applies', () => {
  const calls = [];
  const onReaction = (attack, eligible) => {
    calls.push(eligible.map((c) => c.id));
    return null;
  };
  // A guard must target 'self', so a guard aimed at the attacking goblin is never offered.
  // The self-target guard is still offered.
  createRound(duo({}, { hand: [guardCard('foeGuard', { target: 'goblin' }), guardCard('selfGuard')] }), {
    queues: { goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction,
  }).resolveAll();
  assert.deepEqual(calls, [['selfGuard']]);
});

test('a reaction spends the card cost, and a returned card must be eligible', () => {
  const st = duo({}, { hand: [guardCard()] });
  const round = createRound(st, {
    queues: { goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction: () => ({ id: 'guard' }),
  });
  const out = round.resolveAll();
  // Guard costs 1 SP by default; the player had 3 SP and queued nothing.
  assert.equal(out.state.spLeft.player, 2);
  assert.throws(
    () => createRound(duo({}, { hand: [guardCard()] }), {
      queues: { goblin: [stab(1, 4)] },
      rng: HIT_RNG,
      onReaction: () => ({ id: 'not-in-hand' }),
    }).resolveAll(),
    TypeError,
  );
});

test('a reaction spends the card SP from what is left, and the event records it', () => {
  // Guard costs 2 SP; one queued 1-SP card leaves 2 SP, so the guard is offered and spends both.
  const out = createRound(duo({}, { hand: [guardCard('guard', { sp: 2 })] }), {
    queues: { player: [card('x', 'other', 'self', 1)], goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction: (attack, eligible) => ({ id: eligible[0].id }),
  }).resolveAll();
  assert.equal(out.state.spLeft.player, 0);
  assert.equal(out.events.find((e) => e.type === 'reaction').sp, 2);
});

test('a reaction with 0 SP left is refused: no card is offered and nothing is spent', () => {
  const calls = [];
  const out = createRound(duo({}, { hand: [guardCard()] }), {
    queues: {
      player: [card('x', 'other', 'self', 1), card('y', 'other', 'self', 1), card('z', 'other', 'self', 1)],
      goblin: [stab(1, 4)],
    },
    rng: HIT_RNG,
    onReaction: (attack, eligible) => {
      calls.push(eligible);
      return null;
    },
  }).resolveAll();
  assert.equal(calls.length, 0);
  assert.equal(out.events.some((e) => e.type === 'reaction'), false);
  assert.equal(out.state.spLeft.player, 0);
  assert.equal(out.state.combatants.player.hp, 16);
});

test('a defensive card costing more SP than is left is not eligible for a reaction', () => {
  // Two queued 1-SP cards leave 1 SP; a 2-SP guard cannot be offered.
  const calls = [];
  createRound(duo({}, { hand: [guardCard('guard', { sp: 2 })] }), {
    queues: { player: [card('x', 'other', 'self', 1), card('y', 'other', 'self', 1)], goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction: (attack, eligible) => {
      calls.push(eligible.map((c) => c.id));
      return null;
    },
  }).resolveAll();
  assert.equal(calls.length, 0);
});

test('a preemptive counter cancels the next attack when it is faster', () => {
  // Counter 6 + 1 + 2 = 9. Stab 1 + 2 = 3. The counter resolves first and cancels the stab.
  const out = createRound(duo({ hp: 20 }, { hp: 20 }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 6)],
      goblin: [stab(1, 10)],
    },
    rng: HIT_RNG,
  }).resolveAll();
  assert.ok(out.events.some((e) => e.type === 'countered' && e.by === 'player' && e.target === 'goblin'));
  assert.equal(out.events.some((e) => e.type === 'hit' && e.by === 'goblin'), false);
  // Counter damage is the base 2 plus the buff 1.
  const dmg = out.events.find((e) => e.type === 'damage');
  assert.deepEqual([dmg.target, dmg.amount], ['goblin', 3]);
  assert.equal(out.state.combatants.goblin.hp, 17);
  assert.equal(out.state.combatants.player.hp, 20);
});

test('a counter that is slower than the attack lets the attack land, then fires', () => {
  // wholeQueue: the player's queue goes first (lead init 4 vs 2). Counter total is
  // 0 + 1 + 4 = 5. Stab total is 9 + 2 = 11, which is higher, so the attack lands first.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 0)],
      goblin: [stab(9, 10)],
    },
    rng: rngThen([0.75, 0.3], 0.45), // d4 4 for the player, d4 2 for the goblin
    merge: 'wholeQueue',
  }).resolveAll();
  const hitIdx = out.events.findIndex((e) => e.type === 'hit' && e.by === 'goblin');
  const fireIdx = out.events.findIndex((e) => e.type === 'counterFired');
  assert.ok(hitIdx >= 0 && fireIdx > hitIdx);
  assert.equal(out.state.combatants.player.hp, 10);
  assert.equal(out.state.combatants.goblin.hp, 7);
});

test('a preemptive evade adds +10 to its evade roll, so a roll of 25 is evaded', () => {
  // Evade 20 + 10 = 30. Draws: d4 (player), d4 (goblin), d20 10 (hit), evade roll 25.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: { player: [card('evade', 'evade', 'self', 5, { evadePct: 20 })], goblin: [stab(1, 5)] },
    rng: seqRng([0.45, 0.45, 0.45, 0.25]),
  }).resolveAll();
  const roll = out.events.find((e) => e.type === 'evadeRoll');
  assert.deepEqual([roll.evadePct, roll.roll, roll.success], [30, 25, true]);
  assert.equal(out.state.combatants.player.hp, 20);
});

test('a reaction evade uses its base 20, so the same roll of 25 is not evaded', () => {
  const out = createRound(duo({}, { hp: 20, hand: [card('evade', 'evade', 'self', 5, { evadePct: 20 })] }), {
    queues: { goblin: [stab(1, 5)] },
    rng: seqRng([0.45, 0.45, 0.45, 0.25]),
    onReaction: () => ({ id: 'evade' }),
  }).resolveAll();
  const roll = out.events.find((e) => e.type === 'evadeRoll');
  assert.deepEqual([roll.evadePct, roll.success], [20, false]);
  assert.equal(out.state.combatants.player.hp, 15);
});

test('a reaction counter answers the attack it was played against; a queued counter waits', () => {
  // d4: player 4 (u 0.75), goblin 2 (u 0.3). The player lane leads, so pc is placed first.
  // pc total 6 + 1 + 4 = 11. s1 total 5 + 2 = 7. s2 total 0 + 2 = 2. rc (held) costs 1 SP.
  const out = createRound(duo({}, { hp: 20, hand: [card('rc', 'counter', 'self', 0)] }), {
    queues: {
      player: [card('pc', 'counter', 'goblin', 6)],
      goblin: [atk('s1', 'player', 5), atk('s2', 'player', 0)],
    },
    rng: rngThen([0.75, 0.3], 0.45),
    merge: 'wholeQueue',
    onReaction: (attack) => (attack.cardId === 's1' ? { id: 'rc' } : null),
  }).resolveAll();
  const reaction = out.events.find((e) => e.type === 'reaction');
  assert.deepEqual([reaction.cardId, reaction.against, reaction.seq], ['rc', 'goblin', 1]);
  const at = (type, cardId) => out.events.findIndex((e) => e.type === type && e.cardId === cardId);
  // rc fires on s1, after s1 resolves and before s2 starts. It never cancels s1.
  assert.ok(at('counterFired', 'rc') > at('action', 's1'));
  assert.ok(at('counterFired', 'rc') < at('action', 's2'));
  assert.equal(out.events.some((e) => e.type === 'countered' && e.cardId === 'rc'), false);
  // pc was not taken by s1: it is still active and cancels s2.
  assert.equal(out.events.some((e) => e.type === 'counterFired' && e.cardId === 'pc'), false);
  assert.ok(at('countered', 'pc') > at('action', 's2'));
  assert.equal(out.state.combatants.player.hp, 19);
});

test('a reaction evade answers the attack it was played against; a queued evade waits', () => {
  // d4: player 4, goblin 2. Queued pe is buffed to 20 + 10 = 30; reaction re uses base 20.
  // Draws: d4 player, d4 goblin, then per attack a d20 (hit) and an evade roll of 25.
  const out = createRound(duo({}, { hp: 20, hand: [card('re', 'evade', 'self', 0, { evadePct: 20 })] }), {
    queues: {
      player: [card('pe', 'evade', 'self', 5, { evadePct: 20 })],
      goblin: [atk('s1', 'player', 5), atk('s2', 'player', 0)],
    },
    rng: seqRng([0.75, 0.3, 0.45, 0.25, 0.45, 0.25]),
    merge: 'wholeQueue',
    onReaction: (attack) => (attack.cardId === 's1' ? { id: 're' } : null),
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'reaction').cardId, 're');
  const rolls = out.events.filter((e) => e.type === 'evadeRoll');
  // s1 uses re at base 20: roll 25 misses the evade. s2 then uses pe at 30: roll 25 evades.
  assert.deepEqual(rolls.map((r) => [r.evadePct, r.roll, r.success]), [[20, 25, false], [30, 25, true]]);
  assert.equal(out.state.combatants.player.hp, 19);
});

test('a reaction guard on an attack keeps a queued evade for the next attack', () => {
  // The queued evade (20 + 10 preemptive = 30) must not be spent on s1, which the reaction guard
  // (block 6) answers. It is used on s2: s2 rolls evade at 30 (roll 45 fails), so s2 lands for 4.
  const out = createRound(duo({}, { hp: 20, hand: [guardCard('guard')] }), {
    queues: {
      player: [card('qe', 'evade', 'self', 0, { evadePct: 20 })],
      goblin: [atk('s1', 'player', 1, { damage: 4 }), atk('s2', 'player', 0, { damage: 4 })],
    },
    rng: HIT_RNG,
    merge: 'wholeQueue',
    onReaction: (attack) => (attack.cardId === 's1' ? { id: 'guard' } : null),
  }).resolveAll();
  const rolls = out.events.filter((e) => e.type === 'evadeRoll' && e.by === 'player');
  assert.equal(rolls.length, 1);
  assert.equal(rolls[0].evadePct, 30);
  assert.ok(out.events.indexOf(rolls[0]) > out.events.findIndex((e) => e.type === 'action' && e.cardId === 's2'));
  assert.equal(out.state.active.player.evade.length, 0);
  assert.equal(out.state.combatants.player.hp, 16);
});

test('a reaction guard on an attack keeps a queued counter for the next attack from its foe', () => {
  // d4 2 each (u 0.45). The player lane leads, so the queued counter (speed 6, total 9) is placed
  // first. s1 (total 3) is answered by a reaction guard of block 6 that absorbs its 4 damage.
  // The queued counter must not cancel s1. It cancels s2 (total 2) instead, and s2 deals no damage.
  const out = createRound(duo({}, { hp: 20, hand: [guardCard('guard')] }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 6)],
      goblin: [atk('s1', 'player', 1, { damage: 4 }), atk('s2', 'player', 0, { damage: 4 })],
    },
    rng: HIT_RNG,
    merge: 'wholeQueue',
    onReaction: (attack) => (attack.cardId === 's1' ? { id: 'guard' } : null),
  }).resolveAll();
  const at = (type, cardId) => out.events.findIndex((e) => e.type === type && e.cardId === cardId);
  assert.equal(out.events.find((e) => e.type === 'reaction').cardId, 'guard');
  assert.ok(at('guardUp', 'guard') >= 0);
  // The counter does not cancel or fire on s1: its only event comes after s1 resolves.
  assert.equal(out.events.some((e) => e.type === 'counterFired' && e.cardId === 'counter'), false);
  // The counter is still active for s2: it cancels s2 (its event follows s2's action).
  assert.ok(at('action', 's2') > at('action', 's1'));
  assert.ok(at('countered', 'counter') > at('action', 's2'));
  // s1 is absorbed by the reaction guard (block 6 covers 4), and s2 is cancelled: no damage.
  assert.equal(out.state.combatants.player.hp, 20);
});

test('a reaction evade on an attack keeps a queued counter for the next attack from its foe', () => {
  // Same lanes as the guard case. The reaction evade (95, the cap) evades s1, so the
  // queued counter must not cancel s1. The counter then cancels s2, and s2 deals no damage.
  const out = createRound(duo({}, { hp: 20, hand: [card('re', 'evade', 'self', 0, { evadePct: 95 })] }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 6)],
      goblin: [atk('s1', 'player', 1, { damage: 4 }), atk('s2', 'player', 0, { damage: 4 })],
    },
    rng: HIT_RNG,
    merge: 'wholeQueue',
    onReaction: (attack) => (attack.cardId === 's1' ? { id: 're' } : null),
  }).resolveAll();
  const at = (type, cardId) => out.events.findIndex((e) => e.type === type && e.cardId === cardId);
  assert.equal(out.events.find((e) => e.type === 'reaction').cardId, 're');
  assert.ok(at('evadeUp', 're') >= 0);
  // The counter fires on nothing before s1 and does not cancel s1.
  assert.equal(out.events.some((e) => e.type === 'countered' && e.cardId === 'counter' && e.target === 'goblin'), true);
  assert.ok(at('action', 's2') > at('action', 's1'));
  assert.ok(at('countered', 'counter') > at('action', 's2'));
  assert.equal(out.state.combatants.player.hp, 20);
});

test('with no reaction the queued counter still cancels the attack, with or without onReaction', () => {
  // The unchanged case: a queued counter (total 9) cancels s1 (total 3), and s2 then lands.
  const queues = () => ({
    player: [card('counter', 'counter', 'goblin', 6)],
    goblin: [atk('s1', 'player', 1, { damage: 4 }), atk('s2', 'player', 0, { damage: 4 })],
  });
  const none = createRound(duo({}, { hp: 20, hand: [guardCard('guard')] }), {
    queues: queues(), rng: HIT_RNG, merge: 'wholeQueue', onReaction: () => null,
  }).resolveAll();
  const absent = createRound(duo({}, { hp: 20 }), {
    queues: queues(), rng: HIT_RNG, merge: 'wholeQueue',
  }).resolveAll();
  for (const out of [none, absent]) {
    assert.equal(out.events.some((e) => e.type === 'reaction'), false);
    const at = (type, cardId) => out.events.findIndex((e) => e.type === type && e.cardId === cardId);
    // The counter cancels s1, and s2 then lands for 4 (hp 20 - 4).
    assert.ok(at('countered', 'counter') > -1);
    assert.ok(at('countered', 'counter') < at('action', 's2'));
    assert.equal(out.state.combatants.player.hp, 16);
  }
});

test('a queued counter of a defeated player does not fire, cancel, or credit momentum', () => {
  // d4: player 4, goblin 2. Counter total 0 + 1 + 4 = 5, stab total 3 + 2 = 5: a tie, so
  // the counter goes first and does not cancel. The stab (10) defeats the player (hp 3).
  const out = createRound(duo({}, { hp: 3 }), {
    queues: { player: [card('counter', 'counter', 'goblin', 0)], goblin: [stab(3, 10)] },
    rng: rngThen([0.75, 0.3], 0.45),
  }).resolveAll();
  assert.ok(out.events.some((e) => e.type === 'defeated' && e.id === 'player'));
  assert.equal(out.state.combatants.player.hp, 0);
  assert.equal(out.state.combatants.goblin.hp, 10);
  assert.equal(out.events.some((e) => e.type === 'counterFired' || e.type === 'countered'), false);
  assert.equal(out.events.some((e) => e.type === 'momentum' && e.by === 'player'), false);
});

test('a reaction counter of a player defeated by the attack does not fire', () => {
  const out = createRound(duo({}, { hp: 3, hand: [card('rc', 'counter', 'self', 0)] }), {
    queues: { goblin: [stab(3, 10)] },
    rng: rngThen([0.75, 0.3], 0.45),
    onReaction: () => ({ id: 'rc' }),
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'reaction').cardId, 'rc');
  assert.equal(out.state.combatants.player.hp, 0);
  assert.equal(out.state.combatants.goblin.hp, 10);
  assert.equal(out.events.some((e) => e.type === 'counterFired' || e.type === 'countered'), false);
  assert.equal(out.events.some((e) => e.type === 'momentum' && e.by === 'player'), false);
});

test('a counter cancels on its effective speed (the capped one), not its raw total', () => {
  // d4 1 each (u 0). Player queue: jab (speed 0, total 1), counter (speed 9, total 9 + 1 + 1 = 11).
  // The counter's effective speed is capped at jab's 1. Goblin stab total 0 + 1 = 1: a tie.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [atk('jab', 'goblin', 0), card('counter', 'counter', 'goblin', 9)],
      goblin: [stab(0, 1)],
    },
    rng: seqRng([0, 0, 0.45, 0.45]),
  }).resolveAll();
  assert.equal(out.events.some((e) => e.type === 'countered'), false);
  const order = out.events.filter((e) => e.type === 'action').map((e) => e.cardId);
  assert.deepEqual(order, ['jab', 'counter', 'stab']);
  const fired = out.events.find((e) => e.type === 'counterFired');
  assert.deepEqual([fired.by, fired.cardId], ['player', 'counter']);
  assert.equal(out.state.combatants.player.hp, 19);
});

test("combatant ids '__proto__' and 'constructor' are ordinary keys and resolve", () => {
  const st = makeFight([
    { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 3 },
    { id: '__proto__', attrs: { DEX: 1 }, hp: 10, sp: 3 },
    { id: 'constructor', attrs: { DEX: 1 }, hp: 10, sp: 3 },
  ]);
  assert.ok(Object.hasOwn(st.combatants, '__proto__'));
  assert.ok(Object.hasOwn(st.combatants, 'constructor'));
  assert.equal(Object.getPrototypeOf(st.combatants), Object.prototype);
  assert.equal(st.combatants['__proto__'].hp, 10);
  const out = createRound(st, {
    queues: { player: [atk('jab', '__proto__', 0)], constructor: [atk('stab', 'player', 1)] },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(out.state.combatants['__proto__'].hp, 9);
  assert.equal(out.state.combatants.constructor.hp, 10);
  assert.equal(out.state.combatants.player.hp, 19);
  assert.equal(Object.hasOwn(out.state.momentum, '__proto__'), true);
  assert.equal(out.state.momentum['__proto__'], 1);
  assert.equal(out.state.momentum.constructor, -1);
});

// ---- Momentum: per enemy, summed per exchange, settled once at round end ----

const momentumOf = (out, id) => out.state.momentum[id];

test('round start decays each enemy momentum 1 toward 0, with a decay event per change', () => {
  const st = makeFight([
    { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 3 },
    { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 3 },
    { id: 'wolf', attrs: { DEX: 1 }, hp: 10, sp: 3 },
  ]);
  st.momentum = { goblin: -2, wolf: 2 };
  const out = createRound(st, { queues: {}, rng: HIT_RNG }).resolveAll();
  assert.equal(out.state.momentum.goblin, -1);
  assert.equal(out.state.momentum.wolf, 1);
  const decays = out.events.filter((e) => e.type === 'momentum' && e.reason === 'decay');
  assert.deepEqual(decays.map((e) => [e.enemyId, e.from, e.to]), [['goblin', -2, -1], ['wolf', 2, 1]]);
});

test('a landed hit is the attacker success; momentum changes only at round end', () => {
  const st = duo();
  // A trailing 'other' card keeps the round open after the jab.
  const round = createRound(st, {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 1 }), card('x', 'other', 'self', 0)] },
    rng: HIT_RNG,
  });
  round.next();
  assert.equal(round.state.momentum.goblin, 0); // still the round's start value
  const out = round.resolveAll();
  assert.equal(momentumOf(out, 'goblin'), 0 + 1);
  const applied = out.events.filter((e) => e.type === 'momentumApplied');
  assert.deepEqual(applied.map((e) => [e.enemyId, e.from, e.to]), [['goblin', 0, 1]]);
});

test("a miss is the defender's success, so the enemy's momentum moves toward the player", () => {
  // Constant 0: natural 1 on the d20, so the goblin's stab misses.
  const out = createRound(duo(), {
    queues: { goblin: [atk('stab', 'player', 3, { damage: 4 })] },
    rng: constRng(0),
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').hit, false);
  assert.equal(momentumOf(out, 'goblin'), 1);
});

test('a stance advantage adds its bonus to the success gain', () => {
  // A counter (stance block) cancels the attack (stance attack). Gain 1 + bonus 2 = 3.
  const out = createRound(duo({ hp: 20 }, { hp: 20 }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 6, { stance: 'block' })],
      goblin: [atk('stab', 'player', 1, { damage: 10, stance: 'attack' })],
    },
    rng: HIT_RNG,
    stanceAdvantage: parseStanceAdvantage('attacker_stance,defender_stance,bonus\nblock,attack,2'),
  }).resolveAll();
  const win = out.events.find((e) => e.type === 'momentum' && e.reason === 'success');
  assert.deepEqual([win.by, win.gain, win.bonus, win.delta], ['player', 1, 2, 3]);
  assert.equal(momentumOf(out, 'goblin'), 3);
});

test('a full block by a guard is credited with the guard card gain and stance', () => {
  // Guard gain 3, stance block: block 8 fully covers stab 4 (stance attack). Gain 3 + bonus 2 = 5.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [guardCard('guard', { momentumGain: 3, stance: 'block' })],
      goblin: [atk('stab', 'player', 1, { damage: 4, stance: 'attack' })],
    },
    rng: HIT_RNG,
    stanceAdvantage: parseStanceAdvantage('attacker_stance,defender_stance,bonus\nblock,attack,2'),
  }).resolveAll();
  assert.equal(out.events.some((e) => e.type === 'absorbed'), true);
  assert.equal(out.state.combatants.player.hp, 20);
  const win = out.events.find((e) => e.type === 'momentum' && e.reason === 'success');
  assert.deepEqual([win.by, win.gain, win.bonus, win.delta], ['player', 3, 2, 5]);
  // The raw +5 clamps to MOMENTUM_MAX 3 at round end, and that overflow sets the player's flag.
  assert.equal(momentumOf(out, 'goblin'), 3);
  assert.equal(out.events.some((e) => e.type === 'momentum' && e.reason === 'overflow' && e.side === 'player'), true);
});

test('a landed hit through a partial block scores its stance against the guard card', () => {
  // Guard block 8 (preemptive guard, speed 5, stance block) meets a 10-damage stab (stance
  // attack). The block absorbs 8 and 2 lands. Attack over block has advantage +2, so the
  // enemy's success is gain 1 + bonus 2 = 3, scored on the enemy side (momentum -3).
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [guardCard('guard', { stance: 'block' })],
      goblin: [atk('stab', 'player', 1, { damage: 10, stance: 'attack' })],
    },
    rng: HIT_RNG,
    stanceAdvantage: parseStanceAdvantage('attacker_stance,defender_stance,bonus\nattack,block,2'),
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').hit, true);
  assert.equal(out.state.combatants.player.hp, 18);
  const win = out.events.find((e) => e.type === 'momentum' && e.reason === 'success');
  assert.deepEqual([win.by, win.gain, win.bonus, win.delta], ['enemy', 1, 2, -3]);
  assert.equal(momentumOf(out, 'goblin'), -3);
});

test('a counter stagger adds 3 on top of its slot win, summed then clamped once', () => {
  // Start -2 decays to -1. A cancelling counter with stagger gives +1 + 3 = +4, so -1 + 4 = 3.
  const cancelWith = (tags) => {
    const st = duo({ hp: 20 }, { hp: 20 });
    st.momentum = { goblin: -2 };
    return createRound(st, {
      queues: {
        player: [card('counter', 'counter', 'goblin', 6, { tags })],
        goblin: [atk('stab', 'player', 1, { damage: 10 })],
      },
      rng: HIT_RNG,
    }).resolveAll();
  };
  const staggered = cancelWith(['stagger']);
  assert.equal(staggered.events.find((e) => e.reason === 'counterStagger').delta, 3);
  assert.equal(momentumOf(staggered, 'goblin'), 3);
  assert.equal(momentumOf(cancelWith([]), 'goblin'), 0);
});

test('hyperArmor resists a counter stagger: no +-3, and a resisted event instead', () => {
  // Start -2 decays to -1. The cancelling counter still wins its slot (+1), so -1 + 1 = 0.
  // The stagger is resisted by the goblin's hyperArmor, so it adds no 3.
  const st = duo({ hp: 20, tags: ['hyperArmor'] }, { hp: 20 });
  st.momentum = { goblin: -2 };
  const out = createRound(st, {
    queues: {
      player: [card('counter', 'counter', 'goblin', 6, { tags: ['stagger'] })],
      goblin: [atk('stab', 'player', 1, { damage: 10 })],
    },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(out.events.some((e) => e.reason === 'counterStagger'), false);
  const resisted = out.events.filter((e) => e.type === 'resisted');
  assert.deepEqual(resisted.map((e) => [e.status, e.target]), [['stagger', 'goblin']]);
  assert.equal(out.events.some((e) => e.type === 'status'), false);
  assert.equal(momentumOf(out, 'goblin'), 0);
  // The queued counter deals DEFENSE_BASE 2 plus REACTION_BUFF 1 = 3 damage, so 20 - 3 = 17.
  assert.equal(out.state.combatants.goblin.hp, 17);
});

test('hyperArmor resists a stagger from a counter that fires after the attack', () => {
  // The goblin's attack is faster, so the counter fires after it. The stagger is still resisted.
  const st = duo({ hp: 20, tags: ['hyperArmor'] }, { hp: 20 });
  const out = createRound(st, {
    queues: {
      player: [card('counter', 'counter', 'goblin', 0, { tags: ['stagger'] })],
      goblin: [atk('stab', 'player', 9, { damage: 1 })],
    },
    rng: HIT_RNG,
    merge: 'wholeQueue',
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'counterFired').by, 'player');
  assert.equal(out.events.some((e) => e.reason === 'counterStagger'), false);
  assert.deepEqual(out.events.filter((e) => e.type === 'resisted').map((e) => [e.status, e.target]), [['stagger', 'goblin']]);
});

test('each side wins at most once per exchange: a landed hit and a fired counter net to 0', () => {
  // wholeQueue, as in the counter test: the stab lands (goblin +, wins), then the counter
  // fires (player +). Each side is credited once, so the momentum is unchanged.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 0)],
      goblin: [atk('stab', 'player', 9, { damage: 1 })],
    },
    rng: rngThen([0.75, 0.3], 0.45),
    merge: 'wholeQueue',
  }).resolveAll();
  assert.equal(out.events.filter((e) => e.type === 'momentum' && e.reason === 'success').length, 2);
  assert.equal(momentumOf(out, 'goblin'), 0);
});

test('a fired counter is the defender winning card when the attack misses: gain 3 once', () => {
  // The stab (total 11) beats the counter (total 5), so the stab resolves first and misses
  // (fallback roll 0 is a natural 1). The counter then fires and wins the one credit.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [card('counter', 'counter', 'goblin', 0, { momentumGain: 3 })],
      goblin: [stab(9, 1)],
    },
    rng: rngThen([0.75, 0.3], 0),
    merge: 'wholeQueue',
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').hit, false);
  assert.equal(out.events.some((e) => e.type === 'counterFired'), true);
  const wins = out.events.filter((e) => e.type === 'momentum' && e.reason === 'success');
  assert.equal(wins.length, 1);
  assert.deepEqual([wins[0].by, wins[0].gain, wins[0].delta], ['player', 3, 3]);
  assert.equal(momentumOf(out, 'goblin'), 3);
});

test('a fired counter is the defender winning card when a guard fully blocks: gain 3 once', () => {
  // The queued guard (gain 2) fully blocks the stab, then the slower counter (gain 3) fires.
  // The defender is credited once, with the counter card, not the guard card.
  const out = createRound(duo({}, { hp: 20 }), {
    queues: {
      player: [guardCard('guard', { momentumGain: 2 }), card('counter', 'counter', 'goblin', 0, { momentumGain: 3 })],
      goblin: [stab(9, 4)],
    },
    rng: rngThen([0.75, 0.3], 0.45),
    merge: 'wholeQueue',
  }).resolveAll();
  assert.equal(out.events.some((e) => e.type === 'absorbed'), true);
  assert.equal(out.events.some((e) => e.type === 'counterFired'), true);
  const wins = out.events.filter((e) => e.type === 'momentum' && e.reason === 'success');
  assert.equal(wins.length, 1);
  assert.deepEqual([wins[0].by, wins[0].gain, wins[0].delta], ['player', 3, 3]);
  assert.equal(momentumOf(out, 'goblin'), 3);
});

test('an overflow above +3 clamps to 3 and sets the player poiseDouble flag', () => {
  // Start 3 decays to 2. Two landed player hits give +2, so raw 4 clamps to 3.
  const st = duo();
  st.momentum = { goblin: 3 };
  const out = createRound(st, {
    queues: { player: [atk('a', 'goblin', 6, { damage: 1 }), atk('b', 'goblin', 5, { damage: 1 })] },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(momentumOf(out, 'goblin'), 3);
  assert.equal(out.state.poiseDouble.player, true);
  assert.ok(out.events.some((e) => e.type === 'momentum' && e.reason === 'overflow' && e.side === 'player'));
});

test('an overflow below -3 clamps to -3 and sets that enemy poiseDouble flag', () => {
  // Start -3 decays to -2. Two landed goblin hits on the player give -2, so raw -4 clamps to -3.
  const st = duo({}, { hp: 30 });
  st.momentum = { goblin: -3 };
  const out = createRound(st, {
    queues: { goblin: [atk('a', 'player', 6, { damage: 1 }), atk('b', 'player', 5, { damage: 1 })] },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(momentumOf(out, 'goblin'), -3);
  assert.equal(out.state.poiseDouble.goblin, true);
  assert.equal(out.state.poiseDouble.player, false);
});

test('a set poiseDouble flag doubles the next landed hit of that side, then clears', () => {
  const st = duo();
  st.poiseDouble = { player: true };
  const out = createRound(st, {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 1 })] },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').poiseMultiplier, 2);
  assert.equal(out.state.poiseDouble.player, false);
});

test('momentum is kept per enemy: a hit on the goblin leaves the wolf alone', () => {
  const st = makeFight([
    { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 3 },
    { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 3 },
    { id: 'wolf', attrs: { DEX: 1 }, hp: 10, sp: 3 },
  ]);
  const out = createRound(st, {
    queues: { player: [atk('jab', 'goblin', 6, { damage: 1 })] },
    rng: HIT_RNG,
  }).resolveAll();
  assert.equal(momentumOf(out, 'goblin'), 1);
  assert.equal(momentumOf(out, 'wolf'), 0);
});

// ---- Enemy adaptation (WIS): may change the third queued action ----

const fourCards = () => [
  atk('c0', 'player', 1), atk('c1', 'player', 2), atk('c2', 'player', 3), atk('c3', 'player', 4),
];
const playerHitsGoblin = [atk('jab', 'goblin', 5)];

test('adaptChance is wis * 15%, clamped to 0..60%, and 0 for wis 0 or less', () => {
  assert.equal(adaptChance(0), 0);
  assert.equal(adaptChance(-2), 0);
  assert.ok(Math.abs(adaptChance(2) - 0.3) < 1e-9);
  assert.ok(Math.abs(adaptChance(3) - 0.45) < 1e-9);
  assert.equal(adaptChance(10), 0.6);
});

test('a wis 0 enemy never changes, and draws no rng', () => {
  const { rng, box } = countingRng(0);
  const queues = { goblin: fourCards() };
  const out = adaptEnemyQueues(queues, playerHitsGoblin, rng, { wis: { goblin: 0 } });
  assert.deepEqual(out.changed, []);
  assert.deepEqual(out.queues.goblin, fourCards());
  assert.equal(box.calls, 0);
});

test('a wis 2 enemy changes only its third action, to a counter, when the player attacks it', () => {
  // wis 2: chance 0.3. A draw of 0.1 is below it.
  const queues = { goblin: fourCards() };
  const out = adaptEnemyQueues(queues, playerHitsGoblin, constRng(0.1), { wis: { goblin: 2 } });
  assert.deepEqual(out.changed, ['goblin']);
  const q = out.queues.goblin;
  assert.deepEqual([q[0], q[1], q[3]], [fourCards()[0], fourCards()[1], fourCards()[3]]);
  assert.equal(q[2].kind, 'counter');
  assert.equal(q[2].target, 'player');
  assert.equal(q[2].replaces, 'c2');
  // The input queue is not changed.
  assert.deepEqual(queues.goblin, fourCards());
});

test('an enemy keeps its third action when the player does not attack it', () => {
  const out = adaptEnemyQueues(
    { goblin: fourCards() },
    [atk('jab', 'wolf', 5)],
    constRng(0.1),
    { wis: { goblin: 2 } },
  );
  assert.deepEqual(out.changed, []);
  assert.deepEqual(out.queues.goblin, fourCards());
});

test('the chance is a strict threshold: a draw equal to it does not change', () => {
  const at = adaptEnemyQueues({ goblin: fourCards() }, playerHitsGoblin, constRng(0.3), { wis: { goblin: 2 } });
  assert.deepEqual(at.changed, []);
  // wis 10 clamps to 60%: a draw of 0.59 changes, 0.6 does not.
  const below = adaptEnemyQueues({ goblin: fourCards() }, playerHitsGoblin, constRng(0.59), { wis: { goblin: 10 } });
  assert.deepEqual(below.changed, ['goblin']);
  const at60 = adaptEnemyQueues({ goblin: fourCards() }, playerHitsGoblin, constRng(0.6), { wis: { goblin: 10 } });
  assert.deepEqual(at60.changed, []);
});

test('a queue shorter than three actions is never changed', () => {
  const out = adaptEnemyQueues(
    { goblin: [atk('c0', 'player', 1), atk('c1', 'player', 2)] },
    playerHitsGoblin,
    constRng(0),
    { wis: { goblin: 9 } },
  );
  assert.deepEqual(out.changed, []);
});

test('only the enemies that changed are listed, and the player queue is never adapted', () => {
  const queues = {
    player: [atk('jab', 'goblin', 5)],
    goblin: fourCards(),
    wolf: fourCards(),
  };
  const out = adaptEnemyQueues(queues, [atk('jab', 'goblin', 5)], constRng(0.1), { wis: { goblin: 2, wolf: 0 } });
  assert.deepEqual(out.changed, ['goblin']);
  assert.deepEqual(out.queues.player, queues.player);
  assert.deepEqual(out.queues.wolf, fourCards());
});

test('an un-attacked WIS enemy draws no rng, so it cannot shift another enemy\'s adapt roll', () => {
  // Codex review, 2026-10-11. The first draw (0.1) is below both chances, so whichever enemy
  // draws first decides. Only the goblin is attacked, so the wolf must not take that draw.
  const wis = { goblin: 2, wolf: 3 };
  const jabGoblin = [atk('jab', 'goblin', 5)];
  const alone = adaptEnemyQueues({ goblin: fourCards() }, jabGoblin, rngThen([0.1], 0.99), { wis });
  const wolfFirst = adaptEnemyQueues(
    { wolf: fourCards(), goblin: fourCards() },
    jabGoblin,
    rngThen([0.1], 0.99),
    { wis },
  );
  const goblinFirst = adaptEnemyQueues(
    { goblin: fourCards(), wolf: fourCards() },
    jabGoblin,
    rngThen([0.1], 0.99),
    { wis },
  );
  assert.deepEqual(alone.changed, ['goblin']);
  assert.deepEqual(wolfFirst.changed, ['goblin']);
  assert.deepEqual(goblinFirst.changed, ['goblin']);
  assert.deepEqual(wolfFirst.queues.goblin, alone.queues.goblin);
  assert.deepEqual(goblinFirst.queues.goblin, alone.queues.goblin);
  assert.deepEqual(wolfFirst.queues.wolf, fourCards());
});

// Defence numbers (Codex review on PR #1838): block, evadePct and counterDamage must be finite
// numbers of 0 or more. A bad value throws a TypeError naming the field, whether the card is
// queued or offered as a reaction.
const BAD_DEFENCE_VALUES = [-1, NaN, '6'];
const DEFENCE_CASES = [
  { field: 'block', kind: 'guard', target: 'self' },
  { field: 'evadePct', kind: 'evade', target: 'self' },
  { field: 'counterDamage', kind: 'counter', target: 'goblin' },
];

test('a queued guard, evade or counter with a bad block, evadePct or counterDamage throws TypeError', () => {
  for (const { field, kind, target } of DEFENCE_CASES) {
    for (const bad of BAD_DEFENCE_VALUES) {
      const queued = card('bad', kind, target, 5, { [field]: bad });
      assert.throws(
        () => createRound(duo({}, { hp: 20 }), { queues: { player: [queued] }, rng: HIT_RNG }).resolveAll(),
        { name: 'TypeError', message: new RegExp(field) },
        `queued ${field} = ${String(bad)}`,
      );
    }
  }
});

test('a reaction card with a bad block, evadePct or counterDamage throws TypeError when offered', () => {
  for (const { field, kind, target } of DEFENCE_CASES) {
    for (const bad of BAD_DEFENCE_VALUES) {
      const held = card('bad', kind, target, 5, { [field]: bad });
      assert.throws(
        () => createRound(duo({}, { hand: [held] }), {
          queues: { goblin: [stab(1, 4)] },
          rng: HIT_RNG,
          onReaction: () => ({ id: 'bad' }),
        }).resolveAll(),
        { name: 'TypeError', message: new RegExp(field) },
        `reaction ${field} = ${String(bad)}`,
      );
    }
  }
});

// ---- Evade cards from evasion-cards.csv (owner, 2026-10-11; DESIGN.md, Defensive cards) ----

const EVASION_CARDS = parseEvasionCards('card,bonus\nDodge,3\nBackstep,5\n');
// Goblin accuracy 1 (DEX 1). Player Cloth evasion 0, so need = 8 + 0 - 1 = 7.
// rng: d4 player 1, d4 goblin 4, then d20 8. A Dodge (+3) makes need 10, which misses.
// Any percent roll draws 0.99 (99), so it never avoids.
const EVADE_RNG = () => rngThen([0, 0.75, 0.37], 0.99);
const evadeFight = (playerExtra = {}) => makeFight([
  { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 3, ...playerExtra },
  { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 3 },
], { cards: EVASION_CARDS });
const goblinStab = () => ({ goblin: [atk('stab', 'player', 1, { damage: 4 })] });

test('a queued evade card in evasion-cards.csv adds its Evasion to the hit roll, not a 20% roll', () => {
  const out = createRound(evadeFight(), {
    queues: { player: [card('Dodge', 'evade', 'self', 6)], ...goblinStab() },
    rng: EVADE_RNG(),
  }).resolveAll();
  const hit = out.events.find((e) => e.type === 'hit');
  assert.equal(hit.need, 10);
  assert.equal(hit.hit, false);
  assert.equal(out.events.some((e) => e.type === 'evadeRoll'), false);
  // The table card has no percent of its own: 0, and the preemptive buff does not apply to 0.
  assert.equal(out.events.find((e) => e.type === 'evadeUp').pct, 0);
});

test('a table evade card Evasion ends with the attack it is spent on', () => {
  // Two stabs, one queued Dodge: the first need is 10 (7 + 3), the second is back to 7.
  const out = createRound(evadeFight(), {
    queues: {
      player: [card('Dodge', 'evade', 'self', 6)],
      goblin: [atk('s1', 'player', 1, { damage: 4 }), atk('s2', 'player', 0, { damage: 4 })],
    },
    rng: rngThen([0, 0.75, 0.37, 0.37], 0.99),
  }).resolveAll();
  assert.deepEqual(out.events.filter((e) => e.type === 'hit').map((e) => e.need), [10, 7]);
});

test('an explicit evadePct on a table evade card still rolls, with the preemptive buff', () => {
  const out = createRound(evadeFight(), {
    queues: { player: [card('Dodge', 'evade', 'self', 6, { evadePct: 50 })], ...goblinStab() },
    // d20 12 (u 0.55) meets need 10, so the hit lands and the percent roll happens.
    rng: rngThen([0, 0.75, 0.55], 0.99),
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').need, 10);
  assert.equal(out.events.find((e) => e.type === 'evadeRoll').evadePct, 60);
});

test('an evade card not in the table keeps the 20% default and adds no Evasion', () => {
  const out = createRound(evadeFight(), {
    queues: { player: [card('Shield Bash', 'evade', 'self', 6)], ...goblinStab() },
    rng: EVADE_RNG(),
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').need, 7);
  assert.equal(out.events.find((e) => e.type === 'evadeRoll').evadePct, 30);
});

test('a reaction evade card in the table adds its Evasion to the attack it answers', () => {
  const out = createRound(evadeFight({ hand: [card('Dodge', 'evade', 'self', 1)] }), {
    queues: goblinStab(),
    rng: EVADE_RNG(),
    onReaction: (attack, eligible) => eligible[0],
  }).resolveAll();
  assert.equal(out.events.find((e) => e.type === 'hit').need, 10);
  assert.equal(out.events.some((e) => e.type === 'evadeRoll'), false);
});

test('plannedSpeed is the uncapped buildTimeline entry total minus its d4, for every entry of seeded fights', () => {
  // Seeded LCG: each seed draws a different set of d4s, so the check covers many rolls.
  const lcg = (seed) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const momentum = { goblin: 2, wolf: -3 };
  let checked = 0;
  for (let seed = 1; seed <= 25; seed += 1) {
    const combatants = {
      player: makeCombatant({ id: 'player', attrs: { DEX: 7 }, hp: 20, sp: 4 }),
      goblin: makeCombatant({ id: 'goblin', attrs: { DEX: 5 }, hp: 10, sp: 3 }),
      wolf: makeCombatant({ id: 'wolf', attrs: { DEX: 2 }, hp: 8, sp: 3 }),
    };
    const queues = {
      player: [atk('jab', 'goblin', 6), card('brace', 'counter', 'goblin', 2), card('ward', 'guard', 'self', 1), card('heal', 'other', 'self', 2)],
      goblin: [atk('stab', 'player', 2), card('parry', 'counter', 'player', 3)],
      wolf: [atk('bite', 'player', 1), atk('claw', 'player', 2)],
    };
    const tl = buildTimeline(queues, { combatants, rng: lcg(seed), momentum });
    for (const entry of tl.entries) {
      const planned = plannedSpeed({
        combatant: combatants[entry.actor], card: entry.card, preemptive: entry.preemptive, momentum, foeId: entry.card.target,
      });
      assert.equal(planned, entry.speed.total - entry.speed.d4, `seed ${seed}, ${entry.cardId}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 100, `checked ${checked} entries`);
});

test('plannedSpeed has no d4 input and counts the preemptive buff only for a preemptive card', () => {
  const player = makeCombatant({ id: 'player', attrs: { DEX: 4 }, hp: 10 });
  const brace = card('brace', 'counter', 'goblin', 2);
  assert.equal(plannedSpeed({ combatant: player, card: brace, preemptive: true, momentum: {}, foeId: 'goblin' }), 2 + 1 + 2);
  assert.equal(plannedSpeed({ combatant: player, card: brace, preemptive: false, momentum: {}, foeId: 'goblin' }), 2 + 2);
  assert.equal(plannedSpeed({ combatant: player, card: card('heal', 'other', 'self', 2), preemptive: false, momentum: { goblin: 3 }, foeId: 'self' }), 2 + 2, 'self-target: no momentum term');
});

test('plannedQueueSpeeds caps a card at the previous card in its queue (Codex example)', () => {
  // DEX 1 gives base 0, so the speeds are the card speeds. Player queue [speed 1, speed 5]
  // against a goblin speed-3 action: the 5 is effectively 1, so it is behind the goblin.
  const player = makeCombatant({ id: 'player', attrs: { DEX: 1 }, hp: 10 });
  const goblin = makeCombatant({ id: 'goblin', attrs: { DEX: 1 }, hp: 10 });
  const queue = [atk('jab', 'goblin', 1), atk('slash', 'goblin', 5)];
  assert.equal(timeline.plannedSpeed({ combatant: player, card: queue[1], preemptive: false, momentum: {}, foeId: 'goblin' }), 5, 'uncapped total');
  const [first, second] = timeline.plannedQueueSpeeds({ combatant: player, queue, momentum: {} });
  assert.equal(first, 1);
  assert.equal(second, 1, 'capped at the previous card');
  const [foe] = timeline.plannedQueueSpeeds({ combatant: goblin, queue: [atk('stab', 'player', 3)], momentum: {} });
  assert.equal(foe, 3);
  assert.ok(second < foe, 'the second card forecasts behind the goblin');
  // Stance: the card's block is beaten by the goblin's smash, so the card is at a stance
  // disadvantage. With the speed disadvantage too, the outline is red. The uncapped 5 would
  // have read as a speed advantage, which gives yellow.
  const stanceTable = parseStanceAdvantage('attacker_stance,defender_stance,bonus\nsmash,block,2\n');
  const outline = targetOutline({
    card: { stance: 'block', target: 'goblin' }, foe: { stance: 'smash' }, cardSpeed: second, foeSpeed: foe, stage: 3, stanceTable,
  });
  assert.equal(outline, 'red', 'speed disadvantage counts for the capped card');
});

test('plannedQueueSpeeds is the buildTimeline entry effective speed minus its d4, for every combatant and entry of seeded fights', () => {
  // Seeded LCG: each seed draws a different set of d4s. The queues include capped cards
  // (wolf claw after bite; goblin parry after stab), so the cap is exercised.
  const lcg = (seed) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const momentum = { goblin: 2, wolf: -3 };
  let checked = 0;
  let capped = 0;
  for (let seed = 1; seed <= 25; seed += 1) {
    const combatants = {
      player: makeCombatant({ id: 'player', attrs: { DEX: 7 }, hp: 20, sp: 4 }),
      goblin: makeCombatant({ id: 'goblin', attrs: { DEX: 5 }, hp: 10, sp: 3 }),
      wolf: makeCombatant({ id: 'wolf', attrs: { DEX: 2 }, hp: 8, sp: 3 }),
    };
    const queues = {
      player: [atk('jab', 'goblin', 6), card('brace', 'counter', 'goblin', 2), card('ward', 'guard', 'self', 1), card('heal', 'other', 'self', 2)],
      goblin: [atk('stab', 'player', 2), card('parry', 'counter', 'player', 3)],
      wolf: [atk('bite', 'player', 1), atk('claw', 'player', 2)],
    };
    const tl = buildTimeline(queues, { combatants, rng: lcg(seed), momentum });
    for (const id of Object.keys(combatants)) {
      const planned = timeline.plannedQueueSpeeds({ combatant: combatants[id], queue: queues[id], momentum });
      assert.equal(planned.length, queues[id].length, `seed ${seed}, ${id}: one speed per card`);
      for (const entry of tl.entries.filter((e) => e.actor === id)) {
        assert.equal(planned[entry.cardIndex], entry.speed.effective - entry.speed.d4, `seed ${seed}, ${entry.cardId}`);
        if (entry.speed.effective !== entry.speed.total) capped += 1;
        checked += 1;
      }
    }
  }
  assert.equal(checked, 25 * 8, 'every entry of every seed');
  assert.ok(capped >= 25, `the cap changed ${capped} entries`);
});

test('plannedQueueSpeeds: a single card is its plannedSpeed, and an empty or missing queue is []', () => {
  const player = makeCombatant({ id: 'player', attrs: { DEX: 4 }, hp: 10 });
  const brace = card('brace', 'counter', 'goblin', 2);
  assert.deepEqual(timeline.plannedQueueSpeeds({ combatant: player, queue: [brace], momentum: {} }), [2 + 1 + 2]);
  assert.deepEqual(timeline.plannedQueueSpeeds({ combatant: player, queue: [], momentum: {} }), []);
  assert.deepEqual(timeline.plannedQueueSpeeds({ combatant: player, momentum: {} }), []);
});

