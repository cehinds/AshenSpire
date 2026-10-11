// alternative-combat-rounds: tests for the resolver prototype (node:test).
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
  revealAction,
  clampStage,
  STANCE_GROUPS,
  activeEvadeBonuses,
  parseEvadeBonus,
  decayMomentum,
  accuracyFor,
  evasionFor,
  parseEvasionArmor,
  parseEvasionCards,
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

// The required die is clamped to 2..16 (DESIGN.md, Hit roll): a hit is at least
// 25% and a miss at most 75%, and natural 1 still misses.
test('hit roll: the required die is clamped to 16 at the top, so accuracy 0 and evasion 20 needs 16', () => {
  assert.equal(hitRoll({ accuracy: 0, evasion: 20 }, 15).hit, false);
  assert.equal(hitRoll({ accuracy: 0, evasion: 20 }, 16).hit, true);
  assert.equal(hitRoll({ accuracy: 0, evasion: 20 }, 16).need, 16);
  assert.equal(hitRoll({ accuracy: 0, evasion: 20 }, 20).hit, true);
});

test('hit roll: the required die is clamped to 2 at the bottom, and natural 1 still misses', () => {
  assert.equal(hitRoll({ accuracy: 30, evasion: 0 }, 1).hit, false);
  assert.equal(hitRoll({ accuracy: 30, evasion: 0 }, 1).need, 2);
  assert.equal(hitRoll({ accuracy: 30, evasion: 0 }, 2).hit, true);
});

// Enemy accuracy 5: the miss chance is (2 + evasion) / 20 for these evasions.
test('hit roll: enemy accuracy 5 misses (2 + evasion) of 20 faces, exhaustively', () => {
  for (const evasion of [0, 1, 3, 8]) {
    let missed = 0;
    for (let face = 1; face <= 20; face += 1) {
      if (!hitRoll({ accuracy: 5, evasion }, face).hit) missed += 1;
    }
    assert.equal(missed, 2 + evasion, `evasion ${evasion}`);
  }
});

// Accuracy = floor(STR + DEX + WIS/2 + INT/2) + floor(level / 5) + attack tag
// (DESIGN.md, Hit roll). `accuracy` is an extra flat bonus.
test('accuracyFor: level 1 Reaver STR3 DEX1 WIS1 INT1 has accuracy 5', () => {
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: [] }), 5);
});

test('accuracyFor: level 5 adds one, so the same Reaver has accuracy 6', () => {
  assert.equal(accuracyFor({ attrs: REAVER, level: 5, tags: [] }), 6);
  assert.equal(accuracyFor({ attrs: REAVER, level: 4, tags: [] }), 5);
});

test('accuracyFor: the quick tag adds 1 and the telegraphed tag takes away 2', () => {
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: ['quick'] }), 6);
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: ['telegraphed'] }), 3);
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: ['stun'] }), 5, 'other tags add nothing');
});

test('accuracyFor: a plain numeric accuracy still works, and an extra bonus adds to the total', () => {
  assert.equal(accuracyFor({ accuracy: 5 }), 5);
  assert.equal(accuracyFor({ attrs: REAVER, accuracy: 2 }), 7);
  assert.equal(accuracyFor({}), 0);
});

// Evasion = armor base + min(DEX - 1, armor DEX cap) + shield + card bonus + extra
// (DESIGN.md, Hit roll). Tables come from evasion-armor.csv and evasion-cards.csv.
const EVASION_ARMOR_CSV = resolve(here, 'evasion-armor.csv');
const EVASION_CARDS_CSV = resolve(here, 'evasion-cards.csv');
const evasionTables = () => ({
  armor: parseEvasionArmor(readFileSync(EVASION_ARMOR_CSV, 'utf8')),
  cards: parseEvasionCards(readFileSync(EVASION_CARDS_CSV, 'utf8')),
});

test('evasion CSV parsers: an empty base, dexCap or bonus cell throws, and the shipped tables still parse', () => {
  assert.throws(() => parseEvasionArmor('armor,base,dexCap\nLeather,,6'), TypeError, 'empty base');
  assert.throws(() => parseEvasionArmor('armor,base,dexCap\nLeather,1,'), TypeError, 'empty dexCap');
  assert.throws(() => parseEvasionArmor('armor,base,dexCap\nLeather,1'), TypeError, 'missing dexCap cell');
  assert.throws(() => parseEvasionCards('card,bonus\nBackstep,'), TypeError, 'empty bonus');
  assert.equal(parseEvasionArmor('armor,base,dexCap\nCloth,0,0').get('Cloth').base, 0, 'a real 0 is still valid');
  assert.equal(parseEvasionCards('card,bonus\nBackstep,0').get('Backstep'), 0, 'a real 0 bonus is still valid');
});

test('evasionFor: Cloth at DEX 1 gives 0', () => {
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1 }, evasionTables()), 0);
});

test('evasionFor: Leather at DEX 3 gives 0 + min(2, 6) = 2', () => {
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 3 }, evasionTables()), 2);
});

// Rogue check (owner, 2026-10-11): Leather, DEX 3 and a buckler is evasion 3, so an
// enemy with accuracy 5 (need 6 on the die) misses 5 of 20 faces, 25%.
test('rogue check: Leather, DEX 3, buckler is evasion 3, and enemy accuracy 5 misses 25%', () => {
  const target = { ...PLAIN_TARGET, evasionArmor: 'Leather', dex: 3, shield: 'buckler' };
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 3, shield: 'buckler' }, evasionTables()), 3);
  let missed = 0;
  for (let face = 1; face <= 20; face += 1) {
    const hit = find(resolvePair(target, { id: 'foe', speed: 1, kind: 'attack', accuracy: 5 }, d20Face(face), { evasionTables: evasionTables() }), 'hit');
    if (!hit.hit) missed += 1;
  }
  assert.equal(missed, 5, 'faces 1 to 5 miss');
  assert.equal(missed / 20, 0.25);
});

test('evasionFor: Plated at DEX 5 gives 1, because its DEX cap is 0', () => {
  assert.equal(evasionFor({ evasionArmor: 'Plated', dex: 5 }, evasionTables()), 1);
});

test('evasionFor: the DEX term is capped by the armor and is never negative', () => {
  assert.equal(evasionFor({ evasionArmor: 'Chain', dex: 9 }, evasionTables()), 1 + 2, 'Chain caps DEX at 2');
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 0 }, evasionTables()), 0, 'DEX 0 adds nothing');
});

test('evasionFor: a buckler adds 1, and another shield adds 0', () => {
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, shield: 'buckler' }, evasionTables()), 1);
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, shield: 'kite' }, evasionTables()), 0);
});

test('evasionFor: Backstep adds 5, and an unknown card throws, like an unknown armor', () => {
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: 'Backstep' }, evasionTables()), 5);
  assert.throws(() => evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: 'Strike' }, evasionTables()), RangeError);
  assert.throws(() => evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: 'backstep' }, evasionTables()), RangeError, 'lookup is case-sensitive');
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: null }, evasionTables()), 0, 'no card given adds 0');
});

test('evasionFor: a plain numeric evasion still works, and an unknown armor name throws', () => {
  assert.equal(evasionFor({ evasion: 4 }), 4);
  assert.equal(evasionFor({}), 0);
  assert.throws(() => evasionFor({ evasionArmor: 'Tinsel', dex: 1 }, evasionTables()), RangeError);
});

// Wiring (DESIGN.md, Hit roll): a side's accuracy comes from accuracyFor() and its
// evasion from evasionFor(). Defender evasion 0 means the target is 8, so the
// attacker's accuracy decides which die hits.
const PLAIN_TARGET = { id: 'guard', slot: 0, speed: 4, kind: 'other' };
const attackerHit = (attacker, face) => resolvePair(
  PLAIN_TARGET,
  { id: 'foe', speed: 1, kind: 'attack', ...attacker },
  d20Face(face),
  {},
);

test('wiring: a level 5 attacker gets accuracy +1, so d20 7 hits (need 7)', () => {
  assert.equal(find(attackerHit({ level: 5 }, 7), 'hit').hit, true);
  assert.equal(find(attackerHit({ level: 0 }, 7), 'hit').hit, false, 'level 0 needs 8');
});

// Expected results through resolvePair: enemy accuracy 5 misses (2 + evasion) of
// 20 faces for these player evasions. Passes before the wiring too, since these
// are plain numbers and their needs sit inside the cap.
test('wiring: enemy accuracy 5 through resolvePair misses (2 + evasion) of 20 faces', () => {
  for (const evasion of [0, 1, 3, 8]) {
    let missed = 0;
    for (let face = 1; face <= 20; face += 1) {
      const hit = find(resolvePair({ ...PLAIN_TARGET, evasion }, { id: 'foe', speed: 1, kind: 'attack', accuracy: 5 }, d20Face(face), {}), 'hit');
      if (!hit.hit) missed += 1;
    }
    assert.equal(missed, 2 + evasion, `evasion ${evasion}`);
  }
});

test('wiring: the telegraphed tag takes 2 off accuracy, so d20 9 misses (need 10)', () => {
  assert.equal(find(attackerHit({ tags: ['telegraphed'] }, 9), 'hit').hit, false);
  assert.equal(find(attackerHit({ tags: [] }, 9), 'hit').hit, true, 'no tag needs 8');
});

test('wiring: an unpaired attack uses playerDefense armor and DEX (Plated DEX 5 gives evasion 1)', () => {
  const { events } = resolveRound(
    [],
    [{ id: 'foe', speed: 1, kind: 'attack' }],
    1,
    d20Face(8),
    { decay: 0, evasionTables: evasionTables(), playerDefense: { evasionArmor: 'Plated', dex: 5 } },
  );
  assert.equal(events.find((e) => e.type === 'hit').hit, false, 'evasion 1 needs 9, so d20 8 misses');
});

