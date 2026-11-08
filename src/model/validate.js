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

import { sigils as shippedSigils } from '../content/sigils.js';
import { consumables as shippedConsumables } from '../content/consumables.js';
import { companions as shippedCompanions } from '../content/companions.js';
import { consumableTableProblems, companionTableProblems } from './consumables.js';
import { resolveFloorPlan } from './floorplan.js';
import { assertTableSane } from './secondbeat.js';
import { viewRefusals, geometryRefusals } from './map/mapview.js';
import { graceRefillRefusals } from './gracerefill.js';
import { flaskGrowthRefusals } from './flaskgrowth.js';
import { SCHEMAS, REGISTRY_TYPES } from './schemas.js';
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
import { validateSfxRecipes, validateMusicBeds, walkSchema } from './validate/schemaWalk.js';
import {
  validateCardRamp,
  validateCardContest,
  validateCardTemplates,
  validateRelicTemplate,
} from './validate/templates.js';
import { relicPropertyTagIndex, usesScript } from './validate/propertyRules.js';
import { deckRulesTableProblems as deckRulesTableProblems_ } from './validate/deckRulesTable.js';
export const deckRulesTableProblems = deckRulesTableProblems_;
import { validateSigils } from './validate/sigilRows.js';
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
  const { ids } = ctx; // inline reads

  cardCostProblems(b, err, ctx);
  balanceRowProblems(b, err, ctx);
  rewardScheduleProblems(b, err, ctx);

  progressionProblems(b, err, ctx);
  classTreeProblems(b, err, ctx);

  // JSON mechanic attachments are validated by the same compiler that live
  // mounts use. Ordinary normalized classification tags keep their own door.
  const behaviorMechanics = new Map(fixCoreProtection);
  tagContextProblems(b, err, ctx);
  const { tagIds, creatureTagIds, vctx } = ctx; // inline reads
  equipmentProblems(b, err, ctx);
  const { dependencySafeBundle } = ctx; // inline reads

  schemaWalkProblems(b, err, ctx);

  hudResourceProblems(b, err, ctx);

  seatProblems(b, err, ctx);
  uiHoldProblems(b, err, ctx);
  handOverlapProblems(b, err, ctx);
  // THE SECOND-BEAT TABLE, checked at the same boot and for the same reason as
  // the dial above. It is CODE, not content, so it can never be a row a
  // designer breaks — but it is a table, and a table whose row is malformed
  // resolves to a plausible 'none' and takes a safety step off a button with
  // nothing on the screen looking different. That is Law 0 clause 5 exactly:
  // the dangerous failure is the silent plausible derivation, so the derivation
  // is asked to prove itself out loud on every boot that validates anything.
  for (const complaint of assertTableSane()) err('secondBeat', complaint);

  // THE MAP'S VERTICAL MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what the map node's radius is SOLVED
  // FROM (model/map/mapview.js), so raising it grows the target and eats the space
  // BETWEEN two adjacent targets in the same stroke — at 08e184a, 44.09 px of
  // node against a 47.0 px row pitch at 390x844, under 3 px of air between taps
  // both start a fight nobody can undo (Sunna, 2026-08-08). Nothing was watching
  // that number; a refusal that prints a verdict and not a margin cannot be.
  // THE MAP'S COLLISION MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what EVERY map circle's radius is
  // SOLVED FROM (model/map/mapview.js), so raising it grows every circle while the
  // pitches they are measured against do not move — targets grow, the space
  // between them does not. Sunna's sentence, written about the event screen's
  // choice bars weeks ago and true here too: nothing in this game read a gap.
  // A refusal that prints a verdict and not a margin cannot be watched.
  //
  // It rules on the pairs a content edit is answerable for. The boss/shrine pair
  // is RED at the shipped default — rendered, every act, since #107 — and is
  // deliberately NOT gated here, because a boot banner the player cannot act on
  // is a worse failure than the overlap. That exemption carries a latch:
  // `mapplan --selftest` asserts the pair is still red, so the excuse cannot
  // outlive its reason. `node tools/mapplan.mjs --margins` is where it is red.
  //
  // Asked ONCE of the bundle rather than per act: it does not vary with
  // mapConfigs, and three identical errors would be three copies of one fact.
  // The corpus it has to turn red is `node tools/mapplan.mjs --selftest` — the
  // same corpus the mapConfigs block below points at, and its rows for this
  // refusal are in it, so neither pointer dangles.
  // Guarded on `balance` and NOT on `balance.ui.tapSize`, deliberately: guarding
  // on the entry means deleting the entry silences the check that watches it.
  if (b.balance != null && typeof b.balance === 'object' && !Array.isArray(b.balance)) {
    for (const e of geometryRefusals(b.balance)) err(e.key, e.msg);
  }
  // balance.graceRefill — what a grace hands back (Constantine, 2026-08-08).
  //
  // TAKES THE WHOLE BUNDLE, not `b.balance`, and that is the point: three of its
  // eight refusals can only be asked with the flask ENTRIES in hand (does this
  // kind have a member, does this override resolve, is the override of the kind
  // the row claims). A refusal that could only see `balance` would be checking
  // the half that was never in doubt.
  //
  // Its corpus is `node tools/gracerefill.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of graceRefillRefusals(b)) err(e.key, e.msg);

  // The growth chain (balance.flaskGrowth) — same refusal shape, same door.
  // Its corpus is `node tools/flaskgrowth.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of flaskGrowthRefusals(dependencySafeBundle)) err(e.key, e.msg);

  // balance.poise is engine-consulted data: { growthMult?, onFill? } (see ENGINE-API.md)
  if (b.balance && b.balance.poise) {
    const p = b.balance.poise;
    if (p.growthMult != null && typeof p.growthMult !== 'number') err('balance.poise.growthMult', 'must be a number');
    if (p.onFill != null) validateEffects(p.onFill, 'balance.poise.onFill', vctx);
  }

  if (b.mapConfigs != null) {
    if (typeof b.mapConfigs !== 'object' || Array.isArray(b.mapConfigs)) {
      err('mapConfigs', 'mapConfigs must be an object keyed by act number');
    } else {
      for (const act of Object.keys(b.mapConfigs)) {
        const cfg = b.mapConfigs[act];
        walkSchema(cfg, SCHEMAS.mapConfig, `mapConfigs.${act}`, vctx);
        // THE SECOND LAYER — meaning, not shape. The schema cannot know whether
        // floor 9 exists in THIS act; that needs `floors`, so it is asked here.
        // This is the boot-time half of Law 1 clause 5: bad data fails loud and
        // NAMES THE ENTRY, rather than being clamped, defaulted, or ignored.
        // The corpus it has to turn red is in tools/mapplan.mjs --selftest.
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
          for (const e of resolveFloorPlan(cfg).errors) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
          // AND THE SAME LAYER FOR THE KNOBS WHOSE FAILURE IS A VIEW FAILURE.
          // `floors: 2` already refused by name; `columns: 10` did not, and it
          // makes Constantine's "the current node and its connecting nodes fit"
          // unsatisfiable at every zoom the ladder has — a knob that hands him a
          // broken climb instead of a reason (Law 1 clause 5).
          //
          // AND EVERY ONE OF THESE NOW CARRIES ITS MARGIN, not just its verdict.
          // `columns: 9` was accepted at 1.02x with zero spare columns and the
          // word "accepted" was the whole answer (Vira, 2026-08-08).
          for (const e of viewRefusals(cfg)) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
        }
      }
    }
  }

  if (b.sfx != null) validateSfxRecipes(b.sfx, 'sfx', vctx);
  if (b.music != null) validateMusicBeds(b.music, 'music', vctx);

  // ---- entity-specific cross checks ----------------------------------------
  for (const card of b.cards || []) {
    const path = `cards.${card.id}`;
    if (typeof card.class === 'string' && card.class !== 'colorless' && !ids.classes.has(card.class)) {
      err(`${path}.class`, `class '${card.class}' is neither a class id nor 'colorless'`);
    }
    validateCardTemplates(card, path, err);
    validateCardRamp(card, path, err);
    validateCardContest(card, path, err);
    if (card.burden) {
      for(const key of ['skipActions','staminaTax','manaTax']) if(card.burden[key]!==undefined && (!Number.isSafeInteger(card.burden[key]) || card.burden[key]<0 || card.burden[key]>10)) err(`${path}.burden.${key}`,'must be bounded nonnegative integer');
    }
    if (card.costGrowth) {
      for (const key of ['stamina','mana']) if (card.costGrowth[key]!==undefined && (!Number.isSafeInteger(card.costGrowth[key]) || Math.abs(card.costGrowth[key])>10)) err(`${path}.costGrowth.${key}`,'must be an integer from -10 to 10');
      for (const key of ['perUse','max']) if (card.costGrowth[key]!==undefined && (!Number.isSafeInteger(card.costGrowth[key]) || card.costGrowth[key]<1 || card.costGrowth[key]>100)) err(`${path}.costGrowth.${key}`,'must be an integer from 1 to 100');
    }
    for (const [i,variant] of (card.effectVariants || []).entries()) { validatePredicate(variant.if,`${path}.effectVariants[${i}].if`,vctx);validateEffects(variant.effects,`${path}.effectVariants[${i}].effects`,vctx); }
  }

  const relicTagsByRelic = relicPropertyTagIndex(b);
  const propertyRulesByTag = new Map(
    (Array.isArray(b.propertyRules) ? b.propertyRules : [])
      .filter((rule) => rule && typeof rule.tag === 'string')
      .map((rule) => [rule.tag, rule]));
  for (const relic of b.relics || []) {
    validateRelicTemplate(relic, `relics.${relic.id}`, err, propertyRulesByTag, relicTagsByRelic, b);
    if (Array.isArray(relic.triggers) && relic.triggers.length) {
      err(`relics.${relic.id}.triggers`, `authors triggers on the relic, which no longer reads them — a relic's triggers are its property rule now: register a '${relic.id}' tag in content/source/tags.csv with domain 'property', move these to content/source/propertyRuleEffects.json under that tag, and add 'relic,,${relic.id},${relic.id}' to content/source/tagging.csv`);
    }
    const poiseAdd = relic && relic.passives && relic.passives.poiseThresholdAdd;
    if (poiseAdd != null && (!Number.isFinite(poiseAdd) || !Number.isInteger(poiseAdd) || poiseAdd < 0)) {
      err(`relics.${relic.id}.passives.poiseThresholdAdd`, `must be a finite non-negative integer, got ${JSON.stringify(poiseAdd)}`);
    }
  }

  // ---- sigils (SPEC §14.3, §15.4): { id, name, rarity, cost?, blurb } --------
  // What a sigil does is its tagging row and that leaf's rule, so a sigil adds
  // nothing to the engine's vocabulary. A legendary sigil is §15.4's: attuned,
  // no cost, never stock, and exactly one property tag.
  validateSigils(b.sigils === undefined ? shippedSigils : b.sigils, vctx, b);

  // ---- consumables and companions (SPEC §14.3, step 5b) ----------------------
  // Whole numbers with a [NOTE] each, a sale never above the price, a skill
  // book's track a derived non-class one; a companion writes no triggers — its
  // property is its tagging.csv row, a leaf under the companion branch.
  consumableTableProblems(b.consumables === undefined ? shippedConsumables : b.consumables, b, err);
  companionTableProblems(b.companions === undefined ? shippedCompanions : b.companions, b, err);

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
