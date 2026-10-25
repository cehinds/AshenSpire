import { fixCoreEnabled } from './fixCoreMechanics.js';

// Frozen per fight: an active snapshot without this version keeps its prior
// action pricing and committed plans until that fight ends (SPEC §17).
// Version 2 (2026-10-25) adds the multi-hit SP floor, finesse Dexterity scaling and the persistent paid Advance; a
// fight saved under version 1 keeps version 1 pricing and a temporary Advance ("pending quotes are not repriced").
export const CORE2_ACTION_RULES_VERSION = 2;
export const CORE2_ACTION_RULES_VERSIONS = Object.freeze([1, 2]);
export function core2ActionPolicyEnabled(ctx) {
  return CORE2_ACTION_RULES_VERSIONS.includes(ctx?.core2ActionRulesVersion) && fixCoreEnabled(ctx);
}
/** Version 2 rules: the multi-hit floor, finesse Dexterity scaling and the persistent paid Advance. */
export function core2MultiHitRulesEnabled(ctx) {
  return core2ActionPolicyEnabled(ctx) && ctx.core2ActionRulesVersion >= 2;
}

export function enemySpPaymentValid(payment) {
  return payment !== null && typeof payment === 'object'
    && Object.keys(payment).length === 3
    && ['sp', 'advanceSp', 'totalSp'].every(key => Number.isSafeInteger(payment[key]) && payment[key] >= 0)
    && payment.totalSp === payment.sp + payment.advanceSp;
}
