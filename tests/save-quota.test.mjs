import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { runCombatEnd } from '../src/engine/runCombat.js';
import { createBrowserSaveManager } from '../src/engine/browserSave.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, isStorageFullError, runKey, RUN_ARCHIVE_KEY, profileCopyKey, PROFILE_COPY_PREFIX, PROFILE_STAMP_PREFIX } from '../src/engine/save.js';

const registries = createRegistries(contentBundle);

function quotaError() {
  const e = new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.");
  e.name = 'QuotaExceededError'; e.code = 22;
  return e;
}

// A localStorage-shaped stub with a character budget; `failRunKeys` makes any run key refuse.
function limitedStorage({ budget = Infinity } = {}) {
  const map = new Map();
  const self = { budget };
  const used = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  Object.assign(self, {
    map,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      const next = used() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + String(v).length;
      if (next > self.budget) throw quotaError();
      map.set(k, String(v));
    },
    removeItem: k => map.delete(k),
    key: i => [...map.keys()][i] ?? null,
    used,
  });
  Object.defineProperty(self, 'length', { get: () => map.size });
  return self;
}

function freshRun(seed = 7) {
  const run = createRunState({ registries, seed, classId: 'herald' });
  return { run, rng: createRng(seed) };
}

test('isStorageFullError knows the quota shapes', () => {
  assert.equal(isStorageFullError(quotaError()), true);
  assert.equal(isStorageFullError(Object.assign(new Error('x'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' })), true);
  assert.equal(isStorageFullError(Object.assign(new Error('x'), { code: 22 })), true);
  assert.equal(isStorageFullError(new Error('other')), false);
  assert.equal(isStorageFullError(null), false);
});

test('a full store still throws and keeps savedAt honest', () => {
  const store = limitedStorage();
  const save = createSaveManager(store);
  const { run, rng } = freshRun();
  save.saveRun(run, rng, 1);
  const stamped = run.savedAt;
  store.setItem = () => { throw quotaError(); };
  assert.throws(() => save.saveRun(run, rng, 1), error => isStorageFullError(error));
  assert.equal(run.savedAt, stamped, 'a lost write does not claim a save');
});

test('a save slot is never deleted to make room', () => {
  const { run, rng } = freshRun();
  const store = limitedStorage({ budget: 600 });
  store.map.set(runKey(2), 'slot two');
  const save = createSaveManager(store);
  assert.throws(() => save.saveRun(run, rng, 1), error => isStorageFullError(error));
  assert.equal(store.map.get(runKey(2)), 'slot two');
});

// ---- main.js: the combat checkpoint door, sliced from the shipped source -------
const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function sliceBlock(startMarker, endMarker) {
  const start = mainSource.indexOf(startMarker), end = mainSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, startMarker);
  return mainSource.slice(start, end);
}
const doorSource = sliceBlock('const SAVE_WARNING_REPEAT_MS', '// The run the way its save slot names it');

function door({ saveRun }) {
  const logs = [], banners = [], warns = [];
  const context = {
    saves: { saveRun }, activeSlot: 1, isStorageFullError, Date,
    dlog: (...args) => logs.push(args), console: { warn: (...a) => warns.push(a) },
    failureBanner: (key, title, body) => { const el = { key, title, body, dataset: { failureKey: key }, remove() { this.removed = true; } }; banners.push(el); return el; },
    setTimeout: () => 0,
  };
  runInNewContext(`${doorSource}\nthis.saveCombatCandidate = saveCombatCandidate; this.reportAutosaveFailure = reportAutosaveFailure;`, context);
  return { context, logs, banners, warns };
}

test('a refused combat checkpoint is reported once per window and never refuses the move', () => {
  const h = door({ saveRun: () => { throw quotaError(); } });
  assert.deepEqual({ ...h.context.saveCombatCandidate({}, null) }, { ok: true, durable: false });
  h.context.saveCombatCandidate({}, null);
  assert.equal(h.logs.length, 2, 'every failure reaches the Command log');
  assert.equal(h.logs[0][0], 'save');
  assert.equal(h.banners.length, 1, 'the player-facing warning is throttled');
  assert.match(h.banners[0].body, /browser storage is full/);
  assert.match(h.banners[0].body, /Your game continues/);
  assert.match(h.banners[0].body, /delete an old save slot/);
  assert.match(h.banners[0].body, /returns you to your last saved point/, 'the player is told what a reload does');
  assert.equal(h.context.reportAutosaveFailure(quotaError(), Date.now() + 31000), true, 'warns again after the window');
});

test('a non-quota save error is also non-blocking', () => {
  const h = door({ saveRun: () => { throw new Error('SecurityError: denied'); } });
  assert.equal(h.context.saveCombatCandidate({}, null).ok, true);
  assert.equal(h.banners[0].key, 'save:failed');
  assert.match(h.banners[0].body, /Your game continues/);
});

test('with a full store, a real card play and End Turn still apply and warn', () => {
  const { run, rng } = freshRun(11);
  run.deck.unshift({ instanceId: 'save-native', cardId: 'blightedTransmute', upgraded: false });
  const store = limitedStorage({ budget: 10 }); // nothing fits
  const save = createSaveManager(store);
  const h = door({ saveRun: (next, r) => save.saveRun(next, r, 1) });
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  combat.beforeCombatCommit = candidate => commitExpansionCandidate({ run, candidate, nodeId: 'n1_4', encounterId: 'patrol', saveCandidate: h.context.saveCombatCandidate });
  const energyBefore = combat.player.energy;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'save-native' });
  assert.ok(combat.player.energy < energyBefore || combat.piles.exhaust.some(c => c.instanceId === 'save-native') || combat.piles.discard.some(c => c.instanceId === 'save-native'), 'the card was played');
  assert.equal(combat.phase, 'player');
  dispatch(combat, { type: 'endTurn', discardIds: [] });
  assert.equal(combat.phase, 'enemy', 'End Turn applied: the enemy phase began');
  assert.equal(h.banners.length, 1, 'one warning for the session window');
  assert.ok(h.logs.some(l => l[0] === 'save'));
  assert.equal(store.map.has(runKey(1)), false, 'nothing was written');
});

test('a full victory with a quota-throwing store still reaches the reward screen', () => {
  const { run, rng } = freshRun(11);
  const store = limitedStorage({ budget: 10 }); // nothing fits
  const save = createSaveManager(store);
  const h = door({ saveRun: (next, r) => save.saveRun(next, r, 1) });
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  combat.beforeCombatCommit = candidate => commitExpansionCandidate({ run, candidate, nodeId: 'n1_4', encounterId: 'patrol', saveCandidate: h.context.saveCombatCandidate });
  combat.enemies[0].hp = 1;
  for (const card of [...combat.piles.hand]) {
    if (combat.phase === 'ended') break;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  }
  assert.equal(combat.result, 'victory', 'the winning action applied despite the full store');
  // The reward transition and the persist helpers, sliced from the shipped source.
  const mounted = [];
  const context = {
    ...h.context, run, rng, mounted,
    persist: () => save.saveRun(run, rng, 1),
    configuredRewardOffer: rewards => rewards, mergeProgressionRewards: (_d, rewards) => rewards,
    partitionProgressionRewards: rewards => ({ available: rewards, deferred: {} }),
    pendingRewardCheckpoint: rewards => ({ rewards }),
    mountPendingReward: () => { mounted.push('reward'); return 'mounted'; },
  };
  runInNewContext(`${doorSource}\n${sliceBlock('function beginPendingReward', '// SPEC §15.4: a legendary sigil drop')}\nthis.beginPendingReward = beginPendingReward; this.persistOrWarn = persistOrWarn; this.persistContinuing = persistContinuing;`, context);
  assert.equal(context.beginPendingReward({ title: 'VICTORY' }, { source: 'normal', after: 'map' }), 'mounted');
  assert.deepEqual(mounted, ['reward'], 'the reward screen mounted');
  assert.ok(h.banners.length >= 1, 'the player was told that the save failed');
  assert.equal(context.persistContinuing(), undefined, 'reward doors read a return of false as a refusal; this never returns it');
  assert.equal(context.persistOrWarn(), false);
});

test('an old-format save (no savedAt stamp) still loads, and a refused re-save leaves the slot readable', () => {
  const { run, rng } = freshRun(13);
  const store = limitedStorage();
  const save = createSaveManager(store);
  save.saveRun(run, rng, 1);
  const old = JSON.parse(store.map.get(runKey(1)));
  delete old.savedAt; // saves from before the slot stamp carry none
  store.map.set(runKey(1), JSON.stringify(old));
  const loaded = save.loadRun(registries, 1);
  assert.ok(loaded, 'the old-format run loads');
  assert.equal(loaded.seed, run.seed);
  const before = store.map.get(runKey(1));
  store.budget = store.used(); // now full
  assert.throws(() => save.saveRun(loaded, rng, 1), error => isStorageFullError(error));
  assert.equal(store.map.get(runKey(1)), before, 'the previous bytes survive a refused write');
  assert.ok(save.loadRun(registries, 1), 'and still load');
});

test('size budget: a mid-run save with a 45-card deck stays far below a localStorage quota', () => {
  const { run, rng } = freshRun(5);
  [...registries.cards.ids()].slice(0, 45).forEach((cardId, i) => run.deck.push({ instanceId: `big${i}`, cardId, upgraded: i % 2 === 0 }));
  const store = limitedStorage();
  createSaveManager(store).saveRun(run, rng, 1);
  assert.ok(store.map.get(runKey(1)).length < 100000, `run blob is ${store.map.get(runKey(1)).length} chars`);
});

// ---- Core: the pinned game profile is a reference, so a long run stays small --------------
const coreProfile = resolveGameProfile('core');
const coreRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, coreProfile)), coreProfile);
const coreRun = (seed = 7) => ({ run: createRunState({ registries: coreRegistries, seed, classId: 'reaver' }), rng: createRng(seed) });

