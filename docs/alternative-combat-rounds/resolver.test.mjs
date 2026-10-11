// Tests for the simultaneous-action resolver prototype (node:test).
// Run: node --test docs/alternative-combat-rounds/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  actionSpeed,
  momentumSpeed,
  clampMomentum,
  hitRoll,
  resolvePair,
  resolveRound,
  rollD20,
  parseStanceAdvantage,
  cardHint,
  SPEED_TIERS,
} from './resolver.mjs';

// Fixed RNG: returns a float that maps to the wanted d20 face.
const here = dirname(fileURLToPath(import.meta.url));
const d20Face = (face) => () => (face - 1) / 20 + 0.01;

const hitsOf = (events) => events.filter((e) => e.type === 'hit');
const find = (events, type) => events.find((e) => e.type === type);

const REAVER = { STR: 3, DEX: 1, WIS: 1, INT: 1 };

test('owner example: counter at +5 beats a strike at +4', () => {
  const counter = { kind: 'counter', speed: 5, id: 'counter' };
  const strike = { kind: 'attack', speed: 4, id: 'strike' };
  const events = resolvePair(counter, strike, d20Face(20));

  assert.equal(find(events, 'order').first, 'player');
  assert.deepEqual(find(events, 'countered'), { type: 'countered', by: 'player', target: 'enemy' });
  assert.equal(hitsOf(events).some((e) => e.by === 'enemy'), false, 'countered strike must not hit');
});

test('owner example: strike at +4 beats an enemy action at +3', () => {
  const strike = { kind: 'attack', speed: 4, id: 'strike' };
  const enemy = { kind: 'attack', speed: 3, id: 'enemyStrike' };
  const events = resolvePair(strike, enemy, d20Face(20));

  assert.equal(find(events, 'order').first, 'player');
  assert.equal(find(events, 'interrupted').side, 'enemy', 'slower enemy action is interrupted');
  const playerHit = hitsOf(events).find((e) => e.by === 'player');
  assert.ok(playerHit, 'player strike resolves');
  assert.equal(hitsOf(events).some((e) => e.by === 'enemy'), false, 'interrupted enemy strike does not hit');
});

test('equal speed resolves simultaneously and both attacks hit', () => {
  const player = { kind: 'attack', speed: 4 };
  const enemy = { kind: 'attack', speed: 4 };
  const events = resolvePair(player, enemy, d20Face(20));

  const order = find(events, 'order');
  assert.equal(order.simultaneous, true);
  assert.equal(order.first, null);
  assert.equal(hitsOf(events).length, 2);
  assert.equal(find(events, 'interrupted'), undefined);
});

test('tie: counter does not cancel a tied attack', () => {
  const player = { kind: 'counter', speed: 3 };
  const enemy = { kind: 'attack', speed: 3 };
  const events = resolvePair(player, enemy, d20Face(20));

  assert.equal(find(events, 'countered'), undefined);
  assert.equal(hitsOf(events).some((e) => e.by === 'enemy'), true);
});

test('tie tags: counterDamage adds damage to the opponent', () => {
  const player = { kind: 'attack', speed: 2, tags: ['counterDamage'] };
  const enemy = { kind: 'attack', speed: 2 };
  const events = resolvePair(player, enemy, d20Face(20));

  assert.deepEqual(find(events, 'counterDamage'), { type: 'counterDamage', by: 'player', target: 'enemy' });
});

test('tie tags: stun applies to the opponent unless it has hyper armor', () => {
  const plain = resolvePair(
    { kind: 'attack', speed: 2, tags: ['stun'] },
    { kind: 'attack', speed: 2 },
    d20Face(20),
  );
  assert.deepEqual(find(plain, 'status'), { type: 'status', status: 'stun', target: 'enemy' });

  const armored = resolvePair(
    { kind: 'attack', speed: 2, tags: ['stagger'] },
    { kind: 'attack', speed: 2, tags: ['hyperArmor'] },
    d20Face(20),
  );
  assert.equal(find(armored, 'status'), undefined);
  assert.deepEqual(find(armored, 'resisted'), { type: 'resisted', status: 'stagger', target: 'enemy' });
});

