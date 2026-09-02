// src/model/floorplan.js — what a floor rule MEANS in an act of a given length.
//
// WHY THIS FILE EXISTS. Constantine: "make this configurable by data driven
// tooling." The blocker was that the map's knobs were absolute floor indices:
//
//     fixed: { 1: 'monster', 9: 'treasure', 15: 'shrine' }
//     noEliteOrShrineBefore: 6
//     noShrineOn: 14
//
// Every one of those numbers means something different when `floors` changes,
// and nothing said so. Measured (Freja, 24 seeds):
//
//   - `9: 'treasure'` is a CLIFF. Shorten the act below 10 floors and floor 9
//     does not exist, so the treasure rank is deleted — 4.0 treasure nodes per
//     act becomes 0.0, across 24/24 seeds, silently.
//   - `15: 'shrine'` HAS NEVER FIRED at any shipped act length. Deleting it
//     changes 0 of 24 seeds at 10, 12 and 15 floors, because the top floor is
//     typed by the generator before the rules run and is therefore not rollable.
//     A rule that has never fired, sitting in the table looking load-bearing.
//   - `noEliteOrShrineBefore: 6` gates 36% of a 15-floor act and 56% of a
//     10-floor one. Same 6, different game.
//
// That is SOP 2's drift clause applied to data: a constant whose MEANING moves
// while the constant does not. So the fix is not a longer table of magic
// numbers — it is ANCHORS. A rule names a POSITION, and the position resolves
// against the act it is in.
//
// AND THE RESOLUTION IS A READOUT, not just an internal step (Marina's ruling on
// Constantine's reading 2): `describePlan()` prints "fixed treasure -> floor 9
// of 14 rollable (fraction 0.64)". A knob you can turn and a number you can read
// are the same feature; a knob without the readout is the thing that shipped.
//
// LAYERING: this is model/, imports nothing from engine/, and owns NODE_TYPES —
// which mapgen.js used to export and nothing outside it consumed.
// (`ui/uiContent.js` holds its own node-type map for icons and blurbs. That is a
// second copy of the closed set and it is NOT swept here; named, not fixed.)

/** The closed set of node types. One home; mapgen and the schema both read it. */
export const NODE_TYPES = Object.freeze([
  'monster',
  'event',
  'elite',
  'shrine',
  'merchant',
  'treasure',
  'boss',
]);

/** The closed set of anchor kinds. A new kind is an engine change (Law 1). */
export const ANCHOR_KINDS = Object.freeze(['first', 'last', 'floor', 'fraction']);

/**
 * ROLLABLE FLOORS — the denominator for every fraction here, and it is NOT
 * `floors`. The generator types the top floor as the lone Shrine and puts the
 * Boss above it (SPEC §6) before any rule runs, so floors 1..floors-1 are the
 * only ones a rule can reach. Getting this wrong is what made `15: 'shrine'`
 * look like a rule for four months.
 */
export function rollableFloors(config) {
  return Math.max(0, (config.floors | 0) - 1);
}

/**
 * resolveAnchor(anchor, config) → { floor } | { error }
 *
 * Never throws and never clamps silently into range: an anchor that lands
 * outside the act is an ERROR the caller names, because that is precisely the
 * defect this file exists to catch (Law 1 clause 5 — bad data fails loud and
 * names the entry). `fraction` is the one form that clamps, and only into the
 * band's own ends, because a fraction cannot be out of range by construction.
 */
