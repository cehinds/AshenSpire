// Tests for the simultaneous-action resolver prototype (node:test).
// Run: node --test docs/simultaneous-action/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionSpeed,
  clampMomentum,
  hitRoll,
  resolvePair,
  resolveRound,
  rollD20,
} from './resolver.mjs';

// Fixed RNG: returns a float that maps to the wanted d20 face.
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
  assert.equal(high.parts.momentum, 3);
  assert.equal(high.total, 4);

  const low = actionSpeed({ card: 'strike', momentum: -9 }, { card: { strike: 1 } });
  assert.equal(low.parts.momentum, -3);
  assert.equal(low.total, -2);
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
  // strike 1, momentum +1) totals +1 by the stated table, not +4.
  const example = actionSpeed({ card: 'strike', weapon: 'dagger', armor: 'heavy', momentum: 1 }, mods);
  assert.equal(example.total, 1);
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

test('resolveRound: correct counter gives +1, countered card gives -1', () => {
  const queue = [
    { id: 'strike', speed: 4, kind: 'attack' },
    { id: 'strike2', speed: 4, kind: 'attack' },
    { id: 'lunge', speed: 1, kind: 'attack' },
  ];
  const playerCards = [
    { id: 'counter', slot: 0, speed: 5, kind: 'counter' },
    { id: 'strike', slot: 1, speed: 3, kind: 'attack' },
  ];
  const { events, momentumDelta } = resolveRound(playerCards, queue, 3, d20Face(20));

  // Slot 0: counter at 5 beats strike at 4 (+1). Slot 1: enemy attack at 4 is
  // faster than the player's strike at 3, so the strike is interrupted (no momentum).
  assert.equal(momentumDelta, 1);
  assert.equal(events.some((e) => e.type === 'momentum' && e.reason === 'correctCounter'), true);
  assert.equal(events.some((e) => e.type === 'unpaired' && e.slot === 2), true);
});

test('resolveRound: a player card countered by an enemy counter gives -1', () => {
  const queue = [{ id: 'counter', speed: 5, kind: 'counter' }, { id: 'a', speed: 1, kind: 'other' }, { id: 'b', speed: 1, kind: 'other' }];
  const { momentumDelta } = resolveRound([{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }], queue, 0, d20Face(20));
  assert.equal(momentumDelta, -1);
});

test('resolveRound: a listed combo played back to back gives +1, and a second card on a slot is rejected', () => {
  const queue = [{ id: 'a', speed: 1, kind: 'other' }, { id: 'b', speed: 1, kind: 'other' }, { id: 'c', speed: 1, kind: 'other' }];
  const playerCards = [
    { id: 'quickstep', slot: 0, speed: 2, kind: 'other' },
    { id: 'shieldBash', slot: 1, speed: 2, kind: 'other' },
    { id: 'strike', slot: 1, speed: 1, kind: 'attack' },
  ];
  const { events, momentumDelta } = resolveRound(playerCards, queue, 3, d20Face(20), {
    combos: [['quickstep', 'shieldBash']],
  });
  assert.equal(momentumDelta, 1);
  assert.deepEqual(find(events, 'rejected'), { type: 'rejected', reason: 'slot taken', slot: 1, cardId: 'strike' });
});

test('resolveRound: perception tags visibility only; out-of-range slot throws', () => {
  const queue = [{ id: 'a', speed: 1, kind: 'other' }, { id: 'b', speed: 1, kind: 'other' }, { id: 'c', speed: 1, kind: 'other' }];
  const { events } = resolveRound([], queue, 1, d20Face(20));
  const unpaired = events.filter((e) => e.type === 'unpaired');
  assert.deepEqual(unpaired.map((e) => e.visible), [true, false, false]);

  assert.throws(() => resolveRound([{ id: 'x', slot: 3, speed: 1 }], queue, 3, d20Face(20)), RangeError);
});

test('same RNG seed gives the same events (no Math.random)', () => {
  const player = { kind: 'attack', speed: 4, accuracy: 1, attrs: REAVER };
  const enemy = { kind: 'attack', speed: 4, evasion: 1 };
  const seq = [0.1, 0.7, 0.4, 0.9];
  const run = () => {
    let i = 0;
    return resolvePair(player, enemy, () => seq[i++ % seq.length]);
  };
  assert.deepEqual(run(), run());
});

test('a faster attack that misses does not interrupt the slower action', () => {
  const player = { kind: 'attack', speed: 4, accuracy: 0, attrs: {}, evasion: 0 };
  const enemy = { kind: 'attack', speed: 3, evasion: 0 };
  const events = resolvePair(player, enemy, d20Face(1));

  assert.equal(find(events, 'interrupted'), undefined, 'a miss must not interrupt');
  assert.equal(hitsOf(events).find((e) => e.by === 'player').hit, false);
  assert.equal(hitsOf(events).some((e) => e.by === 'enemy'), true, 'enemy action still resolves');
});

test('owner example: strike at +4 against an enemy counter at +3 is not countered', () => {
  const strike = { kind: 'attack', speed: 4, id: 'strike' };
  const counter = { kind: 'counter', speed: 3, id: 'counter' };
  const events = resolvePair(strike, counter, d20Face(20));

  assert.equal(find(events, 'order').first, 'player');
  assert.equal(find(events, 'countered'), undefined, 'a slower counter cannot cancel a faster strike');
  assert.equal(hitsOf(events).find((e) => e.by === 'player').hit, true, 'player hit is present');
});
