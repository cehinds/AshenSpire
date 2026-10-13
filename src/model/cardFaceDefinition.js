// src/model/cardFaceDefinition.js — the card a player SEES, in or out of combat.
//
// Combat plays `applyCardTraits(applyCombatExpansionCard(def))`; every other
// surface (deck editor, rewards, shop, piles, pickers) used to read the raw
// `resolveCard` def, so the same card said "Block" in the editor and "Ward" in
// combat. This is the one projection both sides call.

import { resolveCard } from './registries.js';
import { applyCombatExpansionCard } from '../content/combatExpansionCards.js';
import { applyCardTraits } from '../content/traitProjection.js';

// createRunState defaults: v2 expansion and v2 reaction rules (default rules apply).
export const NEW_RUN_RULES = Object.freeze({ combatExpansionVersion: 2, reactionRulesVersion: 2, reactionRules: undefined });

let runSource = () => null;
/** main.js registers how to read the live run; with no run the new-run rules apply. */
export function setCardFaceRunSource(fn) { runSource = typeof fn === 'function' ? fn : () => null; }

export function cardFaceRules(run = runSource()) {
  return run ? { combatExpansionVersion: run.combatExpansionVersion || 1,
    reactionRulesVersion: run.reactionRulesVersion ?? null, reactionRules: run.reactionRules } : NEW_RUN_RULES;
}

/** rules: { combatExpansionVersion, reactionRulesVersion, reactionRules } (a combat ctx fits). */
export function projectCombatDefinition(def, rules) {
  if (rules.combatExpansionVersion !== 2) return def;
  const expanded = applyCombatExpansionCard(def);
  if (rules.reactionRulesVersion !== 2) return expanded;
  return rules.reactionRules === undefined ? applyCardTraits(expanded) : applyCardTraits(expanded, rules.reactionRules);
}

export function cardFaceDefinition(registries, ref, rules = cardFaceRules()) {
  return projectCombatDefinition(resolveCard(registries, ref), rules);
}
