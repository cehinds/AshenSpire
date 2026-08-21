// src/ui/audio.js — procedural WebAudio engine (SPEC §7.4 audio).
//
// Hybrid design (per product decision): every sound and music bed has a
// synthesized fallback (zero required assets, zero licensing). SFX ids first
// try assets/sfx/<id>.ogg, with SFX_MANIFEST reserved for explicit path/format
// overrides. The triggering cue is always immediate: synth plays while an
// unknown sample warms, and only a known-good cached sample replaces later cues.
//
// Wiring: `initAudio()` returns an engine; main.js sets `sfx.sink = engine.sfx`
// and calls `engine.music(context)` as screens mount. The AudioContext starts
// suspended (autoplay policy) and resumes on the first user gesture.

import { balance } from '../content/balance.js';
import { MUSIC_MANIFEST, SCALES, BEDS } from '../content/music.js';
import { SFX_MANIFEST, SFX_RECIPES, resolveRecipe } from '../content/sfx.js';
import { MUSIC_SILENCE_WORD } from '../model/schemas.js';
import { assetUrl } from './assetmap.js';

// Default levels for a profile that has never touched the sliders — one source,
// shared with ui/screens/settings.js.
export const AUDIO_DEFAULTS = balance.ui.audio;

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
    // Defaults are data (content/balance.js → ui.audio), shared with the
    // settings sliders. They used to live in two files and could silently
    // disagree: this fallback is what an unset setting actually resolves to
    // (settings are stored sparse), while the row `def` only drew the slider.
    musicVol: clampVol(settings.musicVolume, AUDIO_DEFAULTS.musicVolume),
    sfxVol: clampVol(settings.sfxVolume, AUDIO_DEFAULTS.sfxVolume),
    muted: settings.muteAudio === true,
    context: null, // current music bed key
    nodes: [], // live music nodes to tear down on switch
    timer: null,
    pulseTimer: null, // rhythmic low-thump layer (battle beds)
    sampleCache: new Map(),
    folder: '', // external music folder/URL
    tracks: {}, // context → [track urls] from the folder manifest
    mediaEl: null, // currently-playing external <audio>, if any
    mediaSources: new WeakMap(), // <audio> → MediaElementSource (one per element)
    bedGains: [], // the live per-context level stage(s) — see bedGain()
  };
  applyGains();

  function applyGains() {
    const m = state.muted ? 0 : 1;
    master.gain.value = 0.9 * m;
    musicBus.gain.value = state.musicVol / 100;
    sfxBus.gain.value = state.sfxVol / 100;
  }

  // The context begins suspended; the first gesture resumes it.
  //
  // THE LIST USED TO BE ['pointerdown', 'keydown'] AND THAT IS A TOUCH BUG.
  // Measured, headless Chromium, 390x844, CDP touch, `navigator.userActivation`
  // sampled inside each listener on a fresh load:
  //
  //   touch:  pointerdown false · touchstart false · pointerup TRUE · touchend TRUE
  //   mouse:  pointerdown TRUE
  //
  // Chromium grants user activation for a TOUCH at the lift, not at the press —
  // deliberately, so that a scroll or a long-press is not an activation. A
  // resume() called with no activation returns a promise that simply does not
  // settle. So on a phone the whole of the first press-and-hold ran against a
  // SUSPENDED context: measured on the shipped event screen, peak amplitude
  // 0.000 across 209 sampled frames of a completed hold, while the same hold
  // driven by a mouse resumed at the press. The one platform named as the
  // priority is the one where it failed, and it failed only on the first
  // gesture of a page — which is why nobody found it by playing.
  //
  // Adding the lift events does NOT make the page's very first hold audible;
  // nothing can, because the browser will not start a context during a gesture
  // it has not yet counted. What it fixes is everything after: any tap that
  // ends anywhere now starts the audio, so the window in which the game is
  // silently mute is one gesture wide instead of open-ended. In real play the
  // title screen is tapped before any hold exists, so that window is normally
  // already closed — `?shot=` boots are where it is not.
  function resume() {
    if (ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'pointerup', 'touchend', 'keydown'].forEach((ev) =>
    addEventListener(ev, resume, { once: false, capture: true })
  );

  // ---- SFX -----------------------------------------------------------------
  // Both tables are plain object literals, so a bare [id] read inherits
  // Object.prototype: sfx('toString') found a function, and iterating it as a
  // recipe THREW where the old switch's default beeped (Vira's gate finding
  // on #46). Own-property reads only — an inherited key is a missing entry.
  const own = (table, id) => (Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined);

  function sfx(id) {
    if (state.muted || state.sfxVol <= 0) return;
    resume();
    // A CUE THAT ARRIVES AFTER THE THING IT REPORTS IS A LIE, SO IT IS DROPPED.
    //
    // A suspended context does not advance its clock, so anything scheduled at
    // `now()` sits there and fires the instant the context starts. Measured on
    // the shipped event screen, 390x844, fresh load, CDP touch: the whole of a
    // press-and-hold ran suspended (a touch is not an activation until the
    // lift), and all four sounds of the beat — three ticks spread over 600 ms
    // and an arrival — came out AS ONE 0.1687 PEAK AFTER THE FINGER LIFTED.
    // Not lost. Piled up, in the wrong order, describing a gesture that was
    // already over. A player would read that as the game reacting to their
    // RELEASE, which is the opposite of what happened.
    //
    // Silence is the honest answer for the one gesture the browser has not yet
    // counted. This costs the very first cue of a session on desktop too (the
    // resume promise has not settled inside the same listener that called it)
    // and that is the right price: one missing tick beats a phrase that lies
    // about when it happened.
    //
    // MUSIC IS DELIBERATELY NOT DROPPED — a bed that starts a beat late is a
    // bed, not a report about an event, and music() keeps its own path.
    if (ctx.state !== 'running') return;
    const sample = assetUrl(own(SFX_MANIFEST, id) || `assets/sfx/${encodeURIComponent(id)}.ogg`);
    if (playCachedSample(sample, sfxBus)) return;
    synthSfx(id);
    warmSample(sample);
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

  // The recipes are content (src/content/sfx.js, #46) — one entry per feedback
  // hook, validated with the bundle. This engine speaks exactly two words,
  // tone and noise; a recipe is a list of layers in that vocabulary, and an id
  // with no entry plays the table's own `default` — audible, never silent.
  // Ids the fallback has already named once — the warning is for whoever is
  // building, not a per-frame spam channel (`hit` fires dozens of times a
  // combat, and a warning nobody can read is the same silence in a new coat).
  const warnedFallback = new Set();

  function synthSfx(id) {
    const { recipe, fellBack } = resolveRecipe(id);
    if (fellBack && !warnedFallback.has(id)) {
      // THE FALLBACK NAMES ITSELF (Sunna's finding at #66): music() has warned
      // by name and pointed at its own file since word 3, while synthSfx —
      // eleven lines away — degraded in total silence. That asymmetry is how
      // three composed ids played the 440 Hz blip through a whole release
      // candidate with nobody's console saying a word.
      warnedFallback.add(id);
      // Name the family ONLY when the id actually has one — for a plain id,
      // split('_')[0] is the id itself and the advice read "author 'x', or a
      // family row named 'x'", which is one row wearing two names (Sunna's
      // nit at #66).
      const cut = String(id).indexOf('_');
      const family = cut > 0 ? String(id).slice(0, cut) : null;
      console.warn(
        `[audio] sfx('${id}'): no recipe answers this id — playing the default blip. ` +
          `Author a row named '${id}'` +
          (family ? `, or a family row named '${family}' that covers every '${family}_*' id` : '') +
          `, in src/content/sfx.js.`
      );
    }
    for (const { kind, ...params } of recipe) {
      if (kind === 'noise') noise(params);
      else tone(params);
    }
  }

  // ---- Music ---------------------------------------------------------------
  function stopMusic(fade = 0.6) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    if (state.pulseTimer) {
      clearInterval(state.pulseTimer);
      state.pulseTimer = null;
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

  /**
   * bedGain(bed) → THE ONE PLACE `bed.gain` IS READ (#48).
   *
   * A context's mix level used to be applied by whoever happened to be making
   * sound: the synth multiplied it into four separate voice literals, and the
   * external-track path — the one that matters the moment real music files
   * arrive — never read it at all, connecting straight to the bus at unity. So
   * a shrine track played as loud as a boss track, and the number somebody
   * chose on purpose was silently discarded (Vega, #48).
   *
   * Two readers and no home is the defect; ONE STAGE EVERY SOURCE PASSES
   * THROUGH is the fix. The voices below hand this node their own raw peaks
   * (0.12, 0.16, …) and an external `<audio>` connects to it unchanged, so
   * `bed.gain` is applied exactly once, in one place, to both doors. The
   * synth's shipped levels do not move: `0.16 * gain` into unity and `0.16`
   * into a stage at `gain` are the same product, which is what
   * tools/music-bed-gain-probe.mjs measures per bed rather than asserts.
   *
   * A bed with no gain field plays at unity rather than silently at zero — a
   * missing number is an authoring mistake, and silence is the one failure
   * nobody notices (Law 1 clause 5).
   */
  function bedGain(bed) {
    // The previous playback's stage is finished with by the time a new one
    // starts (its voices were stopped and any element paused in stopMusic), so
    // it is released here rather than mid-fade, where disconnecting would cut
    // the tail the fade exists to produce.
    for (const g of state.bedGains) {
      try { g.disconnect(); } catch (e) { /* already gone */ }
    }
    state.bedGains = [];
    const g = ctx.createGain();
    g.gain.value = bed && typeof bed.gain === 'number' ? bed.gain : 1;
    g.connect(musicBus);
    state.bedGains.push(g);
    return g;
  }

  function drone(freq, gain, out) {
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
    lp.connect(g).connect(out);
    o.start();
    o2.start();
    lfo.start();
    state.nodes.push({ osc: o, gain: g }, { osc: o2, gain: g }, { osc: lfo, gain: g });
  }

  // Returns a disposition so a headless probe can tell WHY nothing (or
  // something) is playing: 'bed' | 'external' | 'silence' (deliberate quiet,
  // the word a human typed in BEDS) | 'unknown' (a context with no bed — the
  // bug shape, warned loud) | 'muted' | 'unchanged'. Callers may ignore it.
  function music(context) {
    if (state.context === context) return 'unchanged';
    state.context = context;
    stopMusic();
    const bed = own(BEDS, context);
    if (bed === undefined) {
      // Silence-by-bug, and it says so: a context nobody wrote a bed for is a
      // mistake, never a decision (Law 1 clause 5). Deliberate quiet is the
      // word — `<context>: 'silence'` in content/music.js BEDS.
      console.warn(`[audio] music('${context}'): no bed with this name in content/music.js BEDS — playing nothing. Deliberate quiet is spelled '${MUSIC_SILENCE_WORD}'.`);
      return 'unknown';
    }
    if (state.muted) return 'muted';
    resume();
    // Prefer an external track for this context if the folder provided any —
    // including over a shipped 'silence': the folder manifest is also a word a
    // human typed on purpose, and the more specific intent wins.
    const ext = state.tracks[context];
    if (ext && ext.length) {
      playExternal(context, ext, bed);
      return 'external';
    }
    if (bed === MUSIC_SILENCE_WORD) return MUSIC_SILENCE_WORD;
    playProcedural(context, bed);
    return 'bed';
  }

  // A failed external track falls back to what the SHIPPED table says — a bed
  // plays, the silence word stays quiet. Without this guard the word itself
  // would have been handed to playProcedural as if it were a bed object.
  function proceduralFallback(context) {
    const bed = own(BEDS, context);
    if (bed && bed !== MUSIC_SILENCE_WORD) playProcedural(context, bed);
  }

  // Stream a random track from the context's list; when it ends, play another
  // (fresh random pick → variety). Any load/decode error → the shipped bed
  // (or shipped silence) via proceduralFallback.
  //
  // THE TRACK PASSES THROUGH THE SAME LEVEL STAGE THE SYNTH DOES (#48): it is
  // the shipped table that says a shrine is quieter than a boss, and a file on
  // disk is not a reason for that sentence to stop being true. The bed is
  // handed in rather than looked up again — the caller already resolved it,
  // and resolving it twice is how two readers of one number get born.
  function playExternal(context, urls, bed) {
    const url = pickRandom(urls);
    let el;
    try {
      el = new Audio(url);
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      if (!state.mediaSources.has(el)) {
        const src = ctx.createMediaElementSource(el);
        src.connect(bedGain(bed));
        state.mediaSources.set(el, src);
      }
    } catch (e) {
      return proceduralFallback(context);
    }
    el.addEventListener('ended', () => {
      if (state.context === context) playExternal(context, urls, bed);
    });
    el.addEventListener('error', () => {
      if (state.context === context) {
        state.mediaEl = null;
        proceduralFallback(context);
      }
    });
    const p = el.play();
    if (p && p.catch) p.catch(() => {}); // autoplay-block is handled by resume()
    state.mediaEl = el;
  }

  function playProcedural(context, bed) {
    const variant = pickRandom(bed.variants);
    // Every voice below carries its own RAW peak and meets the bed's level at
    // one shared stage — see bedGain().
    const out = bedGain(bed);
    if (bed.drone) drone(variant.root / 2, 0.12, out);
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
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.9);
      // Every few notes, lay a soft harmony a perfect fifth above — adds body
      // and variety without a second melodic line to manage.
      if (step % 3 === 1) {
        const h = ctx.createOscillator();
        const hg = ctx.createGain();
        h.type = 'sine';
        h.frequency.value = freq * 1.4983; // ~perfect fifth
        hg.gain.setValueAtTime(0.0001, t);
        hg.gain.exponentialRampToValueAtTime(0.07, t + 0.12);
        hg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        h.connect(hg).connect(out);
        h.start(t);
        h.stop(t + 1.7);
      }
      step++;
    };
    playNote();
    state.timer = setInterval(playNote, variant.cadence);

    // Battle beds get a rhythmic low thump — a heartbeat under the melody. It
    // pulses at roughly two beats per melodic note, so tenser (faster-cadence)
    // variants throb harder. Tears down with the rest via state.pulseTimer.
    if (bed.pulse) {
      const thump = () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        const t = now();
        o.frequency.setValueAtTime(variant.root / 2, t);
        o.frequency.exponentialRampToValueAtTime(variant.root / 3, t + 0.18);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.36);
      };
      thump();
      state.pulseTimer = setInterval(thump, Math.max(420, variant.cadence / 2));
    }
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

  // ---- samples (filename convention + manifest overrides) -----------------
  function warmSample(url) {
    if (state.sampleCache.has(url)) return;
    // A cache entry exists before fetch begins, so repeated cues share the warm
    // without waiting for it. Their synth remains synchronous; this work never
    // replays the event that started it.
    const entry = { status: 'loading', buffer: null };
    state.sampleCache.set(url, entry);
    (async () => {
      let res;
      try {
        res = await fetch(url);
      } catch (error) {
        entry.status = 'unavailable';
        return;
      }
      if (!res.ok) {
        entry.status = 'unavailable';
        return;
      }
      try {
        entry.buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        entry.status = 'ready';
      } catch (error) {
        console.warn(`[audio] SFX sample '${url}' failed to decode — using synth fallback.`, error);
        entry.status = 'unavailable';
      }
    })();
  }
  function playCachedSample(url, bus) {
    const entry = state.sampleCache.get(url);
    if (!entry || entry.status !== 'ready') return false;
    const src = ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.connect(bus);
    src.start();
    return true;
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