test('size budget: a 60-fight Core run stays under 1 MB at rest and mid-fight, and does not grow fight over fight', () => {
  const { run, rng } = coreRun(7);
  const store = limitedStorage();
  const save = createSaveManager(store);
  const sizes = [];
  let peak = 0;
  for (let fight = 1; fight <= 60; fight++) {
    run.hp = run.maxHp; // a rest between fights: the budget is about bytes, not survival
    const combat = createRunCombat({ registries: coreRegistries, run, rng, enemyIds: ['wanderingSoldier', 'wanderingSoldier'], settings: {} });
    combat.beforeCombatCommit = candidate => commitExpansionCandidate({ run, candidate, nodeId: `n${fight}`, encounterId: `e${fight}`,
      saveCandidate: (next, committedRng) => { save.saveRun(next, committedRng, 1); return { ok: true }; } });
    dispatch(combat, { type: 'setReactions', enabled: false });
    for (let turn = 0; turn < 8 && !combat.result; turn++) {
      if (turn >= 2) combat.enemies.forEach(e => { e.hp = 1; });
      for (const card of [...combat.piles.hand]) {
        if (combat.result) break;
        try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies.find(e => e.alive)?.id }); } catch { /* unplayable this turn */ }
      }
      peak = Math.max(peak, store.map.get(runKey(1)).length);
      if (!combat.result && combat.phase === 'player') dispatch(combat, { type: 'endTurn', discardIds: [] });
    }
    runCombatEnd(run, combat);
    run.combatEntered = null;
    delete run.combatPendingOutcome;
    save.saveRun(run, rng, 1);
    sizes.push(store.map.get(runKey(1)).length);
  }
  assert.ok(Math.max(...sizes) < 100000, `a Core run at rest is at most ${Math.max(...sizes)} chars`);
  assert.ok(peak < 1000000, `a Core run mid-fight peaked at ${peak} chars`);
  assert.ok(sizes[59] - sizes[0] < 2000, `the run does not grow with the fights it has won (${sizes[0]} -> ${sizes[59]})`);
  assert.ok(store.used() < 1000000, 'the whole origin (run + profile + backup) stays far from a 5 MB quota');
});

