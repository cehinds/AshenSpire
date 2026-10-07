import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatMatchups, combatIntent } from '../src/content/combatMatchups.js';
import { createRegistries } from '../src/model/registries.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { combatIntentRulesProblems, combatMatchupRulesProblems } from '../src/model/combatTacticsRules.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { advancedConfigRows, configuredContentBundle } from '../src/model/advancedConfig.js';
import { createCombat, dispatch, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { armCombatCounter, matchupRules, prepareMatchupHit } from '../src/engine/combatMatchups.js';
import { applyRatingImpact } from '../src/engine/combatRatings.js';

const registries = createRegistries(contentBundle);
test('headless co-op preview conceals exact move when observer is missing', () => {
  const combat = fight();
  const enemy = combat.enemies[0];
  enemy.intentReads = { knownSeat: true };
  combat.playerKey = 'unknownSeat';
  const hidden = previewIntent(combat, enemy.id);
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.moveId, null);
  assert.equal(hidden.damage, undefined);
  combat.playerKey = 'knownSeat';
  assert.equal(previewIntent(combat, enemy.id).hidden, false);
});
function fight(options = {}) {
  return createCombat({ registries, rng: createRng(449), enemyIds: ['wanderingSoldier'], ...options,
    player: { classId: 'reaver', maxHp: 500, hp: 500, maxMana: 20, energyMax: 3, drawPerTurn: 3,
      attributes: { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 },
      deck: Array.from({ length: 15 }, (_, index) => ({ instanceId: `c${index}`, cardId: 'strike', upgraded: false })), relicIds: [] } });
}
function preparedFight() {
  const combat = fight();
  combat.combatMatchupRules = structuredClone(combatMatchups);
  combat.combatMatchupRules.counter.retaliationFlat = 11;
  combat.combatIntentRules = structuredClone(combatIntent);
  combat.combatIntentRules.baseHiddenChance = 0.4;
  armCombatCounter(combat, combat.player, { cardId: 'guardCounter', combatProfile: { camp: 'physical', maneuver: 'counter', counterMode: 'melee' } }, { damage: 9, poiseDamage: 4, bonus: 2 });
  combat.player.block = 30;
  combat.enemies[0].intentRevealed = false;
  combat.enemies[0].intentReads = { seatA: false, seatB: true };
  return combat;
}

test('a fresh fight captures independent tactical tuning before its first intent roll', () => {
  const combat = fight();
  assert.deepEqual(combat.combatMatchupRules, structuredClone(registries.balance.combatMatchups));
  assert.deepEqual(combat.combatIntentRules, structuredClone(registries.balance.combatIntent));
  combat.combatMatchupRules.counter.defaultDamage = 15;
  combat.combatIntentRules.baseHiddenChance = 0;
  assert.equal(registries.balance.combatMatchups.counter.defaultDamage, 6);
  assert.equal(registries.balance.combatIntent.baseHiddenChance, 0.70);
});

test('tactical rules have tunable rows with probability bounds and unique descriptions', () => {
  const rows = advancedConfigRows(contentBundle);
  for (const key of ['baseHiddenChance', 'wisdomReduction', 'intelligenceReduction', 'minimumHiddenChance', 'maximumHiddenChance']) {
    const row = rows.find(row => row.key === `gameConfig.balance.combatIntent.${key}`);
    assert.ok(row, key);
    assert.equal(row.min, 0); assert.equal(row.max, 1); assert.equal(row.integer, false);
    assert.equal(row.step, 0.01);
    assert.ok(!row.note.startsWith('Authored balance value:'));
  }
  const configured = configuredContentBundle(contentBundle, {
    'gameConfig.balance.combatIntent.baseHiddenChance': 0.2,
    'gameConfig.balance.combatMatchups.counter.defaultDamage': 12,
  });
  assert.equal(configured.balance.combatIntent.baseHiddenChance, 0.2);
  assert.equal(configured.balance.combatMatchups.counter.defaultDamage, 12);
  assert.deepEqual(combatMatchupRulesProblems(configured.balance.combatMatchups), []);
  assert.deepEqual(combatIntentRulesProblems(configured.balance.combatIntent), []);
});

