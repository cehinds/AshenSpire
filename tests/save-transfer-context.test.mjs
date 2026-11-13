import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { productionBundle } from './helpers/production-bundle.mjs';

const moduleIds = [
  'src/content/index.js', 'src/model/registries.js', 'src/model/gameProfile.js',
  'src/model/state.js', 'src/model/prologue.js', 'src/engine/rng.js', 'src/engine/runCombat.js',
  'src/engine/combat.js', 'src/engine/combatSnapshot.js', 'src/engine/save.js',
  'src/engine/savedRunContext.js', 'src/engine/saveTransfer.js',
];
const native = Object.assign({}, ...await Promise.all(moduleIds.map(id => import(`../${id}`))));
const require = productionBundle({ additionalModules: moduleIds });
const bundled = Object.assign({}, ...moduleIds.map(id => require(id)));

const historical = gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))).toString('utf8');
const openingKey = 'gameConfig.prologue.scenes.warmth.text';
const legacyKey = 'gameConfig.balance.xp.kill.normal';
const backupKey = 'sote_transfer_backup_v1';
const plain = value => JSON.parse(JSON.stringify(value));
const hash = value => gameDigest(plain(value));

function storageBytes(storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  return Object.fromEntries(keys.sort().map(key => [key, storage.getItem(key)]));
}

function registriesFor(api, profile) {
  const authored = api.applyGameProfileToContent(api.contentBundle, profile);
  return api.bindGameProfileRegistries(api.createRegistries(authored), profile);
}

function resumeFight(api, context) {
  const { registries, run, gameProfile } = context;
  const { seed, streamCounters, combatEntered } = run;
  const fight = api.restoreCombatSnapshot({
    registries, rng: api.createRng(seed, streamCounters),
    snapshot: combatEntered.snapshot, expectedGameProfile: gameProfile,
  });
  assert.deepEqual(plain(fight.rng.getCounters()), plain(streamCounters));
  return fight;
}

function continueFight(api, fight) {
  const start = fight.eventLog.length;
  if (!fight.pendingReaction) api.dispatch(fight, { type: 'endTurn' });
  for (let count = 0; fight.pendingReaction; count++) {
    assert.ok(count < 30, 'reaction continuation terminates');
    api.dispatch(fight, { type: 'chooseReaction', offerId: fight.pendingReaction.id, optionId: null });
  }
  const events = fight.eventLog.slice(start);
  assert.ok(events.length, 'resuming produces fresh combat events');
  return {
    snapshot: hash(api.serializeCombatSnapshot(fight)),
    events: hash(events),
    rng: plain(fight.rng.getCounters()),
  };
}

function setupSlot(manager, slot, profile, { opening, encounterId, legacyOverride = false }) {
  const api = native;
  const registries = registriesFor(api, profile);
  const seed = 511 + slot - 1;
  const run = api.createRunState({
    registries, classId: 'reaver', seed, runId: `js02-slot-${slot}`,
    profileMeta: { settings: { [openingKey]: opening } },
  });
  if (legacyOverride) {
    // Existing snapshots may still carry old settings, but the pin owns Core 2 rules.
    run.advancedConfigSnapshot = {
      ...run.advancedConfigSnapshot,
      overrides: { ...run.advancedConfigSnapshot.overrides, [legacyKey]: 987 },
    };
  }
  const encounter = registries.encounters.get(encounterId);
  const combat = api.createRunCombat({
    registries, run, encounter, enemyIds: encounter.enemies, rng: api.createRng(seed),
  });
  if (slot === 1) {
    combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
    const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
    api.dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: combat.enemies[0].id });
    assert.ok(combat.pendingReaction, 'current slot saves at an actual reaction prompt');
  }
  api.commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId });
  manager.saveRun(run, combat.rng, slot);
  return {
    opening,
    override: plain(run.advancedConfigSnapshot),
    pin: profile.hash,
    runtime: profile.lock.runtimeHash,
    xp: registries.balance.xp.kill.normal,
    actionPolicy: combat.core2ActionRulesVersion,
    rng: plain(combat.rng.getCounters()),
    snapshot: hash(api.serializeCombatSnapshot(combat)),
    continuation: continueFight(api, combat),
  };
}

