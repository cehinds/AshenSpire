#!/usr/bin/env node
// tools/music-toggle-parity.mjs — issue #230 RED contract for one Music switch.
//
// This is deliberately a preparatory instrument, not an implementation. It
// exercises the real audio engine and reads the real Settings / Quick Menu
// declarations. While #230 is absent it MUST finish RED. `--selftest` runs a
// named future-good observation corpus through the same scorer, then plants one
// defect at a time and proves every named defect is rejected.
//
// Usage:
//   node tools/music-toggle-parity.mjs
//   node tools/music-toggle-parity.mjs --selftest
//   node tools/music-toggle-parity.mjs --out tools/results/issue-230-...
//
// Exit 0 = selftest held, or the real implementation satisfies every check.
// Exit 1 = real-current RED (expected before #230 implementation).
// Exit 2 = the instrument could not inspect the door.
//
// Promotion condition: once a collision-free #230 implementation exists, keep
// the real-engine scenarios and replace the source-level UI join below with a
// rendered Settings <-> Quick Menu interaction at both shipping viewports.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const selftest = args.includes('--selftest');
const oi = args.indexOf('--out');
const OUT = oi >= 0 && args[oi + 1] ? resolve(args[oi + 1]) : null;

const PATHS = {
  balance: 'src/content/balance.js',
  audio: 'src/ui/audio.js',
  settings: 'src/ui/screens/settings.js',
  quicknav: 'src/ui/components/quicknav.js',
  menu: 'src/ui/uiContent.js',
  main: 'src/main.js',
};

const sources = Object.fromEntries(Object.entries(PATHS).map(([key, rel]) => [
  key,
  readFileSync(join(ROOT, rel), 'utf8'),
]));

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const pathReceipts = Object.fromEntries(Object.entries(PATHS).map(([key, rel]) => [
  key,
  { path: rel, sha256: sha256(sources[key]) },
]));
const subjectDigest = sha256(Object.entries(pathReceipts)
  .map(([key, receipt]) => `${key}\0${receipt.path}\0${receipt.sha256}`)
  .join('\n'));

function provenance() {
  const instrumentPath = fileURLToPath(import.meta.url);
  return {
    instrument: { path: 'tools/music-toggle-parity.mjs', sha256: sha256(readFileSync(instrumentPath, 'utf8')) },
    subject: { digest: subjectDigest, paths: pathReceipts },
  };
}

function score(o) {
  return [
    ['M1', 'sparse musicEnabled defaults true', o.sparseDefault === true],
    ['M2', 'invalid stored musicEnabled heals to the default', o.invalidHeals === true],
    ['M3', 'explicit Music choice survives the settings persistence route', o.persistence === true],
    ['M4', 'Music off schedules no procedural sound or timers', o.offProceduralSilent === true],
    ['M5', 'Music off starts no external media and stops live external media', o.offExternalSilent === true],
    ['M6', 'Music on restarts the recorded same context without changing saved volume', o.sameContextRestart === true && o.sameContextVolumePreserved === true],
    ['M7', '0% volume remains enabled and preserves the exact level', o.zeroVolumeEnabled === true],
    ['M8', 'Settings and Quick Menu expose one synchronized switch state', o.uiSynchronized === true],
    ['M9', 'both visible Music controls have switch semantics and truthful ON/OFF copy', o.ariaAndCopy === true],
    ['M10', 'Quick Menu remains a launcher; one main-layer owner commits Music', o.oneCommitOwner === true],
    ['M11', 'Music off does not mute SFX or alias global mute', o.audioChannelsIndependent === true],
    ['M12', 'global mute off does not restart music that is still disabled', o.unmuteKeepsMusicOff === true],
  ].map(([id, label, pass]) => ({ id, label, pass }));
}

const CONTEXTS = ['map', 'combat', 'overlay'];

function memoryProfileDoor(seed = {}, { dropExplicit = false } = {}) {
  let stored = { settings: { ...seed } };
  return {
    load: () => structuredClone(stored),
    save: (meta) => {
      stored = structuredClone(meta);
      if (dropExplicit) delete stored.settings.musicEnabled;
    },
  };
}