export function resolveAnchor(anchor, config) {
  const band = rollableFloors(config);
  if (band < 1) return { error: `act has ${config.floors} floor(s); no floor is rollable` };
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) {
    return { error: `anchor must be an object like { at: 'fraction', of: 0.5 }, got ${JSON.stringify(anchor)}` };
  }
  switch (anchor.at) {
    case 'first':
      return { floor: 1, why: `first of ${band} rollable` };
    case 'last':
      return { floor: band, why: `last of ${band} rollable` };
    case 'floor': {
      const n = anchor.index;
      if (!Number.isInteger(n)) return { error: `{ at: 'floor' } needs an integer 'index', got ${JSON.stringify(n)}` };
      if (n < 1 || n > band) {
        return { error: `floor ${n} is outside this act's rollable band 1..${band} (floors: ${config.floors})` };
      }
      return { floor: n, why: `absolute; band is 1..${band}` };
    }
    case 'fraction': {
      const f = anchor.of;
      if (typeof f !== 'number' || !Number.isFinite(f) || f <= 0 || f > 1) {
        return { error: `{ at: 'fraction' } needs 'of' in (0, 1], got ${JSON.stringify(f)}` };
      }
      const floor = Math.min(band, Math.max(1, Math.round(f * band)));
      return { floor, why: `fraction ${f} of ${band} rollable` };
    }
    default:
      return { error: `unknown anchor kind ${JSON.stringify(anchor.at)} — one of ${ANCHOR_KINDS.join(', ')}` };
  }
}

/**
 * resolveFloorPlan(config) → { plan, errors, readout }
 *
 * The single place that turns authored rules into the numbers mapgen uses.
 * mapgen consumes `plan` and asks nothing else about floors; the validator
 * consumes `errors`; tools consume `readout`. One resolution, three readers —
 * so a tool can never disagree with the generator about what a rule meant.
 *
 * NO `|| {}`. `floorRules` missing is a distinct, named outcome, not an empty
 * object that generates a map nobody authored. (Viki: a graceful fallback is
 * where a defect goes to be quiet.)
 */