// Speed-table ids: an action's `card` (e.g. 'strike') and `armor` (e.g. 'heavy') are
// speed-table keys, not evasion inputs. They must not add evasion or throw.
test('speed ids: a card or armor on an action is not an evasion input (no throw, same hit as evasion 0)', () => {
  const foe = { id: 'foe', speed: 1, kind: 'attack' };
  for (const speedId of [{ card: 'strike' }, { armor: 'heavy' }]) {
    const target = { ...PLAIN_TARGET, ...speedId };
    assert.equal(find(resolvePair(target, foe, d20Face(8), {}), 'hit').hit, true, `${Object.keys(speedId)} d20 8 hits evasion 0`);
    assert.equal(find(resolvePair(target, foe, d20Face(7), {}), 'hit').hit, false, `${Object.keys(speedId)} d20 7 misses`);
  }
});

test('evasionFor: a missing dex takes attrs.DEX, an explicit dex wins, and attrs alone add nothing', () => {
  assert.equal(evasionFor({ evasionArmor: 'Leather', attrs: { DEX: 4 } }, evasionTables()), 3, '0 + min(3, 6)');
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 2, attrs: { DEX: 4 } }, evasionTables()), 1, 'explicit dex 2: 0 + min(1, 6)');
  assert.equal(evasionFor({ attrs: { DEX: 4 } }), 0, 'no evasion input: the plain evasion, 0');
});

test('evasion from attrs.DEX reaches the hit roll: Leather with DEX 4 is evasion 3, needs 11', () => {
  const foe = { id: 'foe', speed: 1, kind: 'attack' };
  const target = { ...PLAIN_TARGET, evasionArmor: 'Leather', attrs: { DEX: 4 } };
  assert.equal(find(resolvePair(target, foe, d20Face(10), { evasionTables: evasionTables() }), 'hit').hit, false);
  assert.equal(find(resolvePair(target, foe, d20Face(11), { evasionTables: evasionTables() }), 'hit').hit, true);
});

test('evasionArmor, evasionCard and shield are the evasion inputs', () => {
  const foe = { id: 'foe', speed: 1, kind: 'attack' };
  const target = { ...PLAIN_TARGET, card: 'strike', evasionArmor: 'Leather', dex: 3 };
  assert.equal(find(resolvePair(target, foe, d20Face(9), { evasionTables: evasionTables() }), 'hit').hit, false, 'Leather DEX 3 is evasion 2, needs 10, so d20 9 misses');
  assert.equal(find(resolvePair(target, foe, d20Face(10), { evasionTables: evasionTables() }), 'hit').hit, true);
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
  // This trace predates momentum decay, so rounds 2 and 3 pass decay: 0. With the
  // default decay, round 2 would start at 0, not +1 (see the decay tests below).
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
    { momentum: step1.momentum, decay: 0 },
  );
  // Round 3 (M = 0): enemy strike at 4 hits first over player strike at 3.
  const step3 = resolveRound(
    [{ id: 'strike', slot: 0, speed: 3, kind: 'attack' }],
    [foe('enemyStrike', 4, 'attack')],
    1,
    d20Face(20),
    { momentum: step2.momentum, decay: 0 },
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
        // Decay moves M_e toward 0 for both sides, so it has no actor. Overflow is a marker (delta 0).
        if (mv.reason === 'decay' || mv.reason === 'overflow') continue;
        assert.equal(mv.by === 'player' ? mv.delta >= 0 : mv.delta <= 0, true, 'a move helps only its actor');
      }
      for (const mv of moves) assert.equal(Number.isFinite(mv.delta), true, 'every momentum event has a numeric delta');
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
    { momentum: { e: 3 }, decay: 0 },
  );
  assert.equal(up.momentum.e, 3);
  assert.equal(find(up.events, 'momentum').delta, 1, 'the raw success is still +1; the clamp is at round end');

  const down = resolveRound(
    [{ id: 'strike', slot: 0, speed: 1, kind: 'attack' }],
    [{ id: 'enemyStrike', speed: 9, kind: 'attack' }],
    1,
    d20Face(20),
    { momentum: { enemyStrike: 3 }, decay: 0 },
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

// Any miss is the defender's success (owner, 2026-10-11), whatever its action.
test('a miss wins the slot for the defender: M moves toward the enemy', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    1,
    d20Face(1),
  );
  assert.equal(find(events, 'hit').hit, false);
  assert.deepEqual(find(events, 'momentum'), {
    type: 'momentum', enemyId: 'e', by: 'enemy', gain: 1, bonus: 0, delta: -1, reason: 'success', slot: 0, momentum: 0,
  });
  assert.equal(momentum.e, -1);
});

test('an enemy attack that misses a player card moves M toward the player', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'guard', slot: 0, speed: 1, kind: 'other' }],
    [{ id: 'swing', enemyId: 'boss', speed: 4, kind: 'attack' }],
    1,
    d20Face(1),
  );
  assert.equal(find(events, 'hit').by, 'enemy');
  assert.equal(find(events, 'hit').hit, false);
  assert.equal(find(events, 'momentum').by, 'player');
  assert.equal(momentum.boss, 1);
});

test('a miss against an evade action credits the defender once, not twice', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'dodger', speed: 1, kind: 'other', stance: 'evade' }],
    1,
    d20Face(1),
  );
  assert.equal(find(events, 'evaded').by, 'enemy');
  assert.equal(events.filter((e) => e.type === 'momentum').length, 1);
  assert.equal(momentum.dodger, -1);
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
    { momentum: { e: 3 }, decay: 0 },
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
    { momentum: { e: -3 }, decay: 0 },
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

// A side wins a slot at most once per pairing (DESIGN.md, Momentum). Here the
// faster enemy attack is fully blocked ('absorbed', a player success), and the
// slower player attack then lands ('hit', a second player success). The player
// wins the slot once: M_boss moves +1, not +2.
test('a side that absorbs and then lands in one pairing wins the slot once', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'guard', slot: 0, speed: 4, kind: 'attack', damage: 2, block: 2 }],
    [{ id: 'swing', enemyId: 'boss', speed: 5, kind: 'attack', damage: 2 }],
    1,
    d20Face(20),
  );
  assert.equal(find(events, 'absorbed').by, 'player', 'the block absorbs the enemy hit');
  assert.equal(hitsOf(events).filter((e) => e.by === 'player' && e.hit && !e.blocked).length, 1, 'the player attack also lands');
  assert.equal(events.filter((e) => e.type === 'momentum' && e.enemyId === 'boss').length, 1, 'one momentum event for the slot win');
  assert.equal(find(events, 'momentumApplied').delta, 1);
  assert.equal(momentum.boss, 1, 'the slot is won once, so M moves +1 toward the player');
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

test('a plain miss with no defensive action: the defender wins the slot, with no evaded event', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'idle', speed: 1, kind: 'other' }],
    1,
    d20Face(1),
  );
  assert.equal(events.some((e) => e.type === 'evaded'), false);
  assert.equal(find(events, 'momentum').by, 'enemy');
  assert.equal(momentum.idle, -1);
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

// Counter stagger (owner, 2026-10-11): a counter that fires and staggers adds
// +-3 to its side's summed round delta, on top of the normal slot win. The
// round-end clamp applies once, to the sum.
test('counter stagger: from M_e -2, the player counter adds 3 on top of the slot win (clamp of -2 + 1 + 1 + 3)', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'counter', slot: 0, speed: 6, kind: 'counter', stance: 'counter', tags: ['stagger'] }],
    [{ id: 'foe', speed: 3, kind: 'attack', stance: 'attack' }],
    1,
    d20Face(20),
    { stanceAdvantage: stanceTable(), momentum: { foe: -2 }, decay: 0 },
  );
  assert.equal(find(events, 'countered').by, 'player');
  assert.equal(find(events, 'status').target, 'enemy');
  assert.equal(find(events, 'status').status, 'stagger');
  const stagger = events.find((e) => e.reason === 'counterStagger');
  assert.equal(stagger.delta, 3);
  assert.equal(stagger.set, undefined, 'the stagger carries a delta, not a set');
  assert.equal(momentum.foe, clampMomentum(-2 + 1 + 1 + 3));
  assert.equal(momentum.foe, 3);
});

test('counter stagger adds to M_e rather than setting it: from -3 the player counter ends at 1, not 3', () => {
  // Speeds at M -3: player 6-1 = 5, enemy 3+1 = 4, so the counter fires first.
  // No stance table, so the slot win is the base gain 1. Total: -3 + 1 + 3 = 1.
  const { momentum } = resolveRound(
    [{ id: 'counter', slot: 0, speed: 6, kind: 'counter', tags: ['stagger'] }],
    [{ id: 'foe', speed: 3, kind: 'attack' }],
    1,
    d20Face(20),
    { momentum: { foe: -3 }, decay: 0 },
  );
  assert.equal(momentum.foe, 1);
});

test('counter stagger: when the enemy counter staggers the player, it adds -3 on top of the slot win (from M_e 2)', () => {
  // Speeds at M 2: player 3+1 = 4, enemy 6-1 = 5, so the enemy counter fires first.
  // Total: 2 - 1 (slot win) - 3 (stagger) = -2.
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 3, kind: 'attack', stance: 'attack' }],
    [{ id: 'foe', speed: 6, kind: 'counter', stance: 'counter', tags: ['stagger'] }],
    1,
    d20Face(20),
    { momentum: { foe: 2 }, decay: 0 },
  );
  assert.equal(find(events, 'countered').by, 'enemy');
  assert.equal(events.find((e) => e.reason === 'counterStagger').delta, -3);
  assert.equal(momentum.foe, -2);
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

