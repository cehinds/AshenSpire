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

// Three kinds of lane:
// - historical: the 73ef action-policy profile, compared to its immutable capture.
// - archived ('current' in the capture): the saved 10911 default profile (runtime
//   c77d, hash 9b5f7a...) is replayed and compared to the pinned JS01 capture, so
//   events, RNG, receipts and continuations stay an oracle of engine behaviour.
// - controlled: small controlled cards/moves on today's default profile, comparing
//   native, shipped bundle, saved snapshot and continuation without balance hashes.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/core2-cleanup-baseline.json', import.meta.url), 'utf8'));
const previousFixture = JSON.parse(readFileSync(new URL('./fixtures/core2-cleanup-baseline-521250.json', import.meta.url), 'utf8'));
// The archived lanes use the pre-feature Dev capture, backed by the archived
// source tree and the same JS01 scenario bodies. Their raw checkpoints agree
// with this tree; the historical action-policy lane keeps the original pin.
const currentFixture = JSON.parse(readFileSync(new URL('./fixtures/core2-cleanup-current-7dff4b03.json', import.meta.url), 'utf8'));
const currentIdentity = JSON.parse(readFileSync(new URL('./fixtures/core2-cleanup-current-reward-fallback-identity.json', import.meta.url), 'utf8'));
const archivedCurrentSave = readFileSync(new URL('./fixtures/pre-registry-dev-7dff4b03-save.json.gz', import.meta.url));
const archivedCurrentGear = JSON.parse(gunzipSync(archivedCurrentSave)).gameProfile;
// Source 10911b810d5: the default profile used by the unchanged identity oracle.
// Current authored cards may change independently; this saved-profile replay
// must keep testing the original profile, including every identity hash.
const capturedDefaultBytes = readFileSync(new URL('./fixtures/core2-cleanup-profile-10911.json.gz', import.meta.url));
const capturedDefaultJson = gunzipSync(capturedDefaultBytes).toString('utf8');
// The compiled runtime and profile commitments move through registry and
// startup changes. Gear inputs stay pinned below. Only identity leaves are
// advanced here; the independent 7dff4b03 behavior digests remain the oracle.
const expectedScenarios = { ...fixture.scenarios };
for (const [name, original] of Object.entries(currentFixture.scenarios)) {
  const { snapshots, save } = currentIdentity.scenarios[name];
  const checkpoints = Object.fromEntries(Object.entries(snapshots).map(([phase, snapshot]) => [phase, { ...original[phase], snapshot }]));
  expectedScenarios[name] = { ...original, ...checkpoints, profile: { ...original.profile, ...currentIdentity.profile }, save };
}
const historicalBytes = readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url));
const historicalJson = gunzipSync(historicalBytes).toString('utf8');
const historicalHash = JSON.parse(historicalJson).hash;
// c18f0d0cdb6 authored inputs used to build the JS01 capture. The historical
// profile predates carrying these inputs. The synthetic new run needs them
// just as a real restored run needs the rules already stored in its snapshot.
const historicalDerivedStatsBytes = readFileSync(new URL('./fixtures/js01-pre-equipment-derived-stat-rules.json', import.meta.url));
const historicalDerivedStats = JSON.parse(historicalDerivedStatsBytes);
const historicalPoiseRules = { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1, breakStatusStacks: 2 };
// The level reward rules the archived lanes' saves were captured with.
const archivedLevelRewards = {
  version: 1,
  classPrimary: { firstLevel: 2, every: 4, amount: 1 },
  classPrimaryAttribute: { reaver: 'strength', rogue: 'dexterity', starseer: 'intelligence', herald: 'wisdom' },
  freeAttribute: { firstLevel: 4, every: 8, amount: 1 },
  cardRankUpsPerLevel: 1,
};
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

