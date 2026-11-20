// src/model/validate/schemaWalk.js — the central schema walk and the audio-recipe walks that ride on it.
// Split out of validate.js.

import { SFX_LAYER_KINDS, SFX_LAYER_SCHEMAS, MUSIC_SILENCE_WORD, MUSIC_BED_SCHEMA } from '../schemas.js';
import { describe, isPlainObject } from './shared.js';
import { validateEffects, validateTriggers, validatePredicate, validateFormula } from './effectGrammar.js';

/**
 * A recipe is a non-empty array of layers; a layer is discriminated on `kind`
 * FIRST so an error names the field that is wrong, not "matched no variant".
 * The second layer here is meaning, not shape: WebAudio's exponential ramps
 * throw on a target of 0 or below, so a freq/peak/dur a schema would accept
 * as "a number" can still be a sound that dies at play time. Both layers
 * report through `err`, so bad data fails loud and NAMES THE RECIPE
 * (Law 1 clause 5) — at boot via main.js's banner, and in tests.
 */
export function validateSfxRecipes(sfx, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(sfx)) {
    err(path, `Expected an object map of recipe ids, got ${describe(sfx)}`);
    return;
  }
  if (sfx.default === undefined) {
    err(`${path}.default`, "Missing 'default' recipe — the audible fallback for an id with no entry");
  }
  for (const id of Object.keys(sfx)) {
    const p = `${path}.${id}`;
    const layers = sfx[id];
    if (!Array.isArray(layers) || layers.length === 0) {
      err(p, `Recipe must be a non-empty array of layers, got ${Array.isArray(layers) ? 'empty array' : describe(layers)}`);
      continue;
    }
    layers.forEach((layer, i) => {
      const lp = `${p}[${i}]`;
      if (!isPlainObject(layer)) {
        err(lp, `Layer must be an object, got ${describe(layer)}`);
        return;
      }
      if (!SFX_LAYER_KINDS.includes(layer.kind)) {
        err(`${lp}.kind`, `Unknown layer kind '${layer.kind}' (closed set: ${SFX_LAYER_KINDS.join(', ')})`);
        return;
      }
      walkSchema(layer, SFX_LAYER_SCHEMAS[layer.kind], lp, vctx);
      // Meaning: values the engine's ramps would throw on or render as
      // silence. Finite is part of the claim, not a nicety — Infinity is
      // typeof 'number', slides past the schema, and is exactly the class
      // this comment promises to reject (Vira's gate finding on #46: the
      // first version checked > 0 only, and Infinity > 0 is true).
      for (const f of ['freq', 'to', 'dur', 'peak', 'hp', 'lp']) {
        if (typeof layer[f] === 'number' && !(Number.isFinite(layer[f]) && layer[f] > 0)) {
          err(`${lp}.${f}`, `'${f}' must be a finite number > 0, got ${layer[f]} (WebAudio's exponential ramps throw on 0 and on non-finite targets)`);
        }
      }
      if (typeof layer.t0 === 'number' && !(Number.isFinite(layer.t0) && layer.t0 >= 0)) {
        err(`${lp}.t0`, `'t0' must be a finite number >= 0, got ${layer.t0}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Music beds + the silence word (word 3; Sunna's lift condition)
// ---------------------------------------------------------------------------

/**
 * A context's bed value is either a bed object or the exact word 'silence'
 * (MUSIC_SILENCE_WORD) — deliberate quiet a human typed on purpose. Everything
 * that LOOKS like quiet but wasn't typed as the word is a distinct, named
 * error: null, [], {}, a wrong or miscased word, a zero gain. That is the
 * whole point of the word — quiet-by-intent is never confusable with
 * quiet-by-bug, at boot (main.js banner) and in tests.
 */
export function validateMusicBeds(music, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(music)) {
    err(path, `Expected { scales, beds }, got ${describe(music)}`);
    return;
  }
  for (const key of Object.keys(music)) {
    if (key !== 'scales' && key !== 'beds') err(`${path}.${key}`, `Unknown field '${key}'`);
  }
  const scales = music.scales;
  const scaleIds = new Set();
  if (!isPlainObject(scales)) {
    err(`${path}.scales`, `Expected an object map of scales, got ${describe(scales)}`);
  } else {
    for (const id of Object.keys(scales)) {
      const s = scales[id];
      if (!Array.isArray(s) || s.length === 0) {
        err(`${path}.scales.${id}`, `Scale must be a non-empty array of semitone offsets, got ${Array.isArray(s) ? 'empty array' : describe(s)}`);
        continue;
      }
      scaleIds.add(id);
      s.forEach((v, i) => {
        if (typeof v !== 'number' || !Number.isFinite(v)) err(`${path}.scales.${id}[${i}]`, `Expected finite number, got ${describe(v)}`);
      });
    }
  }
  const beds = music.beds;
  if (!isPlainObject(beds)) {
    err(`${path}.beds`, `Expected an object map of context beds, got ${describe(beds)}`);
    return;
  }
  for (const context of Object.keys(beds)) {
    const p = `${path}.beds.${context}`;
    const bed = beds[context];
    if (bed === MUSIC_SILENCE_WORD) continue; // deliberate quiet, spelled on purpose
    if (bed === null) {
      err(p, `null is not silence — deliberate quiet is spelled '${MUSIC_SILENCE_WORD}'; a null bed is a mistake, not a decision`);
      continue;
    }
    if (typeof bed === 'string') {
      err(p, `The only word for deliberate quiet is '${MUSIC_SILENCE_WORD}' (exact, lowercase), got '${bed}'`);
      continue;
    }
    if (Array.isArray(bed)) {
      err(p, `An array is not a bed and not silence — a bed is an object, deliberate quiet is '${MUSIC_SILENCE_WORD}'`);
      continue;
    }
    walkSchema(bed, MUSIC_BED_SCHEMA, p, vctx);
    if (!isPlainObject(bed)) continue;
    // Meaning: quiet spelled as numbers, and refs the schema cannot see.
    if (typeof bed.gain === 'number' && !(Number.isFinite(bed.gain) && bed.gain > 0)) {
      err(`${p}.gain`, `'gain' must be a finite number > 0, got ${bed.gain} — a zero gain is silence spelled as a number; deliberate quiet is the word '${MUSIC_SILENCE_WORD}'`);
    }
    if (Array.isArray(bed.variants)) {
      if (bed.variants.length === 0) err(`${p}.variants`, `'variants' must be non-empty — a bed with nothing to play is silence by accident; deliberate quiet is '${MUSIC_SILENCE_WORD}'`);
      bed.variants.forEach((v, i) => {
        if (!isPlainObject(v)) return; // schema pass reported it
        for (const f of ['root', 'cadence']) {
          if (typeof v[f] === 'number' && !(Number.isFinite(v[f]) && v[f] > 0)) {
            err(`${p}.variants[${i}].${f}`, `'${f}' must be a finite number > 0, got ${v[f]}`);
          }
        }
        // Vira's gate finding on word 3: 'lift' was missing from this sweep,
        // and a validator-green `lift: Infinity` or `lift: -3` crashed the
        // music loop per note (NaN / negative scale index → non-finite
        // oscillator frequency). Integer, not just finite-positive: the
        // stride INDEXES the scale, and a fractional stride reads
        // scale[4.5] — the same NaN wearing a friendlier number.
        if (typeof v.lift === 'number' && !(Number.isInteger(v.lift) && v.lift > 0)) {
          err(`${p}.variants[${i}].lift`, `'lift' must be a positive integer, got ${v.lift} — the melodic stride indexes the scale, and a negative, fractional, or non-finite stride reads notes that do not exist`);
        }
        if (typeof v.scale === 'string' && !scaleIds.has(v.scale)) {
          err(`${p}.variants[${i}].scale`, `Dangling reference: unknown scale '${v.scale}'`);
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Schema walker
// ---------------------------------------------------------------------------

export function walkSchema(value, node, path, vctx) {
  const { err } = vctx;
  if (!node) {
    err(path, 'Internal: missing schema node');
    return;
  }
  switch (node.k) {
    case 'any':
      return;
    case 'str':
      if (typeof value !== 'string') err(path, `Expected string, got ${describe(value)}`);
      return;
    case 'num':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        err(path, `Expected number, got ${describe(value)}`);
      } else if (node.int && !Number.isInteger(value)) {
        err(path, `Expected integer, got ${value}`);
      }
      return;
    case 'bool':
      if (typeof value !== 'boolean') err(path, `Expected boolean, got ${describe(value)}`);
      return;
    case 'enum':
      if (!node.values.includes(value)) {
        err(path, `Expected one of [${node.values.join(', ')}], got ${describe(value)}`);
      }
      return;
    case 'arr':
      if (!Array.isArray(value)) {
        err(path, `Expected array, got ${describe(value)}`);
        return;
      }
      if (node.len != null && value.length !== node.len) {
        err(path, `Expected array of length ${node.len}, got ${value.length}`);
      }
      value.forEach((v, i) => walkSchema(v, node.of, `${path}[${i}]`, vctx));
      return;
    case 'map':
      if (!isPlainObject(value)) {
        err(path, `Expected object map, got ${describe(value)}`);
        return;
      }
      for (const key of Object.keys(value)) walkSchema(value[key], node.of, `${path}.${key}`, vctx);
      return;
    case 'obj': {
      if (!isPlainObject(value)) {
        err(path, `Expected object, got ${describe(value)}`);
        return;
      }
      for (const key of Object.keys(value)) {
        if (!(key in node.fields)) err(`${path}.${key}`, `Unknown field '${key}'`);
      }
      for (const [key, fieldNode] of Object.entries(node.fields)) {
        if (value[key] === undefined) {
          if (!fieldNode.opt) err(`${path}.${key}`, `Missing required field '${key}'`);
          continue;
        }
        walkSchema(value[key], fieldNode, `${path}.${key}`, vctx);
      }
      return;
    }
    case 'union': {
      // Accept if any branch matches without producing errors.
      for (const branch of node.anyOf) {
        const probeErrors = [];
        const probe = { ids: vctx.ids, err: (p, m) => probeErrors.push({ p, m }) };
        walkSchema(value, branch, path, probe);
        if (probeErrors.length === 0) return;
      }
      err(path, `Value ${describe(value)} matched no allowed variant`);
      return;
    }
    case 'null':
      if (value !== null) err(path, `Expected null, got ${describe(value)}`);
      return;
    case 'ref':
      if (typeof value !== 'string') {
        err(path, `Expected ${node.reg} id string, got ${describe(value)}`);
      } else if (!vctx.ids[node.reg] || !vctx.ids[node.reg].has(value)) {
        err(path, `Dangling reference: unknown ${node.reg} id '${value}'`);
      }
      return;
    case 'effects':
      validateEffects(value, path, vctx);
      return;
    case 'triggers':
      validateTriggers(value, path, vctx);
      return;
    case 'predicate':
      validatePredicate(value, path, vctx);
      return;
    case 'formulaOrNum':
      validateFormula(value, path, vctx);
      return;
    default:
      err(path, `Internal: unknown schema kind '${node.k}'`);
  }
}
