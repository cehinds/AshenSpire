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
import { thresholdProcProblems } from './validate/thresholdProcs.js';
import { scriptBudgetProblems } from './validate/scriptBudget.js';

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

  tagContextProblems(b, err, ctx);
  equipmentProblems(b, err, ctx);

  schemaWalkProblems(b, err, ctx);

  hudResourceProblems(b, err, ctx);

  seatProblems(b, err, ctx);
  uiHoldProblems(b, err, ctx);
  handOverlapProblems(b, err, ctx);
  mapBalanceProblems(b, err, ctx);

  entityCrossProblems(b, err, ctx);

  thresholdProcProblems(b, err, ctx);

  scriptBudgetProblems(b, err, ctx);

  const { scriptReport } = ctx;
  return { ok: errors.length === 0, errors, scriptReport };
}

// ---------------------------------------------------------------------------
// SFX recipes (#46) — shape via the layer schemas, meaning via the ramp checks
// ---------------------------------------------------------------------------
