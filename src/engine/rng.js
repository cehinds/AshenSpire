// src/engine/rng.js — mulberry32 PRNG + named streams with saved counters (SPEC §3.11)
//
// Every stream is independently derived from (run seed, stream salt, counter).
// mulberry32's internal state advances by a fixed constant per draw, so the
// value at counter i is computable in O(1): restoring a saved counter is exact
// and cheap. Counters are serialized with the run (SPEC §3.12).
//
// Headless: no document/window/localStorage/timers.

export const STREAM_NAMES = Object.freeze([
  'map',
  'shuffle',
  'cardRewards',
  'relicRewards',
  'flaskRewards',
  // Armament drops get their own stream so adding one to a node kind can't
  // shift what every later relic or card reward rolls in an existing seed.
  'armaments',
  'enemyAI',
  'enemyHP',
  'events',
  'shop',
  'misc',
]);

const MULBERRY_INC = 0x6d2b79f5;

/**
 * Classic mulberry32 (public domain). Returns a () => float in [0, 1).
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + MULBERRY_INC) | 0;
    return scramble(a);
  };
}

// The mulberry32 output scramble applied to an accumulator value.
function scramble(a) {
  let t = a | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// FNV-1a string hash → uint32 (used as the per-stream salt).
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Value of stream (base) at draw index i (1-based), identical to calling
// mulberry32(base) i times.
function valueAt(base, i) {
  return scramble((base + Math.imul(i, MULBERRY_INC)) | 0);
}

/**
 * createRng(seed, counters?) → named-stream RNG (SPEC §3.11).
 *
 * - seed: uint32 run seed.
 * - counters: optional { streamName: drawCount } restored from a save.
 *
 * API (all `stream` arguments must be one of STREAM_NAMES, else throws):
 *   float(stream)              → number in [0, 1)
 *   int(stream, min, max)      → integer in [min, max] inclusive
 *   pick(stream, array)        → element
 *   shuffle(stream, array)     → NEW shuffled array (Fisher–Yates)
 *   chance(stream, pct)        → boolean, true with pct% probability
 *   getCounters()              → plain { streamName: count } snapshot (save this)
 *   seed                       → the uint32 seed
 */
export function createRng(seed, counters = {}) {
  const s = seed >>> 0;
  const state = {};
  const bases = {};
  for (const name of STREAM_NAMES) {
    state[name] = (counters[name] || 0) >>> 0;
    bases[name] = (s ^ hashString(name)) >>> 0;
  }

  function assertStream(name) {
    if (!(name in state)) {
      throw new Error(`Unknown RNG stream '${name}'. Valid streams: ${STREAM_NAMES.join(', ')}`);
    }
  }

  const rng = {
    seed: s,
    float(stream) {
      assertStream(stream);
      state[stream] = (state[stream] + 1) >>> 0;
      return valueAt(bases[stream], state[stream]);
    },
    int(stream, min, max) {
      if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
      const r = rng.float(stream);
      return min + Math.floor(r * (max - min + 1));
    },
    pick(stream, array) {
      if (!Array.isArray(array) || array.length === 0) {
        throw new Error('rng.pick: empty or non-array input');
      }
      return array[Math.floor(rng.float(stream) * array.length)];
    },
    shuffle(stream, array) {
      const out = array.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng.float(stream) * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    chance(stream, pct) {
      return rng.float(stream) * 100 < pct;
    },
    getCounters() {
      const out = {};
      for (const name of STREAM_NAMES) out[name] = state[name];
      return out;
    },
  };
  return rng;
}

// ---------------------------------------------------------------------------
// Seed display — base-35 like StS (alphabet omits 'O' to avoid 0/O confusion).
// ---------------------------------------------------------------------------

const SEED_ALPHABET = '0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'; // 35 chars, no O

export function seedToString(seed) {
  let n = seed >>> 0;
  if (n === 0) return '0';
  let out = '';
  while (n > 0) {
    out = SEED_ALPHABET[n % 35] + out;
    n = Math.floor(n / 35);
  }
  return out;
}

export function seedFromString(str) {
  const cleaned = String(str).trim().toUpperCase().replace(/O/g, '0');
  let n = 0;
  for (const ch of cleaned) {
    const v = SEED_ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`Invalid seed character '${ch}'`);
    n = (n * 35 + v) >>> 0;
  }
  return n >>> 0;
}
