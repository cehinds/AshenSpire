#!/usr/bin/env node

// Drives the production external-track door: configureMusic reads a real
// manifest response, music chooses the shipped rest bed, Audio is created, and
// the MediaElementSource graph must carry both authored bed gain and the user's
// music-volume setting as separate gain nodes.

const nodes = [];
class Param {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  constructor(kind) {
    this.kind = kind;
    this.gain = new Param();
    this.frequency = new Param();
    this.connections = [];
    nodes.push(this);
  }
  connect(target) { this.connections.push(target); return target; }
  start() {}
  stop() {}
}
class Context {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = 'running';
    this.destination = new Node('destination');
  }
  createGain() { return new Node('gain'); }
  createOscillator() { return new Node('oscillator'); }
  createBiquadFilter() { return new Node('filter'); }
  createBufferSource() { return new Node('buffer'); }
  createBuffer(_channels, frames) { return { getChannelData: () => new Float32Array(frames) }; }
  createMediaElementSource() { return new Node('media'); }
  resume() {}
}
class AudioElement {
  constructor(url) { this.url = url; this.listeners = new Map(); }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  play() { return Promise.resolve(); }
  pause() {}
}

globalThis.window = { AudioContext: Context };
globalThis.addEventListener = () => {};
globalThis.Audio = AudioElement;
globalThis.fetch = async (url) => ({
  ok: true,
  async json() { return { rest: ['rest.ogg'], boss: ['boss.ogg'], probeQuiet: ['quiet-override.ogg'] }; },
  url,
});

const { BEDS } = await import('../src/content/music.js');
const { MUSIC_SILENCE_WORD } = await import('../src/model/schemas.js');
// The shipped table currently has no quiet context despite documenting the
// vocabulary. Add one to the live content table before audio.js derives its
// accepted manifest contexts, then drive the same override rule.
BEDS.probeQuiet = MUSIC_SILENCE_WORD;
const { initAudio } = await import('../src/ui/audio.js');

const userVolume = 60;
const engine = initAudio({ musicVolume: userVolume, sfxVolume: 50, muteAudio: false });
await engine.configureMusic({ folder: 'https://music.example' });
const failures = [];
function checkExternal(context, expectedBedGain) {
  const before = nodes.filter((node) => node.kind === 'media').length;
  const disposition = engine.music(context);
  const media = nodes.filter((node) => node.kind === 'media')[before];
  const first = media && media.connections[0];
  const second = first && first.connections[0];
  if (disposition !== 'external') failures.push(`music('${context}') reported ${disposition}, not external`);
  if (!media) failures.push(`${context}: no MediaElementSource was created`);
  if (!first || first.kind !== 'gain') failures.push(`${context}: external source first connected to ${first && first.kind}, not its bed-gain node`);
  if (first && first.gain.value !== expectedBedGain) failures.push(`${context}: external bed gain was ${first.gain.value}, expected ${expectedBedGain}`);
  if (!second || second.kind !== 'gain') failures.push(`${context}: bed-gain node connected to ${second && second.kind}, not the music-volume bus`);
  if (second && second.gain.value !== userVolume / 100) failures.push(`${context}: music-volume bus was ${second.gain.value}, expected ${userVolume / 100}`);
}

checkExternal('rest', BEDS.rest.gain);
checkExternal('boss', BEDS.boss.gain);
// A user-supplied track is the explicit override for shipped deliberate
// silence. That string has no numeric gain, so its external stage is unity.
checkExternal('probeQuiet', 1);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(`PASS external tracks carry rest gain ${BEDS.rest.gain}, boss gain ${BEDS.boss.gain}, and deliberate-silence override gain 1, then user music volume ${userVolume / 100}, through the production configureMusic -> music -> Audio graph.`);
