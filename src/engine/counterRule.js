import { fixCoreEnabled, fixCoreCounterRules } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { configuredModule } from '../model/profileModule.js';
import { counterStackReturn, counterStackCount, STACK_CEILING } from './guardStacks.js';

/** True when the Core 2 Counter rule governs this fight. Legacy and co-op profiles keep their own return. */
export const counterRuleActive = ctx => fixCoreEnabled(ctx);

/** True when a Counter stance beats the incoming maneuver in the stances module's matchup table. */
export function counterBeats(ctx, incomingManeuver) {
  return !!incomingManeuver && !!configuredModule(ctx, 'stances')?.matchups?.counter?.includes(incomingManeuver);
}

/**
 * { hp, poise, block } a Counter returns (and adds to its owner's Block) against one hit of `incoming` damage.
 * Incoming damage is measured before target protection. HP includes base once per attack,
 * the configured stack share, and any stance advantage.
 */
export function counterReturn(ctx, incoming, advantaged, { stacks = 0, base = 0 } = {}) {
  const cfg = fixCoreCounterRules(fixCoreRules(ctx));
  const whole = Math.max(0, Math.floor(Number(incoming) || 0));
  if (!whole) return { hp: 0, poise: 0, block: 0 };
  const hp = Math.max(0, Math.floor(Number(base) || 0)) + counterStackReturn(stacks, whole)
    + (advantaged ? Math.floor(cfg.advantageIncomingFraction * whole) : 0);
  return {
    hp,
    poise: Math.floor((advantaged ? cfg.advantagePoiseFraction : cfg.poiseFraction) * hp),
    block: advantaged ? Math.floor(cfg.advantageBlockFraction * whole) : 0,
  };
}

/** The Counter stacks `entity` would hold after playing a Counter card that leaves it `block` Block (capped). */
export const counterStacksAfterCard = (entity, block) => Math.min(STACK_CEILING, counterStackCount(entity) + Math.max(0, Math.floor(Number(block) || 0)));

/** The return of an executed action: the sum over the contacts the Counter covered. `base` is the card's own damage, paid on the first. */
export function counterReturnForReceipt(ctx, receipt, { stacks = 0, base = 0 } = {}) {
  const total = { hp: 0, poise: 0, block: 0, incoming: 0, stackShare: 0 };
  let basePaid = false;
  (receipt.covered || []).forEach((covered, index) => {
    if (!covered) return;
    const incoming = receipt.incomings?.[index] ?? receipt.amounts?.[index] ?? 0;
    const row = counterReturn(ctx, incoming, counterBeats(ctx, receipt.profiles?.[index]?.maneuver), { stacks, base: basePaid ? 0 : base });
    if (row.hp > 0 || incoming > 0) basePaid = true;
    total.hp += row.hp; total.poise += row.poise; total.block += row.block;
    total.incoming += Math.max(0, Math.floor(Number(incoming) || 0)); total.stackShare += row.hp > 0 || incoming > 0 ? counterStackReturn(stacks, incoming) : 0;
  });
  return total;
}

/** Automatic returns share the owner-cycle budget; a paid contact has its own serial below. */
export const counterReturnSpent = entity => entity?.combatCounterReturnedCycle === (entity?.combatOwnerCycle || 0);
export const paidCounterContact = (ctx, carrier, counter) => ctx.reactionRules?.contactPolicy === 'perHit'
  && Number.isSafeInteger(carrier?.manualCounterSerial) && carrier.manualCounterSerial === counter?.serial;

/** The Block a covered, advantaged hit adds to the Counter's owner before it is absorbed (0 otherwise). */
export function counterBlockBonus(ctx, receipt, index, incoming) {
  if (!counterRuleActive(ctx) || !receipt?.counterEligible || receipt.avoided || !receipt.covered?.[index]) return 0;
  if (!counterBeats(ctx, receipt.profiles?.[index]?.maneuver)) return 0;
  return counterReturn(ctx, incoming, true).block;
}