test('reload keeps armed Counter, per-seat intent reads, receipts and original tuning', () => {
  const combat = preparedFight();
  const snapshot = serializeCombatSnapshot(combat);
  const alteredBundle = { ...contentBundle, balance: structuredClone(contentBundle.balance) };
  alteredBundle.balance.combatMatchups.counter.retaliationFlat = 99;
  alteredBundle.balance.combatIntent.baseHiddenChance = 1;
  const loaded = restoreCombatSnapshot({ registries: createRegistries(alteredBundle), rng: createRng(449, combat.rng.getCounters()), snapshot });
  assert.equal(matchupRules(loaded).counter.retaliationFlat, 11);
  assert.equal(loaded.combatIntentRules.baseHiddenChance, 0.4);
  assert.deepEqual(loaded.player.combatCounter, combat.player.combatCounter);
  assert.deepEqual(loaded.enemies[0].intentReads, { seatA: false, seatB: true });
  assert.equal(loaded.enemies[0].intentRevealed, false);
  assert.deepEqual(loaded.eventLog, combat.eventLog);
  assert.deepEqual(serializeCombatSnapshot(loaded), snapshot);
  dispatch(combat, { type: 'endTurn' });
  dispatch(loaded, { type: 'endTurn' });
  assert.deepEqual(loaded.eventLog, combat.eventLog);
  assert.deepEqual(loaded.player.combatCounter, combat.player.combatCounter);
  assert.deepEqual(loaded.rng.getCounters(), combat.rng.getCounters());
});

test('older snapshots remain loadable; malformed tactical fields are refused by name', () => {
  const snapshot = serializeCombatSnapshot(preparedFight());
  const badCases = [
    ['combatMatchupRules.counter.retaliationFlat', copy => { copy.combatMatchupRules.counter.retaliationFlat = -1; }],
    ['combatMatchupRules.counter.meleeIncomingManeuvers', copy => { copy.combatMatchupRules.counter.meleeIncomingManeuvers = null; }],
    ['combatIntentRules.maximumHiddenChance', copy => { copy.combatIntentRules.maximumHiddenChance = 1.2; }],
    ['combatIntentRules.minimumHiddenChance', copy => { copy.combatIntentRules.minimumHiddenChance = 0.99; }],
    ['player.combatCounter.charges', copy => { copy.player.combatCounter.charges = 8; }],
    ['player.combatCounter.carrier', copy => { copy.player.combatCounter.carrier = null; }],
    ['player.combatCounter.damage', copy => { copy.player.combatCounter.damage = NaN; }],
    ['enemies[0].intentRevealed', copy => { copy.enemies[0].intentRevealed = 'false'; }],
    ['enemies[0].intentReads', copy => { copy.enemies[0].intentReads.seatA = 'hidden'; }],
  ];
  for (const [field, mutate] of badCases) {
    const malformed = structuredClone(snapshot); mutate(malformed);
    assert.ok(combatSnapshotProblems(malformed).some(problem => problem.includes(field)), field);
    assert.throws(() => restoreCombatSnapshot({ registries, rng: createRng(449), snapshot: malformed }), /combat snapshot/i, field);
  }
  delete snapshot.combatMatchupRules; delete snapshot.combatIntentRules;
  delete snapshot.player.combatCounter; delete snapshot.enemies[0].intentRevealed; delete snapshot.enemies[0].intentReads;
  assert.deepEqual(combatSnapshotProblems(snapshot), []);
});

test('Poise or Ward breaks cancel the armed Counter before a follow-up attack', () => {
  for (const [damageSchool, meterName] of [['physical', 'poise'], ['magic', 'ward']]) {
    const combat = fight({ ratingsRules: resolveCombatRatings({}, contentBundle) });
    const enemy = combat.enemies[0];
    enemy[meterName + 'Meter'] = { value: 0, max: 2 };
    armCombatCounter(combat, enemy, { combatProfile: { camp: 'physical', maneuver: 'counter', counterMode: 'melee' } }, { damage: 6 });
    const attack = { damageSchool, combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'slashing' } };
    applyRatingImpact(combat, combat.player, enemy, attack, 1);
    assert.ok(enemy.combatCounter, `${meterName} pressure below threshold keeps Counter`);
    applyRatingImpact(combat, combat.player, enemy, attack, 1);
    assert.equal(enemy.intent.kind, 'staggered');
    assert.equal(enemy.combatCounter, undefined, `${meterName} break cancels reaction`);
    assert.equal(prepareMatchupHit(combat, combat.player, enemy, attack, 8).counterEligible, false);
    const saved = serializeCombatSnapshot(combat);
    const loaded = restoreCombatSnapshot({ registries, rng: createRng(449, combat.rng.getCounters()), snapshot: saved });
    assert.equal(loaded.enemies[0].combatCounter, undefined);
  }
});