function mixedFixture() {
  const storage = native.createMemoryStorage();
  const manager = native.createSaveManager(storage);
  const meta = manager.loadMeta();
  meta.settings[openingKey] = 'This is the device default.';
  manager.saveMeta(meta);
  const slots = [
    setupSlot(manager, 1, native.resolveGameProfile('default'), {
      opening: 'Current slot opening.', encounterId: 'a2_knight',
    }),
    setupSlot(manager, 2, native.resolveGameProfile(JSON.parse(historical)), {
      opening: 'Historical slot opening.', encounterId: 'a3_bossAshheartDragon', legacyOverride: true,
    }),
  ];
  assert.notEqual(slots[0].pin, slots[1].pin);
  assert.notEqual(slots[0].runtime, slots[1].runtime);
  assert.deepEqual(slots.map(row => row.actionPolicy), [2, 1]);
  return { slots, text: native.CreateSaveTransfer(storage).CreateBackup() };
}

function currentStorage() {
  const storage = native.createMemoryStorage();
  const manager = native.createSaveManager(storage);
  const registries = registriesFor(native, native.resolveGameProfile('default'));
  const run = native.createRunState({ registries, classId: 'reaver', seed: 7, runId: 'js02-destination' });
  manager.saveRun(run, native.createRng(run.seed), 1);
  return storage;
}

let mixed;
const mixedBackup = () => mixed ??= mixedFixture();

for (const [mode, api] of Object.entries({ native, bundled })) {
  test(`${mode}: inspect, import and Continue use each slot's own Core 2 context`, () => {
    const { slots, text } = mixedBackup();
    const destination = currentStorage();
    const transfer = api.CreateSaveTransfer(destination);
    const before = storageBytes(destination);
    const previous = transfer.CreateBackup();
    const inspection = transfer.Inspect(text);
    assert.equal(inspection.hasProfile, true);
    assert.equal(inspection.slots.filter(slot => slot.summary).length, 2);
    assert.deepEqual(storageBytes(destination), before, 'inspection makes no destination writes');
    assert.deepEqual(plain(transfer.Restore(text)), { ok: true });
    assert.equal(transfer.CreateBackup(), text, 'import retains exact portable payloads');
    assert.equal(transfer.Previous(), previous, 'the pre-import backup remains portable');

    const manager = api.createSaveManager(destination);
    for (const [index, expected] of slots.entries()) {
      const slot = index + 1;
      const context = api.LoadSavedRunContext(manager, slot);
      assert.ok(context.run, context.reason);
      assert.equal(context.gameProfile.hash, expected.pin);
      assert.equal(context.registries.gameProfile.hash, expected.pin);
      assert.equal(context.run.gameProfile.lock.runtimeHash, expected.runtime);
      assert.deepEqual(plain(context.run.advancedConfigSnapshot), expected.override);
      assert.deepEqual(plain(context.configuration), expected.override);
      const opening = api.prologueConfig({
        ...manager.loadMeta().settings, ...context.run.advancedConfigSnapshot.overrides,
      }).scenes.find(scene => scene.id === 'warmth');
      assert.equal(opening.text, expected.opening);
      assert.equal(context.registries.balance.xp.kill.normal, expected.xp, 'stored legacy balance keys stay inactive');
      assert.deepEqual(plain(context.run.streamCounters), expected.rng);
      const resumed = resumeFight(api, context);
      assert.equal(resumed.core2ActionRulesVersion, expected.actionPolicy);
      assert.equal(hash(api.serializeCombatSnapshot(resumed)), expected.snapshot);
      assert.deepEqual(continueFight(api, resumed), expected.continuation);
    }
  });
}

function amendRun(data, change) {
  const key = native.runKey(1);
  const run = JSON.parse(data.entries[key]);
  change(run);
  data.entries[key] = JSON.stringify(run);
}

function amendPin(run, change) {
  const pin = run.gameProfile;
  change(pin);
  delete pin.hash;
  pin.hash = gameDigest(pin);
}

test('unsupported, retired and newer imports preserve destination bytes and recovery', () => {
  const destination = currentStorage();
  destination.setItem(backupKey, 'previous recovery evidence');
  const transfer = native.CreateSaveTransfer(destination);
  const before = storageBytes(destination);
  const original = transfer.CreateBackup();
  const cases = [
    [data => amendRun(data, run => amendPin(run, pin => { pin.lock.runtimeHash = 'sha256:' + '0'.repeat(64); })),
      /Slot 1 cannot be imported: .*unsupported runtime artifact snapshot/],
    [data => amendRun(data, run => amendPin(run, pin => { pin.lock.core = 'ashen.core@1.0.0'; })),
      /Slot 1 cannot be imported: .*retired game mode/],
    [data => amendRun(data, run => { delete run.gameProfile; }), /Slot 1 cannot be imported: .*retired game mode/],
    [data => amendRun(data, run => { run.schemaVersion = native.RUN_SCHEMA_VERSION + 1; }),
      /Slot 1 cannot be imported: .*newer than this build/],
    [data => {
      const meta = JSON.parse(data.entries[native.META_KEY]);
      meta.schemaVersion = native.META_SCHEMA_VERSION + 1;
      data.entries[native.META_KEY] = JSON.stringify(meta);
    }, /Profile cannot be imported: .*newer/],
  ];
  for (const [edit, error] of cases) {
    const data = JSON.parse(original);
    edit(data);
    const text = JSON.stringify(data);
    assert.throws(() => transfer.Inspect(text), error);
    assert.throws(() => transfer.Restore(text), error);
    assert.deepEqual(storageBytes(destination), before);
  }
});

