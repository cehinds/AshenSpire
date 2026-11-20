// src/model/validate/thresholdProcs.js — the threshold-proc second layer (#61): meaning, not shape.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { describe } from './shared.js';

export function thresholdProcProblems(b, err, ctx) {
  const { tagIds, creatureTagIds } = ctx;
  // ---- threshold-proc second layer (#61): meaning, not shape ---------------
  // Every red names its row and, for tag errors, lists the legal tags — a
  // wrong tag teaches the vocabulary instead of just refusing (silence-word
  // standard).
  //
  // finitePositive is the SHARED gate for every numeric knob in this layer
  // (Vira's gate finding 1 — the recurring class: `typeof x === 'number' &&
  // x > 0` waves Infinity through, and Infinity validates green then
  // multiplies damage at play). One helper, every site, instead of a fourth
  // hand-written patch.
  const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const finitePositiveInt = (v) => Number.isInteger(v) && v > 0; // isInteger already rejects ±Infinity/NaN
  const finitePercent = (v) => finitePositive(v) && v <= 100;
  for (const st of b.statuses || []) {
    const path = `statuses.${st.id}`;
    if (st.proc) {
      const p = st.proc;
      if (!finitePositiveInt(p.threshold)) {
        err(`${path}.proc.threshold`, `threshold must be a finite integer > 0, got ${JSON.stringify(p.threshold)}`);
      }
      if (!finitePercent(p.burstPercent)) {
        err(`${path}.proc.burstPercent`, `burstPercent must be a finite number in (0, 100], got ${JSON.stringify(p.burstPercent)}`);
      }
      // The burst band is a damage floor/ceiling: negatives validate a proc
      // that fires and silently no-ops (loseHp clamps at 0) — a dead row in
      // burst clothing (Vira's finding 1, second half).
      if (!(Number.isInteger(p.burstMin) && p.burstMin >= 0)) {
        err(`${path}.proc.burstMin`, `burstMin must be a finite integer ≥ 0, got ${JSON.stringify(p.burstMin)}`);
      }
      if (!finitePositiveInt(p.burstMax)) {
        err(`${path}.proc.burstMax`, `burstMax must be a finite integer > 0 — a 0-or-negative cap is a proc that silently no-ops, got ${JSON.stringify(p.burstMax)}`);
      }
      if (Number.isInteger(p.burstMin) && Number.isInteger(p.burstMax) && p.burstMin > p.burstMax) {
        err(`${path}.proc`, `burstMin ${p.burstMin} exceeds burstMax ${p.burstMax}`);
      }
      if (p.poiseDamage != null && !(Number.isInteger(p.poiseDamage) && p.poiseDamage >= 0)) {
        err(`${path}.proc.poiseDamage`, `poiseDamage must be an integer ≥ 0, got ${JSON.stringify(p.poiseDamage)}`);
      }
      if (p.resistance) {
        for (const tag of p.resistance.tags || []) {
          if (!creatureTagIds.includes(tag)) {
            err(`${path}.proc.resistance.tags`, `unknown creature tag '${tag}' (legal: ${creatureTagIds.join(', ')})`);
          }
        }
        // Empty tag list = a resistance the proc can never grant — same dead
        // shape as an empty taggedVulnerability list, held to the same red
        // (Vira's finding 3: one screen, one rule).
        if (!(p.resistance.tags || []).length) {
          err(`${path}.proc.resistance.tags`, 'tag list must be non-empty — a resistance no creature tag can trigger is a dead row; omit resistance instead');
        }
        const resistDef = (b.statuses || []).find((s) => s && s.id === p.resistance.status);
        if (resistDef && !resistDef.resists) {
          err(`${path}.proc.resistance.status`, `'${p.resistance.status}' has no resists block — a proc's resistance status must declare what it resists`);
        }
      }
    }
    if (st.resists) {
      if (!finitePercent(st.resists.percent)) {
        err(`${path}.resists.percent`, `resist percent must be a finite number in (0, 100], got ${JSON.stringify(st.resists.percent)}`);
      }
      // Reverse-direction check (Vira's finding 2): a resist row naming a
      // status that never procs is consulted by nobody — dead, silently.
      const resisted = (b.statuses || []).find((s) => s && s.id === st.resists.status);
      if (resisted && !resisted.proc) {
        err(`${path}.resists.status`, `'${st.resists.status}' is not a threshold-proc status — this resist row would never be consulted`);
      }
      if (!(st.decay && typeof st.decay === 'object' && Number.isInteger(st.decay.duration) && st.decay.duration > 0)) {
        err(`${path}.decay`, `a resist row needs decay {duration: int > 0} — its duration is a table knob, got ${JSON.stringify(st.decay)}`);
      }
    }
    if (st.taggedVulnerability) {
      const tv = st.taggedVulnerability;
      for (const tag of tv.tags || []) {
        if (!tagIds.has(tag)) {
          err(`${path}.taggedVulnerability.tags`, `unknown effect tag '${tag}' (legal: ${[...tagIds].join(', ')})`);
        }
      }
      if (!finitePositive(tv.mult)) {
        err(`${path}.taggedVulnerability.mult`, `mult must be a finite number > 0, got ${JSON.stringify(tv.mult)}`);
      }
      if (!(tv.tags || []).length) {
        err(`${path}.taggedVulnerability.tags`, 'tag list must be non-empty — an unscoped extra vulnerability is plain Vulnerable, use modifiers instead');
      }
    }
  }

  for (const enemy of b.enemies || []) {
    const path = `enemies.${enemy.id}`;
    // An enemy's own tags are checked with every other carrier's, by
    // tagContentProblems above — one rule, one message, for all of them.
    const moveIds = new Set(Object.keys(enemy.moves || {}));
    if (enemy.rangeClosingMove !== undefined && (!moveIds.has(enemy.rangeClosingMove) || !enemy.moves[enemy.rangeClosingMove].effects?.some(effect => effect.op === 'moveEngagement'))) err(`${path}.rangeClosingMove`, 'must name an owned movement move');
    if (enemy.rangeRetreatMove !== undefined && (!moveIds.has(enemy.rangeRetreatMove) || !enemy.moves[enemy.rangeRetreatMove].effects?.some(effect => effect.op === 'moveEngagement' && effect.bands === 1))) err(`${path}.rangeRetreatMove`, 'must name an owned retreat (bands 1) movement move');
    for (const id of Object.keys(enemy.moveSources || {})) if (!moveIds.has(id)) err(`${path}.moveSources.${id}`, 'must name an owned move');
    if (enemy.firstMove != null && !moveIds.has(enemy.firstMove)) {
      err(`${path}.firstMove`, `firstMove '${enemy.firstMove}' is not one of this enemy's moves`);
    } else if (enemy.firstMove != null && enemy.moves[enemy.firstMove].reaction !== undefined) {
      err(`${path}.firstMove`, `firstMove '${enemy.firstMove}' is a reaction move and is never rolled as an intent`);
    }
    // A reaction move is never rolled, so it carries no weight; every other move
    // is rolled and needs one. `reaction` bounds mirror docs/combat-card-traits-contract.md.
    for (const [moveId, move] of Object.entries(enemy.moves || {})) {
      const movePath = `${path}.moves.${moveId}`;
      if (move.reaction !== undefined) {
        const { on, minIncoming, chance } = move.reaction;
        if (!Array.isArray(on) || on.length === 0) err(`${movePath}.reaction.on`, 'reaction.on must be a non-empty list');
        if (move.weight !== undefined) err(`${movePath}.weight`, 'a reaction move is never rolled and must not carry a weight');
        if (minIncoming !== undefined && !(Number.isInteger(minIncoming) && minIncoming >= 0)) err(`${movePath}.reaction.minIncoming`, 'minIncoming must be an integer >= 0 (0: no incoming damage required)');
        if (chance !== undefined && !(typeof chance === 'number' && chance >= 0 && chance <= 1)) err(`${movePath}.reaction.chance`, 'chance must be a number in [0, 1]');
      } else if (typeof move.weight !== 'number' || Number.isNaN(move.weight)) {
        err(`${movePath}.weight`, `Expected number, got ${describe(move.weight)}`);
      }
    }
    for (const [pi, phase] of (enemy.phases || []).entries()) {
      for (const mv of phase.unlockMoves || []) {
        if (!moveIds.has(mv)) err(`${path}.phases[${pi}].unlockMoves`, `unlockMoves '${mv}' is not one of this enemy's moves`);
      }
      if (phase.on === 'hpBelowPct' && typeof phase.pct !== 'number') {
        err(`${path}.phases[${pi}]`, "phases with on:'hpBelowPct' require a numeric pct");
      }
    }
  }
}
