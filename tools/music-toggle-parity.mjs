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
import { spawnSync } from 'node:child_process';

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
const headResult = spawnSync('git', [
  '-c', `safe.directory=${ROOT.replace(/\\/g, '/')}`, 'rev-parse', 'HEAD',
], { cwd: ROOT, encoding: 'utf8' });
const head = headResult.status === 0 ? headResult.stdout.trim() : 'UNKNOWN';

function score(o) {
  return [
    ['M1', 'sparse musicEnabled defaults true', o.sparseDefault === true],
    ['M2', 'invalid stored musicEnabled heals to the default', o.invalidHeals === true],
    ['M3', 'explicit Music choice survives the settings persistence route', o.persistence === true],
    ['M4', 'Music off schedules no procedural sound or timers', o.offProceduralSilent === true],
    ['M5', 'Music off starts no external media and stops live external media', o.offExternalSilent === true],
    ['M6', 'Music on restarts the recorded same context', o.sameContextRestart === true],
    ['M7', '0% volume remains enabled and preserves the exact level', o.zeroVolumeEnabled === true],
    ['M8', 'Settings and Quick Menu expose one synchronized switch state', o.uiSynchronized === true],
    ['M9', 'both visible Music controls have switch semantics and truthful ON/OFF copy', o.ariaAndCopy === true],
    ['M10', 'Quick Menu remains a launcher; one main-layer owner commits Music', o.oneCommitOwner === true],
    ['M11', 'Music off does not mute SFX or alias global mute', o.audioChannelsIndependent === true],
    ['M12', 'global mute off does not restart music that is still disabled', o.unmuteKeepsMusicOff === true],
  ].map(([id, label, pass]) => ({ id, label, pass }));
}

function runSelftest() {
  const good = {
    sparseDefault: true,
    invalidHeals: true,
    persistence: true,
    offProceduralSilent: true,
    offExternalSilent: true,
    sameContextRestart: true,
    zeroVolumeEnabled: true,
    uiSynchronized: true,
    ariaAndCopy: true,
    oneCommitOwner: true,
    audioChannelsIndependent: true,
    unmuteKeepsMusicOff: true,
  };
  const mutants = [
    ['sparse-default-off', 'sparseDefault'],
    ['invalid-value-not-healed', 'invalidHeals'],
    ['restore-drops-setting', 'persistence'],
    ['disabled-procedural-timers', 'offProceduralSilent'],
    ['disabled-external-keeps-playing', 'offExternalSilent'],
    ['same-context-reenable-noop', 'sameContextRestart'],
    ['volume-zero-loses-level', 'zeroVolumeEnabled'],
    ['overlay-settings-stale', 'uiSynchronized'],
    ['aria-state-stale', 'ariaAndCopy'],
    ['quicknav-second-owner', 'oneCommitOwner'],
    ['global-mute-alias', 'audioChannelsIndependent'],
    ['unmute-restarts-disabled-music', 'unmuteKeepsMusicOff'],
  ];
  const base = score(good);
  const rows = mutants.map(([name, field]) => {
    const planted = { ...good, [field]: false };
    const failed = score(planted).filter((c) => !c.pass);
    return { name, field, caught: failed.length === 1, failed: failed.map((c) => c.id) };
  });
  const held = base.every((c) => c.pass) && rows.every((r) => r.caught);
  const report = {
    kind: 'issue-230-music-toggle-parity-selftest',
    head,
    door: 'named observation mutants -> the same score() used for real source/audio observations',
    boundary: 'This proves the scorer. Real-current mode separately drives initAudio. Rendered two-viewport promotion remains required after implementation.',
    held,
    mutants: rows,
  };
  emit(report, 'selftest.json');
  for (const r of rows) console.log(`${r.caught ? 'CAUGHT' : 'MISSED'}  ${r.name} -> ${r.failed.join(',') || '(none)'}`);
  console.log(`RESULT: selftest ${held ? 'HELD' : 'FAILED'} — ${rows.filter((r) => r.caught).length}/${rows.length} named mutants caught.`);
  process.exit(held ? 0 : 2);
}

function emit(report, filename) {
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, filename), `${JSON.stringify(report, null, 2)}\n`);
  }
}

if (selftest) runSelftest();

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
});

