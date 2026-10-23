import { fixCoreEnabled } from './fixCoreMechanics.js';

// Frozen per fight: an active snapshot without this version keeps its prior
// action pricing and committed plans until that fight ends (SPEC §17).
export const CORE2_ACTION_RULES_VERSION = 1;
export function core2ActionPolicyEnabled(ctx) {
  return ctx?.core2ActionRulesVersion === CORE2_ACTION_RULES_VERSION && fixCoreEnabled(ctx);
}