function collectSettingsDoor({ audioDefault, rowFor, resolveSetting, openProfile }) {
  let row = null;
  let sparseDefault = false;
  let invalidHeals = false;
  let persistence = false;
  try {
    row = rowFor('musicEnabled');
    sparseDefault = audioDefault === true && row.key === 'musicEnabled'
      && row.def === audioDefault && resolveSetting({}, 'musicEnabled') === true;

    const invalidDoor = openProfile({ musicEnabled: 'not-a-boolean' });
    const invalidMeta = invalidDoor.load();
    const resolved = resolveSetting(invalidMeta.settings, 'musicEnabled');
    invalidDoor.save(invalidMeta);
    const invalidReload = invalidDoor.load();
    invalidHeals = resolved === true
      && !Object.hasOwn(invalidReload.settings, 'musicEnabled')
      && resolveSetting(invalidReload.settings, 'musicEnabled') === true;

    const explicitDoor = openProfile({});
    const changed = explicitDoor.load();
    changed.settings.musicEnabled = false;
    explicitDoor.save(changed);
    const reloaded = explicitDoor.load();
    persistence = reloaded.settings.musicEnabled === false
      && resolveSetting(reloaded.settings, 'musicEnabled') === false;
  } catch {}
  return { sparseDefault, invalidHeals, persistence, settingsRow: row };
}

function musicWindows(source, radius = 420) {
  const ranges = [];
  let at = source.indexOf('musicEnabled');
  while (at >= 0) {
    const start = Math.max(0, at - radius);
    const end = Math.min(source.length, at + radius);
    const previous = ranges[ranges.length - 1];
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
    at = source.indexOf('musicEnabled', at + 1);
  }
  return ranges.map(({ start, end }) => source.slice(start, end));
}

