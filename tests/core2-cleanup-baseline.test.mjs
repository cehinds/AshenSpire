import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalGameJSON } from '../engine/kernel/gameConfig.js';
import { productionBundle } from './helpers/production-bundle.mjs';

const moduleIds = [
  'src/content/index.js', 'src/model/registries.js', 'src/model/gameProfile.js',
  'src/model/state.js', 'src/engine/rng.js', 'src/engine/runCombat.js',
  'src/engine/combat.js', 'src/engine/combatSnapshot.js', 'src/engine/combatRoundsAdapter.js',
  'src/engine/normalPreview.js', 'src/engine/save.js', 'src/content/generated/fixCoreMechanics.js',
];
const native = Object.assign({}, ...await Promise.all(moduleIds.map(id => import(`../${id}`))));
const require = productionBundle({ additionalModules: moduleIds });
const bundled = Object.assign({}, ...moduleIds.map(id => require(id)));

// Recaptured 2026-11-18 for Unguarded Bolt's 2/3 Idle HP rider: only the three current profile, snapshot and save digests moved.
// Runtime, event digests, RNG, receipts, continuations and the complete historical scenario are unchanged; native and production captures agree.
// Recaptured 2026-11-19 (owner rulings 20-23 on chore/ForceWardRules: Force, Ward, Pierce, break statuses): every current-profile hash and the events they price moved; measured with this test's own output.
// Recaptured 2026-11-18 (green-discovered pass): runtime hash moved by the Retreat mechanic folder; the historical scenario moved with the same-day gear rulings (see the fixture's recapture note).
// Recaptured 2026-11-18 for the physical cut on top of the ratings removal (physicalDamageMultiplier 0.7, blockGainMultiplier 0.49): the three current-profile scenarios' events and continuations move by design;
// the historical scenario's events, RNG and continuation are identical and only its snapshot, stored and loaded hashes moved (the new effects setting's module default joins the profile).
// Recaptured 2026-11-18 (AR, DR and PR removed; hand, SP and MP per four points): the runtime hash and the current-profile scenarios moved by design.
// Recaptured 2026-11-18 for the second cut (physicalDamageMultiplier 0.7, blockGainMultiplier 0.49): the new setting joins the profile, so the profile, snapshot and save hashes move,
// and the three current-profile scenarios' events and continuations move by design; the historical scenario is unchanged.
// Recaptured 2026-11-18 for Event Copy. Only current profile, snapshot and save hashes moved.
// Runtime hashes, events, RNG, continuations and the complete historical scenario are identical.
// Recaptured 2026-11-17 after the balance review changed pool thresholds, starting gear, tier HP and reactive damage.
// Current profiles, events and snapshots change by design; RNG counters and the historical scenario are unchanged.
// Recaptured 2026-11-17 (theme C, on theme B: the card changes move the default profile hash and the tooltip wording moves the runtime hash, so only the profile, runtime, snapshot, stored and loaded hashes moved).
// The conditional cards in Core's pack change only current profile, snapshot and save hashes. Events, RNG, continuations and the historical profile are unchanged.
// Recaptured 2026-11-17 after the trader inventory changes landed: only the profile, snapshot and save hashes changed.
// Recaptured 2026-11-17 a third time (theme D's runs carry classLevelBonusVersion, so a new run's save moves: only the stored and loaded hashes changed).
// Recaptured 2026-11-17 again (playtest theme D added five relics to Core's reward allow list, which moved the profile hash and so only the snapshot, stored and loaded hashes; every events, rng and continuation hash is unchanged)
// Recaptured 2026-11-17 (theme A balance: base damage halved, single-stat ratings, SP and MP at 3 points, stat-point gear, act levels for elites and bosses): the
// three current-profile scenarios change their events and continuations by design; the historical scenario is unchanged.
// Recaptured 2026-11-17 (theme B status and stance rules: Counter decay keeps it armed, the Defend Poise floor, the enemy Counter badge, the Prepared/Idle stance weaknesses): the
// three current-profile scenarios change their events and continuations by design; the historical scenario changes only its snapshot, stored and loaded hashes (its events,
// rng and continuation are identical, so a save from before keeps its rules).
// Recaptured 2026-11-15 (ci-fixes added the core.retreat and core.upsetRanks resource variants, which moved the profile hash and so only the snapshot, stored and loaded hashes; with those entries reverted and the config regenerated the earlier values return). Earlier: (W25-BANDS merge with batch 5: the fights are made without `bands`, so every events, rng and continuation hash equals dev's; only the profile, runtime, snapshot, stored and loaded hashes moved). Earlier note (Wave 2 batch 5, the Counter-stack rule moved the runtime hash): only the profile hash and the snapshot, stored and loaded hashes moved
// (they embed it); every events, rng and continuation hash is identical, with the legacy fixture in openFight (no Counter-stack keys, the stance's 25% return) in place.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/core2-cleanup-baseline.json', import.meta.url), 'utf8'));
const historicalBytes = readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url));
const historicalJson = gunzipSync(historicalBytes).toString('utf8');
const historicalHash = JSON.parse(historicalJson).hash;
const seed = 511;
const plain = value => JSON.parse(JSON.stringify(value));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hashJson = value => digest(canonicalGameJSON(plain(value)));

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
}