// Deliberately tiny enemy definitions make reaction payment, one-turn charge and
// ordered pool spending exact mechanics scenarios rather than authored matchups.
function controlledEnemies() {
  const tags = ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'];
  const move = (enemyId, id, extra = {}) => ({ id, enemyId, intent: 'attack', sp: 1, damage: 2, weight: 1, tags, ...extra });
  const enemy = (id, spPool, firstMove, moves) => ({ id, name: id, hp: [1000, 1000], poiseMax: 0,
    levelProfile: { min: 1, max: 1 }, spPool, firstMove, moves, startingRange: 'melee',
    attributes: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1 }, tags: [] });
  return {
    gildedKnight: enemy('gildedKnight', 2, 'thrust', {
      thrust: move('gildedKnight', 'thrust'),
      gildedGuard: move('gildedKnight', 'gildedGuard', { reaction: { on: ['playerAction'], minIncoming: 0 }, weight: 0 }),
    }),
    bellKeeper: enemy('bellKeeper', 2, 'bronzeToll', {
      bronzeToll: move('bellKeeper', 'bronzeToll', { delay: { turns: 1, whileCharging: { block: 0 } } }),
    }),
    fellWarden: enemy('fellWarden', 3, 'caneStrike', {
      caneStrike: move('fellWarden', 'caneStrike', { weight: 100, maxConsecutive: 2 }),
      heldBlade: move('fellWarden', 'heldBlade', { maxConsecutive: 1, delay: { turns: 1, whileCharging: { block: 0 } } }),
    }),
  };
}