function collectUiDoor({ rowFor, rowsFor, quicknavSource, mainSource }) {
  let settingsRow = null;
  let onRows = [];
  let offRows = [];
  try {
    settingsRow = rowFor('musicEnabled');
    onRows = CONTEXTS.map((context) => ({
      context,
      row: rowsFor(context, true).find((candidate) => candidate.act === 'music'),
    }));
    offRows = CONTEXTS.map((context) => ({
      context,
      row: rowsFor(context, false).find((candidate) => candidate.act === 'music'),
    }));
  } catch {}

  const allRows = [...onRows, ...offRows];
  const boundRows = allRows.length === CONTEXTS.length * 2 && allRows.every(({ row }) =>
    row && row.settingKey === 'musicEnabled' && typeof row.checked === 'boolean');
  const synchronized = boundRows
    && onRows.every(({ row }) => row.checked === true)
    && offRows.every(({ row }) => row.checked === false);
  const semantics = boundRows && allRows.every(({ row }) =>
    row.role === 'switch'
    && row.ariaChecked === row.checked
    && new RegExp(`\\b${row.checked ? 'ON' : 'OFF'}\\b`).test(row.label));

  // The ownership proof is a join, not three independent vocabulary finds:
  // one bounded Music window in main must contain the write, save and audio
  // application. QuickNav may only dispatch the row's act.
  const ownerWindows = musicWindows(mainSource);
  const mainOwnerCount = ownerWindows.filter((window) =>
    /saveMeta\s*\(/.test(window)
    && /setVolumes\s*\(\s*\{[^}]*musicEnabled/.test(window)
    && /musicEnabled\s*:\s*(?:enabled|next|on|value)/.test(window)).length;
  const quickDispatchesRow = /const\s+fn\s*=\s*actions\[r\.act\]/.test(quicknavSource);
  const quickOwnsMusic = musicWindows(quicknavSource).some((window) =>
    /saveMeta\s*\(|setVolumes\s*\(|musicEnabled\s*=/.test(window));

  return {
    uiSynchronized: !!settingsRow && settingsRow.key === 'musicEnabled' && synchronized,
    ariaAndCopy: !!settingsRow && semantics,
    oneCommitOwner: boundRows && mainOwnerCount === 1 && quickDispatchesRow && !quickOwnsMusic,
    musicMenuRows: allRows.map(({ context, row }) => ({ context, ...(row || {}) })),
    mainMusicOwnerWindows: mainOwnerCount,
  };
}

async function collectAudioDoor(adapter) {
  adapter.reset();
  const offBoot = adapter.open({ musicEnabled: false, musicVolume: 35, sfxVolume: 44, muteAudio: false });
  offBoot.music('combat');
  const offProceduralSilent = adapter.timerCount() === 0 && adapter.soundWrites() === 0;
  offBoot.stop();

  adapter.reset();
  const cycle = adapter.open({ musicEnabled: true, musicVolume: 35, sfxVolume: 44, muteAudio: false });
  cycle.music('combat');
  cycle.setMusicEnabled(false);
  const silentAfterDisable = adapter.timerCount() === 0;
  adapter.clearObservations();
  cycle.setMusicEnabled(true);
  const sameContextRestart = silentAfterDisable && adapter.timerCount() > 0 && adapter.soundWrites() > 0;
  const sameContextVolumePreserved = Math.abs(cycle.musicLevel() - 0.35) < 0.00001;
  cycle.stop();

  adapter.reset();
  const externalOff = adapter.open({ musicEnabled: false, musicVolume: 35, sfxVolume: 44, muteAudio: false });
  await externalOff.configureMusic();
  externalOff.music('combat');
  const disabledExternalStarts = adapter.externalStarts();
  externalOff.stop();
  adapter.reset();
  const externalCycle = adapter.open({ musicEnabled: true, musicVolume: 35, sfxVolume: 44, muteAudio: false });
  await externalCycle.configureMusic();
  externalCycle.music('combat');
  const startsBeforeDisable = adapter.externalStarts();
  externalCycle.setMusicEnabled(false);
  const offExternalSilent = disabledExternalStarts === 0
    && adapter.externalStarts() === startsBeforeDisable
    && adapter.allExternalPaused();
  externalCycle.stop();

  adapter.reset();
  const zero = adapter.open({ musicEnabled: true, musicVolume: 0, sfxVolume: 44, muteAudio: false });
  const zeroDisposition = zero.music('combat');
  const zeroVolumeEnabled = zeroDisposition === 'bed' && adapter.timerCount() > 0 && zero.musicLevel() === 0;
  zero.stop();

  adapter.reset();
  const independent = adapter.open({ musicEnabled: false, musicVolume: 35, sfxVolume: 44, muteAudio: false });
  independent.sfx();
  const audioChannelsIndependent = adapter.soundWrites() > 0 && Math.abs(independent.sfxLevel() - 0.44) < 0.00001;
  // Record a real context while Music is off before the global-mute round trip;
  // otherwise an "unmute restarts" mutant has no context available to restart.
  independent.music('combat');
  independent.setMuted(true);
  adapter.clearObservations();
  independent.setMuted(false);
  const silentAfterUnmute = adapter.timerCount() === 0 && adapter.soundWrites() === 0;
  adapter.clearObservations();
  independent.music('combat');
  const unmuteKeepsMusicOff = silentAfterUnmute
    && adapter.timerCount() === 0 && adapter.soundWrites() === 0;
  independent.stop();

  return {
    offProceduralSilent,
    offExternalSilent,
    sameContextRestart,
    sameContextVolumePreserved,
    zeroVolumeEnabled,
    audioChannelsIndependent,
    unmuteKeepsMusicOff,
    disabledExternalStarts,
  };
}

function settingsFixture({ audioDefaultOff = false, invalidNotHealed = false, dropExplicit = false } = {}) {
  const def = true;
  return {
    audioDefault: !audioDefaultOff,
    rowFor(key) {
      if (key !== 'musicEnabled') throw new Error('unknown row');
      return { key, type: 'toggle', def };
    },
    resolveSetting(bag, key) {
      if (typeof bag[key] !== 'boolean') {
        if (!invalidNotHealed) delete bag[key];
        else return true;
      }
      return def ? bag[key] !== false : bag[key] === true;
    },
    openProfile: (seed) => memoryProfileDoor(seed, { dropExplicit }),
  };
}

function uiFixture({ staleOverlay = false, staleAria = false, quickOwner = false, splitOwner = false } = {}) {
  const makeRow = (context, enabled) => {
    const checked = staleOverlay && context === 'overlay' ? !enabled : enabled;
    return {
      act: 'music',
      settingKey: 'musicEnabled',
      role: 'switch',
      checked,
      ariaChecked: staleAria ? !checked : checked,
      label: `Music — ${checked ? 'ON' : 'OFF'}`,
    };
  };
  const padding = 'x'.repeat(1000);
  const mainSource = splitOwner
    ? `meta.settings.musicEnabled = enabled;${padding}saves.saveMeta(meta);${padding}audio.setVolumes({ musicEnabled: enabled });`
    : 'function commitMusic(enabled) { meta.settings.musicEnabled = enabled; saves.saveMeta(meta); audio.setVolumes({ musicEnabled: enabled }); }';
  const quicknavSource = 'const fn = actions[r.act];'
    + (quickOwner ? ' meta.settings.musicEnabled = enabled; saves.saveMeta(meta);' : '');
  return {
    rowFor: () => ({ key: 'musicEnabled', type: 'toggle', def: true }),
    rowsFor: (context, enabled) => [makeRow(context, enabled)],
    quicknavSource,
    mainSource,
  };
}

function modelAudioAdapter(options = {}) {
  let timers = 0;
  let writes = 0;
  let externalStarts = 0;
  let disabledProceduralCalls = 0;
  const media = [];
  return {
    reset() { timers = 0; writes = 0; externalStarts = 0; media.length = 0; },
    clearObservations() { timers = 0; writes = 0; },
    timerCount: () => timers,
    soundWrites: () => writes,
    externalStarts: () => externalStarts,
    allExternalPaused: () => media.length > 0 && media.every((entry) => entry.paused),
    open(settings) {
      let enabled = settings.musicEnabled !== false;
      let muted = settings.muteAudio === true;
      let musicLevel = settings.musicVolume / 100;
      let sfxLevel = settings.sfxVolume / 100;
      let context = null;
      let external = false;
      const playContext = () => {
        if (!enabled || muted) return;
        if (external) {
          media.push({ paused: false });
          externalStarts++;
        } else {
          timers++;
          if (musicLevel > 0) writes++;
        }
      };
      return {
        async configureMusic() { external = true; },
        music(next) {
          context = next;
          if (!enabled && options.disabledProceduralTimers && !external && disabledProceduralCalls++ === 0) timers++;
          if (!enabled && options.disabledExternalKeepsPlaying && external) {
            media.push({ paused: false });
            externalStarts++;
          }
          playContext();
          return external ? 'external' : 'bed';
        },
        setMusicEnabled(next) {
          enabled = next;
          if (!enabled) {
            timers = 0;
            for (const entry of media) entry.paused = true;
            return;
          }
          if (options.sameContextReenableNoop) return;
          if (options.resetVolumeOnReenable) musicLevel = 0.5;
          if (context) playContext();
        },
        sfx() {
          if (!muted && !(options.globalMuteAlias && !enabled) && sfxLevel > 0) writes++;
        },
        setMuted(next) {
          muted = next;
          if (muted) timers = 0;
          else if (context && (enabled || options.unmuteRestartsDisabledMusic)) {
            if (options.unmuteRestartsDisabledMusic && !enabled) timers++;
            else playContext();
          }
        },
        musicLevel: () => options.zeroLosesLevel && musicLevel === 0 ? 0.5 : musicLevel,
        sfxLevel: () => sfxLevel,
        stop() {
          timers = 0;
          for (const entry of media) entry.paused = true;
        },
      };
    },
  };
}

async function observeFixture({ settings = {}, audio = {}, ui = {} } = {}) {
  return {
    ...collectSettingsDoor(settingsFixture(settings)),
    ...await collectAudioDoor(modelAudioAdapter(audio)),
    ...collectUiDoor(uiFixture(ui)),
  };
}

async function runSelftest() {
  const good = await observeFixture();
  const plants = [
    { name: 'balance-default-disagrees-with-music-row', fixture: { settings: { audioDefaultOff: true } }, expected: ['M1'] },
    { name: 'persisted-invalid-not-canonically-healed', fixture: { settings: { invalidNotHealed: true } }, expected: ['M2'] },
    { name: 'reload-drops-explicit-choice', fixture: { settings: { dropExplicit: true } }, expected: ['M3'] },
    { name: 'disabled-procedural-schedules-timer', fixture: { audio: { disabledProceduralTimers: true } }, expected: ['M4'] },
    { name: 'disabled-external-keeps-playing', fixture: { audio: { disabledExternalKeepsPlaying: true } }, expected: ['M5'] },
    { name: 'same-context-reenable-noop', fixture: { audio: { sameContextReenableNoop: true } }, expected: ['M6'] },
    { name: 'same-context-reenable-resets-35-percent', fixture: { audio: { resetVolumeOnReenable: true } }, expected: ['M6'] },
    { name: 'volume-zero-loses-level', fixture: { audio: { zeroLosesLevel: true } }, expected: ['M7'] },
    { name: 'overlay-music-row-stale', fixture: { ui: { staleOverlay: true } }, expected: ['M8'] },
    { name: 'music-row-aria-state-stale', fixture: { ui: { staleAria: true } }, expected: ['M9'] },
    { name: 'quicknav-becomes-second-music-owner', fixture: { ui: { quickOwner: true } }, expected: ['M10'] },
    { name: 'music-owner-vocabulary-split-across-routes', fixture: { ui: { splitOwner: true } }, expected: ['M10'] },
    { name: 'music-off-aliases-global-mute', fixture: { audio: { globalMuteAlias: true } }, expected: ['M11'] },
    { name: 'unmute-restarts-disabled-music', fixture: { audio: { unmuteRestartsDisabledMusic: true } }, expected: ['M12'] },
  ];
  const rows = [];
  for (const plant of plants) {
    const observed = await observeFixture(plant.fixture);
    const failed = score(observed).filter((check) => !check.pass).map((check) => check.id);
    rows.push({
      name: plant.name,
      expected: plant.expected,
      failed,
      caught: failed.length === plant.expected.length && plant.expected.every((id) => failed.includes(id)),
    });
  }
  const baseline = score(good);
  const held = baseline.every((check) => check.pass) && rows.every((row) => row.caught);
  const report = {
    kind: 'issue-230-music-toggle-parity-selftest',
    provenance: provenance(),
    door: 'Each named plant changes a Settings profile door, audio engine adapter, or Music-row/owner fixture and travels through the same collectSettingsDoor(), collectAudioDoor(), and collectUiDoor() functions used by real-current mode.',
    boundary: 'Collector-travelling selftest. Real-current mode drives shipped modules; rendered desktop/phone promotion remains required after implementation.',
    baseline,
    held,
    plants: rows,
  };
  emit(report, 'selftest.json');
  for (const row of rows) console.log(`${row.caught ? 'CAUGHT' : 'MISSED'}  ${row.name} -> ${row.failed.join(',') || '(none)'}`);
  console.log(`RESULT: selftest ${held ? 'HELD' : 'FAILED'} — ${rows.filter((row) => row.caught).length}/${rows.length} collector-travelling plants caught.`);
  process.exit(held ? 0 : 2);
}

function emit(report, filename) {
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, filename), `${JSON.stringify(report, null, 2)}\n`);
  }
}

if (selftest) await runSelftest();

// ---- Real engine door -----------------------------------------------------
// The shared stub is the established WebAudio door. We add observation around
// it without changing it: active intervals, created gain buses and fake media.
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
let nextTimer = 1;
const activeTimers = new Set();
globalThis.setInterval = () => {
  const id = nextTimer++;
  activeTimers.add(id);
  return id;
};
globalThis.clearInterval = (id) => activeTimers.delete(id);

const { installWebAudioStub } = await import('./webaudio-stub.mjs');
const gainTargets = installWebAudioStub();
// settings.js installs passive window listeners at module load. They are not
// part of this door, but the headless host must still provide their browser
// shape so importing the real resolver is honest rather than source-parsed.
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
const gainNodes = [];
const Ctx = globalThis.window.AudioContext;
const createGain = Ctx.prototype.createGain;
Ctx.prototype.createGain = function observedCreateGain() {
  const node = createGain.call(this);
  gainNodes.push(node);
  return node;
};
Ctx.prototype.createMediaElementSource = function createMediaElementSource() {
  return { connect: (node) => node };
};

const media = [];
class FakeAudio {
  constructor(url) {
    this.url = url;
    this.paused = true;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.listeners = new Map();
    this.onended = null;
    this.onerror = null;
    media.push(this);
  }
  play() { this.paused = false; this.playCalls++; return Promise.resolve(); }
  pause() { this.paused = true; this.pauseCalls++; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
}
globalThis.Audio = FakeAudio;
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ combat: ['combat.ogg'] }),
  arrayBuffer: async () => new ArrayBuffer(8),
});

