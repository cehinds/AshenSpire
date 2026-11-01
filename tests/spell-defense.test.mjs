import test from 'node:test';
import assert from 'node:assert/strict';
import { spellDefenseSplit } from '../src/model/spellDefense.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, previewCard, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { gainBarrier, gainBlock, computeBlockGain, computeMeterGuardGain, computeSpellDefenseGain } from '../src/engine/actions.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { combatCardSummary, playingCardModel } from '../src/model/playingCard.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';

const registries = createRegistries(contentBundle);
const guard = school => ({ type: 'skill', skipRatingBonus: true,
  combatProfile: { camp: 'spell', maneuver: 'counter', school } });
const fixture = () => createCombat({ registries, rng: createRng(5),
  combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
  player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10,
    maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });

test('defense uses school shares independently of damage routing and preserves odd totals', () => {
  for (const [school, block, ward] of [['fire', 2, 3], ['frost', 3, 2], ['force', 4, 1], ['alteration', 4, 1]]) {
    assert.deepEqual(spellDefenseSplit({ ...guard(school), magicShare: 1 }, 5), { block, ward });
    for (let amount = 0; amount <= 40; amount++) {
      const split = spellDefenseSplit(guard(school), amount);
      assert.equal(split.block + split.ward, amount);
    }
  }
  assert.equal(spellDefenseSplit({ ...guard('fire'), evade: { charges: 1 } }, 5), null);
  assert.equal(spellDefenseSplit({ combatProfile: { camp: 'physical', maneuver: 'counter' } }, 5), null);
  assert.equal(spellDefenseSplit({ combatProfile: { camp: 'spell', maneuver: 'casting' } }, 5), null);
  assert.deepEqual(spellDefenseSplit({ type: 'skill', combatProfile: { camp: 'spell', school: 'divine' } }, 3), { block: 1, ward: 2 });
});

test('the block guard splits the modified total once and refills Ward; the part past a full pool becomes Barrier stacks', () => {
  for (const gain of [gainBlock]) for (const [school, block, ward] of [['fire', 2, 3], ['frost', 3, 2], ['force', 4, 1], ['alteration', 4, 1]]) {
    for (const startingWard of [0, 3]) {
      const combat = fixture(), player = combat.player;
      player.block = 0; player.barrier = 0; player.persistentWard = { max: 3, value: startingWard };
      assert.equal(gain(combat, player, 5, guard(school)), 5);
      assert.equal(player.block, block);
      assert.equal(player.wardBlock || 0, 0, 'physical Block has no Ward provenance');
      assert.equal(player.persistentWard.value, Math.min(3, startingWard + ward));
      assert.equal(player.statuses.barrier?.stacks || 0, Math.max(0, startingWard + ward - 3), 'overflow past a full pool is Barrier stacks, one per point');
    }
  }
  const combat = fixture(), player = combat.player;
  player.block = 0; player.barrier = 0; player.persistentWard = { max: 30, value: 0 };
  const card = { ...guard('frost'), cardId: 'frostCounter', skipRatingBonus: false, ratingValue: 4 };
  const total = computeBlockGain(combat, player, 5, card);
  assert.equal(total, 9, 'the authored fallback rating contributes four points');
  assert.equal(gainBlock(combat, player, 5, card), total);
  assert.equal(player.block + player.persistentWard.value + (player.statuses.barrier?.stacks || 0), total, 'rating bonus is included once');
  // The gainBarrier opcode adds that many Barrier stacks and touches neither Block nor Ward (SPEC 4.1a).
  const stacker = fixture().player; stacker.block = 0; stacker.persistentWard = { max: 3, value: 0 };
  assert.equal(gainBarrier(fixture(), stacker, 5, guard('fire')), 5);
  assert.equal(stacker.block, 0); assert.equal(stacker.persistentWard.value, 0);
});

