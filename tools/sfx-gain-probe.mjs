#!/usr/bin/env node
// tools/sfx-gain-probe.mjs — headless gain-target inspection for the SFX
// recipes (#46). Proves the tuning path Constantine was promised: the value a
// recipe carries in src/content/sfx.js is the value the engine schedules on a
// live gain node — no copy, no clamp, no code in between (Law 1 clause 3).
//
// How: stub just enough WebAudio for initAudio() to run under Node, play each
// recipe id through the real engine, record every value scheduled on a gain
// param, and check each layer's peak (or its default) appears among them.
// Nothing here has ears — this is reachability of the number, not quality of
// the sound.
//
// Usage:   node tools/sfx-gain-probe.mjs             # probe all recipes
//          node tools/sfx-gain-probe.mjs --selftest  # known-bad: prove the
//            probe goes red when a table value and the engine disagree (the
//            instrument rule: a check nobody has watched fail is not green).
//
// THE DOORS, FOUR OF THEM, AND TWO ARE DOWNSTREAM ON PURPOSE. Vira's doors
// audit (2026-08-14) called this probe "DOWNSTREAM by declared choice, honestly
// scoped": classes 1 and 2 below enter at the COMPARATOR — the expectation and
// the measured pool — never at the recipe. For the defect they were written
// against that is the right door, because the defect WAS in the comparator
// (the `includes` alibi, her #46 finding). But her sentence continued: "the
// recipe-drop class has no plant." She was right, and class 3 is that plant.
//
//   class 1  false expectation   in-process; `want` is set to a known-false
//                                value. Door: the comparator.
//   class 2  dropped duplicate   in-process; one occurrence removed from the
//                                measured pool. Door: the comparator.
//   class 3  A CLAMP IN THE ENGINE   the real door. A disposable copy of this
//                                tree gets ONE REAL EDIT to src/ui/audio.js —
//                                a clamp between the recipe's number and the
//                                gain node — and THIS PROBE IS RE-RUN INSIDE
//                                THE COPY, so its own `../src/ui/audio.js`
//                                import resolves to the planted engine. Every
//                                stage the real probe performs runs.
//                                This is the class the header's own claim is
//                                about — "no copy, no clamp, no code in
//                                between" — and until now nothing had ever
//                                watched it fail.
//   class 4  synchronous inspection   a disposable copy replaces the real
//                                async settle with an already-resolved promise.
//                                Door: the sample-or-synth decision introduced
//                                by the filename convention. Every empty gain
//                                pool must go red, never pass as a quiet recipe.
//
// Exit 0 = every recipe's peaks reached the gain nodes; 1 = any miss.
// REMOVAL CONDITION: delete this probe when the synth SFX layer is removed in
// favour of samples (#46's own removal condition) — a sample's gain is the
// file's, and there is no recipe table left to inspect.

// ---- minimal WebAudio stub -------------------------------------------------
// One home for the stub and its hard-won model (why BOTH scheduling calls
// record, why frequency params record nothing): tools/webaudio-stub.mjs.
const { installWebAudioStub } = await import('./webaudio-stub.mjs');
const gainTargets = installWebAudioStub();

// The filename convention deliberately decides between a sample and its synth
// fallback asynchronously. Make the miss deterministic, then wait until that
// decision settles before inspecting the scheduled gains. The fetch timer is
// registered first; the settle timer runs after its callback and microtasks.
globalThis.fetch = () => new Promise((done) => setTimeout(() => done({ ok: false, status: 404 }), 0));
const settleAudioDecision = () => new Promise((done) => setTimeout(done, 0));

const { initAudio } = await import('../src/ui/audio.js');
const { SFX_RECIPES } = await import('../src/content/sfx.js');

const selftest = process.argv.includes('--selftest');

// Engine defaults for a layer that omits peak (ui/audio.js tone()/noise()).
const DEFAULT_PEAK = { tone: 0.6, noise: 0.5 };

const engine = initAudio({ musicVolume: 50, sfxVolume: 50, muteAudio: false });
if (!engine.isReal) {
  console.error('RESULT: probe broken — initAudio fell back to the silent engine, nothing was inspected.');
  process.exit(1);
}

