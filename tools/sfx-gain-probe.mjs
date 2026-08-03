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
  for (const [i, layer] of SFX_RECIPES[id].entries()) {
    layersChecked++;
    let want = layer.peak !== undefined ? layer.peak : DEFAULT_PEAK[layer.kind];
    // --selftest: claim one known-false target so the probe is SEEN red.
    if (selftest && id === 'hit' && i === 0) want = 0.987654;
    if (!gainTargets.includes(want)) {
      misses++;
      console.error(`MISS  sfx.${id}[${i}]: peak ${want} never reached a gain node (targets seen: ${[...new Set(gainTargets)].join(', ')})`);
    }
  }
}

if (selftest) {
  if (misses === 1) {
    console.log(`RESULT: selftest held — the planted false peak was the one miss in ${layersChecked} layers, so a table/engine disagreement goes red here.`);
    process.exit(0);
  }
  console.error(`RESULT: selftest FAILED — expected exactly 1 planted miss, saw ${misses}; this probe cannot be trusted either way.`);
  process.exit(1);
}

if (misses === 0) {
  console.log(`RESULT: every peak in the table reached a live gain node — ${layersChecked} layers across ${Object.keys(SFX_RECIPES).length} recipes; a table edit IS the emitted gain. (Reachability only — nothing here has ears.)`);
  process.exit(0);
}
console.error(`RESULT: ${misses} of ${layersChecked} layers never reached a gain node — the table is not the sound; see MISS lines above.`);
process.exit(1);
