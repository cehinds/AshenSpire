// src/model/validate/scriptBudget.js — the scripts budget (SPEC §3.1(6), §3.14(5)).
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { REGISTRY_TYPES } from '../schemas.js';
import { usesScript } from './propertyRules.js';

export function scriptBudgetProblems(b, err, ctx) {
  // ---- scripts budget (SPEC §3.1(6), §3.14(5)) -----------------------------
  const scriptUsers = [];
  let totalObjects = 0;
  for (const type of REGISTRY_TYPES) {
    for (const def of Array.isArray(b[type]) ? b[type] : []) {
      totalObjects++;
      if (usesScript(def)) scriptUsers.push(`${type}.${def.id}`);
    }
  }
  const scriptPct = totalObjects === 0 ? 0 : (scriptUsers.length / totalObjects) * 100;
  if (scriptPct >= 5) {
    err('scripts', `scripts budget exceeded: ${scriptUsers.length}/${totalObjects} content objects (${scriptPct.toFixed(1)}%) use scripts (must stay < 5%). Users: ${scriptUsers.join(', ')}`);
  }
  const scriptReport = {
    count: scriptUsers.length,
    total: totalObjects,
    pct: scriptPct,
    users: scriptUsers,
  };
  ctx.scriptReport = scriptReport;
}