// Two slots for the same enemy, each a counter that staggers the other side.
// Opposing staggers net to their normal deltas (owner, 2026-10-11), so the
// result must not depend on the order of playerCards.
const opposingStaggerQueue = () => [
  { id: 'foeA', enemyId: 'foe', speed: 4, kind: 'attack', stance: 'attack' },
  { id: 'foeCounter', enemyId: 'foe', speed: 5, kind: 'counter', stance: 'counter', tags: ['stagger'] },
];
const playerCounter = { id: 'counter', slot: 0, speed: 5, kind: 'counter', stance: 'counter', tags: ['stagger'] };
const playerStrike = { id: 'strike', slot: 1, speed: 4, kind: 'attack', stance: 'attack' };

test('counter stagger: opposing staggers for one enemy give the same momentum in either playerCards order', () => {
  const forward = resolveRound([playerCounter, playerStrike], opposingStaggerQueue(), 2, d20Face(20), { stanceAdvantage: stanceTable() });
  const reversed = resolveRound([playerStrike, playerCounter], opposingStaggerQueue(), 2, d20Face(20), { stanceAdvantage: stanceTable() });
  assert.equal(forward.momentum.foe, reversed.momentum.foe);
});

test('counter stagger: opposing staggers net to their normal deltas, with no cancel event', () => {
  // Player counter: gain 2 + stance bonus 1 = +3, plus stagger +3 = +6.
  // Enemy counter: gain 1 + stance bonus 1 = -2, plus stagger -3 = -5. Net +1.
  const counter = { ...playerCounter, momentumGain: 2 };
  const { events, momentum } = resolveRound(
    [counter, playerStrike],
    opposingStaggerQueue(),
    2,
    d20Face(20),
    { stanceAdvantage: stanceTable(), momentum: { foe: 0 } },
  );
  assert.equal(momentum.foe, clampMomentum(0 + 6 + -5));
  assert.equal(momentum.foe, 1);
  assert.deepEqual(events.filter((e) => e.reason === 'counterStagger').map((e) => e.delta), [3, -3]);
  assert.equal(events.some((e) => e.reason === 'counterStaggerCancelled'), false);
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
    { momentum: { foe: 2 }, decay: 0 },
  );
  assert.deepEqual(find(events, 'order').speeds, { player: 5, enemy: 3 });
});

// Momentum decay (owner, 2026-10-11; DESIGN.md, Timing). Before any pairing,
// each enemy's starting M_e moves 1 toward 0. options.decay sets the step (0 off).
test('decayMomentum: moves M toward 0 by step, never past it, after clamping the input', () => {
  assert.equal(decayMomentum(2), 1);
  assert.equal(decayMomentum(1), 0);
  assert.equal(decayMomentum(0), 0);
  assert.equal(decayMomentum(-1), 0);
  assert.equal(decayMomentum(-2), -1);
  assert.equal(decayMomentum(3, 2), 1);
  assert.equal(decayMomentum(2, 5), 0, 'a step past 0 stops at 0');
  assert.equal(decayMomentum(-3, 0), -3, 'step 0 turns decay off');
  assert.equal(decayMomentum(5), 2, 'the input is clamped to +3 first, then decays by 1');
  assert.equal(decayMomentum(-9, 1), -2, 'the input is clamped to -3 first');
  assert.equal(decayMomentum(Number.NaN), 0);
  assert.equal(decayMomentum(2, 1), decayMomentum(2), 'the step defaults to 1');
  assert.throws(() => decayMomentum(2, -1), TypeError);
  assert.throws(() => decayMomentum(2, Number.NaN), TypeError);
});

test('decay: from +2 with no successes, M_e moves to +1 at round end, and the change is an event', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'guard', slot: 0, speed: 1, kind: 'other' }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    1,
    d20Face(20),
    { momentum: { e: 2 } },
  );
  assert.equal(momentum.e, 1);
  assert.equal(events.some((e) => e.type === 'momentum' && e.reason === 'success'), false, 'no successes');
  assert.deepEqual(events.filter((e) => e.reason === 'decay'), [{ type: 'momentum', reason: 'decay', enemyId: 'e', from: 2, to: 1, delta: -1, by: null }]);
});

test('decay: from -1 with no successes, M_e moves to 0', () => {
  const { events, momentum } = resolveRound(
    [{ id: 'guard', slot: 0, speed: 1, kind: 'other' }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    1,
    d20Face(20),
    { momentum: { e: -1 } },
  );
  assert.equal(momentum.e, 0);
  assert.deepEqual(events.filter((e) => e.reason === 'decay'), [{ type: 'momentum', reason: 'decay', enemyId: 'e', from: -1, to: 0, delta: 1, by: null }]);
});

test('decay: a step larger than |M_e| stops at 0 and does not overshoot', () => {
  const up = resolveRound([], [{ id: 'e', speed: 1, kind: 'other' }], 0, d20Face(20), { momentum: { e: 1 }, decay: 2 });
  const down = resolveRound([], [{ id: 'e', speed: 1, kind: 'other' }], 0, d20Face(20), { momentum: { e: -1 }, decay: 2 });
  assert.equal(up.momentum.e, 0);
  assert.equal(down.momentum.e, 0);
});

test('decay: options.decay 0 turns decay off (M_e stays +2), and the default step is 1', () => {
  const queue = [{ id: 'e', speed: 1, kind: 'other' }];
  const off = resolveRound([], queue, 0, d20Face(20), { momentum: { e: 2 }, decay: 0 });
  assert.equal(off.momentum.e, 2);
  assert.equal(off.events.some((e) => e.reason === 'decay'), false);
  const on = resolveRound([], queue, 0, d20Face(20), { momentum: { e: 2 } });
  assert.equal(on.momentum.e, 1);
});

test('decay: an enemy in options.momentum but not in the queue also decays', () => {
  const { events, momentum } = resolveRound([], [], 0, d20Face(20), { momentum: { ghost: -2 } });
  assert.equal(momentum.ghost, -1);
  assert.deepEqual(events.find((e) => e.reason === 'decay'), { type: 'momentum', reason: 'decay', enemyId: 'ghost', from: -2, to: -1, delta: 1, by: null });
});

test('decay: pairings use the decayed start, so +2 decays to +1 and gives no speed shift', () => {
  const { events } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'foe', speed: 4, kind: 'other' }],
    1,
    d20Face(20),
    { momentum: { foe: 2 } },
  );
  // Undecayed +2 would give player 5, enemy 3. Decayed +1 gives 4 and 4, a tie.
  assert.deepEqual(find(events, 'order').speeds, { player: 4, enemy: 4 });
  assert.equal(find(events, 'order').simultaneous, true);
  assert.equal(find(events, 'hit').momentum, 1, 'the pair carries the decayed start');
});

test('decay: the round result is clamp(decayed start + summed deltas)', () => {
  // +2 decays to +1 before pairing. The player's success adds +1: 1 + 1 = 2.
  const { events, momentum } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'e', speed: 1, kind: 'other' }],
    1,
    d20Face(20),
    { momentum: { e: 2 } },
  );
  assert.equal(momentum.e, 2);
  assert.deepEqual(find(events, 'momentumApplied'), { type: 'momentumApplied', enemyId: 'e', from: 1, delta: 1, to: 2, momentum: 2 });
});

test('decay: options.decay must be a finite number of 0 or more', () => {
  for (const bad of [-1, NaN, 'x', Infinity]) {
    assert.throws(() => resolveRound([], [], 0, d20Face(20), { decay: bad }), TypeError, `decay ${String(bad)}`);
  }
});

// Card hints (DESIGN.md, Card hints). Speed ids: one=1, two=2, three=3.
const HINT_MODS = { card: { one: 1, two: 2, three: 3 }, weapon: { dagger: 2 } };
const hintCtx = (extra = {}) => ({ mods: HINT_MODS, stanceAdvantage: stanceTable(), ...extra });