// A Core run in the PRE-reference stored form: the profile inline (schema 25), as every older build wrote it.
function inlineSave(seed, stamp = RUN_SCHEMA_VERSION - 1) {
  const { run } = coreRun(seed);
  return JSON.stringify({ ...JSON.parse(JSON.stringify(run)), schemaVersion: stamp });
}

test('a full store is packed smaller, losslessly, and the save then lands', () => {
  const store = limitedStorage();
  const old2 = inlineSave(21), old3 = inlineSave(22);
  store.map.set(runKey(2), old2);
  store.map.set(runKey(3), old3);
  store.map.set(RUN_ARCHIVE_KEY, JSON.stringify({ v: 1, entries: [{ id: 'run-s2-1', kind: 'run', slot: 2, reason: 'test', at: new Date().toISOString(), save: inlineSave(23) }] }));
  store.budget = store.used() + 665000; // room for the shared profile copy (~655 KB), not for the ~30 KB slot-1 save after it
  const save = createSaveManager(store);
  const { run, rng } = coreRun(24);
  const archivedBefore = JSON.parse(store.map.get(RUN_ARCHIVE_KEY)).entries[0].save;
  save.saveRun(run, rng, 1);
  assert.ok(store.map.has(runKey(1)), 'the new save landed after packing');
  assert.ok(store.map.get(runKey(2)).length < old2.length / 5 && store.map.get(runKey(3)).length < old3.length / 5, 'the other slots were packed');
  const archived = JSON.parse(store.map.get(RUN_ARCHIVE_KEY));
  assert.equal(archived.entries.length, 1, 'no archived run was dropped');
  assert.ok(archived.entries[0].save.length < archivedBefore.length / 5);
  for (const slot of [2, 3]) {
    const loaded = save.loadRun(coreRegistries, slot);
    assert.ok(loaded, save.runStatus().reason);
    assert.equal(loaded.gameProfile.hash, coreProfile.hash, `slot ${slot} still pins the same profile`);
  }
});