test('upcast protection keeps its stack total and the faces read Barrier', () => {
  const combat = fixture();
  for (const [cardId, school] of [['frostCounter', 'frost'], ['fireCounter', 'fire'], ['forceCounter', 'force'], ['alterationCounter', 'alteration']]) {
    for (let rank = 0; rank <= 3; rank++) {
      const def = resolveCombatCard(combat, { cardId }, { upcastRanks: rank });
      const amount = def.effects.find(effect => effect.op === 'gainBarrier').amount;
      assert.ok(Number.isInteger(amount) && amount > 0, 'an upcast adds whole Barrier stacks');
    }
  }
  const rules = { combatExpansionVersion: 2, breakMeterVersion: 2 };
  assert.match(cardPlainText(registries, { cardId: 'crystalBarrier', abilityRank: 1 }, { rules }), /Gain 4 Barrier/);
  const complex = { id: 'test-defense', name: 'Complex defense', type: 'skill',
    tags: ['camp:spell', 'school:divine'], ashenBlightCost: 10,
    effects: [{ op: 'gainBarrier', target: 'self', amount: 18 }],
    textTemplate: 'Gain {gainBarrier} temporary Barrier. Pay 10 Ashen Blight. Exhaust.' };
  assert.equal(cardFaceLines(complex, null, registries), null);
  assert.match(cardPlainText(registries, { cardId: 'crystalBarrier' }, { definition: complex, rules }), /Gain 18 temporary Barrier\. Pay 10 Ashen Blight\. Exhaust/);
});

test('expanded block opcode faces and allied gains use defense shares; legacy faces retain Block', () => {
  const legacy = { id: 'custom-defense', name: 'Custom defense', type: 'skill',
    tags: ['camp:spell', 'school:alteration', 'maneuver:defend'], magicShare: 1,
    effects: [{ op: 'block', target: 'ally', amount: 5 }],
    textTemplate: 'Ally gains {block} Block.' };
  const expanded = applyCombatExpansionCard(legacy);
  const compact = cardFaceLines(expanded, null, registries).map(line => line.html).join(' ').replace(/<[^>]+>/g, '');
  assert.match(compact, /Ally gains 4 Block(?:,| and) 1 Ward/);
  assert.match(combatCardSummary(expanded, null, registries), /Ally gains 4 Block(?:,| and) 1 Ward/);
  assert.match(cardPlainText(registries, { cardId: 'crystalBarrier' },
    { definition: { ...expanded, ashenBlightCost: 1 }, rules: { combatExpansionVersion: 2 } }), /Ally gains 4 Block(?:,| and) 1 Ward/);
  assert.match(cardPlainText(registries, { cardId: 'crystalBarrier' }, { definition: legacy }), /Ally gains 5 Block/);
});

function ratedFixture(dr, pr, cardId = 'frostCounter', reactionRulesVersion = 2) {
  const combat = createCombat({ registries, rng: createRng(5),
    ratingsRules: resolveCombatRatings({}, contentBundle),
    combatExpansionVersion: 2, reactionRulesVersion, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20,
      energyMax: 20, drawPerTurn: 1,
      deck: [{ instanceId: 'rated-defense', cardId }] } });
  combat.player.ratings = { ar: 0, dr, pr, poise: 0, ward: 30 };
  combat.player.ratingSources = [];
  combat.player.statuses = {};
  combat.player.block = 0; combat.player.barrier = 0;
  combat.player.persistentWard = { max: 30, value: 0 };
  return combat;
}

