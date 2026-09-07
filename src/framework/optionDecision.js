// src/framework/optionDecision.js — the framework's ADOPTED option-decision
// interaction router (shared presentation tranche; same adoption pattern as
// deckComposition.js and confirmationRule.js).
//
// The tap-to-review vs hold-to-commit surface every routed action uses lives
// in src/ui/components/optionDecision.js; this door makes the framework the
// authority boundary consumers import it through. One implementation, one
// home. Its LEVEL rule for effect-carrying choices is the adopted fail-closed
// derivation (src/framework/confirmationRule.js); its static severities come
// from the ConfirmationRegistry.

import { armOptionDecision as adoptedArmOptionDecision } from '../ui/components/optionDecision.js';
import {
  armHold as adoptedArmHold,
  armInspect as adoptedArmInspect,
  beatArmer as adoptedBeatArmer,
  holdMs as adoptedHoldMs,
  HOLD_POINTER_SLOP as ADOPTED_HOLD_POINTER_SLOP,
} from '../ui/components/holdconfirm.js';

export const armOptionDecision = adoptedArmOptionDecision;

// The rest of the routed-interaction surface (hold-to-commit, press-to-
// inspect, the per-screen beat armer and its timing constants) is the same
// adoption: holdconfirm.js remains the one implementation, and consumers
// reach it through this door. (Plain import-then-export consts: the
// standalone bundler does not parse the `export { … } from` re-export form.)
export const armHold = adoptedArmHold;
export const armInspect = adoptedArmInspect;
export const beatArmer = adoptedBeatArmer;
export const holdMs = adoptedHoldMs;
export const HOLD_POINTER_SLOP = ADOPTED_HOLD_POINTER_SLOP;
