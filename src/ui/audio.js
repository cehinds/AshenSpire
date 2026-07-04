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
  hymn: [0, 2, 4, 7, 9, 12, 16], // warmer major-pentatonic-ish (shop/rest/victory)
  veiled: [0, 3, 5, 6, 10, 12, 15], // dorian-flavored, wistful
  wrath: [0, 1, 4, 5, 8, 11, 12], // jagged, aggressive (elite/boss)
};

// Music beds per context. Each context has a `gain`, a `drone` flag, and a set
// of procedural VARIANTS (root frequency, scale, note cadence in ms) — one is
// picked at random each time the context starts, so the score varies between a
// handful of "tracks" even with zero audio files. Shop and Rest have their own
// calmer sets; Boss/Elite their own darker ones.
// Each variant may also set `wave` (oscillator timbre) and `lift` (melodic
// stride through the scale) so variants differ in colour and contour, not just
// key/tempo — more perceived variety from the same synth.
const BEDS = {
  title: { drone: true, gain: 0.5, variants: [
    { root: 146.83, scale: 'calm', cadence: 2600, wave: 'triangle', lift: 3 },
    { root: 130.81, scale: 'dread', cadence: 3000, wave: 'sine', lift: 2 },
    { root: 164.81, scale: 'calm', cadence: 2400, wave: 'triangle', lift: 4 },
    { root: 155.56, scale: 'veiled', cadence: 2800, wave: 'sine', lift: 3 },
  ] },
  map: { drone: true, gain: 0.42, variants: [
    { root: 164.81, scale: 'calm', cadence: 2200, wave: 'triangle', lift: 3 },
    { root: 155.56, scale: 'calm', cadence: 2500, wave: 'sine', lift: 4 },
    { root: 174.61, scale: 'dread', cadence: 2000, wave: 'triangle', lift: 2 },
    { root: 146.83, scale: 'veiled', cadence: 2350, wave: 'sine', lift: 3 },
  ] },
  combat: { drone: true, gain: 0.5, variants: [
    { root: 130.81, scale: 'tense', cadence: 1500, wave: 'triangle', lift: 3 },
    { root: 123.47, scale: 'dread', cadence: 1300, wave: 'square', lift: 2 },
    { root: 146.83, scale: 'tense', cadence: 1400, wave: 'triangle', lift: 4 },
    { root: 138.59, scale: 'tense', cadence: 1250, wave: 'sawtooth', lift: 3 },
    { root: 130.81, scale: 'veiled', cadence: 1350, wave: 'triangle', lift: 5 },
    { root: 155.56, scale: 'dread', cadence: 1200, wave: 'square', lift: 2 },
  ] },
  elite: { drone: true, gain: 0.55, variants: [
    { root: 110.0, scale: 'tense', cadence: 1150, wave: 'sawtooth', lift: 3 },
    { root: 103.83, scale: 'dread', cadence: 1050, wave: 'square', lift: 2 },
    { root: 116.54, scale: 'wrath', cadence: 1100, wave: 'sawtooth', lift: 4 },
    { root: 98.0, scale: 'wrath', cadence: 1000, wave: 'square', lift: 3 },
  ] },
  boss: { drone: true, gain: 0.6, variants: [
    { root: 98.0, scale: 'dread', cadence: 1000, wave: 'sawtooth', lift: 2 },
    { root: 92.5, scale: 'wrath', cadence: 900, wave: 'square', lift: 3 },
    { root: 87.31, scale: 'wrath', cadence: 950, wave: 'sawtooth', lift: 4 },
    { root: 82.41, scale: 'dread', cadence: 860, wave: 'square', lift: 2 },
    { root: 103.83, scale: 'wrath', cadence: 920, wave: 'sawtooth', lift: 3 },
  ] },
  shop: { drone: true, gain: 0.4, variants: [
    { root: 196.0, scale: 'hymn', cadence: 2200, wave: 'triangle', lift: 3 },
    { root: 174.61, scale: 'calm', cadence: 2000, wave: 'sine', lift: 4 },
    { root: 220.0, scale: 'hymn', cadence: 2400, wave: 'triangle', lift: 2 },
  ] },
  rest: { drone: true, gain: 0.34, variants: [
    { root: 130.81, scale: 'calm', cadence: 3200, wave: 'sine', lift: 3 },
    { root: 146.83, scale: 'hymn', cadence: 3000, wave: 'sine', lift: 2 },
    { root: 123.47, scale: 'veiled', cadence: 3400, wave: 'triangle', lift: 3 },
  ] },
  victory: { drone: false, gain: 0.5, variants: [
    { root: 196.0, scale: 'hymn', cadence: 1400, wave: 'triangle', lift: 3 },
    { root: 220.0, scale: 'hymn', cadence: 1200, wave: 'triangle', lift: 4 },
    { root: 246.94, scale: 'calm', cadence: 1300, wave: 'sine', lift: 2 },
  ] },
};

