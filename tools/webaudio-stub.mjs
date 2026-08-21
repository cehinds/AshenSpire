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
//
// ---- THE GRAPH HALF (#48) --------------------------------------------------
// A flat list of scheduled numbers cannot see a ROUTE, and #48 is a route
// defect: the external track was connected to the bus with no gain stage at
// all, so there was no number anywhere for the old model to be wrong about.
// A probe reading only `gainTargets` reports the same thing whether the mix
// table reaches the asset path or not — which is why nothing in this tree
// could witness the defect Vega measured by hand.
//
// So `connect()` now RECORDS its edge (and still returns its argument, so the
// engine's `a.connect(b).connect(c)` chains are untouched), every scheduled
// value also lands in a second registry that remembers WHICH NODE it was
// scheduled on, and the stub answers `new Audio(url)` +
// `createMediaElementSource(el)` so the external path can be walked at all.
// `stubGraph()` hands a probe the live registry. All of it is additive: the
// `gainTargets` array behaves exactly as it did, which sfx-gain-probe and
// music-silence-probe re-verify by running unchanged.

let current = null;

/** The live graph registry from the most recent install (see the block above). */
export function stubGraph() { return current; }

export function installWebAudioStub() {
  const gainTargets = [];
  const nodes = [];
  const scheduled = []; // { node, value } — the same numbers, with their owner
  const elements = []; // every `new Audio(url)` the engine made

  class FakeParam {
    constructor(record, node) { this.value = 0; this.record = record; this.node = node; }
    setValueAtTime(v) {
      this.value = v;
      if (this.record) { gainTargets.push(v); scheduled.push({ node: this.node, value: v }); }
    }
    exponentialRampToValueAtTime(v) {
      if (this.record) { gainTargets.push(v); scheduled.push({ node: this.node, value: v }); }
    }
    cancelScheduledValues() {}
  }
  class FakeNode {
    constructor(kind = 'node') {
      this.kind = kind;
      this.outs = [];
      this.gain = new FakeParam(true, this);
      this.frequency = new FakeParam(false, this);
      nodes.push(this);
    }
    connect(n) { this.outs.push(n); return n; }
    disconnect() { this.outs.length = 0; }
    start() {}
    stop() {}
  }
  class FakeAudio {
    constructor(url) { this.src = url; this.outs = []; this.handlers = new Map(); elements.push(this); }
    // THE LISTENERS ARE KEPT SO A PROBE CAN FIRE THEM (#296 review). A stub that
    // swallows addEventListener cannot reach any code path behind an event, and
    // the playlist advance — a track ending and the next one starting — lives
    // entirely behind 'ended'. That path leaked a gain node per track and no
    // instrument could get to it, because the door was welded shut here.
    addEventListener(type, fn) {
      if (!this.handlers.has(type)) this.handlers.set(type, []);
      this.handlers.get(type).push(fn);
    }
    fire(type) { for (const fn of this.handlers.get(type) || []) fn(); }
    play() { return Promise.resolve(); }
    pause() {}
  }
  class FakeCtx {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.destination = new FakeNode('destination'); }
    createGain() { return new FakeNode('gain'); }
    createOscillator() { return new FakeNode('osc'); }
    createBiquadFilter() { return new FakeNode('filter'); }
    createBufferSource() { return new FakeNode('buffersource'); }
    createBuffer(ch, frames) { return { getChannelData: () => new Float32Array(frames) }; }
    createMediaElementSource(el) {
      const n = new FakeNode('mediasource');
      n.mediaElement = el;
      if (el) el.source = n;
      return n;
    }
    resume() {}
  }

  globalThis.window = { AudioContext: FakeCtx };
  globalThis.addEventListener = () => {};
  globalThis.Audio = FakeAudio;

  current = { nodes, scheduled, elements, gainTargets, reset() { gainTargets.length = 0; scheduled.length = 0; elements.length = 0; } };
  return gainTargets;
}
