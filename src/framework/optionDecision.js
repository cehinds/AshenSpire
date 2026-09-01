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

export const armOptionDecision = adoptedArmOptionDecision;