test('packing never touches an older schema, an unknown profile, or a corrupt slot, and a still-full store says so', () => {
  const store = limitedStorage();
  const older = inlineSave(31, RUN_SCHEMA_VERSION - 3);
  const foreign = JSON.stringify({ ...JSON.parse(inlineSave(32)), gameProfile: { ...coreProfile, hash: 'sha256:' + 'a'.repeat(64) } });
  store.map.set(runKey(2), older);
  store.map.set(runKey(3), foreign);
  store.map.set(RUN_ARCHIVE_KEY, '{not json');
  store.budget = store.used() + 10;
  const save = createSaveManager(store);
  const { run, rng } = coreRun(33);
  assert.throws(() => save.saveRun(run, rng, 1), error => isStorageFullError(error), 'nothing to pack: the player is told, not silently resumed');
  assert.equal(store.map.get(runKey(2)), older);
  assert.equal(store.map.get(runKey(3)), foreign);
  assert.equal(store.map.get(RUN_ARCHIVE_KEY), '{not json');
  assert.equal(store.map.has(runKey(1)), false);
  assert.equal(run.savedAt, undefined, 'the run does not claim a save it lost');
});

// ---- the first save after an update, on a store that is ALREADY full ---------------------------
test('a near-full store of older inline saves: the first save lands via a bootstrap, nothing lost', () => {
  const store = limitedStorage();
  const old2 = inlineSave(41), old3 = inlineSave(41);
  const archived = inlineSave(41);
  store.map.set(runKey(2), old2);
  store.map.set(runKey(3), old3);
  store.map.set(RUN_ARCHIVE_KEY, JSON.stringify({ v: 1, entries: [{ id: 'run-s2-1', kind: 'run', slot: 2, reason: 'test', at: new Date().toISOString(), save: archived }] }));
  store.budget = store.used() + 100000; // no room for the ~655 KB shared copy, room for a ~30 KB slot
  const save = createSaveManager(store);
  const { run, rng } = coreRun(41);
  save.saveRun(run, rng, 1);
  assert.ok(store.map.has(runKey(1)), 'the save landed');
  assert.ok(store.map.has(profileCopyKey(run.gameProfile.hash)), 'the shared copy was written');
  for (const slot of [1, 2, 3]) assert.ok(save.loadRun(coreRegistries, slot), `slot ${slot} loads: ${save.runStatus().reason}`);
  assert.equal(JSON.parse(store.map.get(RUN_ARCHIVE_KEY)).entries.length, 1, 'the archive keeps its run');
});

test('if the shared copy cannot be written, a converted entry is rolled back byte for byte and the slot is saved inline', () => {
  const store = limitedStorage();
  const old2 = inlineSave(42);
  store.map.set(runKey(2), old2);
  store.budget = store.used() + 800000;
  const realSet = store.setItem;
  store.setItem = (k, v) => { if (k.startsWith(PROFILE_COPY_PREFIX)) throw quotaError(); return realSet(k, v); };
  const save = createSaveManager(store);
  const { run, rng } = coreRun(42);
  save.saveRun(run, rng, 1);
  assert.equal(store.map.get(runKey(2)), old2, 'the other slot is back to its exact original bytes');
  assert.ok(JSON.parse(store.map.get(runKey(1))).gameProfile, 'slot 1 was stored inline, as before this change');
  assert.equal([...store.map.keys()].some(k => k.startsWith(PROFILE_COPY_PREFIX)), false);
  assert.ok(save.loadRun(coreRegistries, 1), save.runStatus().reason);
  assert.ok(save.loadRun(coreRegistries, 2), save.runStatus().reason);
});

