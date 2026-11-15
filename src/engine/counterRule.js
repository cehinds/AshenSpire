import { fixCoreEnabled, fixCoreCounterRules, FixCoreCounterStacks } from '../model/fixCoreMechanics.js';
import { fixCoreRules } from '../model/fixCoreRulesCache.js';
import { configuredModule } from '../model/profileModule.js';
import { counterStackReturn, counterStackCount, STACK_CEILING, CounterStackGrant } from './guardStacks.js';

/** True when the Core 2 Counter rule governs this fight. Legacy and co-op profiles keep their own return. */
export const counterRuleActive = ctx => fixCoreEnabled(ctx);

/** The card-stack Counter rule (owner 2026-11-15) belongs to the player alone; an enemy Counter keeps the previous path (no stacks, charge-based). */
export const CounterStackRule = (ctx, owner) => owner?.kind === 'enemy' ? null : FixCoreCounterStacks(ctx);

/** True when a Counter stance beats the incoming maneuver in the stances module's matchup table. */
export function counterBeats(ctx, incomingManeuver) {
  return !!incomingManeuver && !!configuredModule(ctx, 'stances')?.matchups?.counter?.includes(incomingManeuver);
}

/**
 * { hp, poise, block } a Counter returns (and adds to its owner's Block) against one hit of `incoming` damage.
 * Incoming damage is measured before target protection. HP includes base once per attack,
 * the configured stack share, and any stance advantage.
 */
export function counterReturn(ctx, incoming, advantaged, { stacks = 0, base = 0, owner = null } = {}) {
  const cfg = fixCoreCounterRules(fixCoreRules(ctx));
  const whole = Math.max(0, Math.floor(Number(incoming) || 0));
  if (!whole) return { hp: 0, poise: 0, block: 0 };
  // Owner 2026-11-15: under the card-stack rule each stack returns returnPerStack of the hit and the advantage share is data (0 shipped).
  const cardStacks = CounterStackRule(ctx, owner);
  const hp = Math.max(0, Math.floor(Number(base) || 0)) + counterStackReturn(stacks, whole, cardStacks?.returnPerStack)
    + (advantaged ? Math.floor((cardStacks ? cardStacks.advantageShare : cfg.advantageIncomingFraction) * whole) : 0);
  return {
    hp,
    poise: Math.floor((advantaged ? cfg.advantagePoiseFraction : cfg.poiseFraction) * hp),
    block: advantaged ? Math.floor(cfg.advantageBlockFraction * whole) : 0,
  };
}

/** The Counter stacks `entity` would hold after playing `card` (a Counter card that leaves it `block` Block); the card-stack rule adds the card's own grant. */
export const counterStacksAfterCard = (entity, block, ctx = null, card = null) => ctx && FixCoreCounterStacks(ctx)
  ? counterStackCount(entity) + CounterStackGrant(ctx, card)
  : Math.min(STACK_CEILING, counterStackCount(entity) + Math.max(0, Math.floor(Number(block) || 0)));

/** Card-stack rule: a covered hit answers only while stacks are held and it carries incoming damage. The live return and its forecast share this. */
export const CounterHitAnswers = (held, incoming) => held > 0 && incoming > 0;

/**
 * The return of an executed action: the sum over the contacts the Counter covered. `base` is the card's own damage, paid on the first (Block-as-stacks rule)
 * or on every answered hit (card-stack rule, where each landed covered hit returns once and spends consumePerHit stacks while any are held).
 * Card-stack rule: `hits` lists each answered contact { incoming, stacksBefore, hp, poise, block }.
 */
export function counterReturnForReceipt(ctx, receipt, { stacks = 0, base = 0, owner = null } = {}) {
  const total = { hp: 0, poise: 0, block: 0, incoming: 0, stackShare: 0 };
  const cardStacks = CounterStackRule(ctx, owner);
  if (cardStacks) {
    total.hits = []; total.consumed = 0;
    let held = Math.max(0, Math.floor(Number(stacks) || 0));
    (receipt.covered || []).forEach((covered, index) => {
      if (!covered) return;
      const incoming = receipt.incomings?.[index] ?? receipt.amounts?.[index] ?? 0;
      if (!CounterHitAnswers(held, incoming)) return;
      const row = counterReturn(ctx, incoming, counterBeats(ctx, receipt.profiles?.[index]?.maneuver), { stacks: held, base, owner });
      total.hits.push({ incoming: Math.floor(incoming), stacksBefore: held, ...row });
      total.hp += row.hp; total.poise += row.poise; total.block += row.block;
      total.incoming += Math.floor(incoming); total.stackShare += counterStackReturn(held, incoming, cardStacks.returnPerStack);
      held = Math.max(0, held - cardStacks.consumePerHit); total.consumed += cardStacks.consumePerHit;
    });
    return total;
  }
  let basePaid = false;
  (receipt.covered || []).forEach((covered, index) => {
    if (!covered) return;
    const incoming = receipt.incomings?.[index] ?? receipt.amounts?.[index] ?? 0;
    const row = counterReturn(ctx, incoming, counterBeats(ctx, receipt.profiles?.[index]?.maneuver), { stacks, base: basePaid ? 0 : base, owner });
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
