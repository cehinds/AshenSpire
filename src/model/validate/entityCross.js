// src/model/validate/entityCross.js — entity cross checks, sigils, consumables and companions.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { sigils as shippedSigils } from '../../content/sigils.js';
import { consumables as shippedConsumables } from '../../content/consumables.js';
import { companions as shippedCompanions } from '../../content/companions.js';
import { consumableTableProblems, companionTableProblems } from '../consumables.js';
import { validateEffects, validatePredicate } from './effectGrammar.js';
import { validateCardRamp, validateCardContest, validateCardTemplates, validateRelicTemplate } from './templates.js';
import { relicPropertyTagIndex } from './propertyRules.js';
import { validateSigils } from './sigilRows.js';

export function entityCrossProblems(b, err, ctx) {
  const { ids, vctx } = ctx;
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
}
