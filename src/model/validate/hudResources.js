// src/model/validate/hudResources.js — HUD resource rows: meaning, not shape (Law 1 clause 5).
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { MAX_ENEMIES_PER_COMBAT } from '../combatLimits.js';
import { RESOURCE_SOURCE_IDS } from '../resources.js';
import { enemyLevelProfileProblems, levelBandProblems, levelConfigProblems } from '../levels.js';

export function hudResourceProblems(b, err, ctx) {
  // ---- HUD resource rows: MEANING, not shape (Law 1 clause 5) --------------
  // The shape walk above already rejects a missing `source`. This rejects a
  // source the engine cannot READ — the defect that would otherwise ship a
  // trough reading 0/0 forever on Constantine's HUD, looking finished.
  //
  // A new row whose resource has no engine reader dies HERE at boot, naming the
  // row and legal sources instead of drawing a 0/0 trough that looks finished.
  for (const row of (Array.isArray(b.resources) ? b.resources : [])) {
    if (!row || typeof row.source !== 'string') continue; // shape walk owns this
    if (!RESOURCE_SOURCE_IDS.includes(row.source)) {
      err(`resources.${row.id || '?'}`, `source ${JSON.stringify(row.source)} has no reader — `
        + `the engine cannot get a value for it, so this bar would render an empty trough forever. `
        + `Readable sources are: ${RESOURCE_SOURCE_IDS.join(', ')}. `
        + `Adding one is an engine change (a reader in model/resources.js), not a row.`);
    }
    if (row.domainMax != null && !(Number.isFinite(row.domainMax) && row.domainMax > 0)) {
      err(`resources.${row.id || '?'}.domainMax`, `must be a positive number when present — got ${JSON.stringify(row.domainMax)}. `
        + `It is the bar's full-row ceiling; a zero or negative one divides the length by nothing.`);
    }
    if (Array.isArray(row.surfaces) && row.surfaces.length === 0) {
      err(`resources.${row.id || '?'}.surfaces`, 'names no surface, so this row can never draw — omit the row or give it a surface.');
    }
  }

  if (b.balance != null && (typeof b.balance !== 'object' || Array.isArray(b.balance))) {
    err('balance', 'balance must be a plain object of constants');
  }
  for (const problem of levelConfigProblems(b.balance)) err(problem.path, problem.msg);
  for (const enemy of Array.isArray(b.enemies) ? b.enemies : []) {
    if (enemy?.equipmentPower !== undefined && !(Number.isFinite(enemy.equipmentPower) && enemy.equipmentPower >= 0 && enemy.equipmentPower <= 1)) {
      err(`enemies.${enemy.id || '?'}.equipmentPower`, 'must be a number from 0 to 1');
    }
    if (!enemy || enemy.levelProfile == null) continue;
    for (const problem of enemyLevelProfileProblems(enemy.levelProfile, `enemies.${enemy.id || '?'}.levelProfile`)) {
      err(problem.path, problem.msg);
    }
  }
  for (const encounter of Array.isArray(b.encounters) ? b.encounters : []) {
    if (!encounter) continue;
    // Owner (2026-11-03): "Limit to just 3 enemies max" (SPEC §4, Encounters).
    if (Array.isArray(encounter.enemies) && encounter.enemies.length > MAX_ENEMIES_PER_COMBAT) {
      err(`encounters.${encounter.id || '?'}.enemies`, `lists ${encounter.enemies.length} enemies; a combat holds at most ${MAX_ENEMIES_PER_COMBAT} (owner, 2026-11-03)`);
    }
    for (const field of ['floorBand', 'targetBand']) {
      if (encounter[field] == null) continue;
      for (const problem of levelBandProblems(encounter[field], `encounters.${encounter.id || '?'}.${field}`)) {
        err(problem.path, problem.msg);
      }
    }
  }
}