test('cardHint: SPEED_TIERS is strong 2, slight 1 (owner answer 4, 2026-10-11)', () => {
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

test('cardHint: a stance row with bonus 0 is not a stance advantage (same rule as momentum)', () => {
  // Faster (3 vs 1) and smash is listed over block, but with bonus 0 it gives no advantage.
  const zero = parseStanceAdvantage('attacker_stance,defender_stance,bonus\nsmash,block,0');
  const hint = cardHint({ card: 'three', stance: 'smash' }, { card: 'one', stance: 'block' }, hintCtx({ stanceAdvantage: zero }));
  assert.equal(hint.border, 'yellow', 'speed only, so yellow and not green');
});

test('cardHint: equal speed is not a speed advantage, so smash over block is yellow', () => {
  // Both total 2. Only the stance (smash beats block) is in the card's favour.
  const hint = cardHint({ card: 'two', stance: 'smash' }, { card: 'two', stance: 'block' }, hintCtx());
  assert.equal(hint.border, 'yellow');
  assert.equal(hint.speedDelta, 0);
});

test('cardHint: equal speed with no stance advantage is red, not yellow', () => {
  // Both total 2 and attack>attack is not in the CSV: neither holds.
  const hint = cardHint({ card: 'two', stance: 'attack' }, { card: 'two', stance: 'attack' }, hintCtx());
  assert.equal(hint.border, 'red');
  assert.equal(hint.arrow, null);
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

test('cardHint: a delta beyond +-2 keeps the strong arrow, with its colour', () => {
  // three + dagger = 5 against one = 1: delta +4 is still '>>' green.
  const hint = cardHint({ card: 'three', weapon: 'dagger', stance: 'attack' }, { card: 'one', stance: 'attack' }, hintCtx());
  assert.equal(hint.speedDelta, 4);
  assert.deepEqual(hint.arrow, { glyph: '>>', colour: 'green' });
  // The mirror: delta -4 is '<<' red.
  const mirror = cardHint({ card: 'one', stance: 'attack' }, { card: 'three', weapon: 'dagger', stance: 'attack' }, hintCtx());
  assert.equal(mirror.speedDelta, -4);
  assert.deepEqual(mirror.arrow, { glyph: '<<', colour: 'red' });
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

test('cardHint: a card with a speed field has a breakdown that sums to the speedDelta total', () => {
  // Player total 5 + momentumSpeed(2) = 6; enemy 3 - 1 = 2; delta 4.
  const hint = cardHint(
    { speed: 5, card: 'slash', target: 'enemy' },
    { speed: 3, stage: 3 },
    { mods: { card: { slash: 2 } }, momentum: 2 },
  );
  assert.deepEqual(hint.breakdown, [
    { term: 'speed', value: 5 },
    { term: 'momentum', value: 1 },
  ]);
  assert.equal(hint.breakdown.reduce((n, b) => n + b.value, 0), 6);
  assert.equal(hint.speedDelta, 4);
});

test('cardHint: sum(breakdown) equals the player total on both the component and speed paths', () => {
  const momentum = 2;
  const shift = momentumSpeed(momentum);
  const sumOf = (card, enemy, ctx) => cardHint(card, enemy, { ...ctx, momentum }).breakdown
    .reduce((n, b) => n + b.value, 0);

  // Component path: the total is actionSpeed's total with momentum.
  const component = { card: 'three', weapon: 'dagger', armor: 'heavy', stance: 'attack' };
  const componentMods = { ...HINT_MODS, armor: { heavy: -3 } };
  const componentTotal = actionSpeed({ ...component, momentum }, componentMods, 'player').total;
  assert.equal(sumOf(component, { card: 'one', stance: 'attack' }, { mods: componentMods }), componentTotal);

  // Speed path: the total is card.speed plus the momentum shift.
  const speedCard = { speed: 5, card: 'slash', target: 'enemy' };
  const speedTotal = speedCard.speed + shift;
  assert.equal(sumOf(speedCard, { speed: 3, stage: 3 }, { mods: { card: { slash: 2 } } }), speedTotal);
});

// Perception stages (DESIGN.md, Round flow and perception). One enemy action,
// revealed at each stage.
const FOE_ACTION = { id: 'foe', speed: 2, kind: 'attack', tags: ['stun'], stance: 'smash', damage: 3, block: 1 };

test('perception stage 0 reveals only that an action exists', () => {
  assert.deepEqual(revealAction(FOE_ACTION, 0), { hidden: true, stage: 0 });
});

test('perception stage 1 reveals only the stance group', () => {
  assert.deepEqual(revealAction(FOE_ACTION, 1), { stanceGroup: 'offense', stage: 1 });
  assert.deepEqual(revealAction({ stance: 'block' }, 1), { stanceGroup: 'defense', stage: 1 });
});

test('perception stage 2 reveals the stance and damage, but not speed or tags', () => {
  assert.deepEqual(revealAction(FOE_ACTION, 2), { stanceGroup: 'offense', stance: 'smash', damage: 3, stage: 2 });
});

test('perception stage 3 reveals everything, including speed and tags', () => {
  assert.deepEqual(revealAction(FOE_ACTION, 3), { ...FOE_ACTION, stage: 3 });
});

test('revealAction names the stage it was revealed at, so cardHint knows what is shown', () => {
  assert.equal(revealAction(FOE_ACTION, 9).stage, 3, 'a clamped stage is the stage reported');
  assert.equal(revealAction(FOE_ACTION, -1).stage, 0);
});

test('perception stage clamps: below 0 acts as 0, above 3 acts as 3', () => {
  assert.equal(clampStage(-1), 0);
  assert.equal(clampStage(-99), 0);
  assert.equal(clampStage(7), 3);
  assert.equal(clampStage(2.9), 2);
  assert.equal(clampStage(NaN), 0);
  assert.deepEqual(revealAction(FOE_ACTION, -1), { hidden: true, stage: 0 });
  assert.deepEqual(revealAction(FOE_ACTION, 9), revealAction(FOE_ACTION, 3));
});

test('STANCE_GROUPS covers every stance in stance-advantage.csv', () => {
  const stances = new Set();
  for (const line of readFileSync(STANCE_CSV, 'utf8').split('\n').slice(1)) {
    const [attacker, defender] = line.split(',');
    if (attacker) stances.add(attacker);
    if (defender) stances.add(defender);
  }
  for (const stance of stances) assert.ok(Object.hasOwn(STANCE_GROUPS, stance), `no group for ${stance}`);
});

// Evasion, part 1: the 'intangible' tag (DESIGN.md, Evasion). A holder with a
// charge left avoids a hit that would land, outright.
const GHOST = (charges) => ({ id: 'ghost', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: charges });
const STRIKE = { id: 'strike', slot: 0, speed: 4, kind: 'attack' };

test('intangible: a charge is spent to avoid a hit that would land, and the attack is avoided', () => {
  const { events, momentum } = resolveRound([STRIKE], [GHOST(2)], 1, d20Face(20));
  assert.equal(find(events, 'hit').avoided, true);
  assert.deepEqual(find(events, 'evaded'), {
    type: 'evaded', by: 'enemy', target: 'player', reason: 'intangible', charges: 1, slot: 0, visible: true, momentum: 0,
  });
  assert.equal(events.some((e) => e.type === 'interrupted'), false, 'an avoided hit does not interrupt');
  assert.equal(momentum.ghost, -1, 'the avoid is a defensive success, so M moves toward the enemy');
});

test('intangible: with 0 charges, or without the tag, the hit lands as before', () => {
  const none = resolveRound([STRIKE], [GHOST(0)], 1, d20Face(20));
  assert.equal(none.events.some((e) => e.type === 'evaded'), false);
  assert.equal(find(none.events, 'hit').avoided, false);
  assert.ok(find(none.events, 'interrupted'), 'the landed hit still interrupts');

  const untagged = resolveRound([STRIKE], [{ id: 'ghost', speed: 1, kind: 'other', intangibleCharges: 2 }], 1, d20Face(20));
  assert.equal(untagged.events.some((e) => e.type === 'evaded'), false);
  assert.equal(find(untagged.events, 'hit').avoided, false);
});

test('intangible: a miss spends no charge', () => {
  const { events } = resolveRound([STRIKE], [GHOST(2)], 1, d20Face(1));
  assert.equal(events.some((e) => e.type === 'evaded'), false);
  assert.equal(find(events, 'hit').avoided, false);
});

test('intangible: a full block takes precedence, so no charge is spent', () => {
  const { events } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack', damage: 2 }],
    [{ id: 'ghost', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 2, block: 2 }],
    1,
    d20Face(20),
  );
  assert.ok(find(events, 'absorbed'));
  assert.equal(events.some((e) => e.type === 'evaded'), false);
});

test('intangible: one charge per enemy per round is spent once, across its queued actions', () => {
  // Two queued actions both belong to enemy G, each tagged intangible with 1 charge.
  // The charge is G's, so only the first pairing avoids its hit.
  const cards = [
    { id: 'a', slot: 0, speed: 4, kind: 'attack' },
    { id: 'b', slot: 1, speed: 4, kind: 'attack' },
  ];
  const g = (slot) => ({ id: `g${slot}`, enemyId: 'G', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 1 });
  const { events, charges } = resolveRound(cards, [g(0), g(1)], 2, () => 0.99);
  const evaded = events.filter((e) => e.type === 'evaded');
  assert.equal(evaded.length, 1, 'exactly one charge is spent');
  assert.equal(evaded[0].reason, 'intangible');
  assert.equal(evaded[0].slot, 0);
  const second = events.find((e) => e.type === 'hit' && e.slot === 1);
  assert.equal(second.hit, true);
  assert.equal(second.avoided, false, 'the second hit lands');
  assert.equal(charges.G, 0, 'the round reports the pool left for G');
});

test('intangible: the player pool is shared across pairings, and each enemy has its own pool', () => {
  // Two enemies, each with 1 charge. Player defends against two enemy attacks with
  // 1 charge on the player's first card. The second attack lands.
  const cards = [
    { id: 'shield', slot: 0, speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 1 },
    { id: 'plain', slot: 1, speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 1 },
  ];
  const enemies = [
    { id: 'e0', enemyId: 'G', speed: 4, kind: 'attack', intangibleCharges: 2 },
    { id: 'e1', enemyId: 'H', speed: 4, kind: 'attack', intangibleCharges: 3 },
  ];
  const { events, charges } = resolveRound(cards, enemies, 2, () => 0.99);
  const evaded = events.filter((e) => e.type === 'evaded');
  assert.equal(evaded.length, 1, 'the player pool holds one charge, spent on the first pairing');
  assert.equal(evaded[0].by, 'player', 'the player avoids; by is the defender');
  assert.equal(evaded[0].slot, 0);
  assert.equal(charges.player, 0);
  assert.equal(charges.G, 2, 'G is an attacker, not a tagged defender, so its pool is untouched');
  assert.equal(charges.H, 3);
});

test('resolvePair partial pool: a side missing from options.charges falls back to its own intangibleCharges', () => {
  // Only the player's pool is given (1). The enemy's own 1 charge must still avoid the player's hit.
  const enemy = { id: 'ghost', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 1 };
  const events = resolvePair(ATTACKER, enemy, () => 0.99, { charges: { player: 1 } });
  assert.deepEqual(find(events, 'evaded'), {
    type: 'evaded', by: 'enemy', target: 'player', reason: 'intangible', charges: 0,
  });
});

test('resolvePair does not leak charges between calls that reuse the same options object', () => {
  // Call 1 spends one of the enemy's 2 charges. Call 2 gives its enemy 0 charges,
  // so it must not evade. A leaked pool would still hold 1 for the enemy.
  const opts = { charges: {} };
  const tagged = { id: 'ghost', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 2 };
  const first = resolvePair(ATTACKER, tagged, () => 0.99, opts);
  assert.equal(find(first, 'evaded').reason, 'intangible', 'call 1 spends a charge');

  const empty = { id: 'ghost', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 0 };
  const second = resolvePair(ATTACKER, empty, () => 0.99, opts);
  assert.equal(second.some((e) => e.type === 'evaded'), false, 'call 2 has no charges and does not evade');
  assert.equal(find(second, 'hit').avoided, false);
});

test('resolvePair does not throw on a frozen options.charges when no charge is spent', () => {
  const frozen = Object.freeze({ player: 1 });
  const plain = { id: 'foe', speed: 1, kind: 'other' };
  const events = resolvePair(ATTACKER, plain, () => 0.99, { charges: frozen });
  assert.ok(find(events, 'hit'), 'the pairing resolves');
  assert.equal(events.some((e) => e.type === 'evaded'), false);
});

test('intangible pool: an enemy in options.charges with no action this round keeps its charges', () => {
  // G has no queued action this round, but its 3 charges must come back for the next round.
  const cards = [{ id: 'a', slot: 0, speed: 4, kind: 'attack' }];
  const queue = [{ id: 'h0', enemyId: 'H', speed: 1, kind: 'other' }];
  const { charges } = resolveRound(cards, queue, 1, () => 0.99, { charges: { player: 0, G: 3 } });
  assert.equal(charges.G, 3, 'G is carried over unchanged');
  assert.equal(charges.player, 0);
});

test('intangible pool: a side with no charges option takes the largest intangibleCharges of its cards', () => {
  // The first player card has no charges. The shield, second, has 1. The pool is 1, so the shield avoids one hit.
  const cards = [
    { id: 'plain', slot: 0, speed: 1, kind: 'other' },
    { id: 'shield', slot: 1, speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 1 },
  ];
  const enemies = [
    { id: 'e0', speed: 4, kind: 'attack' },
    { id: 'e1', speed: 4, kind: 'attack' },
  ];
  const { events, charges } = resolveRound(cards, enemies, 2, () => 0.99);
  const evaded = events.filter((e) => e.type === 'evaded');
  assert.equal(evaded.length, 1, 'the shield avoids one hit');
  assert.equal(evaded[0].slot, 1);
  assert.equal(charges.player, 0, 'the pool is spent to 0');
});

test('intangible pool: an enemy takes the largest intangibleCharges of its queued actions', () => {
  // G's first action has no charges. The second has 2, so the pool is 2 and one charge is spent here, leaving 1.
  const cards = [{ id: 'a', slot: 1, speed: 4, kind: 'attack' }];
  const queue = [
    { id: 'g0', enemyId: 'G', speed: 1, kind: 'other' },
    { id: 'g1', enemyId: 'G', speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 2 },
  ];
  const { events, charges } = resolveRound(cards, queue, 2, () => 0.99);
  const evaded = events.find((e) => e.type === 'evaded');
  assert.equal(evaded.reason, 'intangible');
  assert.equal(evaded.charges, 1, 'the pool started at 2');
  assert.equal(charges.G, 1);
});

test('intangible pool: a rejected duplicate-slot card adds no charges to the player pool', () => {
  // Two player cards on slot 0. The first is accepted with 0 charges. The second
  // is rejected as a duplicate, so its 3 charges must not fund the accepted card's evade.
  const cards = [
    { id: 'shield', slot: 0, speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 0 },
    { id: 'dup', slot: 0, speed: 1, kind: 'other', tags: ['intangible'], intangibleCharges: 3 },
  ];
  const enemies = [{ id: 'e0', speed: 4, kind: 'attack' }];
  const { events, charges } = resolveRound(cards, enemies, 1, () => 0.99);
  assert.equal(events.some((e) => e.type === 'evaded'), false, 'the rejected card funds no evade');
  assert.equal(find(events, 'hit').avoided, false, 'the attack lands');
  assert.equal(charges.player, 0);
});

// Evasion, part 2a: evade bonus scopes (owner addendum, 2026-10-11). A bonus is
// { source, pct, scope, condition? }. Only bonuses whose scope is live, and
// whose condition passes, count.
const EX = (extra = {}) => ({ source: 'tag', pct: 10, scope: 'exchange', ...extra });
const ctxOf = (extra = {}) => ({ inExchange: false, round: 1, combatId: 'c1', ...extra });

test('evade scope exchange: live only inside the exchange', () => {
  assert.equal(activeEvadeBonuses([EX()], ctxOf({ inExchange: true })).length, 1);
  assert.equal(activeEvadeBonuses([EX()], ctxOf({ inExchange: false })).length, 0);
});

test('evade scope round: live while a round is set', () => {
  const b = { source: 'r', pct: 5, scope: 'round' };
  assert.equal(activeEvadeBonuses([b], ctxOf({ round: 2 })).length, 1);
  assert.equal(activeEvadeBonuses([b], ctxOf({ round: null })).length, 0);
});

test('evade scope combat: live while a combat id is set', () => {
  const b = { source: 'c', pct: 5, scope: 'combat' };
  assert.equal(activeEvadeBonuses([b], ctxOf({ combatId: 'c9' })).length, 1);
  assert.equal(activeEvadeBonuses([b], ctxOf({ combatId: undefined })).length, 0);
});

test('evade scope run: always live while the bonus is present', () => {
  const b = { source: 'run', pct: 5, scope: 'run' };
  assert.equal(activeEvadeBonuses([b], {}).length, 1);
});

test('evade condition: a failing condition drops the bonus, a passing one keeps it', () => {
  const b = { source: 'third', pct: 5, scope: 'round', condition: (ctx) => ctx.round === 3 };
  assert.equal(activeEvadeBonuses([b], ctxOf({ round: 2 })).length, 0, 'condition fails');
  assert.equal(activeEvadeBonuses([b], ctxOf({ round: 3 })).length, 1, 'condition passes');
});

test('evade scope: exchange bonuses do not leak into the next exchange', () => {
  // The bonus is only in the first exchange's list. Outside that exchange it is not live.
  const bonuses = [EX({ pct: 30 })];
  assert.equal(activeEvadeBonuses(bonuses, ctxOf({ inExchange: true })).length, 1);
  assert.equal(activeEvadeBonuses(bonuses, ctxOf({ inExchange: false })).length, 0, 'between exchanges');
  assert.equal(activeEvadeBonuses([], ctxOf({ inExchange: true })).length, 0, 'the next exchange has no such bonus');
});

test('evade scope: unknown scope and non-array input throw', () => {
  assert.throws(() => activeEvadeBonuses([{ source: 'x', pct: 1, scope: 'day' }], {}), TypeError);
  assert.throws(() => activeEvadeBonuses('nope', {}), TypeError);
});

// Evasion, part 2b: evadePct (DESIGN.md, Evasion). After an attack would land,
// the defender rolls a separate percent check against evadePct. evadePct is
// evadeBasePct plus the live evade bonuses, clamped to 0..95.
// The percent roll is floor(rng() * 100), so a roll of n is wanted as n / 100 + 0.005.
const pctRng = (n) => n / 100 + 0.005;
const seqRng = (values) => {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('rng called more times than the test expects');
    return values[i++];
  };
};
const D20_HIT = d20Face(20)(); // d20 of 20: always hits, so the percent roll comes next
const DEFENDER = (extra = {}) => ({ speed: 1, kind: 'other', ...extra });
const ATTACKER = { speed: 4, kind: 'attack' };

test('evadePct: a roll under the percent avoids the hit and emits evaded with reason evasion', () => {
  const events = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 50 }), seqRng([D20_HIT, pctRng(10)]));
  assert.equal(find(events, 'hit').avoided, true);
  assert.deepEqual(find(events, 'evadeRoll'), { type: 'evadeRoll', by: 'enemy', target: 'player', evadePct: 50, roll: 10, success: true });
  assert.deepEqual(find(events, 'evaded'), { type: 'evaded', by: 'enemy', target: 'player', reason: 'evasion' });
  assert.equal(events.some((e) => e.type === 'interrupted'), false, 'an avoided hit does not interrupt');
});

test('evadePct: a roll at or over the percent lands the hit', () => {
  const events = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 50 }), seqRng([D20_HIT, pctRng(60)]));
  assert.equal(find(events, 'evadeRoll').success, false);
  assert.equal(find(events, 'hit').avoided, false);
  assert.equal(events.some((e) => e.type === 'evaded'), false);
  assert.ok(find(events, 'interrupted'), 'the landed hit still interrupts');
});