test('stagger outside a tie does nothing', () => {
  const events = resolvePair(
    { kind: 'attack', speed: 5, tags: ['stagger'] },
    { kind: 'attack', speed: 2 },
    d20Face(20),
  );
  assert.equal(find(events, 'status'), undefined);
  assert.equal(find(events, 'resisted'), undefined);
});

test('hyper armor: a slower attack is not interrupted by a faster hit', () => {
  const player = { kind: 'attack', speed: 4 };
  const enemy = { kind: 'attack', speed: 3, tags: ['hyperArmor'] };
  const events = resolvePair(player, enemy, d20Face(20));

  assert.equal(find(events, 'interrupted'), undefined);
  assert.equal(find(events, 'hyperArmor').side, 'enemy');
  assert.equal(hitsOf(events).some((e) => e.by === 'enemy'), true, 'armored enemy still hits');
});

test('hyper armor: without it, the same slower attack is interrupted', () => {
  const player = { kind: 'attack', speed: 4 };
  const enemy = { kind: 'attack', speed: 3 };
  const events = resolvePair(player, enemy, d20Face(20));

  assert.equal(find(events, 'interrupted').side, 'enemy');
  assert.equal(hitsOf(events).some((e) => e.by === 'enemy'), false);
});

test('momentum is clamped to -3..+3 in actionSpeed', () => {
  assert.equal(clampMomentum(9), 3);
  assert.equal(clampMomentum(-9), -3);
  assert.equal(clampMomentum(2), 2);
  assert.equal(clampMomentum(NaN), 0);

  const high = actionSpeed({ card: 'strike', momentum: 9 }, { card: { strike: 1 } });
  assert.equal(high.parts.momentum, 1);
  assert.equal(high.total, 2);

  const low = actionSpeed({ card: 'strike', momentum: -9 }, { card: { strike: 1 } });
  assert.equal(low.parts.momentum, -1);
  assert.equal(low.total, 0);

  // The enemy side applies -M, so the same shared value helps the other side.
  const enemyHigh = actionSpeed({ card: 'strike', momentum: 9 }, { card: { strike: 1 } }, 'enemy');
  assert.equal(enemyHigh.parts.momentum, -1);
  assert.equal(enemyHigh.total, 0);
  const enemyLow = actionSpeed({ card: 'strike', momentum: -9 }, { card: { strike: 1 } }, 'enemy');
  assert.equal(enemyLow.parts.momentum, 1);
  assert.equal(enemyLow.total, 2);

  assert.throws(() => actionSpeed({}, {}, 'bogus'), TypeError);
});

test('actionSpeed: owner table sums; a TBD (blank) value counts as 0', () => {
  const mods = {
    card: { strike: 1, counter: 3 },
    weapon: { dagger: 2 },
    armor: { heavy: -3 },
    range: { near: null },
  };
  const counter = actionSpeed({ card: 'counter', weapon: 'dagger' }, mods);
  assert.equal(counter.total, 5);
  assert.equal(counter.parts.range, 0);

  // Open question a: the owner's example as written (dagger +2, heavy -3,
  // strike 1, momentum +1) totals +1 by the stated table, not +4. Under the
  // half-value speed rule, momentum +1 adds 0, so the total is 0 (flagged).
  const example = actionSpeed({ card: 'strike', weapon: 'dagger', armor: 'heavy', momentum: 1 }, mods);
  assert.equal(example.total, 0);
});

test('hit roll at AC 8: Reaver STR3 DEX1 WIS1 INT1 needs 3 or more', () => {
  const reaver = { accuracy: 0, attrs: REAVER, evasion: 0 };
  assert.equal(hitRoll(reaver, 3).need, 3);
  assert.equal(hitRoll(reaver, 2).hit, false);
  assert.equal(hitRoll(reaver, 3).hit, true);
  assert.equal(hitRoll(reaver, 20).hit, true);
});

test('hit roll: plain AC 8 with no attributes needs 8', () => {
  assert.equal(hitRoll({ evasion: 0 }, 7).hit, false);
  assert.equal(hitRoll({ evasion: 0 }, 8).hit, true);
  assert.equal(hitRoll({ evasion: 0 }, 8).need, 8);
});