export function resolveFloorPlan(config) {
  const errors = [];
  const readout = [];
  const band = rollableFloors(config);
  const rules = config && config.floorRules;

  if (rules == null) {
    errors.push({ key: 'floorRules', msg: 'missing — an act with no floor rules is not a default, it is an unauthored map' });
    return { plan: null, errors, readout };
  }
  if (typeof rules !== 'object' || Array.isArray(rules)) {
    errors.push({ key: 'floorRules', msg: `must be an object, got ${Array.isArray(rules) ? 'an array' : typeof rules}` });
    return { plan: null, errors, readout };
  }

  readout.push(`act: ${config.floors} floors · ${band} rollable (1..${band}) · top floor is the Shrine, Boss above it`);

  // ---- fixed ranks -------------------------------------------------------
  const fixed = {};
  const list = rules.fixed;
  if (list != null) {
    if (!Array.isArray(list)) {
      errors.push({ key: 'floorRules.fixed', msg: `must be an array of { at, type } anchors, got ${typeof list}` });
    } else {
      list.forEach((entry, i) => {
        const at = `floorRules.fixed[${i}]`;
        if (!entry || typeof entry !== 'object') {
          errors.push({ key: at, msg: `must be an object like { at: 'first', type: 'monster' }` });
          return;
        }
        if (!NODE_TYPES.includes(entry.type)) {
          errors.push({ key: `${at}.type`, msg: `${JSON.stringify(entry.type)} is not a node type — one of ${NODE_TYPES.join(', ')}` });
          return;
        }
        const r = resolveAnchor(entry, config);
        if (r.error) {
          errors.push({ key: at, msg: `${entry.type}: ${r.error}` });
          return;
        }
        if (fixed[r.floor] != null && fixed[r.floor] !== entry.type) {
          errors.push({ key: at, msg: `${entry.type} resolves to floor ${r.floor}, which ${JSON.stringify(fixed[r.floor])} already claims` });
          return;
        }
        fixed[r.floor] = entry.type;
        readout.push(`fixed ${entry.type} -> floor ${r.floor} (${r.why})`);
      });
    }
  }

  // ---- thresholds --------------------------------------------------------
  const anchorRule = (key, fallbackFloor, label) => {
    const a = rules[key];
    if (a == null) { readout.push(`${key}: not set (${label})`); return fallbackFloor; }
    const r = resolveAnchor(a, config);
    if (r.error) { errors.push({ key: `floorRules.${key}`, msg: r.error }); return fallbackFloor; }
    readout.push(`${key} -> floor ${r.floor} (${r.why})`);
    return r.floor;
  };
  // TWO GATES, AND THE SPLIT IS THE FIX. `noEliteOrShrineBefore` was ONE anchor
  // holding both types, so the first floor that could carry a rest was also the
  // first that could carry an Elite. Constantine asked for the opposite —
  // "so eletes, maybe shop, and definitely before a boss" — and one anchor
  // cannot express it: a shared floor cannot be both the earliest rest and
  // later than the earliest Elite. Measured on the shipped act before the
  // split, over the canonical seed stream (60 runs x 3 acts): 124 of 180 maps
  // carried an Elite with NO Shrine on any earlier floor.
  //
  // The old key is an ERROR rather than a silent shorthand for both, exactly as
  // `minReachableElites` is above: a name that conflates two rules keeps
  // conflating them, and the reader who deletes the split hears about it at
  // boot with the entry named (Law 1 clause 5).
  if (rules.noEliteOrShrineBefore != null) {
    errors.push({ key: 'floorRules.noEliteOrShrineBefore', msg: "split into 'noShrineBefore' and 'noEliteBefore' — one anchor could not put a rest earlier than the first Elite, which is what the rest-before-Elite promise needs" });
  }
  const shrineFrom = anchorRule('noShrineBefore', 1, 'shrines allowed from floor 1');
  const eliteFrom = anchorRule('noEliteBefore', 1, 'elites allowed from floor 1');
  const noShrineOn = anchorRule('noShrineOn', 0, 'no floor bars shrines');

  for (const [key, floor, label] of [
    ['noShrineBefore', shrineFrom, 'Shrine'],
    ['noEliteBefore', eliteFrom, 'an Elite'],
  ]) {
    if (band > 0 && floor > band) {
      errors.push({ key: `floorRules.${key}`, msg: `resolves to ${floor}, past the last rollable floor ${band} — no floor could ever hold ${label}` });
    }
  }
  if (band > 0) {
    for (const [floor, label] of [[shrineFrom, 'Shrine'], [eliteFrom, 'Elite']]) {
      const gated = Math.max(0, floor - 1);
      readout.push(`  => ${gated} of ${band} rollable floors (${Math.round((gated / band) * 100)}%) bar ${label}`);
    }
  }

  // ---- the rest-before-Elite promise -------------------------------------
  // E13, his words: "so eletes, maybe shop, and definitely before a boss".
  // Before-a-boss the generator has always kept (the top floor is the lone
  // Shrine). This is the other half, and it is a HARD PROMISE in the same sense
  // `minElites` is: mapgen bars the roll and then force-places rather than
  // shipping a map that breaks it.
  //
  // WHAT IT PROMISES, STATED NARROWLY BECAUSE THE NAME COULD PROMISE MORE: some
  // floor BELOW the first Elite's floor carries a Shrine. It is a property of
  // the graph, not of a path — the same honesty `minElites` was renamed for.
  // A walker can still climb past an Elite without meeting that rest if the
  // route they chose does not touch it; tools/mapplan.mjs MEASURES the
  // per-path number rather than this file promising it.
  const restBeforeElite = rules.restBeforeElite === true;
  if (rules.restBeforeElite != null && typeof rules.restBeforeElite !== 'boolean') {
    errors.push({ key: 'floorRules.restBeforeElite', msg: `must be true or false, got ${JSON.stringify(rules.restBeforeElite)}` });
  }
  // THE FLOORS THE PROMISED REST MAY LAND ON, resolved HERE and carried on the
  // plan rather than recomputed in the generator. mapgen force-places onto one
  // of these when the rolls produced none, and a second computation of "which
  // floors are free" is a second answer to what the rules meant — the exact
  // defect the anchors were built to end.
  const restFloors = [];
  if (restBeforeElite && band > 0) {
    for (let f = shrineFrom; f < eliteFrom && f <= band; f++) {
      if (f !== noShrineOn && fixed[f] == null) restFloors.push(f);
    }
    // SATISFIABLE, OR REFUSED BY NAME. A promise the act's own other rules make
    // impossible must fail at boot, not by force-placing a Shrine onto a floor
    // some other rule already claimed.
    if (restFloors.length === 0) {
      errors.push({ key: 'floorRules.restBeforeElite', msg: `no floor can hold the promised rest: Shrines start at ${shrineFrom}, Elites at ${eliteFrom}, and every floor between is barred (noShrineOn ${noShrineOn || 'unset'}) or claimed by a fixed rank. Open noShrineBefore earlier, or push noEliteBefore later.` });
    } else {
      readout.push(`restBeforeElite: on — a Shrine is guaranteed on one of floors ${restFloors.join(', ')} whenever the map holds an Elite (graph-level, not per-path)`);
    }
  } else {
    readout.push('restBeforeElite: off — an Elite may appear with no rest below it');
  }

  // ---- counts ------------------------------------------------------------
  // RENAMED, and the rename IS the fix. These were `minReachableElites` /
  // `minReachableMerchants` and they do not measure reachability: mapgen counts
  // the whole graph (`countType`), which is a different promise. Freja measured
  // the gap — 8 of 104 starts can reach no Elite at 15x7, and 16 of 100 at
  // 10x6, plus 28 of 100 with no Merchant. It degrades in the direction we are
  // shortening. The honest name is what it counts; the reachability number is
  // now MEASURED AND REPORTED by tools/mapplan.mjs rather than promised here.
  const count = (key, legacy) => {
    const v = rules[key] != null ? rules[key] : rules[legacy];
    if (v == null) return 0;
    if (!Number.isInteger(v) || v < 0) {
      errors.push({ key: `floorRules.${key}`, msg: `must be a non-negative integer, got ${JSON.stringify(v)}` });
      return 0;
    }
    if (rules[legacy] != null) {
      errors.push({ key: `floorRules.${legacy}`, msg: `renamed to '${key}' — it counts nodes in the whole graph, never reachability, and the old name promised the second` });
    }
    readout.push(`${key}: ${v}`);
    return v;
  };
  const minElites = count('minElites', 'minReachableElites');
  const minMerchants = count('minMerchants', 'minReachableMerchants');

  // ---- unknown-node weights (moved here from balance.unknownNode) --------
  // Freja's finding, Marina made it binding: what a `?` node resolves to is map
  // geometry and belongs beside typeWeights, per act, not in the flat global
  // balance table. One act could not have different `?` odds from another while
  // it lived in `balance.*`, and nothing said so.
  // MISSING IS AN ERROR, exactly as floorRules above — Viki's withhold on this
  // branch, and it was my own standard inverted: floorRules absent was a boot
  // error ("not a default, an unauthored map") while unknownWeights absent was
  // a clean boot and a THROW at act build (resolveUnknownNode requires it).
  // The schema said opt, the resolver said nothing, the runtime said crash —
  // each choice legal alone, the pair a coupling, in the commit whose purpose
  // is closing couplings. Law 1 clause 5: the person who deletes this key
  // while tuning hears about it at boot, with the entry named, not at the
  // first `?` node of act 1.
  let unknownWeights = null;
  if (config.unknownWeights == null) {
    errors.push({ key: 'unknownWeights', msg: 'missing — resolveUnknownNode requires it, so its absence is a crash at act build, not a default' });
  } else {
    const w = config.unknownWeights;
    if (typeof w !== 'object' || Array.isArray(w)) {
      errors.push({ key: 'unknownWeights', msg: `must be an object of kind -> weight, got ${typeof w}` });
    } else {
      const total = Object.values(w).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
      if (total <= 0) errors.push({ key: 'unknownWeights', msg: 'weights sum to 0 — every `?` node would resolve to the first key' });
      unknownWeights = w;
      readout.push(`unknownWeights: ${Object.entries(w).map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`).join(' · ')}`);
    }
  }

  const plan = {
    floors: config.floors,
    band,
    fixed,
    shrineFrom,
    eliteFrom,
    restBeforeElite,
    restFloors,
    noShrineOn,
    minElites,
    minMerchants,
    // THE SAME TWO NUMBERS, KEYED BY THE TYPE THEY FORCE — and it is a
    // derivation of the pair above, not a second copy of them. mapgen honours
    // these by FORCE-PLACING (relaxPlace) when the rolls do not produce them,
    // which means a type named here cannot be rolled out of the act. Anything
    // that wants to say so — applyRunShape's readout, a tool — needs the map
    // rather than two hardcoded names, or it silently stops covering the third
    // minimum the day one is added.
    minima: { elite: minElites, merchant: minMerchants },
    unknownWeights,
  };
  return { plan, errors, readout };
}

/** describePlan(config) → string[] — the readout, for tools and for humans. */
export function describePlan(config) {
  const { errors, readout } = resolveFloorPlan(config);
  return readout.concat(errors.map((e) => `ERROR ${e.key}: ${e.msg}`));
}

/* ------------------------------------------------------------ THE RUN SHAPE --
 *
 * Constantine asked for a debug feature that caps floors and columns and biases
 * the node roll, so a full run fits the patience he actually has. The knobs are
 * data (`MAP_SHAPE_LIMITS` and the act's own `typeWeights`, content/mapconfig.js);
 * this is the machinery that DERIVES an act from them.
 *
 * IT LIVES HERE AND NOT IN A NEW FILE ON PURPOSE. This module is already the one
 * place that turns authored map data into the numbers the generator uses — "one
 * resolution, three readers" is written at resolveFloorPlan above. A per-run
 * override resolved anywhere else would be a second answer to "what does this
 * act's config mean", which is the exact defect the anchors were built to end.
 */

/** The closed set of things a run shape may say. A new key is an engine change. */
export const MAP_SHAPE_KEYS = Object.freeze(['floors', 'columns', 'typeWeights']);

/**
 * minViableFloors(config) → { floors } | { error }
 *
 * The shortest act THIS act's own floor rules can describe, found by asking
 * rather than typing. At the shipped rules the answer is 4, and the reason is
 * worth reading: at 3 floors the band is 2, `{ fraction: 0.64 }` rounds to
 * floor 1, and floor 1 is already claimed by the fixed Monster — two rules
 * collide and resolveFloorPlan refuses. A typed `min: 4` would be a constant
 * whose MEANING moves when someone retunes 0.64 while the constant does not,
 * which is the drift this file was written against.
 */
export function minViableFloors(config) {
  const ceiling = Number.isInteger(config && config.floors) ? config.floors : 0;
  for (let f = 2; f <= ceiling; f++) {
    if (resolveFloorPlan({ ...config, floors: f }).errors.length === 0) return { floors: f };
  }
  return { error: `no act length from 2 to ${ceiling} resolves this act's floor rules` };
}

/**
 * applyRunShape(config, shape, limits) → { config, errors, readout, changed }
 *
 *   shape   { floors?, columns?, typeWeights?: { [nodeType]: number } } or null
 *   limits  MAP_SHAPE_LIMITS from content — passed in, never imported, so this
 *           model file keeps its "imports nothing" property and a tool can ask
 *           the question against limits the game does not ship.
 *
 * `errors` is non-empty ⇒ THE SHAPE IS REFUSED and `config` comes back as the
 * authored one, unchanged. Nothing here clamps a wrong value into a working
 * one: a knob that quietly became a different knob is worse than a knob that
 * says no (Law 1 clause 5).
 *
 * ON `viewRefusals` (model/mapview.js), which is NOT called here and it is a
 * deliberate omission with a reason, not an oversight. That function refuses a
 * `columns` value too WIDE to frame on a phone. This resolver can only ever
 * SHRINK columns — the cap is `min(authored, cap)` — and both `maxFanoutSpan`
 * (floor(columns/2)+1) and `spanWidth` are monotone non-decreasing in columns,
 * so no shrink can newly fire a width refusal that the authored act did not
 * already fire at boot. Importing the view into the generator's path to ask a
 * question whose answer is fixed by construction is a coupling bought for
 * nothing. If this ever grows a knob that WIDENS the act, that argument dies
 * with it and the import becomes required.
 */
export function applyRunShape(config, shape, limits) {
  const errors = [];
  const readout = [];
  // NOTES are the subset of the readout a PLAYER has to read — the sentences
  // that say "this knob did something other than what it looks like it did".
  // They are pushed to both, so the screen prints the resolver's own words and
  // there is no second wording of a caveat to drift (Law 1 clause 2).
  const notes = [];
  const note = (s) => { notes.push(s); readout.push(s); };
  const lim = limits || {};
  const refuse = () => ({ config, errors, readout, notes, changed: false });

  if (shape == null) return { config, errors, readout, notes, changed: false };
  if (typeof shape !== 'object' || Array.isArray(shape)) {
    errors.push({ key: 'mapShape', msg: `must be an object like { floors: 8, columns: 5, typeWeights: { elite: 30 } }, got ${Array.isArray(shape) ? 'an array' : typeof shape}` });
    return refuse();
  }
  for (const key of Object.keys(shape)) {
    if (!MAP_SHAPE_KEYS.includes(key)) {
      errors.push({ key: `mapShape.${key}`, msg: `is not a run-shape knob — one of ${MAP_SHAPE_KEYS.join(', ')}` });
    }
  }

  // ---- the two caps ------------------------------------------------------
  const cap = (key, min, whyMin) => {
    const authored = config[key];
    const v = shape[key];
    if (v == null) { readout.push(`${key}: uncapped — the act's own ${authored}`); return authored; }
    if (!Number.isInteger(v)) {
      errors.push({ key: `mapShape.${key}`, msg: `must be a whole number of ${key}, got ${JSON.stringify(v)}` });
      return authored;
    }
    if (min != null && v < min) {
      errors.push({ key: `mapShape.${key}`, msg: `${v} is below ${min} — ${whyMin}` });
      return authored;
    }
    if (v > authored) {
      // Not an error: min() is the semantics and a cap above the act is simply
      // slack. It is PRINTED, because a knob that silently did nothing is the
      // failure this feature is most likely to ship with.
      readout.push(`${key}: cap ${v} is above the ${authored} this act authors — NOT BINDING, the act keeps ${authored}`);
      return authored;
    }
    readout.push(`${key}: ${authored} capped to ${v}`);
    return v;
  };

  const mv = minViableFloors(config);
  if (mv.error) errors.push({ key: 'mapShape.floors', msg: mv.error });
  const floors = cap(
    'floors',
    mv.floors,
    mv.floors == null ? 'this act has no viable length' :
      `${mv.floors} is the shortest act this act's own floor rules resolve at (ask tools/mapplan.mjs --floors ${(mv.floors || 2) - 1} and read the collision)`
  );
  const columns = cap(
    'columns',
    lim.minColumns,
    `${lim.minColumns} columns is the floor — one column is a corridor: every walker lands on the same node and the act has no choices in it`
  );

  // ---- the weights -------------------------------------------------------
  // The knobs are DERIVED from the act's own typeWeights keys. An unknown key
  // is refused by name and the legal set is printed, so the day a node type is
  // added to the act the message changes with it and nothing here is retyped.
  let typeWeights = config.typeWeights;
  const authoredWeights = config.typeWeights;
  if (shape.typeWeights != null) {
    const w = shape.typeWeights;
    if (typeof w !== 'object' || Array.isArray(w)) {
      errors.push({ key: 'mapShape.typeWeights', msg: `must be an object of node type -> weight, got ${Array.isArray(w) ? 'an array' : typeof w}` });
    } else if (!authoredWeights || typeof authoredWeights !== 'object') {
      errors.push({ key: 'mapShape.typeWeights', msg: 'this act authors no typeWeights, so there is nothing to re-weight' });
    } else {
      const merged = { ...authoredWeights };
      for (const [type, v] of Object.entries(w)) {
        if (!Object.prototype.hasOwnProperty.call(authoredWeights, type)) {
          errors.push({ key: `mapShape.typeWeights.${type}`, msg: `is not a node type this act rolls — one of ${Object.keys(authoredWeights).join(', ')}` });
          continue;
        }
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          errors.push({ key: `mapShape.typeWeights.${type}`, msg: `must be a weight of 0 or more, got ${JSON.stringify(v)}` });
          continue;
        }
        if (lim.maxWeight != null && v > lim.maxWeight) {
          errors.push({ key: `mapShape.typeWeights.${type}`, msg: `${v} is above the ${lim.maxWeight} a run-shape knob may set` });
          continue;
        }
        merged[type] = v;
      }
      const total = Object.values(merged).reduce((a, b) => a + b, 0);
      if (total <= 0) {
        errors.push({ key: 'mapShape.typeWeights', msg: 'every weight is zero — no type could ever be rolled and every node would fall back to Monster. Raise at least one above zero.' });
      } else {
        typeWeights = merged;
        readout.push(`typeWeights: ${Object.entries(merged).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(' · ')}`);
        // THE ONE HONEST FOOTNOTE ON THIS KNOB, and it is not a bug: mapgen's
        // rollType returns 'monster' when a node's every other type is barred
        // (a floor rule, or the no-same-type-adjacent ban). So Monster at 0
        // does not mean zero Monsters — it means Monster is never CHOSEN, only
        // fallen back to. Said here rather than discovered on the map.
        if (merged.monster === 0) {
          note('Monster 0 — a node whose every other type is barred by a floor rule or the no-repeat-neighbour ban still falls back to Monster, so Monsters do not reach zero.');
        }
      }
    }
  }

  if (errors.length) return refuse();

  const next = { ...config, floors, columns, typeWeights };
  const changed = floors !== config.floors || columns !== config.columns || typeWeights !== config.typeWeights;
  if (!changed) return { config, errors, readout, notes, changed: false };

  // The shortened act must still resolve its OWN rules — the anchors move with
  // `floors`, so this is not a formality: it is the check that makes the cap
  // safe to expose to a slider. One resolution, and it is the same one the
  // generator will run.
  const { plan, errors: planErrors, readout: planReadout } = resolveFloorPlan(next);
  for (const e of planErrors) errors.push({ key: `mapShape -> ${e.key}`, msg: e.msg });
  if (errors.length) return refuse();

  // A WEIGHT OF ZERO THAT STILL PRODUCES THE TYPE, SAID OUT LOUD. Found by the
  // test that asserted it reached zero and did not: `minElites: 2` is a hard
  // promise the generator keeps by FORCE-PLACING elites when the rolls never
  // made one, so Elite at weight 0 still lands two per act. That is correct
  // behaviour and it is exactly the shape of Law 0 clause 5 — the knob looks
  // ignored. It is not ignored; it is outranked, and the reader is told which.
  for (const [type, floorCount] of Object.entries(plan.minima || {})) {
    if (floorCount > 0 && typeWeights[type] === 0) {
      note(`${type[0].toUpperCase()}${type.slice(1)} 0 — but this act promises at least ${floorCount} a map, so ${floorCount} are force-placed. Zero weight means never ROLLED, not never present.`);
    }
  }

  readout.push(...planReadout.map((l) => `  ${l}`));

  return { config: next, errors, readout, notes, changed: true };
}
