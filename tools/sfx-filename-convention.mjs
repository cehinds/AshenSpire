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
// It proves the triggering cue is synchronous even while a sample warms, then
// proves fetch, decode, later sample start and synth suppression independently.
// The artifact lane checks the selected standalone file, never an assumed
// output. Selftest plants the source seams and that selected artifact.

import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : null; };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const SOURCE_BASIS_PATHS = [
  'src/content/sfx.js',
  'src/ui/assetmap.js',
  'src/ui/audio.js',
  'tools/bundle.mjs',
  'tools/sfx-filename-convention.mjs',
  'tools/sfx-gain-probe.mjs',
  'tools/webaudio-stub.mjs',
];
const RUNTIME_LABELS = [
  'convention warming starts at assets/sfx/<encoded-id>.ogg',
  'stalled fetch cannot delay the triggering procedural cue',
  'pending fetch is cached while every later trigger stays immediate',
  'first successful warm keeps synth now and never replays the cue later',
  'known-good cached sample suppresses synth on a later play',
  'missing sample keeps both triggering cues immediate',
  'missing sample caches unavailable and is not fetched twice',
  'decode failure keeps both triggering cues immediate',
  'decode failure caches unavailable and is not fetched or decoded twice',
  'decode failure diagnostic names the exact resolved URL',
  'manifest row remains an explicit override',
  'assetUrl warms standalone data URI, then cached sample suppresses synth',
];
const RUNTIME_ROWS = [
  'stalled-fetch-stays-immediate', 'known-good-later-play', 'missing-stays-immediate',
  'decode-falls-back-and-names-url', 'manifest-override', 'standalone-inlined-asset',
];

function gitText(cwd, gitArgs) {
  const run = spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
  return run.status === 0 ? run.stdout.trim() : '';
}