test('hit roll: evasion raises the target and accuracy lowers it', () => {
  assert.equal(hitRoll({ accuracy: 2, attrs: REAVER, evasion: 2 }, 3).need, 3);
  assert.equal(hitRoll({ accuracy: 0, attrs: REAVER, evasion: 2 }, 5).hit, true);
  assert.equal(hitRoll({ accuracy: 0, attrs: REAVER, evasion: 2 }, 4).hit, false);
});

test('hit roll rejects a d20 outside 1..20', () => {
  assert.throws(() => hitRoll({}, 0), RangeError);
  assert.throws(() => hitRoll({}, 21), RangeError);
});

test('rollD20 maps [0, 1) to 1..20 and rejects an out-of-range rng', () => {
  assert.equal(rollD20(() => 0), 1);
  assert.equal(rollD20(() => 0.999999), 20);
  assert.throws(() => rollD20(() => 1), RangeError);
});

test('resolveRound: a counter that triggers moves that enemy M toward the player', () => {
  const queue = [{ id: 'strike', speed: 4, kind: 'attack' }];
  const { events, momentum } = resolveRound([{ id: 'counter', slot: 0, speed: 5, kind: 'counter' }], queue, 1, d20Face(20));

  assert.equal(find(events, 'countered').by, 'player');
  assert.equal(momentum.strike, 1);
  assert.deepEqual(find(events, 'momentum'), {
    type: 'momentum', enemyId: 'strike', by: 'player', gain: 1, bonus: 0, delta: 1, reason: 'success', slot: 0, momentum: 0,
  });
});

test('resolveRound: a player card countered by an enemy counter moves M toward the enemy', () => {
  const queue = [{ id: 'counter', speed: 5, kind: 'counter' }];
  const { events, momentum } = resolveRound([{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }], queue, 0, d20Face(20));

  assert.equal(find(events, 'countered').by, 'enemy');
  assert.equal(momentum.counter, -1);
  assert.equal(find(events, 'momentum').by, 'enemy');
});

test('resolveRound: a second card on a taken slot is rejected and moves nothing', () => {
  const queue = [{ id: 'a', speed: 1, kind: 'other' }, { id: 'b', speed: 1, kind: 'other' }];
  const playerCards = [
    { id: 'quickstep', slot: 0, speed: 2, kind: 'other' },
    { id: 'shieldBash', slot: 0, speed: 2, kind: 'attack' },
  ];
  const { events, momentum } = resolveRound(playerCards, queue, 2, d20Face(20));

  assert.deepEqual(find(events, 'rejected'), {
    type: 'rejected', reason: 'slot taken', slot: 0, cardId: 'shieldBash', momentum: null,
  });
  assert.equal(events.some((e) => e.type === 'momentum'), false);
  assert.deepEqual(momentum, { a: 0, b: 0 });
});

test('owner trace, per enemy and round end: 0/0, +1/-1, 0/0, -1/+1', () => {
  // All three rounds face the same enemy, 'foe' (enemyId), so M_foe carries over.
  const foe = (id, speed, kind) => ({ id, enemyId: 'foe', speed, kind });
  // Round 1 (M = 0): player Strike at 4 hits first over enemy strike at 3.
  const step1 = resolveRound([{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }], [foe('enemyStrike', 3, 'attack')], 1, d20Face(20));
  // Round 2 (M = +1): half of +1 is 0, so player attack 2, enemy counter 5. Enemy counters.
  const step2 = resolveRound(
    [{ id: 'strike', slot: 0, speed: 2, kind: 'attack' }],
    [foe('counter', 5, 'counter')],
    1,
    d20Face(20),
    { momentum: step1.momentum },
  );
  // Round 3 (M = 0): enemy strike at 4 hits first over player strike at 3.
  const step3 = resolveRound(
    [{ id: 'strike', slot: 0, speed: 3, kind: 'attack' }],
    [foe('enemyStrike', 4, 'attack')],
    1,
    d20Face(20),
    { momentum: step2.momentum },
  );

  const values = [0, step1.momentum.foe, step2.momentum.foe, step3.momentum.foe].map((m) => ({ player: m, enemy: 0 - m }));
  assert.deepEqual(values, [
    { player: 0, enemy: 0 },
    { player: 1, enemy: -1 },
    { player: 0, enemy: 0 },
    { player: -1, enemy: 1 },
  ]);
  assert.equal(find(step2.events, 'countered').by, 'enemy');
  assert.equal(find(step3.events, 'hit').by, 'enemy');
});

