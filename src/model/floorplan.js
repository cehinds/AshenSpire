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
  const eliteShrineFrom = anchorRule('noEliteOrShrineBefore', 1, 'elites and shrines allowed from floor 1');
  const noShrineOn = anchorRule('noShrineOn', 0, 'no floor bars shrines');

  if (band > 0 && eliteShrineFrom > band) {
    errors.push({ key: 'floorRules.noEliteOrShrineBefore', msg: `resolves to ${eliteShrineFrom}, past the last rollable floor ${band} — no floor could ever hold an Elite or Shrine` });
  }
  if (band > 0) {
    const gated = Math.max(0, eliteShrineFrom - 1);
    readout.push(`  => ${gated} of ${band} rollable floors (${Math.round((gated / band) * 100)}%) bar Elite and Shrine`);
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
    eliteShrineFrom,
    noShrineOn,
    minElites,
    minMerchants,
    unknownWeights,
  };
  return { plan, errors, readout };
}

/** describePlan(config) → string[] — the readout, for tools and for humans. */
export function describePlan(config) {
  const { errors, readout } = resolveFloorPlan(config);
  return readout.concat(errors.map((e) => `ERROR ${e.key}: ${e.msg}`));
}
