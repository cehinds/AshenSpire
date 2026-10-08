// src/framework/statusSemantics.js — the framework's ADOPTED status-effect
// semantics (same adoption pattern as deckComposition.js, confirmationRule.js
// and optionDecision.js: one implementation, one home, with the authority
// boundary — which module consumers import — moved to the framework).
//
// src/engine/statuses.js remains the implementation: stack modes, meters,
// decay clocks, procs, resists, and the derived combat modifiers
// (mult/add/flag/cap) it computes from status definitions. The WORDS for
// those same definitions already resolve through the per-bundle term overlay
// (registries.frameworkTerms); this door moves the SEMANTICS reads of every
// engine consumer behind the framework as well.
//
// Forwarding functions keep reciprocal modules live in the standalone loader.
// It rewrites named imports as eager reads and cannot preserve re-export bindings.
import * as Adopted from '../engine/statuses.js';

export function getStatusInstance(...args) { return Adopted.getStatusInstance(...args); }
export function getStacks(...args) { return Adopted.getStacks(...args); }
export function hasStatus(...args) { return Adopted.hasStatus(...args); }
export function applyStatus(...args) { return Adopted.applyStatus(...args); }
export function removeStatus(...args) { return Adopted.removeStatus(...args); }
export function decayAtTurnEnd(...args) { return Adopted.decayAtTurnEnd(...args); }
export function advanceStatusClock(...args) { return Adopted.advanceStatusClock(...args); }
export function getMult(...args) { return Adopted.getMult(...args); }
export function getAdd(...args) { return Adopted.getAdd(...args); }
export function getFlag(...args) { return Adopted.getFlag(...args); }
export function getCap(...args) { return Adopted.getCap(...args); }
export function anyCombatantFlag(...args) { return Adopted.anyCombatantFlag(...args); }

// Explicit v2 pressure/recovery shares the same framework authority boundary.
import * as Control from '../engine/combatStatusControl.js';
export function applyStatusPressure(...args) { return Control.applyStatusPressure(...args); }
export function controlRestrictions(...args) { return Control.controlRestrictions(...args); }
export function controlGate(...args) { return Control.controlGate(...args); }
export function recoveryControls(...args) { return Control.recoveryControls(...args); }
export function manualRecovery(...args) { return Control.manualRecovery(...args); }