test('per enemy: one enemy\'s M does not move another enemy\'s value', () => {
  const queue = [{ id: 'a', speed: 1, kind: 'other' }, { id: 'b', speed: 1, kind: 'other' }];
  const { momentum } = resolveRound([{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }], queue, 2, d20Face(20));
  assert.deepEqual(momentum, { a: 1, b: 0 });
});

test('zero-sum: player value + enemy value is always 0, and round deltas add up to the change', () => {
  for (let m = -3; m <= 3; m++) {
    const p = actionSpeed({ card: 'strike', momentum: m }, { card: { strike: 1 } }, 'player');
    const e = actionSpeed({ card: 'strike', momentum: m }, { card: { strike: 1 } }, 'enemy');
    assert.equal(p.parts.momentum + e.parts.momentum, 0);
    assert.equal(p.total - e.total, 2 * momentumSpeed(m));
  }

  const seq = [0.1, 0.7, 0.4, 0.9, 0.2, 0.55];
  let i = 0;
  const rng = () => seq[i++ % seq.length];
  let map = {};
  for (let round = 0; round < 25; round++) {
    const playerCards = [
      { id: 'a', slot: 0, speed: 1 + (round % 4), kind: round % 2 ? 'attack' : 'counter' },
      { id: 'b', slot: 1, speed: 2, kind: 'attack' },
      { id: 'c', slot: 2, speed: 1, kind: 'counter' },
    ];
    const queue = [
      { id: 'x', enemyId: 'x', speed: 2, kind: 'attack' },
      { id: 'y', enemyId: 'y', speed: 3, kind: 'counter' },
      { id: 'z', enemyId: 'z', speed: 1, kind: 'attack' },
    ];
    const out = resolveRound(playerCards, queue, 3, rng, { momentum: map });
    for (const k of ['x', 'y', 'z']) {
      const moves = out.events.filter((e) => e.type === 'momentum' && e.enemyId === k);
      for (const mv of moves) {
        assert.equal(mv.by === 'player' ? mv.delta >= 0 : mv.delta <= 0, true, 'a move helps only its actor');
      }
      const raw = moves.reduce((sum, mv) => sum + mv.delta, 0);
      assert.equal(out.momentum[k], clampMomentum((map[k] ?? 0) + raw));
      assert.ok(out.momentum[k] >= -3 && out.momentum[k] <= 3);
    }
    map = out.momentum;
  }
});

test('clamp: from +3 a player success stays at +3, and an enemy success goes to +2', () => {
  const up = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    1,
    d20Face(20),
    { momentum: { e: 3 } },
  );
  assert.equal(up.momentum.e, 3);
  assert.equal(find(up.events, 'momentum').delta, 1, 'the raw success is still +1; the clamp is at round end');

  const down = resolveRound(
    [{ id: 'strike', slot: 0, speed: 1, kind: 'attack' }],
    [{ id: 'enemyStrike', speed: 9, kind: 'attack' }],
    1,
    d20Face(20),
    { momentum: { enemyStrike: 3 } },
  );
  assert.equal(find(down.events, 'hit').by, 'enemy');
  assert.equal(down.momentum.enemyStrike, 2);
});

test('momentumGain: a card with momentumGain 2 moves M by 2 on success', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'heavy', slot: 0, speed: 4, kind: 'attack', momentumGain: 2 }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    0,
    d20Face(20),
  );
  assert.equal(momentum.e, 2);
  assert.equal(find(events, 'momentum').gain, 2);
  assert.equal(find(events, 'momentum').delta, 2);
});

test('a miss does not move M', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    1,
    d20Face(1),
  );
  assert.equal(find(events, 'hit').hit, false);
  assert.equal(events.some((e) => e.type === 'momentum'), false);
  assert.equal(momentum.e, 0);
});