test('Continue refuses an unsupported, retired or newer slot without altering storage', () => {
  const destination = currentStorage();
  const original = JSON.parse(native.CreateSaveTransfer(destination).CreateBackup());
  const manager = native.createSaveManager(destination);
  const key = native.runKey(1);
  const saved = JSON.parse(original.entries[key]);
  const unsupported = structuredClone(saved);
  amendPin(unsupported, pin => { pin.lock.runtimeHash = 'sha256:' + '0'.repeat(64); });
  destination.setItem(key, JSON.stringify(unsupported));
  let before = storageBytes(destination);
  assert.throws(() => native.LoadSavedRunContext(manager, 1), /unsupported runtime artifact snapshot/);
  assert.deepEqual(storageBytes(destination), before);

  const retired = structuredClone(saved);
  amendPin(retired, pin => { pin.lock.core = 'ashen.core@1.0.0'; });
  destination.setItem(key, JSON.stringify(retired));
  before = storageBytes(destination);
  const refused = native.LoadSavedRunContext(manager, 1);
  assert.equal(refused.run, null);
  assert.equal(refused.retiredReason, 'retired-core');
  assert.deepEqual(storageBytes(destination), before);

  destination.setItem(key, JSON.stringify({ ...saved, schemaVersion: native.RUN_SCHEMA_VERSION + 1 }));
  before = storageBytes(destination);
  assert.equal(native.LoadSavedRunContext(manager, 1).run, null);
  assert.equal(manager.runStatus().state, 'newer');
  assert.deepEqual(storageBytes(destination), before);
});

test('failed writes restore exact compact slot bytes and retain a portable recovery copy', () => {
  const { text } = mixedBackup();
  const destination = currentStorage();
  const key = native.runKey(1);
  const compact = destination.getItem(key);
  assert.ok(JSON.parse(compact).gameProfileRef, 'the original slot uses a compact profile reference');
  destination.setItem(key, ` \n${compact}\n `);
  const mirror = destination.getItem(native.META_BACKUP_KEY);
  destination.setItem(native.META_BACKUP_KEY, ` \n${mirror}\n `);
  const before = storageBytes(destination);
  const previous = native.CreateSaveTransfer(destination).CreateBackup();
  const failing = Object.create(destination);
  let refused = false;
  failing.setItem = (key, value) => {
    if (key !== backupKey) assert.equal(destination.getItem(backupKey), previous, 'recovery backup lands before live writes');
    destination.setItem(key, value);
    if (key === native.META_BACKUP_KEY && !refused) {
      refused = true;
      throw new Error('injected mirror write failure');
    }
  };
  const transfer = native.CreateSaveTransfer(failing);
  assert.throws(() => transfer.Restore(text), /injected mirror write failure/);
  assert.equal(refused, true);
  assert.deepEqual(storageBytes(destination), { ...before, [backupKey]: previous });
  assert.equal(transfer.Previous(), previous);
  assert.equal(transfer.Inspect(previous).slots.filter(slot => slot.summary).length, 1);
});

test('failure to write recovery prevents any live writes', () => {
  const destination = currentStorage();
  const before = storageBytes(destination);
  const failing = Object.create(destination);
  failing.setItem = key => {
    assert.equal(key, backupKey);
    throw new Error('injected backup write failure');
  };
  assert.throws(() => native.CreateSaveTransfer(failing).Restore(mixedBackup().text), /injected backup write failure/);
  assert.deepEqual(storageBytes(destination), before);
});
test('the archived transfer adapter keeps its old method surface in native and bundled modules', () => {
  for (const api of [native, bundled]) {
    const storage = api.createMemoryStorage();
    const modern = api.CreateSaveTransfer(storage);
    const legacy = api.createSaveTransfer(storage);
    const backup = modern.CreateBackup();
    assert.equal(legacy.slotCount, modern.SlotCount);
    assert.equal(legacy.createBackup(), backup);
    assert.deepEqual(plain(legacy.inspect(backup)), plain(modern.Inspect(backup)));
    assert.deepEqual(plain(legacy.restore(backup)), { ok: true });
    assert.equal(legacy.previous(), modern.Previous());
  }
});