function openFight(api, enemyId, encounterId, profileId) {
  let profile;
  if (profileId === 'historical') {
    const storage = memoryStorage();
    // Let each runtime parse the original bytes in its own realm through the
    // profile read door. The following run is then created from that pin.
    storage.setItem(api.runKey(1), `{"gameProfile":${historicalJson}}`);
    profile = api.resolveGameProfile(api.createSaveManager(storage).peekRunGameProfile(1));
    assert.equal(profile.hash, historicalHash);
  } else {
    profile = api.resolveGameProfile('default');
  }
  const content = api.applyGameProfileToContent(api.contentBundle, profile);
  const registries = api.bindGameProfileRegistries(api.createRegistries(content), profile);
  const run = api.createRunState({ registries, classId: 'reaver', seed, runId: `js01-${profileId}-${enemyId}` });
  const encounter = registries.encounters.get(encounterId);
  assert.deepEqual(plain(encounter.enemies), [enemyId]);
  // W25-BANDS legacy fixture: this baseline pins the arithmetic before front/back rows, so the fight is made without the `bands` rules (as one saved before them), in whichever module realm `api` is.
  const shippedBands = api.fixCoreMechanics.bands;
  delete api.fixCoreMechanics.bands;
  let combat;
  try { combat = api.createRunCombat({ registries, run, rng: api.createRng(seed), encounter, enemyIds: encounter.enemies }); } finally { if (shippedBands !== undefined) api.fixCoreMechanics.bands = shippedBands; }
  // W25-F legacy fixture: this test pins the pre-W25-F pricing and numbers, so the spell cost and flux rules (fixCoreMechanics.json) are removed, as in a fight saved before them.
  delete combat.fixCoreRules?.spellCosts; delete combat.fixCoreRules?.elementFlux;
  // Wave 2 batch 5 legacy fixture: the Counter-stack keys are newer than this baseline and the Counter stance still returns 25% of the HP lost, as in a fight saved before the ruling.
  if (combat.fixCoreRules?.counter) for (const key of ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'decayClock', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard']) delete combat.fixCoreRules.counter[key];
  if (combat.fixCoreRules?.stanceBenefits?.counter) combat.fixCoreRules.stanceBenefits.counter = { ...combat.fixCoreRules.stanceBenefits.counter, hpReturnFraction: 0.25 };
  // W25-BANDS legacy fixture: this baseline pins the arithmetic before front/back rows, so the fight drops the `bands` rules, as one saved before them.
  delete combat.fixCoreRules?.bands;
  assert.equal(combat.core2ActionRulesVersion, profileId === 'historical' ? 1 : 2);
  return { api, profile, registries, run, combat, encounter };
}

function settle(api, combat) {
  for (let count = 0; combat.pendingReaction; count++) {
    assert.ok(count < 30, 'reaction continuation terminates');
    api.dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
}

function checkpoint(api, combat) {
  const rng = combat.rng.getCounters();
  return {
    snapshot: hashJson(api.serializeCombatSnapshot(combat)),
    events: hashJson(combat.eventLog),
    rng: { hash: hashJson(rng), drawn: Object.fromEntries(Object.entries(rng).filter(([, count]) => count > 0)) },
  };
}

function hashRun(json) {
  const payload = JSON.parse(json);
  delete payload.savedAt;
  return hashJson(payload);
}

function saveAndRestore({ api, profile, registries, run, combat, encounter }) {
  const storage = memoryStorage();
  const manager = api.createSaveManager(storage);
  api.commitCombatSnapshot({
    run, combat, nodeId: run.mapNodeId || 'n1_4', encounterId: encounter.id,
  });
  manager.saveRun(run, combat.rng);
  const stored = hashRun(storage.getItem(api.runKey(1)));
  const loaded = manager.loadRun(registries);
  assert.ok(loaded, manager.runStatus().reason);
  assert.equal(loaded.gameProfile.hash, profile.hash);
  assert.deepEqual(plain(loaded.streamCounters), plain(combat.rng.getCounters()));
  const restored = api.restoreCombatSnapshot({
    registries,
    rng: api.createRng(loaded.seed, loaded.streamCounters),
    snapshot: loaded.combatEntered.snapshot,
    expectedGameProfile: loaded.gameProfile,
  });
  assert.equal(restored.core2ActionRulesVersion, combat.core2ActionRulesVersion);
  return { restored, save: { stored, loaded: hashRun(api.serializeRun(loaded, { inline: true })) } };
}

function continued(api, combat, restored, action) {
  function resume(fight) {
    const start = fight.eventLog.length;
    action(fight);
    return {
      ...checkpoint(api, fight),
      continuation: hashJson(fight.eventLog.slice(start)),
    };
  }
  const live = resume(combat);
  const afterRestore = resume(restored);
  // Persistence strips bulky fields from past events. Newly emitted events match exactly.
  assert.equal(afterRestore.continuation, live.continuation, 'restoring does not replay or change continuation events');
  assert.deepEqual(afterRestore.rng, live.rng);
  assert.equal(afterRestore.snapshot, live.snapshot, 'live and restored fights commit the same final snapshot');
  return { live, afterRestore };
}

function baseline(api, profileId, enemyId, encounterId, prepare, action) {
  const setup = openFight(api, enemyId, encounterId, profileId);
  const { combat, profile } = setup;
  const start = checkpoint(api, combat);
  const receipt = prepare(setup);
  const pending = checkpoint(api, combat);
  const { restored, save } = saveAndRestore(setup);
  return {
    profile: { hash: profile.hash, runtimeHash: profile.lock.runtimeHash, actionPolicy: combat.core2ActionRulesVersion },
    start, receipt, pending, save, restored: checkpoint(api, restored),
    ...continued(api, combat, restored, fight => action(api, fight)),
  };
}

const endTurn = (api, combat) => api.dispatch(combat, { type: 'endTurn' });

const scenarios = [
  ['paid reaction', 'current', 'gildedKnight', 'a2_knight', ({ api, combat, registries }) => {
    const [enemy] = combat.enemies;
    combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
    const quote = api.enemyMoveQuote(registries.enemies.get(enemy.enemyId).moves.gildedGuard, { enemy, moveId: 'gildedGuard', combat });
    assert.deepEqual([quote.sp, quote.advanceSp, quote.totalSp], [1, 1, 2]);
    const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
    assert.ok(strike);
    // The knight reacts to a hit of 8 or more (minIncoming); Core's x0.7 player side scale (owner, 2026-11-18) leaves a bare Strike below it.
    combat.player.ratings = { ...combat.player.ratings, ar: (combat.player.ratings?.ar || 0) + 8 };
    const before = checkpoint(api, combat);
    const { cost, manaCost, staminaCost, values, damageSequences } = api.previewCard(combat, strike.instanceId, enemy.id);
    assert.deepEqual(checkpoint(api, combat), before, 'preview does not mutate the save or draw RNG');
    const preview = { cost, manaCost, staminaCost, effects: hashJson({ values, damageSequences }) };
    api.dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
    assert.ok(combat.pendingReaction, 'save pauses at a real reaction choice');
    const payment = combat.reactionStack.entries.find(entry => entry.spPayment)?.spPayment;
    assert.deepEqual(plain(payment), { sp: 1, advanceSp: 0, totalSp: 1 });
    return { preview, payment: plain(payment) };
  }, (api, combat) => {
    settle(api, combat);
    assert.equal(combat.enemies[0].stamina, 1);
    assert.ok(combat.enemies[0].performedMoves.includes('gildedGuard'));
  }],
  ['paid delayed charge', 'current', 'bellKeeper', 'bossBellKeeper', ({ api, combat, registries }) => {
    const [enemy] = combat.enemies;
    combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
    const quote = api.enemyMoveQuote(registries.enemies.get(enemy.enemyId).moves.bronzeToll, { enemy, moveId: 'bronzeToll', combat });
    assert.ok(quote.advanceSp > 0);
    endTurn(api, combat);
    const payment = plain(enemy.pendingMove.spPayment);
    assert.deepEqual(payment, { sp: quote.sp, advanceSp: quote.advanceSp, totalSp: quote.totalSp });
    assert.equal(enemy.stamina, enemy.maxStamina - quote.totalSp);
    return payment;
  }, (api, combat) => {
    endTurn(api, combat);
    settle(api, combat);
    const [enemy] = combat.enemies;
    assert.equal(enemy.stamina, enemy.maxStamina);
    assert.equal(enemy.performedMoves.filter(id => id === 'bronzeToll').length, 1);
  }],
  ['ordered enemy plan', 'current', 'fellWarden', 'bossOmen', ({ api, combat }) => {
    const [enemy] = combat.enemies;
    combat.normalPreview = { ...combat.normalPreview, multiAction: false };
    const before = checkpoint(api, combat);
    const plan = plain(api.enemyPlanActions(combat, enemy).map(row => [row.id, row.sp]));
    assert.deepEqual(plan, [['caneStrike', 1], ['caneStrike', 1], ['heldBlade', 1]]);
    assert.deepEqual(checkpoint(api, combat), before, 'quoting does not mutate the save or draw RNG');
    return plan;
  }, (api, combat) => {
    endTurn(api, combat);
    settle(api, combat);
    const [enemy] = combat.enemies;
    assert.deepEqual(plain(enemy.performedMoves), ['caneStrike', 'caneStrike']);
    assert.equal(enemy.pendingMove.moveId, 'heldBlade');
    assert.equal(enemy.pendingMove.spPayment.totalSp, 1);
    assert.equal(enemy.stamina, 0);
  }],
  ['historical action policy', 'historical', 'ashheartDragon', 'a3_bossAshheartDragon', ({ api, combat, registries }) => {
    const [enemy] = combat.enemies;
    const move = registries.enemies.get(enemy.enemyId).moves.ashBreath;
    const quote = api.enemyMoveQuote(move, { enemy, moveId: 'ashBreath', combat });
    assert.ok(quote.totalSp <= enemy.maxStamina);
    return { level: enemy.level, attributes: plain(enemy.ownAttributes), stamina: enemy.maxStamina, totalSp: quote.totalSp };
  }, (api, combat) => {
    endTurn(api, combat);
    settle(api, combat);
  }],
];

test('the original historical profile fixture keeps its provenance', () => {
  assert.equal(digest(historicalBytes), fixture.historicalProfileSha256);
});

for (const [name, ...scenario] of scenarios) {
  test(`Core 2 cleanup baseline: ${name}`, () => {
    const source = baseline(native, ...scenario);
    const bundle = baseline(bundled, ...scenario);
    assert.deepEqual(bundle, source, 'the production module transform preserves source behavior');
    assert.deepEqual(source, fixture.scenarios[name], 'compare against the immutable JS01 capture');
  });
}
