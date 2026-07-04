// src/ui/audio.js — procedural WebAudio engine (SPEC §7.4 audio).
//
// Hybrid design (per product decision): every sound and music bed is SYNTHESIZED
// in code today (zero assets, zero licensing), but each id also has a slot in a
// manifest so a real .ogg/.mp3 can replace it later with no call-site change —
// if `MANIFEST[id]` names a URL that loads, the sample plays instead of the synth.
//
// Wiring: `initAudio()` returns an engine; main.js sets `sfx.sink = engine.sfx`
// and calls `engine.music(context)` as screens mount. The AudioContext starts
// suspended (autoplay policy) and resumes on the first user gesture.

// A real build can point these at files; missing/failed loads fall back to synth.
const SFX_MANIFEST = {
  // cardPlay: 'assets/sfx/card.ogg',  ← example: drop a file here to override
};
const MUSIC_MANIFEST = {
  // combat: 'assets/music/combat.ogg',
};

// Minor / phrygian-ish scales (semitone offsets from the root) per mood.
const SCALES = {
  calm: [0, 3, 5, 7, 10, 12, 15],
  tense: [0, 1, 5, 6, 7, 10, 12],
  dread: [0, 2, 3, 7, 8, 10, 12],
};

// Music beds: root frequency, scale, note cadence (ms), and a low drone.
const BEDS = {
  title: { root: 146.83, scale: 'calm', cadence: 2600, drone: true, gain: 0.5 },
  map: { root: 164.81, scale: 'calm', cadence: 2200, drone: true, gain: 0.42 },
  combat: { root: 130.81, scale: 'tense', cadence: 1500, drone: true, gain: 0.5 },
  elite: { root: 110.0, scale: 'tense', cadence: 1150, drone: true, gain: 0.55 },
  boss: { root: 98.0, scale: 'dread', cadence: 1000, drone: true, gain: 0.6 },
  victory: { root: 196.0, scale: 'calm', cadence: 1400, drone: false, gain: 0.5 },
};