test('round end: a later slot in the same round does not see the change', () => {
  const queue = [
    { id: 'a', enemyId: 'boss', speed: 1, kind: 'other' },
    { id: 'b', enemyId: 'boss', speed: 3, kind: 'attack' },
  ];
  const playerCards = [
    { id: 'strike', slot: 0, speed: 4, kind: 'attack' },
    { id: 'strike2', slot: 1, speed: 3, kind: 'attack' },
  ];
  const { events, momentum } = resolveRound(playerCards, queue, 2, d20Face(20));

  const orders = events.filter((e) => e.type === 'order');
  assert.deepEqual(orders[0].speeds, { player: 4, enemy: 1 });
  // Pair 1 still uses the starting M (0), so 3 vs 3 is a tie, not 4 vs 2.
  assert.deepEqual(orders[1].speeds, { player: 3, enemy: 3 });
  assert.equal(orders[1].simultaneous, true);
  assert.equal(momentum.boss, 1);
  assert.deepEqual(find(events, 'momentumApplied'), {
    type: 'momentumApplied', enemyId: 'boss', from: 0, delta: 1, to: 1, momentum: 1,
  });
});

test('resolveRound rejects a momentum value that is not an object keyed by enemy', () => {
  assert.throws(() => resolveRound([], [], 0, d20Face(20), { momentum: 3 }), TypeError);
});

// Every source_type in speed-mods.csv must name a component that actionSpeed()
// reads. The list mirrors COMPONENTS in resolver.mjs.
const SPEED_COMPONENTS = ['card', 'weapon', 'armor', 'range', 'attackType', 'skill', 'initiative'];

test('speed-mods.csv: every source_type maps to an actionSpeed component', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = fileURLToPath(new URL('./speed-mods.csv', import.meta.url));
  const rows = readFileSync(path, 'utf8').trim().split('\n');
  const header = rows.shift().split(',');
  assert.deepEqual(header.slice(0, 4), ['source_type', 'source', 'mod', 'status']);

  const bad = [];
  for (const line of rows) {
    const sourceType = line.split(',')[0];
    if (!SPEED_COMPONENTS.includes(sourceType)) bad.push(`${sourceType} (${line.split(',')[1]})`);
  }
  assert.deepEqual(bad, [], 'source_type values with no matching component');
});

// Codex finding 1: momentum is summed for the whole pair, then clamped once.
// Both sides land in one tie: the player's +1 and the enemy's -1 net to 0, so
// M must stay where it was. Shift-then-clamp per side ends at +2 from +3.
test('clamp after netting: a tie that lands on both sides at +3 stays at +3', () => {
  // Effective speeds at M = +3 (half is +1): player 1+1 = 2, enemy 3-1 = 2, a tie.
  const { momentum } = resolveRound(
    [{ id: 'p', slot: 0, speed: 1, kind: 'attack' }],
    [{ id: 'e', speed: 3, kind: 'attack' }],
    1,
    d20Face(20),
    { momentum: { e: 3 } },
  );
  assert.equal(momentum.e, 3);
});

// Passes on c8776f4fd too: that code always shifts the player first, which
// happens to be the right result at -3. It is kept as the symmetric guard.
test('clamp after netting: the mirrored tie at -3 stays at -3', () => {
  // Effective speeds at M = -3 (half is -1): player 3-1 = 2, enemy 1+1 = 2, a tie.
  const { momentum } = resolveRound(
    [{ id: 'p', slot: 0, speed: 3, kind: 'attack' }],
    [{ id: 'e', speed: 1, kind: 'attack' }],
    1,
    d20Face(20),
    { momentum: { e: -3 } },
  );
  assert.equal(momentum.e, -3);
});

// Codex finding 2: Block >= damage is a full block. It emits 'absorbed' and
// the success goes to the blocking side, not to the attacker's landed hit.
test('full block: Block >= damage emits absorbed and credits the blocker', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack', damage: 2 }],
    [{ id: 'guard', speed: 1, kind: 'other', block: 2 }],
    1,
    d20Face(20),
  );
  assert.deepEqual(find(events, 'absorbed'), { type: 'absorbed', by: 'enemy', target: 'player', slot: 0, visible: true, momentum: 0 });
  assert.equal(find(events, 'hit').blocked, true);
  assert.equal(events.some((e) => e.type === 'interrupted'), false, 'a fully blocked hit does not interrupt');
  assert.equal(momentum.guard, -1, 'the blocker wins the slot, so M moves toward the enemy');
});

