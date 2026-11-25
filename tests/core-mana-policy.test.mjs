import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCard } from '../src/model/registries.js';
import { core2Registries } from './helpers/core2.mjs';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { getStacks } from '../src/engine/statuses.js';
import { pinLegacyRests } from './helpers/legacy-core-rests.mjs';
import { rederivePools } from '../src/model/levelup.js';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
const registries = core2Registries();
function fresh(classId = 'reaver', reg = registries) {
  return createRunState({ seed: 73, classId, registries: reg, runId: 'mana-policy-test',
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['one'] } } },
  });
}
function fight(cardId, classId = 'reaver', reg = registries) {
  const run = fresh(classId, reg);
  // A caster's staff is a Focus armament (-1 MP, tests/focus-mana-discount.test.mjs); these tests price the printed Mana.
  run.loadout.sets.rightHand[0] = 'greatsword'; run.loadout.sets.leftHand[0] = null;
  const combat = createRunCombat({ registries: reg, rng: createRng(3), run, enemyIds: ['wanderingSoldier'], settings: {} });
  const card = { instanceId: 'mana-test-card', cardId, upgraded: false };
  combat.piles.hand = [card];
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
  return { combat, card };
}

// Current Core Mana starts at 1 + Wisdom, independent of Intelligence.
test('core Reaver Mana grows by one with each earned Wisdom, independent of Intelligence', () => {
  // Level Up is no longer a shipped rest service; a run pinned to the pre-one-pick rests keeps it.
  const run = pinLegacyRests(fresh()); assert.equal(run.maxMana, 2); assert.equal(run.mana, 2);
  assert.equal(run.attributes.wisdom, 1);
  run.attributes.intelligence = 7; run.attributes.wisdom = 3;
  rederivePools(registries, run, 'test');
  assert.equal(run.maxMana, 4, 'Mana is 1 + WIS 3 despite the higher Intelligence');
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1); run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine').id; // the first rest of act 1 (a branch may open narrow)
  beginGameProfileRest(run, '1:' + run.mapNodeId); run.level.unspentPoints = 1;
  commitGameProfileRest(registries, run, 'levelUp', { attributeId: 'wisdom' });
  assert.equal(run.maxMana, 5); assert.equal(run.mana, 5);
});

// Owner ruling 2026-11-21 (starter budget): Sundering Art is Unranked, so it prints 32 (was 3x Smash = 36).
test('core Smash is twice its same-rank Strike for one extra SP; Sundering Art is a 2 SP + 1 MP Smash printing 32', () => {
  const strike = resolveCard(registries, { cardId: 'core.strike' });
  const smash = resolveCard(registries, { cardId: 'core.smash' });
  const art = resolveCard(registries, { cardId: 'core.reaverSpecial' });
  assert.deepEqual([strike.effects[0].amount, strike.staminaCost, strike.manaCost], [6, 1, 0]);
  assert.deepEqual([smash.effects[0].amount, smash.staminaCost, smash.manaCost], [12, 2, 0]);
  assert.deepEqual([art.effects[0].amount, art.staminaCost, art.manaCost], [32, 2, 1]);
  assert.ok(smash.tags.includes('maneuver:smash') && art.tags.includes('maneuver:smash'));
});

test('Sundering Art preview, affordability and actual combat payment use the same 2 SP and 1 MP', () => {
  const { combat, card } = fight('core.reaverSpecial');
  assert.deepEqual(cardPlayCosts(combat, card.instanceId), { energy: 2, stamina: 2, mana: 1 });
  combat.player.mana = 0;
  const before = combat.player.stamina;
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }), /mana/i);
  assert.equal(combat.player.stamina, before, 'refused play pays nothing');
  combat.player.mana = 1;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  assert.equal(combat.player.mana, 0);
  assert.equal(combat.player.stamina, before - 2);
  assert.ok(combat.eventLog.some(event => event.type === 'cardPlayed' && event.cardInstanceId === card.instanceId));
});

// Owner, 2026-11-15 (W25-F): every spell costs 1 more Mana, so Star Spark's printed 1 MP is paid as 2 (no Focus armament here; the Focus discount has its own test).
// Owner ruling 2026-11-21 (starter budget): Star Spark is Unranked, so it no longer applies Vulnerable (a second effect costs 5 and the stacks 8).
test('Star Spark pays two MP (one printed, one spell surcharge) and applies no Vulnerable', () => {
  // This intrinsic surcharge fixture predates armour-type discounts; current robe/Focus integration is exercised below.
  const { combat, card } = fight('core.starseerSpecial', 'starseer', legacyGearRegistries(registries));
  combat.player.maxMana = Math.max(combat.player.maxMana, 2); combat.player.mana = 2;
  // Magic spends Poise 1:1 (owner, 2026-10-31), so the spell would empty the soldier's Poise 5 and the break's Staggered adds a third Vulnerable.
  // A deep pool keeps this test about the card's own two stacks.
  combat.enemies[0].persistentPoise = { value: 100, max: 100 };
  const before = combat.player.mana;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  assert.equal(combat.player.mana, before - 2);
  assert.equal(getStacks(combat.enemies[0], 'vulnerable'), 0);
  assert.equal(registries.statuses.get('vulnerable').modifiers.damageTakenMult, 1.25);
  assert.equal(registries.statuses.get('vulnerable').decay, 'perTurnEnd');
});