export function initAudio(settings = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return silentEngine();

  const ctx = new Ctx();
  const master = ctx.createGain();
  const musicBus = ctx.createGain();
  const sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  master.connect(ctx.destination);

  const state = {
    musicVol: clampVol(settings.musicVolume, 55),
    sfxVol: clampVol(settings.sfxVolume, 75),
    muted: settings.muteAudio === true,
    context: null, // current music bed key
    nodes: [], // live music nodes to tear down on switch
    timer: null,
    sampleCache: new Map(),
  };
  applyGains();

  function applyGains() {
    const m = state.muted ? 0 : 1;
    master.gain.value = 0.9 * m;
    musicBus.gain.value = state.musicVol / 100;
    sfxBus.gain.value = state.sfxVol / 100;
  }

  // The context begins suspended; the first gesture resumes it.
  function resume() {
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown'].forEach((ev) =>
    addEventListener(ev, resume, { once: false, capture: true })
  );

  // ---- SFX -----------------------------------------------------------------
  function sfx(id) {
    if (state.muted || state.sfxVol <= 0) return;
    resume();
    if (SFX_MANIFEST[id]) {
      playSample(SFX_MANIFEST[id], sfxBus);
      return;
    }
    synthSfx(id);
  }

  const now = () => ctx.currentTime;

  function tone({ type = 'sine', freq, to, t0 = 0, dur, peak = 0.6, bus = sfxBus }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    const start = now() + t0;
    o.frequency.setValueAtTime(freq, start);
    if (to != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(bus);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  function noise({ dur, peak = 0.5, t0 = 0, hp = 400, lp = 6000, bus = sfxBus }) {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hpF = ctx.createBiquadFilter();
    hpF.type = 'highpass';
    hpF.frequency.value = hp;
    const lpF = ctx.createBiquadFilter();
    lpF.type = 'lowpass';
    lpF.frequency.value = lp;
    const g = ctx.createGain();
    const start = now() + t0;
    g.gain.setValueAtTime(peak, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(hpF).connect(lpF).connect(g).connect(bus);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  // One recipe per feedback hook. Kept short and characterful (dark fantasy).
  function synthSfx(id) {
    switch (id) {
      case 'cardPlay':
        tone({ type: 'triangle', freq: 520, to: 380, dur: 0.12, peak: 0.35 });
        break;
      case 'hit':
        noise({ dur: 0.16, peak: 0.5, hp: 300, lp: 4200 });
        tone({ type: 'square', freq: 150, to: 60, dur: 0.14, peak: 0.35 });
        break;
      case 'block':
        tone({ type: 'sine', freq: 320, to: 520, dur: 0.14, peak: 0.4 });
        noise({ dur: 0.08, peak: 0.2, hp: 2000 });
        break;
      case 'bleedBurst':
        tone({ type: 'sawtooth', freq: 220, to: 70, dur: 0.5, peak: 0.5 });
        noise({ dur: 0.4, peak: 0.35, hp: 200, lp: 2600 });
        break;
      case 'stagger':
        tone({ type: 'square', freq: 90, to: 40, dur: 0.35, peak: 0.5 });
        noise({ dur: 0.22, peak: 0.4, hp: 120, lp: 1800 });
        break;
      case 'enemyDeath':
        tone({ type: 'sawtooth', freq: 240, to: 30, dur: 0.6, peak: 0.45 });
        break;
      case 'heal':
        tone({ type: 'sine', freq: 480, to: 720, dur: 0.4, peak: 0.35 });
        tone({ type: 'sine', freq: 720, to: 960, dur: 0.4, peak: 0.2, t0: 0.06 });
        break;
      case 'stance':
        tone({ type: 'triangle', freq: 300, to: 600, dur: 0.3, peak: 0.4 });
        break;
      case 'relic':
        tone({ type: 'sine', freq: 880, to: 1320, dur: 0.25, peak: 0.3 });
        break;
      case 'flask':
        tone({ type: 'sine', freq: 640, to: 400, dur: 0.18, peak: 0.3 });
        break;
      case 'shrine':
        tone({ type: 'sine', freq: 392, to: 588, dur: 0.6, peak: 0.3 });
        break;
      case 'buy':
        tone({ type: 'triangle', freq: 700, to: 1050, dur: 0.16, peak: 0.35 });
        break;
      case 'nodeTravel':
        tone({ type: 'triangle', freq: 300, to: 460, dur: 0.14, peak: 0.3 });
        break;
      case 'uiClick':
        tone({ type: 'square', freq: 420, to: 420, dur: 0.04, peak: 0.18 });
        break;
      case 'victory':
        [392, 494, 587, 784].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.5, peak: 0.32, t0: i * 0.12 }));
        break;
      case 'youDied':
        tone({ type: 'sawtooth', freq: 160, to: 40, dur: 1.2, peak: 0.5 });
        break;
      default:
        tone({ type: 'sine', freq: 440, to: 440, dur: 0.05, peak: 0.15 });
    }
  }

  // ---- Music ---------------------------------------------------------------
  function stopMusic(fade = 0.6) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const t = now();
    for (const n of state.nodes) {
      try {
        n.gain.gain.cancelScheduledValues(t);
        n.gain.gain.setValueAtTime(n.gain.gain.value, t);
        n.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
        n.osc.stop(t + fade + 0.05);
      } catch (e) {
        /* already stopped */
      }
    }
    state.nodes = [];
  }

  function drone(freq, gain) {
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    o.type = 'sawtooth';
    o2.type = 'sawtooth';
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.005; // slight detune = movement
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(gain, now() + 1.5);
    // slow filter LFO for an evolving pad
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 260;
    lfo.connect(lfoG).connect(lp.frequency);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(musicBus);
    o.start();
    o2.start();
    lfo.start();
    state.nodes.push({ osc: o, gain: g }, { osc: o2, gain: g }, { osc: lfo, gain: g });
  }

  function music(context) {
    if (state.context === context) return;
    state.context = context;
    stopMusic();
    const bed = BEDS[context];
    if (!bed || state.muted) return;
    resume();
    // (Sample-based beds would load here from MUSIC_MANIFEST; none ship yet.)
    if (bed.drone) drone(bed.root / 2, 0.12 * bed.gain);
    const scale = SCALES[bed.scale];
    let step = 0;
    const playNote = () => {
      if (state.sfxVol < 0) return;
      const deg = scale[(step * 3 + (step % 2 ? 2 : 0)) % scale.length];
      const oct = step % 4 === 0 ? 2 : 1;
      const freq = bed.root * oct * Math.pow(2, deg / 12);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      const t = now();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16 * bed.gain, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g).connect(musicBus);
      o.start(t);
      o.stop(t + 1.9);
      step++;
    };
    playNote();
    state.timer = setInterval(playNote, bed.cadence);
  }

  // ---- samples (manifest override path) ------------------------------------
  async function loadSample(url) {
    if (state.sampleCache.has(url)) return state.sampleCache.get(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('missing');
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      state.sampleCache.set(url, buf);
      return buf;
    } catch (e) {
      state.sampleCache.set(url, null); // remember the miss; fall back to synth
      return null;
    }
  }
  async function playSample(url, bus) {
    const buf = await loadSample(url);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bus);
    src.start();
  }

  // ---- settings applied live ----------------------------------------------
  function setVolumes({ musicVolume, sfxVolume, muteAudio } = {}) {
    if (musicVolume != null) state.musicVol = clampVol(musicVolume, state.musicVol);
    if (sfxVolume != null) state.sfxVol = clampVol(sfxVolume, state.sfxVol);
    if (muteAudio != null) state.muted = !!muteAudio;
    applyGains();
    if (state.muted) stopMusic(0.3);
    else if (state.context) {
      const c = state.context;
      state.context = null;
      music(c);
    }
  }

  return { sfx, music, stopMusic, setVolumes, resume, isReal: true };
}

function clampVol(v, dflt) {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.max(0, Math.min(100, n));
}

// No-WebAudio fallback: a no-op engine so callers never branch.
function silentEngine() {
  return { sfx() {}, music() {}, stopMusic() {}, setVolumes() {}, resume() {}, isReal: false };
}