let initAudio;
let balance;
let settingOn;
let settingsRow;
let menuRows;
let createSaveManager;
let createMemoryStorage;
try {
  ({ initAudio } = await import('../src/ui/audio.js'));
  ({ balance } = await import('../src/content/balance.js'));
  ({ settingOn, settingsRow } = await import('../src/ui/screens/settings.js'));
  ({ menuRows } = await import('../src/ui/uiContent.js'));
  ({ createSaveManager, createMemoryStorage } = await import('../src/engine/save.js'));
} catch (error) {
  const report = { kind: 'issue-230-music-toggle-parity-real', provenance: provenance(), instrumentError: error.stack || String(error) };
  emit(report, 'real-current-red.json');
  console.error(`RESULT: UNKNOWN — the real door could not load: ${error.message}`);
  process.exit(2);
}

const soundWrites = () => gainTargets.filter((v) => Number(v) > 0.0001).length;
const setMusicEnabled = (engine, enabled) => {
  if (typeof engine.setMusicEnabled === 'function') engine.setMusicEnabled(enabled);
  else engine.setVolumes({ musicEnabled: enabled });
};
const freshEngine = (settings) => {
  const firstGain = gainNodes.length;
  const engine = initAudio(settings);
  return { engine, musicBus: gainNodes[firstGain + 1], sfxBus: gainNodes[firstGain + 2] };
};
const stop = (engine) => { try { engine.stopMusic(0); } catch {} };

