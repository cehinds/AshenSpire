// src/model/validate/idSets.js — unknown bundle keys, the registry id sets every cross-reference reads, and status stacking.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { REGISTRY_TYPES } from '../schemas.js';
import { KNOWN_BUNDLE_KEYS } from './bundleKeys.js';

export function idSetProblems(b, err, ctx) {
  for (const key of Object.keys(b)) {
    if (!KNOWN_BUNDLE_KEYS.has(key)) err(key, `Unknown content bundle key '${key}'`);
  }

  // ---- collect id sets for cross-reference checks -------------------------
  const ids = { scripts: new Set(Object.keys(b.scripts || {})) };
  for (const type of REGISTRY_TYPES) {
    ids[type] = new Set();
    const defs = b[type] || [];
    if (!Array.isArray(defs)) {
      err(type, `Bundle key '${type}' must be an array of defs`);
      continue;
    }
    defs.forEach((def, i) => {
      if (!def || typeof def.id !== 'string') err(`${type}[${i}]`, 'Def missing string id');
      else if (ids[type].has(def.id)) err(`${type}.${def.id}`, `Duplicate id '${def.id}'`);
      else ids[type].add(def.id);
    });
  }

  // Explicit applications have their own cap and duration; meters keep their
  // threshold semantics instead of mixing two independent stacking models.
  for (const status of Array.isArray(b.statuses) ? b.statuses : []) {
    const rule = status?.stacking;
    if (!rule) continue;
    if (status.meter || status.proc) err(`statuses.${status.id}.stacking`, 'explicit application stacking cannot replace a buildup meter');
    if (!Number.isInteger(rule.cap) || rule.cap < 1) err(`statuses.${status.id}.stacking.cap`, 'must be a positive integer');
    if (rule.duration !== undefined && (!Number.isInteger(rule.duration) || rule.duration < 1)) err(`statuses.${status.id}.stacking.duration`, 'must be a positive integer');
  }
  ctx.ids = ids;
}