test('current robes, Focus and Prepared keep spell quotes, payment and restored snapshots in agreement', () => {
  // Independent worked prices: spells add 1 MP and no SP (the +1 SP on non-cantrip spells was dropped by the owner on 2026-11-23);
  // Prepared cuts SP by 1 (floor 0) and positive printed MP by 1. Robes and Focus each cut another MP only while Prepared.
  const prices = [
    ['core.cometLance', [1, 2], [0, 0], [0, 0]], // Prepared: Graduate cut 1 -> 0 (owner 2026-11-22), then +1 surcharge, -1 robe
    ['core.meteor', [1, 4], [0, 2], [0, 1]],
    ['core.cantrip', [1, 2], [0, 0], [0, 0]], // Arcane Spark prints 1 MP (owner 2026-11-22): plain 1 + 1 surcharge - 1 robe
    // A current gear profile without spellCosts has neither surcharge nor its SP cut.
    // Meteor stays 3 MP plain / 2 MP with Adept, before robe -1 and Prepared Focus -1.
    ['core.meteor', [1, 3], [1, 1], [1, 0], false],
    // A fight saved before 2026-11-23 keeps staminaSurcharge 1 in its rules snapshot, so its spells still pay +1 SP.
    ['core.cometLance', [2, 2], [1, 0], [1, 0], 'saved'],
    ['core.meteor', [2, 4], [1, 2], [1, 1], 'saved'],
    ['core.cantrip', [1, 2], [0, 0], [0, 0], 'saved'],
  ];
  for (const [cardId, plain, prepared, focused, spellCosts = true] of prices) for (const [hand, stance, expected] of [
    ['greatsword', null, plain], ['ashStaff', null, plain], ['boneSceptre', null, plain],
    ['greatsword', 'casting', prepared], ['ashStaff', 'casting', focused],
    ['ashStaff', 'prepared', focused], ['boneSceptre', 'casting', focused],
  ]) {
    const run = fresh('starseer');
    run.loadout.sets.rightHand[0] = hand; run.loadout.sets.leftHand[0] = null;
    const combat = createRunCombat({ registries, run, rng: createRng(3), enemyIds: ['wanderingSoldier'] });
    if (!spellCosts) delete combat.fixCoreRules.spellCosts;
    if (spellCosts === 'saved') combat.fixCoreRules.spellCosts.staminaSurcharge = 1;
    assert.equal(combat.gameProfile.modules.gear.typeEffectsVersion, 1, 'this is current gear integration');
    assert.equal(combat.player.maxMana, 4, 'the current Nightweave kit starts with four MP');
    assert.equal(getStacks(combat.player, 'ward'), 0, 'these weapon types have no automatic turn-start Ward');
    combat.piles.hand = [{ instanceId: 'robe-focus', cardId, upgraded: false }];
    combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
    combat.enemies[0].persistentPoise = { value: 100, max: 100 };
    if (stance) combat.player.combatStance = { maneuver: stance, camp: 'spell' };
    const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
    const costs = cardPlayCosts(combat, 'robe-focus'), preview = previewCard(combat, 'robe-focus', combat.enemies[0].id);
    assert.deepEqual([costs.stamina, costs.mana], expected, `${cardId}/${hand}/${stance}/spellCosts=${spellCosts}`);
    assert.deepEqual([preview.staminaCost, preview.manaCost], expected);
    assert.deepEqual(serializeCombatSnapshot(combat), before, 'quotes do not mutate combat');
    assert.deepEqual(combat.rng.getCounters(), counters, 'quotes consume no RNG');
    const restored = restoreCombatSnapshot({ registries, snapshot: before, rng: createRng(combat.rng.seed, counters), expectedGameProfile: combat.gameProfile });
    const play = ctx => dispatch(ctx, { type: 'playCard', cardInstanceId: 'robe-focus', targetId: ctx.enemies[0].id });
    const actual = play(combat), resumed = play(restored);
    const paid = actual.events.find(event => event.type === 'cardPlayed' && event.cardInstanceId === 'robe-focus');
    assert.deepEqual([paid.staminaSpent, paid.manaSpent], expected);
    assert.deepEqual(actual, resumed, 'restored payment and events match');
    assert.deepEqual(serializeCombatSnapshot(combat), serializeCombatSnapshot(restored));
  }
});

