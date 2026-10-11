// alternative-combat-rounds: tests for the timeline model (node:test).
// Owner's round model, 2026-10-11. Run: node --test docs/alternative-combat-rounds/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCombatant,
  buildTimeline,
  createRound,
  makeFight,
  adaptEnemyQueues,
  adaptChance,
  MERGE_MODES,
} from './timeline.mjs';
import { parseStanceAdvantage } from './resolver.mjs';

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
const mk = (id, extra = {}) => makeCombatant({ id, attrs: { DEX: 1 }, hp: 10, sp: 6, ...extra });

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

test('buildTimeline rejects a queue that costs more SP than the combatant has', () => {
  const { player, goblin, wolf } = trio();
  const queues = { player: [atk('a', 'goblin', 1), atk('b', 'goblin', 1), atk('c', 'goblin', 1)] };
  // Three cards at 3 SP each cost 9; player has 6.
  assert.throws(
    () => buildTimeline(queues, { combatants: { player, goblin, wolf }, rng: constRng(0) }),
    RangeError,
  );
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
  { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 6, ...playerExtra },
  { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 6, ...goblinExtra },
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

test('onReaction is offered only to the player, and only when SP is left for the card', () => {
  const calls = [];
  const onReaction = (attack, eligible) => {
    calls.push({ attack, eligible: eligible.map((c) => c.id) });
    return null;
  };
  // Two queued 3-SP cards use all 6 SP, so no reaction is offered.
  const spent = createRound(duo({}, { hand: [guardCard()] }), {
    queues: { player: [card('x', 'other', 'self', 1), card('y', 'other', 'self', 1)], goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction,
  }).resolveAll();
  assert.equal(calls.length, 0);
  assert.equal(spent.state.combatants.player.hp, 16);

  // One queued card leaves 3 SP: the guard (cost 3) is eligible and offered.
  createRound(duo({}, { hand: [guardCard()] }), {
    queues: { player: [card('x', 'other', 'self', 1)], goblin: [stab(1, 4)] },
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

test('a reaction spends the card cost, and a returned card must be eligible', () => {
  const st = duo({}, { hand: [guardCard()] });
  const round = createRound(st, {
    queues: { goblin: [stab(1, 4)] },
    rng: HIT_RNG,
    onReaction: () => ({ id: 'guard' }),
  });
  const out = round.resolveAll();
  assert.equal(out.state.spLeft.player, 3);
  assert.throws(
    () => createRound(duo({}, { hand: [guardCard()] }), {
      queues: { goblin: [stab(1, 4)] },
      rng: HIT_RNG,
      onReaction: () => ({ id: 'not-in-hand' }),
    }).resolveAll(),
    TypeError,
  );
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

// ---- Momentum: per enemy, summed per exchange, settled once at round end ----

const momentumOf = (out, id) => out.state.momentum[id];

test('round start decays each enemy momentum 1 toward 0, with a decay event per change', () => {
  const st = makeFight([
    { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 6 },
    { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 6 },
    { id: 'wolf', attrs: { DEX: 1 }, hp: 10, sp: 6 },
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
    { id: 'player', attrs: { DEX: 1 }, hp: 20, sp: 6 },
    { id: 'goblin', attrs: { DEX: 1 }, hp: 10, sp: 6 },
    { id: 'wolf', attrs: { DEX: 1 }, hp: 10, sp: 6 },
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