test('evadePct: a roll exactly equal to the percent lands the hit', () => {
  const events = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 50 }), seqRng([D20_HIT, pctRng(50)]));
  assert.equal(find(events, 'evadeRoll').success, false);
});

test('evadePct: clamped to 95 at the top, and to 0 at the bottom with no percent roll', () => {
  const top = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 200 }), seqRng([D20_HIT, pctRng(95)]));
  assert.equal(find(top, 'evadeRoll').evadePct, 95);
  assert.equal(find(top, 'evadeRoll').success, false, 'a roll of 95 is not under 95');

  const edge = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 200 }), seqRng([D20_HIT, pctRng(94)]));
  assert.equal(find(edge, 'evadeRoll').success, true);

  // evadePct 0 draws no percent roll: the seeded RNG only has the d20 value.
  const none = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: -20 }), seqRng([D20_HIT]));
  assert.equal(find(none, 'evadeRoll'), undefined);
  assert.equal(find(none, 'hit').avoided, false);
});

test('evadePct: a card-tag bonus adds to evadePct for this exchange only', () => {
  const nimble = [{ source: 'nimble', pct: 20, scope: 'exchange' }];
  const withBonus = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 30, evadeBonuses: nimble }), seqRng([D20_HIT, pctRng(0)]));
  assert.equal(find(withBonus, 'evadeRoll').evadePct, 50);

  // The next exchange has no such card: the same base alone.
  const next = resolvePair(ATTACKER, DEFENDER({ evadeBasePct: 30 }), seqRng([D20_HIT, pctRng(0)]));
  assert.equal(find(next, 'evadeRoll').evadePct, 30);
});