function canonicalBytes(path, rawEol = false) {
  const raw = readFileSync(path);
  if (rawEol) return raw;
  return Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

function sourceIdentity(root, path, rawEol = false) {
  const bytes = canonicalBytes(resolve(root, path), rawEol);
  return {
    path,
    lfSha256: createHash('sha256').update(bytes).digest('hex'),
    gitBlobOid: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
  };
}

function currentPatchBasis() {
  const commit = gitText(ROOT, ['merge-base', 'HEAD', 'origin/dev'])
    || gitText(ROOT, ['rev-parse', 'HEAD^']);
  return {
    baseRef: 'dev',
    baseCommit: commit,
    baseTree: commit ? gitText(ROOT, ['show', '-s', '--format=%T', commit]) : '',
    binding: 'content identities below; published HEAD/tree are verified and printed externally',
  };
}

function buildSourceBasis(root = ROOT, patch = currentPatchBasis(), rawEol = false) {
  return {
    schema: 'ashen-sfx-tested-source-v2',
    normalization: rawEol ? 'raw-worktree-bytes-PLANT' : 'UTF-8 with CRLF/CR normalized to LF',
    patch,
    paths: SOURCE_BASIS_PATHS.map((path) => sourceIdentity(root, path, rawEol)),
  };
}

function receiptSemanticErrors(receipt) {
  const errors = [];
  if (!receipt.report || !Array.isArray(receipt.report.rows)) errors.push('runtime report is missing');
  else {
    const names = receipt.report.rows.map((row) => row.name);
    for (const name of RUNTIME_ROWS) if (!names.includes(name)) errors.push(`runtime row missing: ${name}`);
  }
  if (!Array.isArray(receipt.checks)) errors.push('checks are missing');
  else {
    for (const label of RUNTIME_LABELS) {
      const rows = receipt.checks.filter((row) => row.label === label);
      if (rows.length !== 1 || rows[0].ok !== true) errors.push(`runtime check is not uniquely green: ${label}`);
    }
    if (receipt.checks.some((row) => row.ok !== true)) errors.push('receipt contains a red check');
  }
  if (!Array.isArray(receipt.failures) || receipt.failures.length !== 0) errors.push('receipt failures are not empty');
  if (receipt.plantFailures !== undefined && receipt.plantFailures !== 0) errors.push('plantFailures is not zero');
  return errors;
}

function verifyReceiptData(receipt, root = ROOT, rawEol = false) {
  const errors = receiptSemanticErrors(receipt);
  const basis = receipt.sourceBasis;
  if (!basis || basis.schema !== 'ashen-sfx-tested-source-v2') {
    errors.push('canonical sourceBasis v2 is missing');
    return errors;
  }
  const recorded = new Map((basis.paths || []).map((row) => [row.path, row]));
  if (recorded.size !== SOURCE_BASIS_PATHS.length) errors.push('sourceBasis path count is wrong');
  for (const path of SOURCE_BASIS_PATHS) {
    const want = recorded.get(path);
    if (!want) { errors.push(`sourceBasis path missing: ${path}`); continue; }
    const got = sourceIdentity(root, path, rawEol);
    if (want.lfSha256 !== got.lfSha256) errors.push(`LF SHA256 mismatch: ${path}`);
    if (want.gitBlobOid !== got.gitBlobOid) errors.push(`Git blob OID mismatch: ${path}`);
  }
  return errors;
}

function publishedGitErrors(receipt) {
  const errors = [];
  const patch = receipt.sourceBasis?.patch || {};
  if (!patch.baseCommit || !patch.baseTree) return ['receipt patch basis is incomplete'];
  const actualBaseTree = gitText(ROOT, ['show', '-s', '--format=%T', patch.baseCommit]);
  if (actualBaseTree !== patch.baseTree) errors.push('recorded base commit/tree do not agree');
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', patch.baseCommit, 'HEAD'], { cwd: ROOT });
  if (ancestor.status !== 0) errors.push('recorded base is not an ancestor of published HEAD');
  for (const row of receipt.sourceBasis?.paths || []) {
    const publishedOid = gitText(ROOT, ['rev-parse', `HEAD:${row.path}`]);
    if (publishedOid !== row.gitBlobOid) errors.push(`published HEAD does not contain tested blob: ${row.path}`);
  }
  return errors;
}

function verifyReceiptCli(path) {
  const absolute = resolve(path);
  const receipt = JSON.parse(readFileSync(absolute, 'utf8'));
  const rawPlant = args.includes('--raw-eol-basis-plant');
  const errors = [
    ...verifyReceiptData(receipt, ROOT, rawPlant),
    ...publishedGitErrors(receipt),
  ];
  const head = gitText(ROOT, ['rev-parse', 'HEAD']);
  const tree = gitText(ROOT, ['show', '-s', '--format=%T', 'HEAD']);
  console.log(`published HEAD ${head}`);
  console.log(`published tree ${tree}`);
  console.log(`receipt ${absolute}`);
  console.log(`canonical source basis ${SOURCE_BASIS_PATHS.length}/${SOURCE_BASIS_PATHS.length} path(s)`);
  console.log(`runtime semantics ${RUNTIME_LABELS.length}/${RUNTIME_LABELS.length}`);
  if (errors.length) {
    for (const error of errors) console.error(`VERIFY FAIL: ${error}`);
    console.error(`VERIFY RECEIPT FAILED (${errors.length})`);
    process.exit(1);
  }
  console.log('VERIFY RECEIPT OK');
  process.exit(0);
}

if (argOf('--verify-receipt')) verifyReceiptCli(argOf('--verify-receipt'));

async function runner() {
  const { installWebAudioStub } = await import('./webaudio-stub.mjs');
  const gains = installWebAudioStub();
  const proto = window.AudioContext.prototype;
  const createSource = proto.createBufferSource;
  let decodeFails = false;
  let decodes = 0;
  let starts = 0;
  let fetches = [];
  let fetchMode = 'ok';
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
  globalThis.fetch = (url) => {
    fetches.push(String(url));
    if (fetchMode === 'stalled') return new Promise(() => {});
    return Promise.resolve({
      ok: fetchMode === 'ok', status: fetchMode === 'ok' ? 200 : 404,
      arrayBuffer: async () => new ArrayBuffer(16),
    });
  };
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));

  const { SFX_MANIFEST } = await import('../src/content/sfx.js');
  const { ASSET_MAP } = await import('../src/ui/assetmap.js');
  const { initAudio } = await import('../src/ui/audio.js');
  const rows = [];
  const snapshot = () => ({
    fetches: [...fetches], decodes, starts,
    synthPeaks: gains.filter((value) => value > 0.01), logs: [...logs],
  });
  const run = async ({ name, id, manifest = null, inlined = null, mode = 'ok', badDecode = false }) => {
    delete SFX_MANIFEST[id];
    const convention = `assets/sfx/${encodeURIComponent(id)}.ogg`;
    delete ASSET_MAP[convention];
    if (manifest) SFX_MANIFEST[id] = manifest;
    if (inlined) ASSET_MAP[convention] = inlined;
    fetchMode = mode; decodeFails = badDecode;
    fetches = []; decodes = 0; starts = 0; logs.length = 0;
    const engine = initAudio({ musicVolume: 50, sfxVolume: 50, muteAudio: false });
    gains.length = 0;
    engine.sfx(id);
    const firstImmediate = snapshot();
    await wait(30);
    const afterWarm = snapshot();
    gains.length = 0;
    engine.sfx(id);
    const secondImmediate = snapshot();
    await wait(5);
    const afterSecond = snapshot();
    rows.push({
      name, id, convention, manifest, inlined,
      firstImmediate, afterWarm, secondImmediate, afterSecond,
    });
    delete SFX_MANIFEST[id]; delete ASSET_MAP[convention];
  };

  await run({ name: 'stalled-fetch-stays-immediate', id: 'cardPlay', mode: 'stalled' });
  await run({ name: 'known-good-later-play', id: 'heal' });
  await run({ name: 'missing-stays-immediate', id: 'hit', mode: 'missing' });
  await run({ name: 'decode-falls-back-and-names-url', id: 'block', badDecode: true });
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
  const stalled = by['stalled-fetch-stays-immediate'];
  check(stalled.firstImmediate.fetches.length === 1
      && stalled.firstImmediate.fetches[0] === stalled.convention,
    'convention warming starts at assets/sfx/<encoded-id>.ogg', JSON.stringify(stalled.firstImmediate));
  check(stalled.firstImmediate.synthPeaks.includes(0.35) && stalled.firstImmediate.starts === 0,
    'stalled fetch cannot delay the triggering procedural cue', JSON.stringify(stalled.firstImmediate));
  check(stalled.secondImmediate.fetches.length === 1
      && stalled.secondImmediate.synthPeaks.includes(0.35) && stalled.secondImmediate.starts === 0,
    'pending fetch is cached while every later trigger stays immediate', JSON.stringify(stalled.secondImmediate));

  const success = by['known-good-later-play'];
  check(success.firstImmediate.synthPeaks.includes(0.35) && success.firstImmediate.starts === 0
      && success.afterWarm.decodes === 1 && success.afterWarm.starts === 0,
    'first successful warm keeps synth now and never replays the cue later', JSON.stringify(success));
  check(success.secondImmediate.fetches.length === 1 && success.secondImmediate.decodes === 1
      && success.secondImmediate.starts === 1 && success.secondImmediate.synthPeaks.length === 0,
    'known-good cached sample suppresses synth on a later play', JSON.stringify(success.secondImmediate));

  const missing = by['missing-stays-immediate'];
  check(missing.firstImmediate.synthPeaks.includes(0.5) && missing.firstImmediate.synthPeaks.includes(0.35)
      && missing.secondImmediate.synthPeaks.includes(0.5) && missing.secondImmediate.synthPeaks.includes(0.35),
    'missing sample keeps both triggering cues immediate', JSON.stringify(missing));
  check(missing.secondImmediate.fetches.length === 1 && missing.secondImmediate.decodes === 0
      && missing.secondImmediate.starts === 0,
    'missing sample caches unavailable and is not fetched twice', JSON.stringify(missing.secondImmediate));

  const decode = by['decode-falls-back-and-names-url'];
  check(decode.firstImmediate.synthPeaks.includes(0.4)
      && decode.secondImmediate.synthPeaks.includes(0.4) && decode.secondImmediate.starts === 0,
    'decode failure keeps both triggering cues immediate', JSON.stringify(decode));
  check(decode.secondImmediate.fetches.length === 1 && decode.secondImmediate.decodes === 1,
    'decode failure caches unavailable and is not fetched or decoded twice', JSON.stringify(decode.secondImmediate));
  check(decode.afterWarm.logs.some((line) => line.includes(decode.convention)),
    'decode failure diagnostic names the exact resolved URL', JSON.stringify(decode.afterWarm.logs));

  const override = by['manifest-override'];
  check(override.firstImmediate.fetches.length === 1 && override.firstImmediate.fetches[0] === override.manifest
      && override.firstImmediate.synthPeaks.includes(0.3)
      && override.secondImmediate.starts === 1 && override.secondImmediate.synthPeaks.length === 0,
    'manifest row remains an explicit override', JSON.stringify(override));

  const inline = by['standalone-inlined-asset'];
  check(inline.firstImmediate.fetches.length === 1 && inline.firstImmediate.fetches[0] === inline.inlined
      && inline.firstImmediate.synthPeaks.includes(0.3)
      && inline.secondImmediate.starts === 1 && inline.secondImmediate.synthPeaks.length === 0,
    'assetUrl warms standalone data URI, then cached sample suppresses synth', JSON.stringify(inline));
}