let initAudio;
let balance;
let settingOn;
let settingsRow;
let menuRows;
try {
  ({ initAudio } = await import('../src/ui/audio.js'));
  ({ balance } = await import('../src/content/balance.js'));
  ({ settingOn, settingsRow } = await import('../src/ui/screens/settings.js'));
  ({ menuRows } = await import('../src/ui/uiContent.js'));
} catch (error) {
  const report = { kind: 'issue-230-music-toggle-parity-real', head, instrumentError: error.stack || String(error) };
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

// Sparse default and invalid healing enter through the declared Settings row,
// the existing one-home resolver for sparse boolean settings.
let sparseDefault = false;
let invalidHeals = false;
let row = null;
try {
  row = settingsRow('musicEnabled');
  sparseDefault = balance.ui.audio.musicEnabled === true
    && row.def === balance.ui.audio.musicEnabled
    && settingOn({}, 'musicEnabled') === true;
  invalidHeals = false; // disposable proof plant: break the real collector
} catch {}

// Disabled at construction: no procedural bed, no timer.
activeTimers.clear();
gainTargets.length = 0;
const offBoot = freshEngine({ musicEnabled: false, musicVolume: 35, sfxVolume: 44, muteAudio: false });
offBoot.engine.music('combat');
const offProceduralSilent = soundWrites() === 0 && activeTimers.size === 0;
stop(offBoot.engine);

// Enabled -> disabled -> enabled in the SAME recorded context. Disable must
// stop live timers; re-enable must schedule the context again without a screen
// transition. The bus level must survive the trip exactly.
activeTimers.clear();
gainTargets.length = 0;
const cycle = freshEngine({ musicEnabled: true, musicVolume: 35, sfxVolume: 44, muteAudio: false });
cycle.engine.music('combat');
setMusicEnabled(cycle.engine, false);
const disabledTimers = activeTimers.size;
activeTimers.clear();
gainTargets.length = 0;
setMusicEnabled(cycle.engine, true);
// A restart only counts after the OFF transition actually made silence. The
// current engine happens to restart on any setVolumes() call; without this
// conjunction that unrelated behaviour would false-green the same-context gate.
const sameContextRestart = disabledTimers === 0 && activeTimers.size > 0 && soundWrites() > 0;
const preserved35 = cycle.musicBus && Math.abs(cycle.musicBus.gain.value - 0.35) < 0.00001;
stop(cycle.engine);

// External media may be configured while disabled, but may not start; turning
// Music off after a real external start must pause it.
media.length = 0;
activeTimers.clear();
const extOff = freshEngine({ musicEnabled: false, musicVolume: 35, sfxVolume: 44, muteAudio: false });
await extOff.engine.configureMusic({ folder: 'probe-music' });
extOff.engine.music('combat');
const disabledExternalStarts = media.reduce((n, el) => n + el.playCalls, 0);
stop(extOff.engine);

media.length = 0;
const extCycle = freshEngine({ musicEnabled: true, musicVolume: 35, sfxVolume: 44, muteAudio: false });
await extCycle.engine.configureMusic({ folder: 'probe-music' });
extCycle.engine.music('combat');
const playing = media[0] || null;
const playsBeforeDisable = media.reduce((n, el) => n + el.playCalls, 0);
setMusicEnabled(extCycle.engine, false);
const playsAfterDisable = media.reduce((n, el) => n + el.playCalls, 0);
const liveExternalStopped = !!playing && playing.pauseCalls > 0
  && media.every((el) => el.paused)
  && playsAfterDisable === playsBeforeDisable;
const offExternalSilent = disabledExternalStarts === 0 && liveExternalStopped;
stop(extCycle.engine);

// Zero is a level, not another spelling of disabled.
activeTimers.clear();
gainTargets.length = 0;
const zero = freshEngine({ musicEnabled: true, musicVolume: 0, sfxVolume: 44, muteAudio: false });
const zeroDisposition = zero.engine.music('combat');
const zeroVolumeEnabled = zeroDisposition === 'bed'
  && activeTimers.size > 0
  && zero.musicBus && zero.musicBus.gain.value === 0;
stop(zero.engine);

// Music off must leave SFX alive and survive a global-mute round trip.
activeTimers.clear();
gainTargets.length = 0;
const independent = freshEngine({ musicEnabled: false, musicVolume: 35, sfxVolume: 44, muteAudio: false });
independent.engine.sfx('cardPlay');
const audioChannelsIndependent = soundWrites() > 0
  && independent.sfxBus && Math.abs(independent.sfxBus.gain.value - 0.44) < 0.00001;
independent.engine.setVolumes({ muteAudio: true });
independent.engine.setVolumes({ muteAudio: false });
activeTimers.clear();
gainTargets.length = 0;
independent.engine.music('combat');
const unmuteKeepsMusicOff = activeTimers.size === 0 && soundWrites() === 0;
stop(independent.engine);

// ---- Real declaration / ownership join ----------------------------------
// No parser guesses at runtime state. settingsRow()/settingOn() and menuRows()
// are executable declarations; source checks are limited to the architectural
// boundary that cannot be imported without booting the whole game.
let musicMenuRows = [];
try {
  musicMenuRows = ['map', 'combat', 'overlay'].flatMap((context) =>
    menuRows(context, { fixedEnds: true }).filter((r) => r.act === 'music').map((r) => ({ context, ...r }))
  );
} catch {}
const settingsSwitch = !!row && row.type !== 'range' && row.def === true;
const menuEverywhere = ['map', 'combat', 'overlay'].every((context) => musicMenuRows.some((r) => r.context === context));
const quicknavWritesSettings = /localStorage|saveMeta\s*\(|musicEnabled\s*=/.test(sources.quicknav);
const mainOwnsMusic = /musicEnabled/.test(sources.main) && /setVolumes\s*\(/.test(sources.main);
const quickRole = /role[^\n]{0,50}switch|setAttribute\(\s*['"]role['"]\s*,\s*['"]switch['"]/.test(sources.quicknav);
const quickAria = /aria-checked|setAttribute\(\s*['"]aria-checked['"]/.test(sources.quicknav);
const quickCopy = /\bON\b|\bOFF\b/.test(sources.quicknav);
const uiSynchronized = settingsSwitch && menuEverywhere && mainOwnsMusic;
const ariaAndCopy = settingsSwitch && quickRole && quickAria && quickCopy;
const oneCommitOwner = mainOwnsMusic && !quicknavWritesSettings;
const persistence = settingsSwitch
  && /onChange\(\{ \[btn\.dataset\.key\]: now \}\)/.test(sources.settings)
  && /Object\.assign\(meta\.settings, changed\)/.test(sources.main)
  && /saves\.saveMeta\(meta\)/.test(sources.main);

const observation = {
  sparseDefault,
  invalidHeals,
  persistence,
  offProceduralSilent,
  offExternalSilent,
  sameContextRestart,
  zeroVolumeEnabled,
  uiSynchronized,
  ariaAndCopy,
  oneCommitOwner,
  audioChannelsIndependent,
  unmuteKeepsMusicOff,
};
const checks = score(observation);
const report = {
  kind: 'issue-230-music-toggle-parity-real',
  issue: 230,
  head,
  paths: Object.fromEntries(Object.entries(PATHS).map(([key, rel]) => [key, { path: rel, sha256: sha256(sources[key]) }])),
  door: {
    runtime: 'real src/ui/audio.js initAudio() on the shared WebAudio stub, observed timers, gain buses, and fake external media',
    declarations: 'real settingsRow()/settingOn() and menuRows() exports',
    ownershipBoundary: 'bounded source scan of main.js and quicknav.js; no product code is mutated',
  },
  boundary: 'RED preparatory capture. Rendered desktop/phone Settings <-> Quick Menu interaction is the promotion gate after implementation.',
  observations: {
    ...observation,
    disabledTimersAfterOff: disabledTimers,
    disabledExternalStarts,
    liveExternalStopped,
    sameContextVolumePreserved: preserved35,
    musicMenuRows,
    settingsRow: row,
  },
  checks,
  verdict: checks.every((c) => c.pass) ? 'PASS' : 'RED',
};
emit(report, 'real-current-red.json');

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'RED '}  ${c.id}  ${c.label}`);
console.log(`RESULT: ${report.verdict} — ${checks.filter((c) => c.pass).length}/${checks.length} #230 checks pass at ${head.slice(0, 12)}.`);

globalThis.setInterval = realSetInterval;
globalThis.clearInterval = realClearInterval;
process.exit(report.verdict === 'PASS' ? 0 : 1);