test('live DR scales Block and PR scales Ward in the block guard; the gainBarrier stacks are not scaled by either', () => {
  for (const [cardId, school, baseBlock, baseWard] of [
    ['fireCounter', 'fire', 2, 3], ['frostCounter', 'frost', 3, 2],
    ['forceCounter', 'force', 4, 1], ['alterationCounter', 'alteration', 4, 1],
  ]) for (const [dr, pr] of [[3, 0], [0, 3], [3, 3]]) {
    const combat = ratedFixture(dr, pr, cardId), player = combat.player;
    const card = { ...guard(school), cardId, damageSchool: 'magic' };
    const total = 5 + dr + pr, expected = { block: baseBlock + dr, ward: baseWard + pr };
    assert.equal(computeBlockGain(combat, player, 5, card), total);
    assert.deepEqual(computeSpellDefenseGain(combat, player, 5, card), expected);
    assert.equal(gainBlock(combat, player, 5, card), total);
    assert.deepEqual({ block: player.block, ward: player.persistentWard.value + (player.statuses.barrier?.stacks || 0) }, expected);
    // The gainBarrier opcode: stacks equal the printed amount, whatever DR and PR are (SPEC 4.1a).
    const stacked = ratedFixture(dr, pr, cardId), holder = stacked.player;
    assert.equal(gainBarrier(stacked, holder, 5, card), 5);
    assert.equal(holder.statuses.barrier.stacks, 5); assert.equal(holder.block, 0);
  }
  for (const [cardId] of [['fireCounter'], ['frostCounter']]) for (const version of [1, 2]) {
    const combat = ratedFixture(3, 3, cardId, version), player = combat.player;
    const before = JSON.stringify({ model: serializeCombatSnapshot(combat), rng: combat.rng.getCounters(), events: combat.eventLog });
    const preview = previewCard(combat, 'rated-defense');
    const protection = preview.values.find(value => value.op === 'gainBarrier');
    assert.equal(protection.value, version === 2 ? 7 : 5, 'Counterstrike scales the printed 5 to 7; ratings do not');
    assert.equal(protection.defenseSplit, undefined);
    assert.equal(JSON.stringify({ model: serializeCombatSnapshot(combat), rng: combat.rng.getCounters(), events: combat.eventLog }), before,
      'preview changes no stance, pools, preparation, queue or RNG');
    const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'rated-defense', targetId: player.id });
    const own = out.events.filter(event => event.cardInstanceId === 'rated-defense' && !event.triggeredBy);
    assert.equal(own.filter(event => event.type === 'barrierGained').reduce((sum, event) => sum + event.amount, 0), protection.value,
      'paid support adds the previewed Barrier stacks');
    assert.equal(out.events.filter(event => event.type === 'combatCounterArmed').length, 1);
  }
});

test('combined spell defense rating caps once and preserves source equipment filtering', () => {
  const combat = ratedFixture(3, 3), player = combat.player;
  const card = { ...guard('frost'), cardId: 'frostCounter', damageSchool: 'magic', ratingCap: 9 };
  assert.equal(computeBlockGain(combat, player, 5, card), 9, 'DR + PR share one cap');
  assert.deepEqual(computeSpellDefenseGain(combat, player, 5, card), { block: 5, ward: 4 });
  assert.equal(computeBlockGain(combat, player, 10, card), 10, 'a cap never removes the authored base');
  player.ratingSources = [
    { kind: 'attribute', dr: 1, pr: 1 },
    { kind: 'equipment', sourceId: 'focus-a', dr: 20, pr: 20, effectiveRatings: { dr: 2, pr: 3 } },
    { kind: 'equipment', sourceId: 'focus-b', dr: 50, pr: 50 },
  ];
  assert.equal(computeBlockGain(combat, player, 5,
    { ...card, ratingCap: undefined, sourceArmamentId: 'focus-a', equipmentRole: 'guard' }), 12);
  assert.equal(computeBlockGain(combat, player, 5,
    { ...card, ratingCap: undefined, equipmentRole: 'guard' }), 7, 'unbound equipment guard excludes all equipment rows');
});

test('physical defense, evasion, legacy spell defense and meter guards retain their existing rating', () => {
  const combat = ratedFixture(3, 7), player = combat.player;
  const spell = { ...guard('frost'), cardId: 'frostCounter', damageSchool: 'magic' };
  const physical = { ...spell, damageSchool: 'physical', combatProfile: { camp: 'physical', maneuver: 'defend' } };
  assert.equal(computeBlockGain(combat, player, 5, physical), 8);
  assert.equal(computeBlockGain(combat, player, 5, { ...spell, evade: { charges: 1 } }), 12);
  assert.equal(computeMeterGuardGain(combat, player, 5, spell), 12, 'meter guard still reads PR alone');
  combat.combatExpansionVersion = 1;
  assert.equal(computeBlockGain(combat, player, 5, spell), 12);
});
