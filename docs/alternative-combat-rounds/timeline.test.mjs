// alternative-combat-rounds: tests for the timeline model (node:test).
// Owner's round model, 2026-10-11. Run: node --test docs/alternative-combat-rounds/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCombatant,
  buildTimeline,
  MERGE_MODES,
} from './timeline.mjs';

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