test('partial block: Block below damage still lands, and the attacker wins the slot', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack', damage: 2 }],
    [{ id: 'guard', speed: 1, kind: 'other', block: 1 }],
    1,
    d20Face(20),
  );
  assert.equal(events.some((e) => e.type === 'absorbed'), false);
  assert.equal(find(events, 'hit').blocked, false);
  assert.equal(momentum.guard, 1);
});

test('evade: a miss against an evade action wins the slot for the defender', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'dodger', speed: 1, kind: 'other', stance: 'evade' }],
    1,
    d20Face(1),
  );
  assert.deepEqual(find(events, 'evaded'), { type: 'evaded', by: 'enemy', target: 'player', slot: 0, visible: true, momentum: 0 });
  assert.equal(momentum.dodger, -1);
});

test('a plain miss with no defensive action still moves nothing', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'idle', speed: 1, kind: 'other' }],
    1,
    d20Face(1),
  );
  assert.equal(events.some((e) => e.type === 'evaded'), false);
  assert.equal(momentum.idle, 0);
});

// Stance advantage (rule 3). The table is data: stance-advantage.csv.
const STANCE_CSV = resolve(here, 'stance-advantage.csv');
const stanceTable = () => parseStanceAdvantage(readFileSync(STANCE_CSV, 'utf8'));

test('stance-advantage.csv: owner rows are present and every stance is in the tree', () => {
  const table = stanceTable();
  assert.equal(table.get('smash>block'), 2, 'smash beats guard and breaks it for +2');
  assert.equal(table.get('counter>attack'), 1, 'counter beats attack for +1');
  const tree = new Set(['attack', 'smash', 'sweep', 'block', 'evade', 'counter']);
  for (const key of table.keys()) {
    const [a, d] = key.split('>');
    assert.equal(tree.has(a) && tree.has(d), true, `unknown stance in ${key}`);
  }
});

test('stance-advantage.csv parser: a blank bonus defaults to 1, and a bad header throws', () => {
  const t = parseStanceAdvantage('attacker_stance,defender_stance,bonus,note\nsmash,block,,blank\nsweep,evade,3,x\n');
  assert.equal(t.get('smash>block'), 1);
  assert.equal(t.get('sweep>evade'), 3);
  assert.throws(() => parseStanceAdvantage('stance,against\n'), TypeError);
});

test('a winning stance adds its bonus: smash beating block gains 1 + 2', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'smash', slot: 0, speed: 4, kind: 'attack', stance: 'smash' }],
    [{ id: 'guard', speed: 1, kind: 'other', stance: 'block' }],
    1,
    d20Face(20),
    { stanceAdvantage: stanceTable() },
  );
  assert.equal(find(events, 'momentum').bonus, 2);
  assert.equal(momentum.guard, 3);
});

test('without a stance table, the same win is worth only the base 1', () => {
  const { momentum } = resolveRound(
    [{ id: 'smash', slot: 0, speed: 4, kind: 'attack', stance: 'smash' }],
    [{ id: 'guard', speed: 1, kind: 'other', stance: 'block' }],
    1,
    d20Face(20),
  );
  assert.equal(momentum.guard, 1);
});

test('a counter that fires against an attack gains its bonus too', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'counter', slot: 0, speed: 5, kind: 'counter', stance: 'counter' }],
    [{ id: 'foe', speed: 4, kind: 'attack', stance: 'attack' }],
    1,
    d20Face(20),
    { stanceAdvantage: stanceTable() },
  );
  assert.equal(find(events, 'countered').by, 'player');
  assert.equal(momentum.foe, 2, 'base 1 plus counter-over-attack bonus 1');
});

test('the bonus goes to the winning stance only', () => {
  const { momentum } = resolveRound(
    [{ id: 'block', slot: 0, speed: 1, kind: 'other', stance: 'block' }],
    [{ id: 'foe', speed: 4, kind: 'attack', stance: 'smash' }],
    1,
    d20Face(20),
    { stanceAdvantage: stanceTable() },
  );
  // Smash wins and earns its +2 (total -3). Block loses, so it earns no bonus.
  assert.equal(momentum.foe, -3);
});

