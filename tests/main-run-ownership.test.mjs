import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commitRunFinishAsync } from '../src/model/runCompletion.js';
import { isConfiguredRun } from '../src/model/gameProfileRun.js';
import { createRunStartOwner } from '../src/model/runStart.js';
import { advancedConfigSnapshot, coreAdvancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { createRng, seedFromString, seedProblem } from '../src/engine/rng.js';
import { CreatePreparedRun } from '../src/services/runBirth.js';
import { core2Profile, core2Registries, core2Run } from './helpers/core2.mjs';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const body = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

function finishFixture({ failCheckpoint = false } = {}) {
  const gate = deferred(), checkpoints = [], records = [], cleared = [];
  let banks = 0;
  const memory = createMemoryStorage();
  const manager = createSaveManager({
    ...memory,
    setItem(key, value) {
      if (failCheckpoint && key === RUN_KEY) throw new Error('Run storage quota exceeded');
      memory.setItem(key, value);
    },
  });
  const saves = {
    loadMeta: () => ({}), saveRun: (run, rng, slot) => { checkpoints.push({ seed: run.seed, slot }); return manager.saveRun(run, rng, slot); },
    bankEnemyKnowledge: () => { banks++; return gate.promise; },
    withProfile: callback => callback({ loadMeta: () => ({}), saveMeta: meta => { records.push(...meta.results); return { ok: true }; } }),
    clearRun: slot => { cleared.push(slot); manager.clearRun(slot); }, hasRun: slot => manager.hasRun(slot),
  };
  const fixture = new Function('commitRunFinishAsync', 'saves', 'isConfiguredRun', `
    let run = { seed: 'A' }, activeSlot = 1;
    const registries = { unlocks: [] }, rng = { getCounters: () => ({}) }, shotState = false;
    const crypto = { randomUUID: () => 'A' };
    const stampSkillBonuses = () => {};
    const runResult = victory => ({ victory, seed: run.seed });
    const completedRunMeta = (registries, meta, result) => ({ meta: { results: [result] }, unlocked: [] });
    ${body('async function finishRun(', '\nasync function showFinishedRun(')}
    return { finish: finishRun, change: () => { run = { seed: 'B' }; activeSlot = 2; } };
  `)(commitRunFinishAsync, saves, isConfiguredRun);
  return { ...fixture, gate, checkpoints, records, cleared, banks: () => banks, savedRun: () => memory.getItem(RUN_KEY) };
}

test('actual terminal completion cannot record or clear a later adopted run after awaiting learning storage', async () => {
  const fixture = finishFixture();
  const operation = fixture.finish(false);
  await Promise.resolve(); await Promise.resolve();
  fixture.change(); fixture.gate.resolve({ ok: true });
  const result = await operation;
  assert.equal(result.ok, false); assert.match(result.error.message, /active run changed/);
  assert.equal(fixture.banks(), 1); assert.deepEqual(fixture.records, []); assert.deepEqual(fixture.cleared, []);
  assert.deepEqual(fixture.checkpoints, [{ seed: 'A', slot: 1 }]);
});

test('repeated terminal completion requests share one bank, result and original-slot clear', async () => {
  const fixture = finishFixture();
  const first = fixture.finish(false), second = fixture.finish(false);
  await Promise.resolve(); await Promise.resolve(); fixture.gate.resolve({ ok: true });
  assert.ok((await first).ok); assert.ok((await second).ok);
  assert.equal(fixture.banks(), 1); assert.equal(fixture.records.length, 1);
  assert.deepEqual(fixture.records[0], { victory: false, seed: 'A', finishId: 'A', gameProfile: undefined, runId: undefined });
  assert.deepEqual(fixture.cleared, [1]);
  assert.equal(fixture.savedRun(), null);
});

test('actual terminal checkpoint preserves the save manager throwing failure contract', async () => {
  const fixture = finishFixture({ failCheckpoint: true });
  const result = await fixture.finish(false);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Run storage quota exceeded/);
  assert.equal(fixture.banks(), 0);
  assert.deepEqual(fixture.records, []);
  assert.deepEqual(fixture.cleared, []);
});

test('actual screenshot new-run entry adopts its synchronous memory fixture before returning', () => {
  const fixture = new Function('createRunStartOwner', `
    const runStartOwner = createRunStartOwner(), shotState = 'combat', selectedGameProfile = 'core';
    let run = null; const saves = { ensureProfile: () => ({ ok: true }) };
    const randomSeedString = () => 'SHOWCASE', seedProblem = () => null;
    const beginPreparedRun = config => { run = { seed: config.seedString, gameProfile: config.gameProfile }; };
    ${body('function newRun(', '\nfunction beginPreparedRun(')}
    return { start: newRun, current: () => run };
  `)(createRunStartOwner);
  fixture.start({ seedString: 'SHOWCASE' });
  assert.deepEqual(fixture.current(), { seed: 'SHOWCASE', gameProfile: 'core' });
  fixture.start({ seedString:'EXPLICIT', gameProfile:'current' });
  assert.deepEqual(fixture.current(),{seed:'EXPLICIT',gameProfile:'current'},'an explicit profile still overrides the selected default');
});