// The persisted-setting probe uses the shipped save manager twice: once to
// reopen bytes after invalid-value normalization and once after an explicit
// OFF write. `settingOn()` is allowed to heal the bag in place; only what the
// second load reads counts.
const openRealProfile = (seed) => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.ensureProfile();
  const meta = saves.loadMeta();
  meta.settings = { ...seed };
  saves.saveMeta(meta);
  return { load: () => saves.loadMeta(), save: (next) => saves.saveMeta(next) };
};
const settingsObservation = collectSettingsDoor({
  audioDefault: balance.ui.audio.musicEnabled,
  rowFor: settingsRow,
  resolveSetting: settingOn,
  openProfile: openRealProfile,
});

const realAudioAdapter = {
  reset() { activeTimers.clear(); gainTargets.length = 0; media.length = 0; },
  clearObservations() { activeTimers.clear(); gainTargets.length = 0; },
  timerCount: () => activeTimers.size,
  soundWrites,
  externalStarts: () => media.reduce((count, element) => count + element.playCalls, 0),
  allExternalPaused: () => media.length > 0 && media.every((element) => element.paused),
  open(settings) {
    const opened = freshEngine(settings);
    return {
      configureMusic: () => opened.engine.configureMusic({ folder: 'probe-music' }),
      music: (context) => opened.engine.music(context),
      setMusicEnabled: (enabled) => setMusicEnabled(opened.engine, enabled),
      sfx: () => opened.engine.sfx('cardPlay'),
      setMuted: (muted) => opened.engine.setVolumes({ muteAudio: muted }),
      musicLevel: () => opened.musicBus ? opened.musicBus.gain.value : NaN,
      sfxLevel: () => opened.sfxBus ? opened.sfxBus.gain.value : NaN,
      stop: () => stop(opened.engine),
    };
  },
};
const audioObservation = await collectAudioDoor(realAudioAdapter);

