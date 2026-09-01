// src/framework/bridge.js — the runtime seam between the legacy engine/UI and
// the framework (cutover path, step "port the legacy consumers": the
// framework becomes the DECISION authority for card lifecycle vocabulary and
// keyword terminology while legacy modules keep their interfaces).
//
// Decisions run on the RESOLVED card def — upgrades, mods, profiles and
// smithing can change keywords (an upgrade may remove Exhaust), so a base-row
// lookup would be wrong. The def is mapped through the importer's ONE
// card-mechanics mapping (never display text) and cached by def identity
// (resolved defs are frozen and cached upstream in resolveCard).

import { properties as propertiesData } from './data/properties.js';
import { relations as relationsData } from './data/relations.js';
import { terms as termsData } from './data/terms.js';
import { confirmationPolicies } from './data/confirmationPolicies.js';
import { PropertyRegistry, TermRegistry, ConfirmationRegistry } from './registries.js';
import { cardPropertyInstances, KEYWORD_PROPERTY } from './importer.js';
import { destinationAfterPlay, endTurnCleanup } from './lifecycle.js';
import { compileCosts } from './costs.js';
import { hasProperty, propertyParameters } from './compiler.js';

let sharedBridge = null;

/**
 * The bridge reads only canonical framework data (never the content bundle),
 * so one instance serves every registries object; created on first use.
 * Plain-property assignment in createRegistries keeps it visible to tests
 * that clone registries with spread.
 */
export function sharedFrameworkBridge() {
  if (!sharedBridge) sharedBridge = createFrameworkBridge();
  return sharedBridge;
}

export function createFrameworkBridge() {
  const props = new PropertyRegistry(propertiesData.properties, relationsData.relations);
  const terms = new TermRegistry(termsData.terms);
  const confirmation = new ConfirmationRegistry(confirmationPolicies);
  const viewCache = new WeakMap();

  /** Property view of a resolved legacy card def, cached by def identity. */
  function viewFor(def) {
    let view = viewCache.get(def);
    if (!view) {
      view = Object.freeze({
        id: def.id,
        properties: Object.freeze(cardPropertyInstances(def).map((p) => Object.freeze({
          propertyId: p.propertyId,
          parameters: p.parameters || {},
        }))),
      });
      viewCache.set(def, view);
    }
    return view;
  }

  return Object.freeze({
    viewFor,

    /** After-play placement (framework contract: Card lifecycle). */
    afterPlayDestination(def) {
      return destinationAfterPlay(viewFor(def), { cancelled: false, legal: true });
    },

    /** End-of-turn fate of one card in hand: 'keep' | 'exhaust' | 'discard'. */
    endTurnFate(def) {
      const { keep, exhaust } = endTurnCleanup([viewFor(def)]);
      if (keep.length) return 'keep';
      if (exhaust.length) return 'exhaust';
      return 'discard';
    },

    isInnate(def) {
      return hasProperty(viewFor(def), 'lifecycle.innate');
    },

    /**
     * The card's cost profile (framework contract: Cost compilation): base
     * action/mana/stamina from the cost properties, with the Power cost
     * reduction applied only when the card IS a Power — that classification
     * decision lives here, not at the call site. `variable` marks X costs;
     * their numeric action amount is the caller's to substitute.
     */
    costProfile(def, { powerCostReduction = 0 } = {}) {
      const view = viewFor(def);
      const modifiers = powerCostReduction && hasProperty(view, 'classification.power')
        ? [{ resource: 'action', delta: -powerCostReduction }]
        : [];
      const profile = compileCosts({ ...view, overrides: {} }, { modifiers });
      const amount = (resource) => profile.entries.find((e) => e.resource === resource)?.amount ?? 0;
      const action = propertyParameters(view, 'cost.action');
      return {
        action: amount('action'),
        mana: amount('mana'),
        stamina: amount('stamina'),
        variable: Boolean(action && action.variable),
      };
    },

    /**
     * The canonical display word for a cost resource — the shipped
     * vocabulary ('Energy' is the in-game word for the action cost),
     * resolved only through TermRegistry.
     */
    resourceWord(resource) {
      const termId = { action: 'term.energy', mana: 'term.mana', stamina: 'term.stamina' }[resource];
      if (!termId) throw new Error(`bridge: unknown cost resource ${JSON.stringify(resource)}`);
      return terms.displayTerm(termId);
    },

    /**
     * The confirmation level for a registered action, as the tone the shared
     * modal wears: DESTRUCTIVE reads 'danger', every other level 'normal'.
     * An unknown action id throws — a destructive surface with no registered
     * policy is exactly what the registry exists to prevent.
     */
    confirmationTone(actionId) {
      return confirmation.policyForAction(actionId).level === 'DESTRUCTIVE' ? 'danger' : 'normal';
    },

    isUnplayable(def) {
      return hasProperty(viewFor(def), 'internal.unplayable');
    },

    /**
     * Canonical display for a legacy keyword id — words resolved only through
     * TermRegistry. Returns null for an id outside the keyword vocabulary
     * (the caller skips it, as the legacy keyword registry lookup did).
     */
    keywordDisplay(keywordId) {
      const propertyId = KEYWORD_PROPERTY[keywordId];
      if (!propertyId) return null;
      const prop = props.require(propertyId);
      return {
        name: terms.displayTerm(prop.playerTermId),
        tooltip: terms.displayTerm(prop.tooltipTermId),
      };
    },
  });
}
