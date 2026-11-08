import { fixCoreProtection } from '../content/generated/fixCoreProtection.js';
// src/model/validate.js — content validation (SPEC §3.14)
//
// Runs at boot in dev mode and from the test page. Checks, across ALL content:
//   1. Schema conformance (fields, types, enums; unknown fields fail loudly).
//   2. Every id cross-reference resolves (no dangling ids).
//   3. Every opcode, formula op, trigger event, and predicate is in the
//      closed sets of SPEC §3.4–§3.6.
//   4. Every text-template token binds, and every player-visible literal
//      numeric effect has a token (SPEC §3.13) — enforced for cards + relics.
//   5. scripts.js budget report: script-using content stays < 5% of content.
//
// Headless: no document/window/localStorage/timers.

import { REGISTRY_TYPES } from './schemas.js';
import { describe } from './validate/shared.js';
import {
  validateEffects as validateEffects_,
  validateTriggers as validateTriggers_,
  validatePredicate as validatePredicate_,
  validateFormula as validateFormula_,
} from './validate/effectGrammar.js';
export const validateEffects = validateEffects_;
export const validateTriggers = validateTriggers_;
export const validatePredicate = validatePredicate_;
export const validateFormula = validateFormula_;
import {
  TOKENIZABLE_OPS as TOKENIZABLE_OPS_,
  REQUIRED_TOKEN_OPS as REQUIRED_TOKEN_OPS_,
  relicTokens as relicTokens_,
  computeTokenBindings as computeTokenBindings_,
  cardTokenEffects as cardTokenEffects_,
  extractTemplateTokens as extractTemplateTokens_,
} from './validate/tokenBindings.js';
export const TOKENIZABLE_OPS = TOKENIZABLE_OPS_;
export const REQUIRED_TOKEN_OPS = REQUIRED_TOKEN_OPS_;
export const relicTokens = relicTokens_;
export const computeTokenBindings = computeTokenBindings_;
export const cardTokenEffects = cardTokenEffects_;
export const extractTemplateTokens = extractTemplateTokens_;
import { usesScript } from './validate/propertyRules.js';
import { deckRulesTableProblems as deckRulesTableProblems_ } from './validate/deckRulesTable.js';
export const deckRulesTableProblems = deckRulesTableProblems_;
import { rootProblems } from './validate/root.js';
import { questProblems } from './validate/quests.js';
import { idSetProblems } from './validate/idSets.js';
import { cardCostProblems } from './validate/cardCosts.js';
import { balanceRowProblems } from './validate/balanceRows.js';
import { rewardScheduleProblems } from './validate/rewardSchedule.js';
import { progressionProblems } from './validate/progression.js';
import { classTreeProblems } from './validate/classTree.js';
import { tagContextProblems } from './validate/tagContext.js';
import { equipmentProblems } from './validate/equipment.js';
import { schemaWalkProblems } from './validate/schemaWalks.js';
import { hudResourceProblems } from './validate/hudResources.js';
import { seatProblems } from './validate/seats.js';
import { uiHoldProblems } from './validate/uiHolds.js';
import { handOverlapProblems } from './validate/handOverlap.js';
import { mapBalanceProblems } from './validate/mapBalance.js';
import { entityCrossProblems } from './validate/entityCross.js';

/**
 * The template-token grammar, in ONE place. `{block}`, `{bleed}`, `{damage.2}`.
 *
 * EldenSpire#41, Bjorn's deletability review: this regex had FOUR copies —
 * validate.js:150, loadout.js:258 (already named TOKEN_RE), and twice in
 * card.js. A factory rather than a shared instance on purpose: a `g` regex
 * carries `lastIndex`, so one exported object shared across modules is a
 * cross-module mutable, and loadout.js was already resetting it defensively at
 * three call sites. Each caller gets its own.
 */
// The grammar lives in model/tokens.js (a leaf, so tree.js can read it without
// importing this file back); re-exported here as plain consts because
// tools/bundle.mjs inlines `export const` and does not read `export … from`.
import { TOKEN_PATTERN as TOKEN_PATTERN_, tokenRe as tokenRe_ } from './tokens.js';
export const TOKEN_PATTERN = TOKEN_PATTERN_;
export const tokenRe = tokenRe_;

/**
 * validateContent(bundle) → { ok, errors: [{ path, msg }], scriptReport }.
 * `bundle` is the raw content bundle (same shape createRegistries takes).
 */
/**
 * A VALIDATION DOOR MAY NOT THROW — the structural half of that rule.
 *
 * Four rounds of review found the same shape at four addresses: a pass that
 * exists to ANSWER questions about content, crashing on content instead
 * (`sourceOrder.join`, `keywords.map`, `global.grants` iteration, a non-string
 * tag `source`). Each was a real gap and each got a named rule, but fixing them
 * one at a time is how the fifth arrives. Malformed content is infinite and this
 * pass reads hundreds of fields, so the guarantee cannot rest on having guarded
 * every one — it rests on the door being structurally unable to throw.
 *
 * So the whole pass runs inside a catch, and an unexpected throw becomes the
 * last problem in the list rather than an exception at the boot banner. Specific
 * rules still come first and still say the useful thing; this is the floor under
 * them, not a substitute for them.
 */
export function validateContent(bundle, options = {}) {
  // The accumulator is created HERE and handed in, so a throw partway through
  // KEEPS every field-addressed error found before it. A floor that returns a
  // fresh list erases the diagnosis it was meant to stand behind.
  const errors = [];
  try {
    return collectContentProblems(bundle, errors, options);
  } catch (error) {
    errors.push({
      path: '<bundle>',
      msg: `content validation could not finish reading this bundle: ${error && error.message} — a field is malformed in a way no rule names yet; any errors listed above were found before it, and the stack points at the field that threw`,
    });
    return { ok: false, errors, scriptReport: null };
  }
}

function collectContentProblems(bundle, errors = [], options = {}) {
  const err = (path, msg) => errors.push({ path, msg });
  const b = bundle || {};
  const ctx = { bundle };
  rootProblems(b, err, ctx);

  questProblems(b, err, ctx);

  idSetProblems(b, err, ctx);

  cardCostProblems(b, err, ctx);
  balanceRowProblems(b, err, ctx);
  rewardScheduleProblems(b, err, ctx);

  progressionProblems(b, err, ctx);
  classTreeProblems(b, err, ctx);

  // JSON mechanic attachments are validated by the same compiler that live
  // mounts use. Ordinary normalized classification tags keep their own door.
  const behaviorMechanics = new Map(fixCoreProtection);
  tagContextProblems(b, err, ctx);
  const { tagIds, creatureTagIds } = ctx; // inline reads
  equipmentProblems(b, err, ctx);

  schemaWalkProblems(b, err, ctx);

  hudResourceProblems(b, err, ctx);

  seatProblems(b, err, ctx);
  uiHoldProblems(b, err, ctx);
  handOverlapProblems(b, err, ctx);
  mapBalanceProblems(b, err, ctx);

  entityCrossProblems(b, err, ctx);

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

  return { ok: errors.length === 0, errors, scriptReport };
}

// ---------------------------------------------------------------------------
// SFX recipes (#46) — shape via the layer schemas, meaning via the ramp checks
// ---------------------------------------------------------------------------