// Owner example: if a counter staggers the attacker, the counter-user gains
// full momentum, which sets M_e to +-3 in their favour (round end).
test('counter stagger: a counter that staggers the attacker sets M_e to +3 for the player', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'counter', slot: 0, speed: 5, kind: 'counter', stance: 'counter', tags: ['stagger'] }],
    [{ id: 'foe', speed: 4, kind: 'attack', stance: 'attack' }],
    1,
    d20Face(20),
    { stanceAdvantage: stanceTable() },
  );
  assert.deepEqual(find(events, 'status'), { type: 'status', status: 'stagger', target: 'enemy', slot: 0, visible: true, momentum: 0 });
  assert.equal(momentum.foe, 3);
  assert.deepEqual(find(events, 'momentum').reason, 'success');
  assert.equal(events.find((e) => e.reason === 'counterStagger').set, 3);
});

test('counter stagger: when the enemy counter staggers the player, M_e is set to -3', () => {
  const { momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack', stance: 'attack' }],
    [{ id: 'foe', speed: 5, kind: 'counter', stance: 'counter', tags: ['stagger'] }],
    1,
    d20Face(20),
  );
  assert.equal(momentum.foe, -3);
});

test('counter stagger: hyper armor resists the stagger, so no full momentum', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'counter', slot: 0, speed: 5, kind: 'counter', tags: ['stagger'] }],
    [{ id: 'foe', speed: 4, kind: 'attack', tags: ['hyperArmor'] }],
    1,
    d20Face(20),
  );
  assert.equal(find(events, 'resisted').status, 'stagger');
  assert.equal(events.some((e) => e.reason === 'counterStagger'), false);
  assert.equal(momentum.foe, 1);
});

test('counter stagger: a counter that only stuns sets no full momentum, so the normal slot win applies', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'counter', slot: 0, speed: 5, kind: 'counter', tags: ['stun'] }],
    [{ id: 'foe', speed: 4, kind: 'attack' }],
    1,
    d20Face(20),
  );
  assert.deepEqual(find(events, 'status'), { type: 'status', status: 'stun', target: 'enemy', slot: 0, visible: true, momentum: 0 });
  assert.equal(events.some((e) => e.reason === 'counterStagger'), false);
  assert.equal(momentum.foe, 1);
});

// Momentum adds half its value to speed, truncated toward zero (owner, 2026-10-11).
// +-1 gives 0, +-2 gives +-1, +-3 gives +-1. (Flagged: "rounded down" read as truncation.)
test('momentum adds half its value to speed, truncated toward zero', () => {
  const shifts = { '-3': -1, '-2': -1, '-1': 0, '0': 0, '1': 0, '2': 1, '3': 1 };
  for (const [m, shift] of Object.entries(shifts)) {
    const v = Number(m);
    assert.equal(momentumSpeed(v), shift);
    const p = actionSpeed({ card: 'strike', momentum: v }, { card: { strike: 1 } }, 'player');
    const e = actionSpeed({ card: 'strike', momentum: v }, { card: { strike: 1 } }, 'enemy');
    assert.equal(p.parts.momentum, shift);
    assert.equal(e.parts.momentum, 0 - shift);
  }
});

test('momentum +2 adds +1 to the player pairing speed in resolveRound', () => {
  const { events } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'foe', speed: 4, kind: 'other' }],
    1,
    d20Face(1),
    { momentum: { foe: 2 } },
  );
  assert.deepEqual(find(events, 'order').speeds, { player: 5, enemy: 3 });
});

// Card hints (DESIGN.md, Card hints). Speed ids: one=1, two=2, three=3.
const HINT_MODS = { card: { one: 1, two: 2, three: 3 }, weapon: { dagger: 2 } };
const hintCtx = (extra = {}) => ({ mods: HINT_MODS, stanceAdvantage: stanceTable(), ...extra });

test('cardHint: SPEED_TIERS placeholder is strong 2, slight 1', () => {
  assert.deepEqual(SPEED_TIERS, { strong: 2, slight: 1 });
});

test('cardHint: green when faster and the stance beats the enemy stance', () => {
  // counter (3) beats strike (1) on speed; counter beats attack in the CSV.
  const hint = cardHint({ card: 'three', stance: 'counter' }, { card: 'one', stance: 'attack' }, hintCtx());
  assert.equal(hint.border, 'green');
});