function copyBundleInputs(to) {
  for (const name of ['index.html', 'buildordinal.json', 'src', 'styles', 'assets', 'tools']) {
    const from = resolve(ROOT, name);
    if (existsSync(from)) cpSync(from, resolve(to, name), { recursive: true });
  }
}

function forceCrLfTree(path) {
  const textExtensions = new Set(['.css', '.csv', '.html', '.js', '.json', '.md', '.mjs']);
  const visit = (entry) => {
    for (const item of readdirSync(entry, { withFileTypes: true })) {
      const absolute = resolve(entry, item.name);
      if (item.isDirectory()) visit(absolute);
      else if (textExtensions.has(item.name.slice(item.name.lastIndexOf('.')))) {
        const text = readFileSync(absolute, 'utf8').replace(/\r?\n/g, '\n');
        writeFileSync(absolute, text.replace(/\n/g, '\r\n'), 'utf8');
      }
    }
  };
  visit(path);
}

function forceLfTree(path) {
  const visit = (entry) => {
    for (const item of readdirSync(entry, { withFileTypes: true })) {
      const absolute = resolve(entry, item.name);
      if (item.isDirectory()) visit(absolute);
      else {
        const text = readFileSync(absolute, 'utf8').replace(/\r\n?/g, '\n');
        writeFileSync(absolute, text, 'utf8');
      }
    }
  };
  visit(path);
}

