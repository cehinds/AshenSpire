// tools/webaudio-stub.mjs — the ONE minimal WebAudio stub the headless audio
// probes share (sfx-gain-probe.mjs, music-silence-probe.mjs). Extracted so the
// stub's hard-won model has one home: it records every value scheduled on a
// GAIN param — both setValueAtTime and exponentialRampToValueAtTime, because
// the engine uses both (tone() ramps up to its peak, noise() sets its peak
// directly and ramps down; the sfx probe's first run missed all four noise
// layers by assuming ramps only, and mixed frequency targets into the pool —
// both wrong models, caught by watching it fail). Frequency params record
// nothing, so a freq can never alibi a gain.
//
// install() MUST run before importing ../src/ui/audio.js — the engine reads
// window.AudioContext at init. Returns the live gainTargets array; truncate it
// (`gainTargets.length = 0`) between probes.

export function installWebAudioStub() {
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

  return gainTargets;
}