test('evadePct: a bonus with a failing condition is dropped', () => {
  const onRoundTwo = [{ source: 'round2', pct: 20, scope: 'round', condition: (ctx) => ctx.round === 2 }];
  const events = resolvePair(
    ATTACKER,
    DEFENDER({ evadeBasePct: 30, evadeBonuses: onRoundTwo }),
    seqRng([D20_HIT, pctRng(0)]),
    { round: 1, combatId: 'c1' },
  );
  assert.equal(find(events, 'evadeRoll').evadePct, 30);
});

test('evadePct: an evasion avoid credits momentum the same way as a dodge', () => {
  const { momentum, events } = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'dodger', speed: 1, kind: 'other', evadeBasePct: 50 }],
    1,
    seqRng([D20_HIT, pctRng(10)]),
  );
  assert.equal(find(events, 'momentum').by, 'enemy');
  assert.equal(momentum.dodger, -1);
});

test('evadePct: a card-tag bonus that is not a number is rejected', () => {
  assert.throws(() => resolvePair(ATTACKER, DEFENDER({ evadeBonuses: [{ source: 'x', pct: 'many', scope: 'run' }] }), d20Face(1)), TypeError);
});

// Evasion, part 3: stance bonuses from evade-bonus.csv. A stance bonus is an
// exchange-scoped bonus for the defender's stance in that one exchange.
const EVADE_CSV = resolve(here, 'evade-bonus.csv');
const evadeTable = () => parseEvadeBonus(readFileSync(EVADE_CSV, 'utf8'));

test('evade-bonus.csv: parses stance rows, a blank bonus is 0, and a bad header throws', () => {
  const table = evadeTable();
  assert.equal(table.get('evade'), 20);
  assert.equal(table.get('block'), 5);
  assert.throws(() => parseEvadeBonus('stance,pct\nevade,20'), TypeError);
  assert.equal(parseEvadeBonus('stance,bonusPct\nevade,').get('evade'), 0);
});

test('stance evade bonus applies to that exchange only', () => {
  const evading = DEFENDER({ evadeBasePct: 40, stance: 'evade' });
  // 40 + 20 = 60: a roll of 55 is avoided.
  const inside = resolvePair(ATTACKER, evading, seqRng([D20_HIT, pctRng(55)]), { evadeTable: evadeTable() });
  assert.equal(find(inside, 'evadeRoll').evadePct, 60);
  assert.equal(find(inside, 'evaded').reason, 'evasion');

  // The next exchange does not carry the bonus: the same roll of 55 lands.
  const next = resolvePair(ATTACKER, evading, seqRng([D20_HIT, pctRng(55)]));
  assert.equal(find(next, 'evadeRoll').evadePct, 40);
  assert.equal(find(next, 'evadeRoll').success, false);
});

test('stance evade bonus adds to evadePct in the same exchange, and the total clamps at 95', () => {
  // 90 + 20 = 110, clamped to EVADE_PCT_MAX (95). A roll of 94 avoids, a roll of 95 lands.
  const evading = DEFENDER({ evadeBasePct: 90, stance: 'evade' });
  const under = resolvePair(ATTACKER, evading, seqRng([D20_HIT, pctRng(94)]), { evadeTable: evadeTable() });
  assert.equal(find(under, 'evadeRoll').evadePct, 95);
  assert.equal(find(under, 'evadeRoll').success, true);
  assert.equal(find(under, 'evaded').reason, 'evasion');

  const atCap = resolvePair(ATTACKER, evading, seqRng([D20_HIT, pctRng(95)]), { evadeTable: evadeTable() });
  assert.equal(find(atCap, 'evadeRoll').evadePct, 95);
  assert.equal(find(atCap, 'evadeRoll').success, false);
});

test('stance evade bonus is not applied without the table', () => {
  // The evade stance would add 20 with the table. Without it, evadePct stays at the base.
  const evading = DEFENDER({ evadeBasePct: 40, stance: 'evade' });
  const events = resolvePair(ATTACKER, evading, seqRng([D20_HIT, pctRng(0)]));
  assert.equal(find(events, 'evadeRoll').evadePct, 40, 'no table, so no stance bonus');
});

test('a stance row with a 0 bonus adds nothing', () => {
  // evade-bonus.csv has an attack row at 0, so the table is used and the bonus is 0.
  const attacking = DEFENDER({ evadeBasePct: 40, stance: 'attack' });
  const events = resolvePair(ATTACKER, attacking, seqRng([D20_HIT, pctRng(0)]), { evadeTable: evadeTable() });
  assert.equal(find(events, 'evadeRoll').evadePct, 40, 'attack row is 0, so no bonus');
});

test('resolveRound passes the evade table through: a stance bonus raises evadePct in that pairing', () => {
  const events = resolveRound(
    [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }],
    [{ id: 'dodger', speed: 1, kind: 'other', evadeBasePct: 40, stance: 'evade' }],
    1,
    seqRng([D20_HIT, pctRng(55)]),
    { evadeTable: evadeTable() },
  ).events;
  assert.equal(find(events, 'evadeRoll').evadePct, 60);
  assert.equal(find(events, 'momentum').by, 'enemy');
});

// Scope filter in resolveRound (DESIGN.md, Evade bonus scopes). Bonuses passed in
// options.evadeBonuses are filtered by resolveRound itself. Player cards defend
// against enemy attacks, so each evadeRoll is the defending card's own roll.
const SCOPED_CARDS = [
  { id: 'A', slot: 0, speed: 1, kind: 'other', evadeBasePct: 30 },
  { id: 'B', slot: 1, speed: 1, kind: 'other', evadeBasePct: 30 },
];
const SCOPED_ENEMIES = [
  { id: 'eA', speed: 4, kind: 'attack' },
  { id: 'eB', speed: 4, kind: 'attack' },
];
const rollAt = (events, slot) => events.find((e) => e.type === 'evadeRoll' && e.slot === slot);

test('scope exchange: a bonus attached to card A changes only A\'s evadePct in that round', () => {
  const bonus = { source: 'ring', pct: 20, scope: 'exchange', appliesTo: 'A' };
  const { events } = resolveRound(SCOPED_CARDS, SCOPED_ENEMIES, 2, () => 0.99, { evadeBonuses: [bonus] });
  assert.equal(rollAt(events, 0).evadePct, 50, 'card A gets the bonus');
  assert.equal(rollAt(events, 1).evadePct, 30, 'card B does not');
});

test('scope exchange: a bonus with no appliesTo attaches to nothing', () => {
  const attached = { source: 'ring', pct: 20, scope: 'exchange', appliesTo: 'A' };
  const loose = { source: 'ring', pct: 20, scope: 'exchange' };
  assert.equal(rollAt(resolveRound(SCOPED_CARDS, SCOPED_ENEMIES, 2, () => 0.99, { evadeBonuses: [attached] }).events, 0).evadePct, 50);
  const { events } = resolveRound(SCOPED_CARDS, SCOPED_ENEMIES, 2, () => 0.99, { evadeBonuses: [loose] });
  assert.equal(rollAt(events, 0).evadePct, 30);
  assert.equal(rollAt(events, 1).evadePct, 30);
});

test('scope round: a bonus with round 1 applies at options.round 1 and not at round 2', () => {
  const bonus = { source: 'round1', pct: 20, scope: 'round', round: 1 };
  const one = resolveRound([SCOPED_CARDS[0]], [SCOPED_ENEMIES[0]], 1, () => 0.99, { round: 1, evadeBonuses: [bonus] });
  assert.equal(rollAt(one.events, 0).evadePct, 50, 'round 1 matches');
  const two = resolveRound([SCOPED_CARDS[0]], [SCOPED_ENEMIES[0]], 1, () => 0.99, { round: 2, evadeBonuses: [bonus] });
  assert.equal(rollAt(two.events, 0).evadePct, 30, 'round 2 does not match');
});

test('scope combat: a bonus with combatId c1 applies in c1 and not in c2', () => {
  const bonus = { source: 'c1', pct: 20, scope: 'combat', combatId: 'c1' };
  const inC1 = resolveRound([SCOPED_CARDS[0]], [SCOPED_ENEMIES[0]], 1, () => 0.99, { combatId: 'c1', evadeBonuses: [bonus] });
  assert.equal(rollAt(inC1.events, 0).evadePct, 50);
  const inC2 = resolveRound([SCOPED_CARDS[0]], [SCOPED_ENEMIES[0]], 1, () => 0.99, { combatId: 'c2', evadeBonuses: [bonus] });
  assert.equal(rollAt(inC2.events, 0).evadePct, 30);
});

test('scope run: a run bonus applies with no round or combat set', () => {
  const bonus = { source: 'run', pct: 20, scope: 'run' };
  const { events } = resolveRound([SCOPED_CARDS[0]], [SCOPED_ENEMIES[0]], 1, () => 0.99, { evadeBonuses: [bonus] });
  assert.equal(rollAt(events, 0).evadePct, 50);
});

test('scope run: an unscoped-side bonus defaults to the player, so an enemy defender gets no evadePct', () => {
  // The player attacks enemy eA. The run bonus is owned by the player, so eA gets no roll and no evaded.
  const bonus = { source: 'ring', pct: 90, scope: 'run' };
  const attack = [{ id: 'A', slot: 0, speed: 4, kind: 'attack' }];
  const foe = [{ id: 'eA', speed: 1, kind: 'other' }];
  const { events } = resolveRound(attack, foe, 1, seqRng([D20_HIT, pctRng(10)]), { evadeBonuses: [bonus] });
  assert.equal(rollAt(events, 0), undefined, 'no evade roll for the enemy');
  assert.equal(events.some((e) => e.type === 'evaded'), false, 'no evaded event');
});