function copyBasisInputs(to) {
  for (const path of SOURCE_BASIS_PATHS) {
    const target = resolve(to, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(resolve(ROOT, path), target);
  }
}

function sourceBasisSelftest() {
  let bad = 0;
  const lfDir = mkdtempSync(join(tmpdir(), 'sfx-basis-lf-'));
  const crlfDir = mkdtempSync(join(tmpdir(), 'sfx-basis-crlf-'));
  try {
    copyBasisInputs(lfDir);
    copyBasisInputs(crlfDir);
    forceLfTree(lfDir);
    forceCrLfTree(crlfDir);
    const patch = currentPatchBasis();
    const lfBasis = buildSourceBasis(lfDir, patch);
    const crlfBasis = buildSourceBasis(crlfDir, patch);
    const equal = JSON.stringify(lfBasis.paths) === JSON.stringify(crlfBasis.paths);
    check(equal, 'canonical source basis is identical for LF and forced-CRLF worktrees');
    if (!equal) bad++;

    const fixture = {
      sourceBasis: lfBasis,
      artifact: null,
      report,
      checks: checks.filter((row) => RUNTIME_LABELS.includes(row.label)),
      failures: [],
      plantFailures: 0,
    };
    const cleanErrors = verifyReceiptData(fixture, crlfDir);
    check(cleanErrors.length === 0, 'forced-CRLF receipt verifier accepts the canonical LF basis',
      cleanErrors.join('; '));
    if (cleanErrors.length) bad++;

    const stale = JSON.parse(JSON.stringify(fixture));
    stale.sourceBasis.paths[0].lfSha256 = '0'.repeat(64);
    const staleErrors = verifyReceiptData(stale, crlfDir);
    const staleHeld = staleErrors.some((error) => error.startsWith('LF SHA256 mismatch:'));
    check(staleHeld, 'stale source-basis plant is killed by the receipt verifier');
    if (!staleHeld) bad++;

    const rawErrors = verifyReceiptData(fixture, crlfDir, true);
    const rawHeld = rawErrors.some((error) => /mismatch:/.test(error));
    check(rawHeld, 'raw worktree-EOL identity plant is killed under forced CRLF');
    if (!rawHeld) bad++;
  } finally {
    rmSync(lfDir, { recursive: true, force: true });
    rmSync(crlfDir, { recursive: true, force: true });
  }
  return bad;
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
      name: 'stalled warm delays the procedural cue',
      from: '    synthSfx(id);',
      to: '    // PLANT: triggering synth removed.',
    },
    {
      name: 'known-good sample no longer suppresses later synth',
      from: '    if (playCachedSample(sample, sfxBus)) return;',
      to: '    playCachedSample(sample, sfxBus);',
    },
    {
      name: 'pending and unavailable samples are fetched again',
      from: '    if (state.sampleCache.has(url)) return;',
      to: '    state.sampleCache.delete(url);',
    },
    {
      name: 'decoded sample never becomes ready',
      from: "        entry.status = 'ready';",
      to: "        entry.status = 'unavailable';",
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

  if (!args.includes('--skip-eol-selftest')) {
    const crlfDir = mkdtempSync(join(tmpdir(), 'sfx-convention-crlf-'));
    try {
      copyBundleInputs(crlfDir);
      forceCrLfTree(crlfDir);
      const crlfTool = resolve(crlfDir, 'tools/sfx-filename-convention.mjs');
      const control = spawnSync(process.execPath, [crlfTool, '--selftest', '--skip-eol-selftest'], {
        cwd: crlfDir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
      });
      const controlHeld = control.status === 0 && /SFX FILENAME CONVENTION OK/.test(control.stdout || '');
      check(controlHeld, 'forced-CRLF source and selected-standalone controls stay green',
        `exit ${control.status}`);
      if (!controlHeld) bad++;

      const toolText = readFileSync(crlfTool, 'utf8');
      const currentAnchor = "      from: '    synth" + "Sfx(id);',";
      const staleAnchor = "      from: '    synthSfx(id);\\n    warmSample(sample);',";
      const anchorAt = toolText.indexOf(currentAnchor);
      if (anchorAt < 0 || toolText.indexOf(currentAnchor, anchorAt + 1) >= 0) {
        check(false, 'stale-LF-only anchor plant has one tool home'); bad++;
      } else {
        writeFileSync(crlfTool,
          toolText.slice(0, anchorAt) + staleAnchor + toolText.slice(anchorAt + currentAnchor.length), 'utf8');
        const stale = spawnSync(process.execPath, [crlfTool, '--selftest', '--skip-eol-selftest'], {
          cwd: crlfDir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
        });
        const staleOut = `${stale.stdout || ''}\n${stale.stderr || ''}`;
        const staleHeld = stale.status === 1
          && /plant aim is exact: stalled warm delays the procedural cue/.test(staleOut);
        check(staleHeld, 'stale LF-only multiline anchor plant is killed under forced CRLF',
          `exit ${stale.status}`);
        if (!staleHeld) bad++;
      }
    } finally { rmSync(crlfDir, { recursive: true, force: true }); }
  }
  bad += sourceBasisSelftest();
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
    sourceBasis: buildSourceBasis(),
    artifact, report, checks, failures, plantFailures,
  }, null, 2)}\n`);
  console.log(`  receipt ${absolute}`);
}
const total = failures.length;
console.log(`\nSFX FILENAME CONVENTION ${total ? `FAILED (${total})` : 'OK'}`);
process.exit(total ? 1 : 0);