const uiObservation = collectUiDoor({
  rowFor: settingsRow,
  rowsFor: (context, enabled) => menuRows(context, {
    fixedEnds: true,
    settings: { musicEnabled: enabled },
  }),
  quicknavSource: sources.quicknav,
  mainSource: sources.main,
});

const observation = { ...settingsObservation, ...audioObservation, ...uiObservation };
const checks = score(observation);
const report = {
  kind: 'issue-230-music-toggle-parity-real',
  issue: 230,
  provenance: provenance(),
  door: {
    runtime: 'real src/ui/audio.js initAudio() on the shared WebAudio stub, observed timers, gain buses, and fake external media',
    settings: 'real createSaveManager(createMemoryStorage()) save/reload around settingsRow()/settingOn()',
    declarations: 'real settingsRow()/settingOn() and menuRows(context, {settings}) exports',
    ownershipBoundary: 'actual Music rows joined to one bounded main-layer save/audio route and QuickNav actions[r.act] dispatch',
  },
  boundary: 'RED preparatory capture. Rendered desktop/phone Settings <-> Quick Menu interaction is the promotion gate after implementation.',
  observations: observation,
  checks,
  verdict: checks.every((c) => c.pass) ? 'PASS' : 'RED',
};
emit(report, 'real-current-red.json');

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'RED '}  ${c.id}  ${c.label}`);
console.log(`RESULT: ${report.verdict} — ${checks.filter((c) => c.pass).length}/${checks.length} #230 checks pass for product digest ${subjectDigest.slice(0, 12)}.`);

globalThis.setInterval = realSetInterval;
globalThis.clearInterval = realClearInterval;
process.exit(report.verdict === 'PASS' ? 0 : 1);