test('a refused prepared birth leaves the previous run and RNG unadopted', async () => {
  const notices = [], errors = [], writes = [];
  const previousRun = core2Run(), previousRng = createRng(previousRun.seed);
  const selectedGameProfile = core2Profile(), registries = core2Registries();
  const saves = createSaveManager(createMemoryStorage());
  const bindings = {
    previousRun, previousRng, selectedGameProfile, registries,
    saves: { ...saves, saveRun: (...args) => { writes.push(args); throw new Error('first save refused'); } },
    createRunStartOwner, isConfiguredRun, CreatePreparedRun,
    advancedConfigSnapshot, coreAdvancedConfigSnapshot, seedFromString, seedProblem,
    app: { firstElementChild: {} },
    resetArmouryTraySession: () => {}, rebuildRegistries: () => {},
    randomSeedString: () => assert.fail('the chosen seed is valid'),
    failureBanner: () => assert.fail('the notice owns this failure'),
    console: { error: (...args) => errors.push(args) },
    dlog: () => {},
    showSettingsNotice: message => { notices.push(message); return true; },
  };
  const fixture = new Function(...Object.keys(bindings), `
    const shotState = null, shotParams = new URLSearchParams('');
    const runStartOwner = createRunStartOwner();
    let run = previousRun, rng = previousRng, activeSlot = 1, xpCombat = {};
    const startClimb = () => saves.saveRun(run, rng, activeSlot);
    ${body('function newRun(', '\n// After the deck is finalized')}
    return { start: newRun, current: () => ({ run, rng, activeSlot, xpCombat }) };
  `)(...Object.values(bindings));
  const result = await fixture.start({ classId: 'reaver', seedString: '511', slot: 2,
    custom: { firstSeat: 'missing-seat' },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown first seat 'missing-seat'/);
  assert.equal(fixture.current().run, previousRun);
  assert.equal(fixture.current().rng, previousRng);
  assert.equal(fixture.current().activeSlot, 2, 'slot selection still precedes birth');
  assert.equal(fixture.current().xpCombat, null, 'combat ownership prep still precedes birth');
  assert.deepEqual(writes, []);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /unknown first seat 'missing-seat'/);
  assert.equal(errors.length, 1);

  const saved = await fixture.start({ classId: 'reaver', seedString: '511', slot: 2 });
  assert.deepEqual(saved, { ok: false, reason: 'first save refused' });
  assert.notEqual(fixture.current().run, previousRun, 'the first save runs after adoption');
  assert.notEqual(fixture.current().rng, previousRng);
  assert.deepEqual(writes, [[fixture.current().run, fixture.current().rng, 2]]);
});

function combatOutcomeFixture() {
  const bank = deferred(), beat = deferred(), checkpoints = [];
  const fixture = new Function('bank', 'beat', 'checkpoints', `
    const original = { seed: 'A', combatPendingOutcome: { result: 'victory' } };
    let run = original, activeSlot = 1, xpCombat = {}, beats = 0, settlements = 0;
    const saves = { bankEnemyKnowledge: () => bank.promise };
    const app = { querySelector: () => ({}) }, registries = { balance: { ui: { victoryBeat: { ms: 0 } } } };
    const persist = () => checkpoints.push(run.seed), showSettingsNotice = () => {}, victoryTitle = () => 'VICTORY';
    const persistOrWarn = () => { persist(); return true; };
    const victoryBeat = () => { beats++; return beat.promise; };
    const runCombatEnd = () => { settlements++; throw new Error('Unexpected stale combat settlement'); };
    ${body('async function onCombatEnd(', '\n// ---- non-combat nodes')}
    return { end: () => onCombatEnd('victory', xpCombat, { pool: 'normal' }),
      change: () => { run = { seed: 'B', combatPendingOutcome: { result: 'defeat' } }; activeSlot = 2; },
      facts: () => ({ beats, settlements, originalPending: !!original.combatPendingOutcome, currentPending: !!run.combatPendingOutcome }) };
  `)(bank, beat, checkpoints);
  return { ...fixture, bank, beat, checkpoints };
}

test('actual combat outcome abandons stale settlement after either asynchronous handoff', async () => {
  for (const boundary of ['bank', 'beat']) {
    const fixture = combatOutcomeFixture(), operation = fixture.end();
    if (boundary === 'bank') fixture.change();
    fixture.bank.resolve({ ok: true });
    await Promise.resolve(); await Promise.resolve();
    if (boundary === 'beat') fixture.change();
    fixture.beat.resolve(); await operation;
    assert.deepEqual(fixture.checkpoints, boundary === 'bank' ? [] : ['A']);
    assert.deepEqual(fixture.facts(), { beats: boundary === 'bank' ? 0 : 1, settlements: 0, originalPending: true, currentPending: true });
  }
});

test('actual terminal resume shields navigation immediately and duplicate Continue shares its operation', async () => {
  const gate = deferred(); let calls = 0;
  const fixture = new Function('operation', `
    let terminalResume = null; const app = { inert: false }, refusedRunLanding = () => {};
    ${body('function resumeRun(', '\nfunction resumeTerminal(')}
    ${body('function resumeTerminal(', '\nfunction saveSlotRecords(')}
    return { start: () => resumeTerminal(operation), duplicate: () => resumeRun(2), inert: () => app.inert };
  `)(() => { calls++; return gate.promise; });
  const first = fixture.start(); assert.equal(fixture.inert(), true);
  assert.equal(fixture.duplicate(), first); await Promise.resolve(); assert.equal(calls, 1);
  gate.resolve(); await first; assert.equal(fixture.inert(), false);
});
