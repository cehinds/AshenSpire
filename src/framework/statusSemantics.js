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
// (Plain import-then-export consts: the standalone bundler rewrites modules
// and does not handle the `export { … } from` re-export form.)
import {
  getStatusInstance as adoptedGetStatusInstance,
  getStacks as adoptedGetStacks,
  hasStatus as adoptedHasStatus,
  applyStatus as adoptedApplyStatus,
  removeStatus as adoptedRemoveStatus,
  decayAtTurnEnd as adoptedDecayAtTurnEnd,
  getMult as adoptedGetMult,
  getAdd as adoptedGetAdd,
  getFlag as adoptedGetFlag,
  getCap as adoptedGetCap,
  anyCombatantFlag as adoptedAnyCombatantFlag,
} from '../engine/statuses.js';

export const getStatusInstance = adoptedGetStatusInstance;
export const getStacks = adoptedGetStacks;
export const hasStatus = adoptedHasStatus;
export const applyStatus = adoptedApplyStatus;
export const removeStatus = adoptedRemoveStatus;
export const decayAtTurnEnd = adoptedDecayAtTurnEnd;
export const getMult = adoptedGetMult;
export const getAdd = adoptedGetAdd;
export const getFlag = adoptedGetFlag;
export const getCap = adoptedGetCap;
export const anyCombatantFlag = adoptedAnyCombatantFlag;