test('a full store reclaims orphaned profile copies first', () => {
  const store = limitedStorage();
  store.map.set(profileCopyKey('sha256:orphan'), 'x'.repeat(700000));
  store.budget = store.used() + 600000; // the copy fits only once the orphan is gone
  const save = createSaveManager(store);
  const { run, rng } = coreRun(43);
  save.saveRun(run, rng, 1);
  assert.equal(store.map.has(profileCopyKey('sha256:orphan')), false);
  assert.ok(store.map.has(profileCopyKey(run.gameProfile.hash)));
});

// ---- the manager the BROWSER uses (browserSave.js) is built from a readOnlyProfile reader ---------
test('the browser manager collects shared copies and reclaims on a full store', () => {
  const store = limitedStorage();
  const browser = createBrowserSaveManager(store);
  const { run, rng } = coreRun(51);
  store.map.set(profileCopyKey('sha256:orphan'), '{"hash":"sha256:orphan"}');
  browser.saveRun(run, rng, 1);
  assert.equal(store.map.has(profileCopyKey('sha256:orphan')), false, 'the orphan is collected on a save that writes a copy');
  assert.ok(store.map.has(profileCopyKey(run.gameProfile.hash)));
  browser.clearRun(1);
  store.map.delete(`${PROFILE_STAMP_PREFIX}${run.gameProfile.hash}`); // the grace has passed
  browser.clearRun(1);
  assert.equal([...store.map.keys()].some(k => k.startsWith(PROFILE_COPY_PREFIX)), false, 'cleared: the copy goes too');
  // full store of older inline saves: the bootstrap runs through the same manager
  store.map.set(runKey(2), inlineSave(52));
  store.budget = store.used() + 100000;
  browser.saveRun(run, rng, 1);
  assert.ok(store.map.has(runKey(1)) && store.map.has(profileCopyKey(run.gameProfile.hash)));
  assert.ok(JSON.parse(store.map.get(runKey(2))).gameProfileRef, 'the older slot was repacked');
});

test('a run resumed from its shared copy after a content update re-saves as a reference', () => {
  const old = resolveGameProfile('ashen.core@1.0.0');
  const oldRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, old)), old);
  const run = createRunState({ registries: oldRegistries, seed: 53, classId: 'reaver' });
  const stored = JSON.parse(JSON.stringify(run));
  delete stored.gameProfile;
  stored.gameProfileRef = { id: old.id, hash: old.hash };
  stored.schemaVersion = RUN_SCHEMA_VERSION;
  const store = limitedStorage();
  store.map.set(runKey(1), JSON.stringify(stored));
  store.map.set(profileCopyKey(old.hash), JSON.stringify(old));
  store.budget = store.used() + 200000; // far less than the ~655 KB an inline write would need
  const save = createSaveManager(store);
  const loaded = save.loadRun(oldRegistries);
  assert.ok(loaded, save.runStatus().reason);
  save.saveRun(loaded, createRng(53), 1);
  const after = JSON.parse(store.map.get(runKey(1)));
  assert.ok(after.gameProfileRef && !after.gameProfile, 'still a reference');
  assert.ok(save.loadRun(oldRegistries), 'and it loads');
});

// ---- two tabs: another tab's collection between this tab's copy write and its slot write ----------
function racing(expireGrace) {
  const store = limitedStorage();
  const tabA = createSaveManager(store);
  const tabB = createSaveManager(store);
  const { run, rng } = coreRun(61);
  const hash = run.gameProfile.hash;
  const realSet = store.setItem;
  let raced = false;
  store.setItem = (k, v) => {
    if (k === runKey(1) && !raced) {
      raced = true;
      if (expireGrace) store.map.delete(`${PROFILE_STAMP_PREFIX}${hash}`); // as if the copy were older than the grace
      tabA.clearRun(3); // tab A collects now: slot 1 does not name the copy yet
    }
    return realSet(k, v);
  };
  tabB.saveRun(run, rng, 1);
  return { store, tabB, hash };
}

test('another tab\'s collection cannot take a copy that was just written (grace)', () => {
  const { store, tabB, hash } = racing(false);
  assert.ok(store.map.has(profileCopyKey(hash)));
  assert.ok(tabB.loadRun(coreRegistries, 1), tabB.runStatus().reason);
});

test('and if the grace has passed, the writing tab puts the copy back after its slot lands', () => {
  const { store, tabB, hash } = racing(true);
  assert.ok(store.map.has(profileCopyKey(hash)), 'restored after the slot write');
  assert.ok(tabB.loadRun(coreRegistries, 1), tabB.runStatus().reason);
});