test('scope run: a bonus with side eA applies to eA only, and not to the player', () => {
  const bonus = { source: 'ring', pct: 90, scope: 'run', side: 'eA' };
  const attack = [{ id: 'A', slot: 0, speed: 4, kind: 'attack' }];
  const foe = [{ id: 'eA', speed: 1, kind: 'other' }];
  const hitEnemy = resolveRound(attack, foe, 1, seqRng([D20_HIT, pctRng(10)]), { evadeBonuses: [bonus] });
  assert.equal(rollAt(hitEnemy.events, 0).evadePct, 90, 'eA gets the bonus');
  assert.equal(find(hitEnemy.events, 'evaded').by, 'enemy');

  const defend = [{ id: 'P', slot: 0, speed: 1, kind: 'other' }];
  const attacker = [{ id: 'eA', speed: 4, kind: 'attack' }];
  const hitPlayer = resolveRound(defend, attacker, 1, () => 0.99, { evadeBonuses: [bonus] });
  assert.equal(rollAt(hitPlayer.events, 0), undefined, 'the player does not get eA\'s bonus');
});

test('clampStage: Infinity clamps to 3, -Infinity and NaN clamp to 0', () => {
  assert.equal(clampStage(Infinity), 3);
  assert.equal(clampStage(-Infinity), 0);
  assert.equal(clampStage(NaN), 0);
});

// Card hints from a perception stage (DESIGN.md, Card hints). The enemy action is
// passed through revealAction(), so only the fields visible at that stage exist.
const HINT_FOE = { id: 'foe', card: 'one', speed: 1, kind: 'attack', stance: 'attack', damage: 2, tags: [] };
const HINT_CARD = { card: 'three', stance: 'counter' }; // faster, and counter beats attack in the CSV

test('cardHint at perception stage 0: hidden, so no speed, no arrow, and a grey border', () => {
  const hint = cardHint(HINT_CARD, revealAction(HINT_FOE, 0), hintCtx());
  assert.equal(hint.border, 'grey');
  assert.equal(hint.speedDelta, null);
  assert.equal(hint.arrow, null);
});

test('cardHint at perception stage 1: stance group only, so the stance is not judged and the border is grey', () => {
  const hint = cardHint(HINT_CARD, revealAction(HINT_FOE, 1), hintCtx());
  assert.equal(hint.border, 'grey');
  assert.equal(hint.speedDelta, null);
  assert.equal(hint.arrow, null);
});

test('cardHint at perception stage 2: the stance is known and speed is not, so no green and no arrow', () => {
  const advantage = cardHint(HINT_CARD, revealAction(HINT_FOE, 2), hintCtx());
  assert.equal(advantage.border, 'yellow', 'stance advantage only, speed unknown');
  assert.equal(advantage.speedDelta, null);
  assert.equal(advantage.arrow, null);

  const none = cardHint({ card: 'three', stance: 'attack' }, revealAction(HINT_FOE, 2), hintCtx());
  assert.equal(none.border, 'red', 'no stance advantage, and speed is not used');
  assert.equal(none.speedDelta, null);
});

test('cardHint self-target card: blue border, but no speed delta while the enemy speed is unknown', () => {
  const self = { card: 'three', target: 'self' };
  const hidden = cardHint(self, revealAction(HINT_FOE, 2), hintCtx());
  assert.equal(hidden.border, 'blue');
  assert.equal(hidden.speedDelta, null, 'stage 2 hides the enemy speed');
  assert.equal(hidden.arrow, null);

  const known = cardHint(self, revealAction(HINT_FOE, 3), hintCtx());
  assert.equal(known.speedDelta, 2, 'at stage 3 the delta is shown');
  assert.equal(known.arrow, null, 'self-target cards never show an arrow');
});

test('cardHint at stage 3: a speed field without speed component ids still gives a speed delta and arrow', () => {
  // The action carries only `speed`, the field resolveRound pairs with. Speed is known at stage 3.
  const hint = cardHint(HINT_CARD, revealAction({ id: 'x', speed: 1, kind: 'attack', stance: 'attack' }, 3), hintCtx());
  assert.equal(hint.speedDelta, 2, 'player 3 minus enemy speed 1');
  assert.deepEqual(hint.arrow, { glyph: '>>', colour: 'green' });
});

test('cardHint speedDelta sign matches who acts first in resolvePair and resolveRound', () => {
  const rng = () => 0.99;
  const sign = (n) => Math.sign(n);
  const who = { player: 1, enemy: -1 };
  for (const [p, e] of [[3, 1], [1, 3], [2, 2], [4, 2]]) {
    const card = { id: 'c', speed: p, kind: 'other' };
    const foe = { id: 'x', speed: e, kind: 'other', stance: 'attack' };
    const hint = cardHint(card, foe, hintCtx());
    const first = find(resolvePair(card, foe, rng), 'order').first;
    const expected = first === null ? 0 : who[first];
    assert.equal(sign(hint.speedDelta), expected, `player ${p} vs enemy ${e}`);
  }
  // Momentum with the default decay (no decay: 0 pin). The stored M_e of 2 decays to 1
  // before pairing, so the player gets trunc(1 / 2) = 0 and the foe at 2 is faster.
  // The hint must be given the decayed M_e, as DESIGN.md (Card hints) says.
  const card = { id: 'c', speed: 1, kind: 'other' };
  const foe = { id: 'x', speed: 2, kind: 'other', stance: 'attack' };
  const { events } = resolveRound([{ ...card, slot: 0 }], [foe], 1, rng, { momentum: { x: 2 } });
  const hint = cardHint(card, foe, hintCtx({ momentum: decayMomentum(2) }));
  assert.equal(sign(hint.speedDelta), -1);
  assert.equal(find(events, 'order').first, 'enemy');
  // Passing the stored M_e instead gives +1 (the player faster), which disagrees with the pairing.
  assert.equal(sign(cardHint(card, foe, hintCtx({ momentum: 2 })).speedDelta), 1);
});

test('cardHint sign matches resolveRound when M_e is passed decayed, for a range of stored values', () => {
  const rng = () => 0.99;
  const sign = (n) => Math.sign(n);
  for (const stored of [-3, -2, -1, 0, 1, 2, 3]) {
    const card = { id: 'c', speed: 2, kind: 'other' };
    const foe = { id: 'x', speed: 2, kind: 'other', stance: 'attack' };
    const { events } = resolveRound([{ ...card, slot: 0 }], [foe], 1, rng, { momentum: { x: stored } });
    const hint = cardHint(card, foe, hintCtx({ momentum: decayMomentum(stored) }));
    const first = find(events, 'order').first;
    const expected = first === null ? 0 : { player: 1, enemy: -1 }[first];
    assert.equal(sign(hint.speedDelta), expected, `stored M_e ${stored}`);
  }
});

test('cardHint at perception stage 3: the full action gives speed, the arrow and green', () => {
  const hint = cardHint(HINT_CARD, revealAction(HINT_FOE, 3), hintCtx());
  assert.equal(hint.border, 'green');
  assert.equal(hint.speedDelta, 2);
  assert.deepEqual(hint.arrow, { glyph: '>>', colour: 'green' });
});

test('unpaired: the event names the enemy by enemyId, the same key momentum uses', () => {
  // The action id differs from its enemy id. One action is paired, the other is not.
  const cards = [{ id: 'a', slot: 0, speed: 4, kind: 'attack' }];
  const queue = [
    { id: 'G-strike', enemyId: 'G', speed: 1, kind: 'other' },
    { id: 'G-guard', enemyId: 'G', speed: 1, kind: 'other' },
  ];
  const { events } = resolveRound(cards, queue, 2, () => 0.99);
  const unpaired = events.find((e) => e.type === 'unpaired');
  assert.equal(unpaired.slot, 1);
  assert.equal(unpaired.enemyId, 'G', 'enemyId is the enemy id, not the action id');
  assert.equal(unpaired.momentum, 0, 'and it carries that enemy\'s momentum key');
});

// Unpaired enemy actions (owner, 2026-10-11; DESIGN.md, Open question d). An enemy
// attack with no card on its slot rolls its hit against the player's defence. A
// landed hit wins the slot for that enemy. A non-attack unpaired action does nothing.
const COVERED = [{ id: 'block', slot: 0, speed: 1, kind: 'other' }];
const UNPAIRED_QUEUE = () => [
  { id: 'guard', enemyId: 'G', speed: 1, kind: 'other' },
  { id: 'strike', enemyId: 'H', speed: 3, kind: 'attack' },
];
const unpairedHit = (events) => events.find((e) => e.type === 'hit' && e.slot === 1);

test('unpaired attack: a landed hit on the player wins the slot for that enemy, momentum -1 for the player', () => {
  const { events, momentum } = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(20), { decay: 0 });
  const hit = unpairedHit(events);
  assert.equal(hit.by, 'enemy');
  assert.equal(hit.target, 'player');
  assert.equal(hit.hit, true);
  assert.equal(momentum.H, -1, 'the enemy wins the slot: M moves toward the enemy');
  assert.equal(momentum.G, 0, 'the unpaired guard does nothing');
  const win = events.find((e) => e.type === 'momentum' && e.reason === 'success' && e.enemyId === 'H');
  assert.equal(win.by, 'enemy');
  assert.equal(win.delta, -1);
});

test('unpaired attack: a miss gives the player nothing (owner, 2026-10-11), so M_H stays put', () => {
  const { events, momentum } = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(1), { decay: 0 });
  assert.equal(unpairedHit(events).hit, false);
  assert.equal(momentum.H, 0);
});

