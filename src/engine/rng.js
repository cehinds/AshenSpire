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

/**
 * The homoglyph table: characters that are a SECOND SPELLING of a character
 * the alphabet already has. `O` is not in the alphabet and never was — it has
 * always been silently rewritten to `0`, and that is correct, because the two
 * are one character wearing two shapes and nothing is lost.
 *
 * It is a table rather than an inline `.replace()` because the sentence a
 * player reads about it is DERIVED FROM IT (seedVocabulary below). Before
 * this, the rule lived in seedFromString and the explanation lived nowhere —
 * so the day someone widens the alphabet, the rule and the sentence move
 * together or not at all.
 */
const SEED_HOMOGLYPHS = [['O', '0']]; // [typed, meant]

/**
 * How many characters a seed FIELD accepts. This is a UI bound and says so:
 * the engine below imposes no length at all (a longer string just wraps mod
 * 2^32 and is still perfectly deterministic). It lives here because it is a
 * fact about the seed vocabulary, and it lives here ONCE — the three player-
 * facing seed fields used to spell it `maxlength="10"` in three markup
 * strings, which is three copies of one number with nothing keeping them
 * equal (Law 1 clause 2).
 */
export const SEED_MAX_LEN = 10;

/**
 * The vocabulary in the words a player reads — DERIVED FROM THE ALPHABET,
 * never retyped. Widen SEED_ALPHABET tomorrow and this sentence, the field's
 * refusal and the engine's throw all change together, because there is one of
 * them. That is the whole reason this function exists instead of a string.
 */
function seedVocabulary() {
  const chars = new Set(SEED_ALPHABET);
  const digits = [...SEED_ALPHABET].filter((c) => c >= '0' && c <= '9');
  const letters = [...SEED_ALPHABET].filter((c) => c >= 'A' && c <= 'Z');
  const range = (a) => (a.length ? `${a[0]}–${a[a.length - 1]}` : '');
  // Only homoglyphs the alphabet actually lacks are worth a word: the day `O`
  // joins the alphabet, this clause disappears on its own.
  const folded = SEED_HOMOGLYPHS.filter(([typed]) => !chars.has(typed))
    .map(([typed, meant]) => `${typed} reads as ${meant}`);
  return `seeds are ${range(digits)} and ${range(letters)}`
    + (folded.length ? `, and ${folded.join(', ')}` : '');
}

/**
 * scanSeed(str) — the ONE pass over a typed seed. `seedProblem` and
 * `seedFromString` are both this function, so the sentence a player reads at
 * the field and the error the engine throws are the same sentence and cannot
 * drift apart. Two loops over one alphabet is the second copy this seat exists
 * to refuse.
 *
 * Normalisation is unchanged and is deliberately narrow: trim, upper-case, and
 * O→0. Those are HOMOGLYPH identities — two spellings of one character — so
 * they lose nothing. Dropping a hyphen would not be that; it would be a
 * silent, plausible derivation (Law 0 clause 5), which is why this refuses
 * instead. (`ß` upper-cases to `SS` and is therefore accepted as two S's,
 * exactly as it has been since the first commit — named, not changed.)
 */
function scanSeed(str) {
  let cleaned = String(str).trim().toUpperCase();
  for (const [typed, meant] of SEED_HOMOGLYPHS) cleaned = cleaned.split(typed).join(meant);
  for (const ch of cleaned) {
    if (SEED_ALPHABET.indexOf(ch) < 0) {
      return { cleaned, bad: ch, why: `A seed cannot contain “${ch}” — ${seedVocabulary()}.` };
    }
  }
  return { cleaned, bad: null, why: null };
}

/**
 * seedProblem(str) → null when the string is a seed, or ONE sentence naming
 * the character that stops it being one (Law 1 clause 5: bad data fails loud
 * and names the entry). Callers: the seed fields, and seedFromString below.
 */
export function seedProblem(str) {
  return scanSeed(str).why;
}

/**
 * sweepSeed(i) → a uint32 that is genuinely different for every i.
 *
 * THE ONE HOME FOR "give me the i-th seed of a sweep", and it exists because
 * getting it wrong is invisible. `createRng('mapplan-3')` is `'mapplan-3' >>> 0`,
 * which is 0 — for EVERY i. tools/mapplan.mjs's first run reported 24 seeds with
 * a range of 52-52 and nearly shipped: that was ONE seed measured 24 times,
 * wearing a distribution's clothes, and it was caught only because a count read
 * exactly 52.00 twenty-four times.
 *
 * Knuth's multiplicative hash on (i + 1), so index 0 is not seed 0. Every sweep
 * in the tree — the tool, the tests, and the live estimate the Custom Climb
 * screen prints while a knob is dragged — draws from this function, so a
 * distribution measured in one of them is the same distribution in the others.
 * A caller that writes its own is reintroducing the defect this export deletes.
 */
export function sweepSeed(i) {
  return Math.imul((i | 0) + 1, 2654435761) >>> 0;
}

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
  const { cleaned, why } = scanSeed(str);
  if (why) throw new Error(why);
  let n = 0;
  for (const ch of cleaned) n = (n * 35 + SEED_ALPHABET.indexOf(ch)) >>> 0;
  return n >>> 0;
}