test('cardHint: yellow when only speed is in the card\'s favour', () => {
  // Faster (3 vs 1), but attack>attack is not in the CSV.
  const hint = cardHint({ card: 'three', stance: 'attack' }, { card: 'one', stance: 'attack' }, hintCtx());
  assert.equal(hint.border, 'yellow');
});

test('cardHint: yellow when only the stance is in the card\'s favour', () => {
  // Slower (1 vs 3), but smash beats block in the CSV.
  const hint = cardHint({ card: 'one', stance: 'smash' }, { card: 'three', stance: 'block' }, hintCtx());
  assert.equal(hint.border, 'yellow');
});

test('cardHint: red when neither speed nor stance is in the card\'s favour', () => {
  const hint = cardHint({ card: 'one', stance: 'attack' }, { card: 'three', stance: 'attack' }, hintCtx());
  assert.equal(hint.border, 'red');
});

test('cardHint: blue for a self-target card, with no arrow', () => {
  const hint = cardHint({ card: 'three', stance: 'smash', target: 'self' }, { card: 'one', stance: 'block' }, hintCtx());
  assert.equal(hint.border, 'blue');
  assert.equal(hint.arrow, null);
  assert.equal(hint.speedDelta, 2);
});

test('cardHint: arrow tiers >> > 0 < << and thresholds from SPEED_TIERS', () => {
  const stance = { stance: 'attack' };
  const arrow = (p, e, ctx = hintCtx()) => cardHint({ card: p, ...stance }, { card: e, ...stance }, ctx).arrow;

  assert.deepEqual(arrow('three', 'one'), { glyph: '>>', colour: 'green' }, 'delta +2');
  assert.deepEqual(arrow('two', 'one'), { glyph: '>', colour: 'yellow' }, 'delta +1');
  assert.equal(arrow('one', 'one'), null, 'delta 0 has no arrow');
  assert.deepEqual(arrow('one', 'two'), { glyph: '<', colour: 'yellow' }, 'delta -1');
  assert.deepEqual(arrow('one', 'three'), { glyph: '<<', colour: 'red' }, 'delta -2');

  // Speed difference is reported exactly, and the arrow follows SPEED_TIERS.
  assert.equal(cardHint({ card: 'two', ...stance }, { card: 'one', ...stance }, hintCtx()).speedDelta, 1);
});

test('cardHint: breakdown lists every speed term and sums to the player total', () => {
  const card = { card: 'three', weapon: 'dagger', armor: 'heavy', stance: 'attack' };
  const enemy = { card: 'one', stance: 'attack' };
  const mods = { ...HINT_MODS, armor: { heavy: -3 } };
  const hint = cardHint(card, enemy, hintCtx({ mods }));

  assert.deepEqual(
    hint.breakdown.map((b) => b.term),
    ['base', 'weapon', 'armor', 'range', 'attackType', 'skill', 'initiative', 'momentum'],
  );
  assert.deepEqual(hint.breakdown.find((b) => b.term === 'weapon'), { term: 'weapon', value: 2 });
  assert.deepEqual(hint.breakdown.find((b) => b.term === 'armor'), { term: 'armor', value: -3 });
  const sum = hint.breakdown.reduce((n, b) => n + b.value, 0);
  assert.equal(sum, 3 + 2 - 3);
});

test('cardHint: momentum term is trunc(M_e / 2) on the player breakdown', () => {
  const card = { card: 'one', stance: 'attack' };
  const enemy = { card: 'one', stance: 'attack' };
  const momentumOf = (m) => cardHint(card, enemy, hintCtx({ momentum: m })).breakdown.find((b) => b.term === 'momentum').value;

  assert.equal(momentumOf(2), 1);
  assert.equal(momentumOf(-3), -1);
  assert.equal(momentumOf(1), 0);
  assert.equal(momentumOf(-1), 0);
});

test('cardHint: momentum moves the speed delta the same way as resolveRound (player +, enemy -)', () => {
  const card = { card: 'one', stance: 'attack' };
  const enemy = { card: 'one', stance: 'attack' };
  // M_e = +2: player 1 + 1 = 2, enemy 1 - 1 = 0, so the delta is +2.
  const hint = cardHint(card, enemy, hintCtx({ momentum: 2 }));
  assert.equal(hint.speedDelta, 2);
  assert.deepEqual(hint.arrow, { glyph: '>>', colour: 'green' });
});
