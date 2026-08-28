#!/usr/bin/env node
// Focused door for #47: SFX files bind by assets/sfx/<id>.ogg without a
// registration row, while SFX_MANIFEST remains an explicit override.
//
// Usage:
//   node tools/sfx-filename-convention.mjs
//   node tools/sfx-filename-convention.mjs --receipt tools/results/...json
//   node tools/sfx-filename-convention.mjs --artifact AshenSpire.html
//   node tools/sfx-filename-convention.mjs --selftest
//
// The runtime lane drives the real initAudio() over a WebAudio/fetch recorder.
// It proves fetch, decode, sample start and synth scheduling independently.
// The artifact lane checks the selected standalone file, never an assumed
// output. Selftest plants the source seams and that selected artifact.

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : null; };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function runner() {
  const { installWebAudioStub } = await import('./webaudio-stub.mjs');
  const gains = installWebAudioStub();
  const proto = window.AudioContext.prototype;
  const createSource = proto.createBufferSource;
  let decodeFails = false;
  let decodes = 0;
  let starts = 0;
  let fetches = [];
  let fetchOk = true;
  const logs = [];

  proto.decodeAudioData = async () => {
    decodes++;
    if (decodeFails) throw new Error('fixture decode failure');
    return { fixture: true };
  };
  proto.createBufferSource = function patchedSource() {
    const node = createSource.call(this);
    const start = node.start;
    // Synth noise also uses a BufferSource. Count only decoded sample buffers,
    // or hit/block fallback noise would impersonate a successful file start.
    node.start = (...a) => { if (node.buffer?.fixture === true) starts++; return start.apply(node, a); };
    return node;
  };
  globalThis.fetch = async (url) => {
    fetches.push(String(url));
    return { ok: fetchOk, status: fetchOk ? 200 : 404, arrayBuffer: async () => new ArrayBuffer(16) };
  };
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));

  const { SFX_MANIFEST } = await import('../src/content/sfx.js');
  const { ASSET_MAP } = await import('../src/ui/assetmap.js');
  const { initAudio } = await import('../src/ui/audio.js');
  const rows = [];
  const run = async ({ name, id, manifest = null, inlined = null, ok = true, badDecode = false, plays = 1 }) => {
    delete SFX_MANIFEST[id];
    const convention = `assets/sfx/${encodeURIComponent(id)}.ogg`;
    delete ASSET_MAP[convention];
    if (manifest) SFX_MANIFEST[id] = manifest;
    if (inlined) ASSET_MAP[convention] = inlined;
    fetchOk = ok; decodeFails = badDecode;
    fetches = []; decodes = 0; starts = 0; logs.length = 0;
    const engine = initAudio({ musicVolume: 50, sfxVolume: 50, muteAudio: false });
    gains.length = 0;
    for (let i = 0; i < plays; i++) engine.sfx(id);
    await wait(30);
    rows.push({
      name, id, convention, manifest, inlined, fetches: [...fetches], decodes, starts,
      synthPeaks: gains.filter((value) => value > 0.01), logs: [...logs],
    });
    delete SFX_MANIFEST[id]; delete ASSET_MAP[convention];
  };

  await run({ name: 'convention-success', id: 'cardPlay' });
  await run({ name: 'missing-falls-back', id: 'hit', ok: false });
  await run({ name: 'decode-falls-back-and-names-url', id: 'block', badDecode: true });
  await run({ name: 'cached-fetch-and-decode', id: 'heal', plays: 2 });
  await run({ name: 'manifest-override', id: 'nodeTravel', manifest: 'custom/sfx/travel.wav' });
  await run({
    name: 'standalone-inlined-asset', id: 'relic',
    inlined: 'data:audio/ogg;base64,T2dnUw==',
  });

  console.warn = realWarn; console.error = realError;
  process.stdout.write(JSON.stringify({ rows }));
}

if (args.includes('--runner')) {
  await runner();
  process.exit(0);
}