let misses = 0;
let layersChecked = 0;
for (const id of Object.keys(SFX_RECIPES)) {
  gainTargets.length = 0;
  engine.sfx(id);
  await settleAudioDecision();
  // MULTISET, not membership: each expected peak CONSUMES one occurrence from
  // the pool. Vira's gate finding on #46: with `includes`, victory's four
  // identical 0.32 peaks were alibied by any one of them — she planted a
  // dropped third note and the probe stayed green. Counting closes it: four
  // expected 0.32s now require four scheduled 0.32s.
  const pool = [...gainTargets];
  // --selftest, planted class 2: simulate victory's dropped note by removing
  // one of its duplicate peaks from the pool — under `includes` this stayed
  // green, so this plant is the regression test for the multiset itself.
  if (selftest && id === 'victory') pool.splice(pool.indexOf(0.32), 1);
  for (const [i, layer] of SFX_RECIPES[id].entries()) {
    layersChecked++;
    let want = layer.peak !== undefined ? layer.peak : DEFAULT_PEAK[layer.kind];
    // --selftest, planted class 1: claim one known-false target.
    if (selftest && id === 'hit' && i === 0) want = 0.987654;
    const at = pool.indexOf(want);
    if (at === -1) {
      misses++;
      console.error(`MISS  sfx.${id}[${i}]: peak ${want} not among the remaining gain targets (scheduled this recipe: ${[...new Set(gainTargets)].join(', ')})`);
    } else {
      pool.splice(at, 1);
    }
  }
}

// Prototype-safety of the engine's own lookups (Vira's gate finding on #46):
// 'toString' is an inherited key on any plain object, so a bare [id] read
// found a function and THREW where the old switch's default beeped. Both an
// unknown id and an inherited key must play the table's audible `default`.
const DEFAULT_LAYER_PEAK = SFX_RECIPES.default[0].peak;
for (const probe of ['noSuchSound', 'toString']) {
  gainTargets.length = 0;
  try {
    engine.sfx(probe);
    await settleAudioDecision();
  } catch (e) {
    misses++;
    console.error(`MISS  sfx('${probe}') threw instead of playing default: ${e.message}`);
    continue;
  }
  if (!gainTargets.includes(DEFAULT_LAYER_PEAK)) {
    misses++;
    console.error(`MISS  sfx('${probe}') did not schedule default's peak ${DEFAULT_LAYER_PEAK} (targets seen: ${[...new Set(gainTargets)].join(', ')})`);
  }
}

