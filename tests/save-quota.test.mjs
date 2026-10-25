import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, isStorageFullError, runKey } from '../src/engine/save.js';

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