test('unanswered miss gives the player nothing: no success event, no momentum move', () => {
  // Owner, 2026-10-11: an unanswered enemy attack that misses gives the player no slot credit.
  const { events, momentum } = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(1), { decay: 0 });
  assert.equal(unpairedHit(events).hit, false, 'the event is still emitted');
  assert.equal(momentum.H, 0, 'no momentum moves for the player');
  assert.equal(events.some((e) => e.type === 'momentum' && e.reason === 'success' && e.enemyId === 'H'), false);
});

test('unpaired attack: a player intangible charge avoids the hit, is spent, and the avoid gives the player nothing', () => {
  const { events, momentum, charges } = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(20), {
    decay: 0,
    charges: { player: 1 },
    playerDefense: { tags: ['intangible'] },
  });
  const evaded = events.find((e) => e.type === 'evaded' && e.slot === 1);
  assert.equal(evaded.reason, 'intangible');
  assert.equal(evaded.by, 'player');
  assert.equal(charges.player, 0);
  assert.equal(momentum.H, 0, 'an avoid on an unanswered attack earns no slot credit');
});

test('unpaired attack: a hit that would land rolls the player\'s evadePct, and a roll under it avoids the hit', () => {
  const { events, momentum } = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, seqRng([D20_HIT, pctRng(10)]), {
    decay: 0,
    playerDefense: { evadePct: 50 },
  });
  const roll = events.find((e) => e.type === 'evadeRoll' && e.slot === 1);
  assert.equal(roll.evadePct, 50);
  assert.equal(roll.success, true);
  assert.equal(events.find((e) => e.type === 'evaded' && e.slot === 1).reason, 'evasion');
  assert.equal(momentum.H, 0, 'an evadePct avoid on an unanswered attack earns no slot credit');
});

test('unpaired attack: playerDefense.evasion raises the bar; with no playerDefense the evasion is 0', () => {
  const dflt = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(10), { decay: 0 });
  assert.equal(unpairedHit(dflt.events).hit, true, 'no playerDefense: d20 10 meets AC 8');
  const armoured = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(10), { decay: 0, playerDefense: { evasion: 5 } });
  assert.equal(unpairedHit(armoured.events).hit, false, 'evasion 5 needs 13, so d20 10 misses');
  assert.equal(armoured.momentum.H, 0, 'a miss on an unanswered attack earns the player no slot credit');
});

test('unpaired non-attack actions do nothing: no hit, no evade roll, no momentum, no status', () => {
  const queue = [
    { id: 'guard', enemyId: 'G', speed: 1, kind: 'other' },
    { id: 'counter', enemyId: 'H', speed: 3, kind: 'counter', tags: ['stagger'] },
  ];
  const { events, momentum } = resolveRound(COVERED, queue, 2, d20Face(20), { decay: 0 });
  assert.equal(events.some((e) => e.type === 'hit' || e.type === 'evadeRoll' || e.type === 'status'), false);
  assert.equal(momentum.H, 0);
  assert.ok(events.find((e) => e.type === 'unpaired' && e.slot === 1), 'the marker is still there');
});

test('unpaired marker: every event from an unpaired slot carries unpaired: true, and paired events do not', () => {
  const { events } = resolveRound(COVERED, UNPAIRED_QUEUE(), 2, d20Face(20), { decay: 0 });
  const onSlot1 = events.filter((e) => e.slot === 1);
  assert.ok(onSlot1.some((e) => e.type === 'unpaired'), 'the marker is on slot 1');
  assert.ok(onSlot1.some((e) => e.type === 'hit'), 'the unanswered hit is on slot 1');
  for (const e of onSlot1) assert.equal(e.unpaired, true, e.type);
  for (const e of events.filter((e) => e.slot === 0)) assert.equal(e.unpaired, undefined, e.type);
});

// Overflow and poise (owner, 2026-10-11; DESIGN.md, Momentum). When a side's
// success pushes M_e past its limit, that side gets double poise on its next
// landed hit. Modelled as a flag only: poise damage is not in the prototype.
const POISE_CARDS = [{ id: 'strike', slot: 0, speed: 4, kind: 'attack' }];
const POISE_QUEUE = [{ id: 'e', speed: 1, kind: 'other' }];

test('overflow: a player success from +3 emits an overflow event and sets poiseDouble.player', () => {
  const out = resolveRound(POISE_CARDS, POISE_QUEUE, 1, d20Face(20), { momentum: { e: 3 }, decay: 0 });
  assert.equal(out.momentum.e, 3, 'the clamp holds M_e at +3');
  const overflow = out.events.find((e) => e.type === 'momentum' && e.reason === 'overflow');
  assert.deepEqual({ enemyId: overflow.enemyId, side: overflow.side }, { enemyId: 'e', side: 'player' });
  assert.equal(out.poiseDouble.player, true);
  assert.equal(out.poiseDouble.e, false, 'the enemy side has no flag');
});

test('overflow: no flag when the success stays inside the limit (from +2 to +3)', () => {
  const out = resolveRound(POISE_CARDS, POISE_QUEUE, 1, d20Face(20), { momentum: { e: 2 }, decay: 0 });
  assert.equal(out.events.some((e) => e.reason === 'overflow'), false);
  assert.equal(out.poiseDouble.player, false);
});

test('poise: the next round, the flag doubles the player first landed hit and is then cleared', () => {
  const out = resolveRound(POISE_CARDS, POISE_QUEUE, 1, d20Face(20), { momentum: { e: 0 }, decay: 0, poiseDouble: { player: true } });
  const hit = out.events.find((e) => e.type === 'hit');
  assert.equal(hit.by, 'player');
  assert.equal(hit.hit, true);
  assert.equal(hit.poiseMultiplier, 2);
  assert.equal(out.poiseDouble.player, false);
});

test('poise: a landed hit with no flag carries no multiplier', () => {
  const out = resolveRound(POISE_CARDS, POISE_QUEUE, 1, d20Face(20), { momentum: { e: 0 }, decay: 0 });
  assert.equal(out.events.find((e) => e.type === 'hit').poiseMultiplier, undefined);
});

test('poise: only the first landed hit of a flagged side is doubled in a round', () => {
  const cards = [
    { id: 'a', slot: 0, speed: 4, kind: 'attack' },
    { id: 'b', slot: 1, speed: 4, kind: 'attack' },
  ];
  const queue = [{ id: 'e0', enemyId: 'e0', speed: 1, kind: 'other' }, { id: 'e1', enemyId: 'e1', speed: 1, kind: 'other' }];
  const out = resolveRound(cards, queue, 2, d20Face(20), { decay: 0, poiseDouble: { player: true } });
  const hits = out.events.filter((e) => e.type === 'hit');
  assert.deepEqual(hits.map((h) => h.poiseMultiplier), [2, undefined]);
  assert.equal(out.poiseDouble.player, false);
});

test('poise: a flagged side that does not land keeps its flag for a later round', () => {
  const out = resolveRound(POISE_CARDS, POISE_QUEUE, 1, d20Face(1), { momentum: { e: 0 }, decay: 0, poiseDouble: { player: true } });
  assert.equal(out.events.find((e) => e.type === 'hit').hit, false);
  assert.equal(out.poiseDouble.player, true);
});

test('overflow: an enemy success from -3 flags that enemy, and the next landed enemy hit is doubled', () => {
  // The unpaired enemy H attacks and lands: M_H moves -1, from -3 to past the limit.
  const cover = [{ id: 'block', slot: 0, speed: 1, kind: 'other' }];
  const queue = [
    { id: 'guard', enemyId: 'G', speed: 1, kind: 'other' },
    { id: 'strike', enemyId: 'H', speed: 3, kind: 'attack' },
  ];
  const first = resolveRound(cover, queue, 2, d20Face(20), { momentum: { H: -3 }, decay: 0 });
  assert.equal(first.events.find((e) => e.reason === 'overflow').side, 'enemy');
  assert.equal(first.poiseDouble.H, true);
  assert.equal(first.poiseDouble.player, false);
  const next = resolveRound(cover, queue, 2, d20Face(20), { momentum: { H: 0 }, decay: 0, poiseDouble: first.poiseDouble });
  const hit = next.events.find((e) => e.type === 'hit' && e.slot === 1);
  assert.equal(hit.by, 'enemy');
  assert.equal(hit.poiseMultiplier, 2);
  assert.equal(next.poiseDouble.H, false);
});

test('poiseDouble: must be an object keyed by side or enemy id', () => {
  assert.throws(() => resolveRound([], [], 0, d20Face(20), { poiseDouble: [] }), TypeError);
  assert.throws(() => resolveRound([], [], 0, d20Face(20), { poiseDouble: true }), TypeError);
});

// A seeded generator, so the rolls are the same on every run.
const seeded = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

test('per-enemy keys: enemy ids that name Object.prototype members keep their own momentum and charges', () => {
  // 'toString' and 'constructor' are inherited from Object.prototype. Each
  // enemy gets its own entry in the returned maps, not the inherited function.
  const cards = [
    { id: 'strikeA', slot: 0, speed: 4, kind: 'attack' },
    { id: 'strikeB', slot: 1, speed: 4, kind: 'attack' },
  ];
  const queue = [
    { id: 'toString-hit', enemyId: 'toString', speed: 1, kind: 'attack', tags: ['intangible'], intangibleCharges: 2 },
    { id: 'constructor-hit', enemyId: 'constructor', speed: 1, kind: 'attack', tags: ['intangible'], intangibleCharges: 2 },
  ];
  const out = resolveRound(cards, queue, 2, seeded(7));
  for (const k of ['toString', 'constructor']) {
    assert.equal(Object.hasOwn(out.momentum, k), true, `${k} has its own momentum entry`);
    assert.equal(typeof out.momentum[k], 'number', `${k} momentum is a number`);
    assert.equal(Object.hasOwn(out.charges, k), true, `${k} has its own charges entry`);
    assert.equal(typeof out.charges[k], 'number', `${k} charges is a number`);
  }
});