if (selftest) {
  if (misses !== 2) {
    console.error(`RESULT: selftest FAILED — expected exactly the 2 planted comparator misses, saw ${misses}; this probe cannot be trusted either way.`);
    process.exit(1);
  }
  console.log(`  classes 1+2 held — both comparator plants (false peak, dropped duplicate note) were the only 2 misses in ${layersChecked} layers.`);
  console.log('    DOOR, stated: these two enter at the COMPARATOR (the expectation, the measured');
  console.log('    pool) — NOT at the recipe. That is the right door for the defect they were');
  console.log('    written against (the `includes` alibi lived in the comparator), and it is the');
  console.log('    wrong door for the claim in this file\'s header. Class 3 is that door.');

  // ---- class 3: the recipe door ------------------------------------------
  const { spawnSync } = await import('node:child_process');
  const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } = await import('node:fs');
  const { resolve, join, dirname } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { fileURLToPath } = await import('node:url');

  const HERE = dirname(fileURLToPath(import.meta.url));
  const TREE = resolve(HERE, '..');
  // A clamp between the recipe's number and the gain node. This is the whole
  // defect class: a value that gets QUIETLY BOUNDED on its way to the node
  // still ships a table nobody can tune. 0.4 is chosen to catch the loud end
  // of the real table (peaks run 0.1 - 0.5) and leave the rest alone, so the
  // red names recipes rather than painting everything.
  const FROM = '    g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.3));';
  const TO = '    g.gain.exponentialRampToValueAtTime(Math.min(peak, 0.4), start + Math.min(0.02, dur * 0.3));';

  const dir = mkdtempSync(join(tmpdir(), 'sfx-gain-kb-'));
  for (const d of ['src', 'tools']) {
    if (existsSync(resolve(TREE, d))) cpSync(resolve(TREE, d), resolve(dir, d), { recursive: true });
  }
  const enginePath = resolve(dir, 'src/ui/audio.js');
  const engineSrc = readFileSync(enginePath, 'utf8');
  const first = engineSrc.indexOf(FROM);
  if (first < 0 || engineSrc.indexOf(FROM, first + 1) >= 0) {
    console.error(`RESULT: selftest FAILED — class 3's plant found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in src/ui/audio.js.`);
    console.error('  The tone gain line moved. RE-AIM the plant at wherever a recipe peak now reaches');
    console.error('  a gain node; do not delete it. A corpus that silently stops matching is exactly');
    console.error('  the eleven-instruments shape (development.md, the instrument rule).');
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ }
    process.exit(1);
  }
  writeFileSync(enginePath, engineSrc.slice(0, first) + TO + engineSrc.slice(first + FROM.length), 'utf8');

  const r = spawnSync(process.execPath, [resolve(dir, 'tools/sfx-gain-probe.mjs')], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const missLines = out.split('\n').filter((l) => /^MISS /.test(l));
  const clean = spawnSync(process.execPath, [resolve(TREE, 'tools/sfx-gain-probe.mjs')], { encoding: 'utf8' });

  console.log('\n  class 3 — THE RECIPE DOOR: a clamp planted in src/ui/audio.js of a disposable copy,');
  console.log('    this probe re-run INSIDE that copy so its own engine import resolves to the plant.');
  console.log(`    control (this tree, unplanted): exit ${clean.status} — or a red below proves only that copying breaks it`);
  console.log(`    planted:                        exit ${r.status}, ${missLines.length} MISS line(s)`);
  for (const l of missLines.slice(0, 4)) console.log(`    red | ${l}`);
  if (missLines.length > 4) console.log(`    red | ... and ${missLines.length - 4} more`);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* tmp */ }

  const held = clean.status === 0 && r.status === 1 && missLines.length > 0;
  if (!held) {
    console.error('RESULT: selftest FAILED — class 3 did not go red through the recipe door. A clamp');
    console.error('  between the table and the node is the exact defect this probe claims to catch,');
    console.error('  and it did not catch it. Treat every green from this tool as unknown.');
    process.exit(1);
  }
  // ---- class 4: the async-decision door ---------------------------------
  // If this probe stops waiting for the convention fetch/decode decision, it
  // races every fallback and prints a clean-looking empty gain pool. Plant the
  // old synchronous assumption in a disposable copy and require that red.
  const SETTLE_FROM = 'const settleAudio' + 'Decision = () => new Promise((done) => setTimeout(done, 0));';
  const SETTLE_TO = 'const settleAudioDecision = () => Promise.resolve();';
  const syncDir = mkdtempSync(join(tmpdir(), 'sfx-gain-sync-kb-'));
  for (const d of ['src', 'tools']) {
    if (existsSync(resolve(TREE, d))) cpSync(resolve(TREE, d), resolve(syncDir, d), { recursive: true });
  }
  const syncTool = resolve(syncDir, 'tools/sfx-gain-probe.mjs');
  const syncSrc = readFileSync(syncTool, 'utf8');
  const syncAt = syncSrc.indexOf(SETTLE_FROM);
  if (syncAt < 0 || syncSrc.indexOf(SETTLE_FROM, syncAt + 1) >= 0) {
    console.error(`RESULT: selftest FAILED — class 4's async-decision plant found ${syncAt < 0 ? 'NO' : 'MORE THAN ONE'} home.`);
    try { rmSync(syncDir, { recursive: true, force: true }); } catch { /* tmp */ }
    process.exit(1);
  }
  writeFileSync(syncTool, syncSrc.slice(0, syncAt) + SETTLE_TO + syncSrc.slice(syncAt + SETTLE_FROM.length), 'utf8');
  const syncRun = spawnSync(process.execPath, [syncTool], { encoding: 'utf8' });
  const syncOut = (syncRun.stdout || '') + (syncRun.stderr || '');
  const syncMisses = syncOut.split('\n').filter((line) => /^MISS /.test(line));
  try { rmSync(syncDir, { recursive: true, force: true }); } catch { /* tmp */ }
  if (syncRun.status !== 1 || syncMisses.length === 0) {
    console.error('RESULT: selftest FAILED — class 4 did not catch the old synchronous inspection race.');
    process.exit(1);
  }
  console.log('\n  class 4 — THE ASYNC-DECISION DOOR: replacing the real settle with an already-resolved');
  console.log(`    promise exited ${syncRun.status} with ${syncMisses.length} MISS line(s).`);

  console.log('\nRESULT: selftest held — comparator plants red (classes 1+2, downstream and SAID SO),');
  console.log('  a clamp planted in the real engine goes red through the real door (class 3),');
  console.log('  and the old synchronous inspection race goes red (class 4).');
  console.log('  Boundary: the noise() path carries no plant of its own — class 3 clamps tone() only.');
  process.exit(0);
}

if (misses === 0) {
  console.log(`RESULT: every peak in the table reached a live gain node, counted not just found — ${layersChecked} layers across ${Object.keys(SFX_RECIPES).length} recipes, and unknown/inherited ids play default. (Reachability only — nothing here has ears.)`);
  process.exit(0);
}
console.error(`RESULT: ${misses} misses across ${layersChecked} layers + 2 fallback probes — the table is not the sound; see MISS lines above.`);
process.exit(1);
