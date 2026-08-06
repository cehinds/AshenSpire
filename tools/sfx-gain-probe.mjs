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
// Exit 0 = every recipe's peaks reached the gain nodes; 1 = any miss.
// REMOVAL CONDITION: delete this probe when the synth SFX layer is removed in
// favour of samples (#46's own removal condition) — a sample's gain is the
// file's, and there is no recipe table left to inspect.

// ---- minimal WebAudio stub -------------------------------------------------
// Records every value scheduled on a GAIN param — both setValueAtTime and
// exponentialRampToValueAtTime, because the engine uses both: tone() ramps up
// to its peak, noise() sets its peak directly and ramps down. (The probe's own
// first run missed all four noise layers by assuming ramps only, and mixed
// frequency targets into the pool — both wrong models, caught by watching it
// fail. Frequency params record nothing here so a freq can never alibi a peak.)
const gainTargets = [];

class FakeParam {
  constructor(record) { this.value = 0; this.record = record; }
  setValueAtTime(v) { this.value = v; if (this.record) gainTargets.push(v); }
  exponentialRampToValueAtTime(v) { if (this.record) gainTargets.push(v); }
  cancelScheduledValues() {}
}
class FakeNode {
  constructor() { this.gain = new FakeParam(true); this.frequency = new FakeParam(false); }
  connect(n) { return n; }
  start() {}
  stop() {}
}
class FakeCtx {
  constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = new FakeNode(); }
  createGain() { return new FakeNode(); }
  createOscillator() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer(ch, frames) { return { getChannelData: () => new Float32Array(frames) }; }
  resume() {}
}

globalThis.window = { AudioContext: FakeCtx };
globalThis.addEventListener = () => {};

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
  if (misses === 2) {
    console.log(`RESULT: selftest held — both plants (false peak, dropped duplicate note) were the only 2 misses in ${layersChecked} layers, so a disagreement and a dropped-note-behind-a-duplicate both go red here.`);
    process.exit(0);
  }
  console.error(`RESULT: selftest FAILED — expected exactly the 2 planted misses, saw ${misses}; this probe cannot be trusted either way.`);
  process.exit(1);
}

if (misses === 0) {
  console.log(`RESULT: every peak in the table reached a live gain node, counted not just found — ${layersChecked} layers across ${Object.keys(SFX_RECIPES).length} recipes, and unknown/inherited ids play default. (Reachability only — nothing here has ears.)`);
  process.exit(0);
}
console.error(`RESULT: ${misses} misses across ${layersChecked} layers + 2 fallback probes — the table is not the sound; see MISS lines above.`);
process.exit(1);