function openFight(api, enemyId, encounterId, profileId, contentVersion) {
  const historical = profileId === 'historical';
  const archived = profileId === 'current';
  const controlled = profileId === 'controlled';
  assert.ok(historical || archived || controlled, `known lane ${profileId}`);
  let profile;
  if (historical) {
    const storage = memoryStorage();
    // Let each runtime parse the original bytes in its own realm through the
    // profile read door. The following run is then created from that pin.
    storage.setItem(api.runKey(1), `{"gameProfile":${historicalJson}}`);
    profile = api.resolveGameProfile(api.createSaveManager(storage).peekRunGameProfile(1));
    assert.equal(profile.hash, historicalHash);
  } else if (archived) {
    const capturedStorage = memoryStorage();
    capturedStorage.setItem(api.runKey(1), `{"gameProfile":${capturedDefaultJson}}`);
    profile = plain(api.resolveGameProfile(api.createSaveManager(capturedStorage).peekRunGameProfile(1)));
    assert.equal(profile.hash, 'sha256:9b5f7a725112f76a65f8037f4313f886b95a2d4ad3b8b705eb63d59a820c65a5');
    // The archived lanes replay their archived gear inputs. Modern equipment
    // tuning and typed equipment effects are covered by the gear suites.
    profile.modules.gear.statPoints = plain(archivedCurrentGear.modules.gear.statPoints);
    profile.content.gear = plain(archivedCurrentGear.content.gear);
    delete profile.modules.gear.typeEffectsVersion;
    const { hash: _hash, ...payload } = profile;
    profile.hash = `sha256:${hashJson(payload)}`;
    const storage = memoryStorage();
    storage.setItem(api.runKey(1), JSON.stringify({ gameProfile: profile }));
    profile = api.resolveGameProfile(api.createSaveManager(storage).peekRunGameProfile(1));
  } else {
    profile = plain(api.resolveGameProfile('default'));
    // A compact carrier controls only this scenario's player card and recipe.
    // No archived catalog or balance table is substituted for today's content.
    profile.content.cards = profile.content.cards.filter(card => !['core.strike', 'core.defend'].includes(card.id));
    profile.content.cards.push({ id: 'core.strike', name: 'JS01 fixture strike', class: 'colorless', rarity: 'common',
      type: 'attack', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', keywords: [],
      tags: ['camp:physical', 'maneuver:attack', 'classification.attack'],
      effects: [{ op: 'damage', target: 'enemy', amount: 12 }], textTemplate: 'Deal {damage} damage.' });
    profile.content.cards.push({ id: 'core.defend', name: 'JS01 fixture reaction', class: 'colorless', rarity: 'common',
      type: 'skill', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', keywords: [],
      tags: ['camp:physical', 'maneuver:defend', 'classification.skill', 'trait:reaction'],
      effects: [{ op: 'block', target: 'self', amount: 1 }], textTemplate: 'Gain {block} Block.' });
    profile.content.starterDeck.classDecks.reaver = [{ card: 'core.strike', copies: 5 }, { card: 'core.defend', copies: 5 }];
    for (const id of ['core.strike', 'core.defend']) delete profile.content.resourceVariants?.[id];
    const { hash: _hash, ...payload } = profile;
    profile.hash = `sha256:${hashJson(payload)}`;
    const storage = memoryStorage();
    storage.setItem(api.runKey(1), JSON.stringify({ gameProfile: profile }));
    profile = api.resolveGameProfile(api.createSaveManager(storage).peekRunGameProfile(1));
  }
  const bundle = historical ? { ...api.contentBundle, derivedStatRules: historicalDerivedStats } : api.contentBundle;
  const applied = api.applyGameProfileToContent(bundle, profile);
  const content = contentVersion === undefined ? applied : { ...applied, version: contentVersion };
  const baseRegistries = api.bindGameProfileRegistries(api.createRegistries(content), profile);
  const fixtures = controlledEnemies();
  const registries = !controlled ? baseRegistries : { ...baseRegistries, enemies: { ...baseRegistries.enemies,
    get: id => fixtures[id] || baseRegistries.enemies.get(id) } };
  if (contentVersion !== undefined) assert.equal(registries.contentVersion, contentVersion);
  const run = api.createRunState({ registries, classId: 'reaver', seed, runId: `js01-${profileId}-${enemyId}` });
  if (historical) {
    run.classLevelBonusVersion = 1;
    delete run.levelRewardRuleSnapshot;
  }
  const encounter = !controlled ? registries.encounters.get(encounterId) : { id: encounterId, enemies: [enemyId] };
  assert.deepEqual(plain(encounter.enemies), [enemyId]);
  // W25-BANDS legacy fixture: this baseline pins the arithmetic before front/back rows, so the fight is made without the `bands` rules (as one saved before them), in whichever module realm `api` is.
  const shippedBands = api.fixCoreMechanics.bands;
  const shippedPoise = api.fixCoreMechanics.poise;
  delete api.fixCoreMechanics.bands;
  if (historical) api.fixCoreMechanics.poise = historicalPoiseRules;
  let combat;
  try {
    combat = api.createRunCombat({
      registries, run, rng: api.createRng(seed), encounter, enemyIds: encounter.enemies,
      ...(historical ? { player: { poiseMax: 6 } } : {}),
    });
  } finally {
    if (historical) api.fixCoreMechanics.poise = shippedPoise;
    if (shippedBands !== undefined) api.fixCoreMechanics.bands = shippedBands;
  }
  // W25-F legacy fixture: this test pins the pre-W25-F pricing and numbers, so the spell cost and flux rules (fixCoreMechanics.json) are removed, as in a fight saved before them.
  delete combat.fixCoreRules?.spellCosts; delete combat.fixCoreRules?.elementFlux; delete combat.fixCoreRules?.stance?.playerMinimumCost; // the Magic Adept zero Mana floor key (owner ruling 2026-11-22) is newer than this fight
  // Wave 2 batch 5 legacy fixture: the Counter-stack keys are newer than this baseline and the Counter stance still returns 25% of the HP lost, as in a fight saved before the ruling.
  if (combat.fixCoreRules?.counter) for (const key of ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'decayClock', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard']) delete combat.fixCoreRules.counter[key];
  if (combat.fixCoreRules?.stanceBenefits?.counter) combat.fixCoreRules.stanceBenefits.counter = { ...combat.fixCoreRules.stanceBenefits.counter, hpReturnFraction: 0.25 };
  // W25-BANDS legacy fixture: this baseline pins the arithmetic before front/back rows, so the fight drops the `bands` rules, as one saved before them.
  delete combat.fixCoreRules?.bands;
  // This scenario pins an actual pre-override combat, not today's new-fight defaults.
  if (profileId === 'historical') delete combat.fixCoreRules?.smashVsDefensive?.defendDamageMultiplier;
  // Archived/historical JS01 captures predate dropping smashVsDefensive.blockFraction (2026-11-20); restore it in the snapshot so the immutable capture stays exact.
  if (!controlled && combat.fixCoreRules?.smashVsDefensive) combat.fixCoreRules.smashVsDefensive.blockFraction = 0.25;
  if (controlled) {
    for (const enemy of combat.enemies) {
      const pool = fixtures[enemy.enemyId].spPool;
      Object.assign(enemy, { hp: 1000, maxHp: 1000, stamina: pool, maxStamina: pool, fixCoreStaminaRemaining: pool, block: 0, statuses: {}, ratings: { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 } });
      delete enemy.weaknesses;
    }
    Object.assign(combat.rangeState.policy, { enabled: true, advanceSpPerBand: 1, reachPrecisionBonus: 0, throwPrecisionPenalty: 0, maxRange: 'ranged' });
    run.rangePolicy = plain(combat.rangeState.policy);
    const hand = ['core.strike', 'core.defend'].map(id => plain(run.deck.find(card => card.cardId === id)));
    for (const pile of Object.values(combat.piles)) pile.length = 0;
    combat.piles.hand.push(...hand);
    combat.piles.draw.push(...run.deck.filter(card => !hand.some(held => held.instanceId === card.instanceId)).map(plain));
  }
  assert.equal(combat.core2ActionRulesVersion, profileId === 'historical' ? 1 : 2);
  return { api, profile, registries, run, combat, encounter, historical, archived };
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

// Release cuts rewrite the content version (version-advance.yml), and a saved run records it, so the
// raw bytes would change at every cut. The recorded version is swapped for a constant only when it
// equals the version the registries really carry: a save that drops or mis-records it still moves the hash.
const CONTENT_VERSION_STAMP = '<contentVersion>';
function hashRun(json, contentVersion, levelRewards) {
  const payload = JSON.parse(json);
  delete payload.savedAt;
  if (payload.contentVersion === contentVersion) payload.contentVersion = CONTENT_VERSION_STAMP;
  // The archive predates this field. Check the exact new snapshot before
  // comparing every other part of the save with the captured envelope.
  assert.deepEqual(payload.levelRewardRuleSnapshot, levelRewards, 'save carries its birth-era level reward rules');
  delete payload.levelRewardRuleSnapshot;
  return hashJson(payload);
}

let lastStoredContentVersion;
function saveAndRestore({ api, profile, registries, run, combat, encounter, historical, archived }) {
  const storage = memoryStorage();
  const manager = api.createSaveManager(storage);
  api.commitCombatSnapshot({
    run, combat, nodeId: run.mapNodeId || 'n1_4', encounterId: encounter.id,
  });
  manager.saveRun(run, combat.rng);
  const storedJson = storage.getItem(api.runKey(1));
  assert.equal(JSON.parse(storedJson).contentVersion, registries.contentVersion);
  lastStoredContentVersion = JSON.parse(storedJson).contentVersion;
  const levelRewards = historical ? undefined : archived ? archivedLevelRewards : plain(run.levelRewardRuleSnapshot);
  const stored = hashRun(storedJson, registries.contentVersion, levelRewards);
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
  return { restored, save: { stored, loaded: hashRun(api.serializeRun(loaded, { inline: true }), registries.contentVersion, levelRewards) } };
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

function baseline(api, profileId, enemyId, encounterId, prepare, action, { contentVersion } = {}) {
  const setup = openFight(api, enemyId, encounterId, profileId, contentVersion);
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

// Each mechanics scenario runs twice: on the archived profile against the pinned
// capture ('current' lane, named as in the capture), and on the controlled carrier.
const mechanics = [
  ['paid reaction', 'gildedKnight', 'a2_knight', ({ api, combat, registries, archived }) => {
    const [enemy] = combat.enemies;
    combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
    const quote = api.enemyMoveQuote(registries.enemies.get(enemy.enemyId).moves.gildedGuard, { enemy, moveId: 'gildedGuard', combat });
    assert.deepEqual([quote.sp, quote.advanceSp, quote.totalSp], [1, 1, 2]);
    const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
    assert.ok(strike);
    // The archived knight reacts to a hit of 8 or more (minIncoming); Core's x0.7 player side scale (owner, 2026-11-18) leaves a bare Strike below it.
    if (archived) combat.player.ratings = { ...combat.player.ratings, ar: (combat.player.ratings?.ar || 0) + 8 };
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
  ['paid delayed charge', 'bellKeeper', 'bossBellKeeper', ({ api, combat, registries }) => {
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
  ['ordered enemy plan', 'fellWarden', 'bossOmen', ({ api, combat }) => {
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
];

const scenarios = [
  ...mechanics.map(([name, ...rest]) => [name, 'current', ...rest]),
  ...mechanics.map(([name, ...rest]) => [`controlled ${name}`, 'controlled', ...rest]),
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
  assert.equal(digest(archivedCurrentSave), 'fb2cdb88f5072d509738716968fed042977e75d2cc8c36eb2af17543a00a14e5');
  assert.equal(digest(historicalDerivedStatsBytes), '236c8e3c474ca126884f5edf1acaa8b57e9d02b8c00c9bea5e4d4a030bc7a4a5');
  assert.equal(digest(capturedDefaultBytes), '2d23a93ffc5c778f08c86bd6a76914a51347df0a62ca8adab362cd95b5a2cd2d');
});

test('the tradition-policy recapture preserves preceding events, RNG, receipts and continuations', () => {
  for (const [name, current] of Object.entries(fixture.scenarios)) {
    const previous = previousFixture.scenarios[name];
    assert.deepEqual(current.receipt, previous.receipt, `${name}: same receipt`);
    assert.equal(current.profile.actionPolicy, previous.profile.actionPolicy);
    for (const key of ['start', 'pending', 'restored', 'live', 'afterRestore']) {
      const { snapshot: oldSnapshot, ...oldBehavior } = previous[key];
      const { snapshot: newSnapshot, ...newBehavior } = current[key];
      assert.deepEqual(newBehavior, oldBehavior, `${name}: ${key} behavior`);
    }
    if (name === 'historical action policy') assert.deepEqual(current.profile, previous.profile);
    else assert.equal(previous.profile.runtimeHash, 'sha256:521250500d421c9742b8877b11e395c5718e0fc218c1add1c27c85d338253772');
  }
});

for (const [name, ...scenario] of scenarios) {
  test(`Core 2 cleanup baseline: ${name}`, () => {
    const source = baseline(native, ...scenario);
    const bundle = baseline(bundled, ...scenario);
    assert.deepEqual(bundle, source, 'the production module transform preserves source behavior');
    if (scenario[0] !== 'controlled') assert.deepEqual(source, expectedScenarios[name], 'compare against its pinned JS01 capture');
  });
}

test('the saved-run baseline does not depend on the content version', () => {
  for (const [name, ...scenario] of scenarios) {
    lastStoredContentVersion = undefined;
    const result = baseline(native, ...scenario, { contentVersion: '9.99.99' });
    assert.equal(lastStoredContentVersion, '9.99.99', `${name}: the save recorded the overridden version`);
    const expected = scenario[0] === 'controlled' ? baseline(native, ...scenario) : expectedScenarios[name];
    assert.deepEqual(result, expected, name);
  }
});

test('the saved-run hash still sees a wrong content version', () => {
  const json = JSON.stringify({ contentVersion: '1.2.3', gold: 5 });
  assert.equal(hashRun(json, '1.2.3'), hashRun(JSON.stringify({ contentVersion: '9.9.9', gold: 5 }), '9.9.9'));
  assert.notEqual(hashRun(json, '1.2.3'), hashRun(json, '9.9.9'));
  assert.notEqual(hashRun(json, '1.2.3'), hashRun(JSON.stringify({ contentVersion: '1.2.3', gold: 6 }), '1.2.3'));
});