// Contexts that can be backed by external audio files. A manifest maps each to
// a list of file paths (see configureMusic); missing/failed loads fall back to
// the procedural bed above.
const MUSIC_CONTEXTS = Object.keys(BEDS);

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
    folder: '', // external music folder/URL
    tracks: {}, // context → [track urls] from the folder manifest
    mediaEl: null, // currently-playing external <audio>, if any
    mediaSources: new WeakMap(), // <audio> → MediaElementSource (one per element)
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
    // Stop an external track if one is playing.
    if (state.mediaEl) {
      const el = state.mediaEl;
      state.mediaEl = null;
      try {
        el.onended = null;
        el.onerror = null;
        el.pause();
      } catch (e) {
        /* ignore */
      }
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

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
    // Prefer an external track for this context if the folder provided any;
    // fall back to a procedural variant on missing/unplayable files.
    const ext = state.tracks[context];
    if (ext && ext.length) {
      playExternal(context, ext);
      return;
    }
    playProcedural(context, bed);
  }

  // Stream a random track from the context's list; when it ends, play another
  // (fresh random pick → variety). Any load/decode error → procedural bed.
  function playExternal(context, urls) {
    const url = pickRandom(urls);
    let el;
    try {
      el = new Audio(url);
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      if (!state.mediaSources.has(el)) {
        const src = ctx.createMediaElementSource(el);
        src.connect(musicBus);
        state.mediaSources.set(el, src);
      }
    } catch (e) {
      return playProcedural(context, BEDS[context]);
    }
    el.addEventListener('ended', () => {
      if (state.context === context) playExternal(context, urls);
    });
    el.addEventListener('error', () => {
      if (state.context === context) {
        state.mediaEl = null;
        playProcedural(context, BEDS[context]);
      }
    });
    const p = el.play();
    if (p && p.catch) p.catch(() => {}); // autoplay-block is handled by resume()
    state.mediaEl = el;
  }

  function playProcedural(context, bed) {
    const variant = pickRandom(bed.variants);
    if (bed.drone) drone(variant.root / 2, 0.12 * bed.gain);
    const scale = SCALES[variant.scale];
    const lift = variant.lift || 3;
    let step = 0;
    const playNote = () => {
      const deg = scale[(step * lift + (step % 2 ? 2 : 0)) % scale.length];
      const oct = step % 4 === 0 ? 2 : 1;
      const freq = variant.root * oct * Math.pow(2, deg / 12);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = variant.wave || 'triangle';
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
    state.timer = setInterval(playNote, variant.cadence);
  }

  /**
   * configureMusic({ folder }) — point the engine at a folder/URL of music.
   * Fetches `<folder>/manifest.json` mapping context → [file paths], e.g.
   *   { "combat": ["combat/track1.mp3", "combat/track2.mp3"], "boss": [...] }
   * Relative entries resolve against the folder; each context then plays a
   * random track from its list, looping to a fresh pick. No folder / no
   * manifest / unreachable files → the procedural score is used. Re-applied
   * live restarts the current context so a new folder takes effect at once.
   */
  async function configureMusic({ folder } = {}) {
    state.folder = folder || '';
    state.tracks = {};
    if (folder) {
      try {
        const base = String(folder).replace(/\/+$/, '');
        const res = await fetch(`${base}/manifest.json`);
        if (res.ok) {
          const m = await res.json();
          for (const key of MUSIC_CONTEXTS) {
            const list = m[key];
            if (Array.isArray(list) && list.length) {
              state.tracks[key] = list.map((f) => (/^(https?:)?\/\//.test(f) || f.startsWith('/') ? f : `${base}/${f}`));
            }
          }
        }
      } catch (e) {
        state.tracks = {}; // fall back entirely to procedural
      }
    }
    // Re-trigger the current context so the new source is used immediately.
    if (state.context && !state.muted) {
      const c = state.context;
      state.context = null;
      music(c);
    }
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

  return { sfx, music, stopMusic, setVolumes, configureMusic, resume, isReal: true };
}

function clampVol(v, dflt) {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.max(0, Math.min(100, n));
}

// No-WebAudio fallback: a no-op engine so callers never branch.
function silentEngine() {
  return { sfx() {}, music() {}, stopMusic() {}, setVolumes() {}, configureMusic() {}, resume() {}, isReal: false };
}