function runtimeDoor(tool = fileURLToPath(import.meta.url)) {
  const proc = spawnSync(process.execPath, [tool, '--runner'], {
    cwd: dirname(tool), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  if (proc.status !== 0) throw new Error(`runner exited ${proc.status}: ${(proc.stderr || proc.stdout || '').slice(-800)}`);
  return JSON.parse(proc.stdout);
}

function artifactDoor(path) {
  const text = readFileSync(path, 'utf8');
  return {
    path: resolve(path),
    convention: /assets\/sfx\/\$\{encodeURIComponent\(id\)\}\.ogg/.test(text),
    resolver: /assetUrl\(own\(SFX_MANIFEST,\s*id\)\s*\|\|\s*`assets\/sfx\/\$\{encodeURIComponent\(id\)\}\.ogg`\)/.test(text),
    embeddedFixture: /"assets\/sfx\/cardPlay\.ogg"\s*:\s*"data:audio\/ogg;base64,/.test(text),
  };
}

const failures = [];
const checks = [];
function check(ok, label, detail = '') {
  checks.push({ ok: !!ok, label, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

function scoreRuntime(report) {
  const by = Object.fromEntries(report.rows.map((row) => [row.name, row]));
  const success = by['convention-success'];
  check(success.fetches.length === 1 && success.fetches[0] === success.convention,
    'convention tries assets/sfx/<encoded-id>.ogg', JSON.stringify(success.fetches));
  check(success.decodes === 1 && success.starts === 1 && success.synthPeaks.length === 0,
    'successful sample decodes/starts once and suppresses synth', JSON.stringify(success));

  const missing = by['missing-falls-back'];
  check(missing.fetches.length === 1 && missing.fetches[0] === missing.convention,
    'missing sample is attempted through the convention', JSON.stringify(missing.fetches));
  check(missing.starts === 0 && missing.synthPeaks.includes(0.5) && missing.synthPeaks.includes(0.35),
    'missing sample falls back to the existing hit synth', JSON.stringify(missing.synthPeaks));

  const decode = by['decode-falls-back-and-names-url'];
  check(decode.decodes === 1 && decode.starts === 0 && decode.synthPeaks.includes(0.4),
    'decode failure falls back to the existing block synth', JSON.stringify(decode.synthPeaks));
  check(decode.logs.some((line) => line.includes(decode.convention)),
    'decode failure diagnostic names the exact resolved URL', JSON.stringify(decode.logs));

  const cached = by['cached-fetch-and-decode'];
  check(cached.fetches.length === 1 && cached.decodes === 1 && cached.starts === 2,
    'two plays share one cached fetch/decode and start twice', JSON.stringify(cached));

  const override = by['manifest-override'];
  check(override.fetches.length === 1 && override.fetches[0] === override.manifest
      && override.starts === 1 && override.synthPeaks.length === 0,
    'manifest row remains an explicit override', JSON.stringify(override));

  const inline = by['standalone-inlined-asset'];
  check(inline.fetches.length === 1 && inline.fetches[0] === inline.inlined
      && inline.starts === 1 && inline.synthPeaks.length === 0,
    'assetUrl selects the standalone inlined data URI', JSON.stringify(inline.fetches));
}

function copyBundleInputs(to) {
  for (const name of ['index.html', 'buildordinal.json', 'src', 'styles', 'assets', 'tools']) {
    const from = resolve(ROOT, name);
    if (existsSync(from)) cpSync(from, resolve(to, name), { recursive: true });
  }
}

function selftest() {
  console.log('\nSFX FILENAME CONVENTION — selftest plants');
  const audioPath = resolve(ROOT, 'src/ui/audio.js');
  const plants = [
    {
      name: 'convention lookup removed',
      from: "    const sample = assetUrl(own(SFX_MANIFEST, id) || `assets/sfx/${encodeURIComponent(id)}.ogg`);",
      to: '    const sample = assetUrl(own(SFX_MANIFEST, id));',
    },
    {
      name: 'sample miss no longer invokes synth',
      from: '    playSample(sample, sfxBus, () => synthSfx(id));',
      to: '    playSample(sample, sfxBus, () => {});',
    },
    {
      name: 'decode diagnostic loses exact URL',
      from: "        console.warn(`[audio] SFX sample '${url}' failed to decode — using synth fallback.`, error);",
      to: "        console.warn('[audio] SFX sample failed to decode — using synth fallback.', error);",
    },
  ];
  let bad = 0;
  for (const plant of plants) {
    const dir = mkdtempSync(join(tmpdir(), 'sfx-convention-plant-'));
    try {
      cpSync(resolve(ROOT, 'src'), resolve(dir, 'src'), { recursive: true });
      cpSync(resolve(ROOT, 'tools'), resolve(dir, 'tools'), { recursive: true });
      const target = resolve(dir, 'src/ui/audio.js');
      const text = readFileSync(target, 'utf8');
      const at = text.indexOf(plant.from);
      if (at < 0 || text.indexOf(plant.from, at + 1) >= 0) {
        check(false, `plant aim is exact: ${plant.name}`); bad++; continue;
      }
      writeFileSync(target, text.slice(0, at) + plant.to + text.slice(at + plant.from.length));
      const run = spawnSync(process.execPath, [resolve(dir, 'tools/sfx-filename-convention.mjs')], {
        cwd: dir, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
      });
      const held = run.status === 1 && /✗/.test(run.stdout || '');
      check(held, `source plant killed: ${plant.name}`, `exit ${run.status}`);
      if (!held) bad++;
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  const dir = mkdtempSync(join(tmpdir(), 'sfx-convention-artifact-'));
  try {
    copyBundleInputs(dir);
    mkdirSync(resolve(dir, 'assets/sfx'), { recursive: true });
    writeFileSync(resolve(dir, 'assets/sfx/cardPlay.ogg'), Buffer.from('OggS-fixture-47'));
    const gitSteps = [
      ['init', '-q'],
      ['add', 'index.html', 'buildordinal.json', 'src', 'styles', 'assets', 'tools'],
      ['-c', 'user.name=SFX Fixture', '-c', 'user.email=sfx-fixture@example.invalid',
        'commit', '-qm', 'fixture'],
    ];
    for (const step of gitSteps) {
      const git = spawnSync('git', step, { cwd: dir, encoding: 'utf8' });
      if (git.status !== 0) {
        check(false, 'selected-artifact fixture repository initializes',
          `git ${step[0]} exit ${git.status}: ${(git.stderr || git.stdout || '').trim().slice(-400)}`);
        bad++;
        return bad;
      }
    }
    const built = spawnSync(process.execPath, [resolve(dir, 'tools/bundle.mjs')], {
      cwd: dir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    });
    const artifact = resolve(dir, 'build/AshenSpire.html');
    if (built.status !== 0 || !existsSync(artifact)) {
      check(false, 'selected-artifact control builds',
        `exit ${built.status}: ${(built.stderr || built.stdout || '').trim().slice(-800)}`); bad++;
    } else {
      const control = artifactDoor(artifact);
      check(control.convention && control.resolver && control.embeddedFixture,
        'selected-artifact control carries convention, resolver and fixture', JSON.stringify(control));
      const planted = resolve(dir, 'build/AshenSpire-planted.html');
      const text = readFileSync(artifact, 'utf8');
      writeFileSync(planted, text.replace('"assets/sfx/cardPlay.ogg": "data:audio/ogg;base64,',
        '"assets/sfx/cardPlay.WRONG": "data:audio/ogg;base64,'));
      const row = artifactDoor(planted);
      check(!row.embeddedFixture, 'selected-artifact plant killed: embedded convention key renamed');
      if (row.embeddedFixture) bad++;
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return bad;
}

console.log('\nSFX FILENAME CONVENTION — focused door');
let report = null;
let artifact = null;
if (argOf('--artifact')) {
  artifact = artifactDoor(resolve(argOf('--artifact')));
  check(artifact.convention, 'selected artifact contains the filename convention', artifact.path);
  check(artifact.resolver, 'selected artifact routes convention through assetUrl', artifact.path);
  check(artifact.embeddedFixture, 'selected artifact embeds the convention fixture', artifact.path);
} else {
  report = runtimeDoor();
  scoreRuntime(report);
}

let plantFailures = 0;
if (args.includes('--selftest') && failures.length === 0) plantFailures = selftest();
const receiptPath = argOf('--receipt');
if (receiptPath) {
  const absolute = resolve(receiptPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify({
    head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim(),
    artifact, report, checks, failures, plantFailures,
  }, null, 2)}\n`);
  console.log(`  receipt ${absolute}`);
}
const total = failures.length;
console.log(`\nSFX FILENAME CONVENTION ${total ? `FAILED (${total})` : 'OK'}`);
process.exit(total ? 1 : 0);
