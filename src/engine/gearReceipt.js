// src/engine/gearReceipt.js — the leaf the damage receipt reads for worn gear (no liveStats import, so the receipt can load it while it loads).
import { GearHitAdds, GearConditionState } from '../model/gearEffects.js';
import { ChannelWeight } from '../model/damageChannels.js';
import { sourceRatingValue } from '../model/combatRatings.js';

/** GearGainBonus(entity, kind) -> the extra stacks every `counter` or `evade` gain gives its wearer (0 for an enemy or no such gear). */
export const GearGainBonus = (entity, kind) => Math.max(0, Number(GearProps(entity)?.gainBonus?.[kind]) || 0);
export const GearProps = entity => (entity && entity.kind !== 'enemy' ? entity.itemProps || null : null);

/** The state a gear condition reads, from the player as it stands now. */
export const GearState = (ctx, entity) => GearConditionState(entity, GearProps(entity)?.mainWeaponType);

/**
 * GearReceiptAdd(ctx, source, target, carrier, { ratingId, ar, effects }) -> the damage the worn gear adds to one hit before stance, status and defence:
 * STR a second time (a Greatsword Smash), DEX in its place (a Katana, a Bow against a Retreat-stacked target) and the flat damage of a rule that reads the target.
 * Weighted exactly as the rating it stands for, so the quote and the hit read one number.
 */
export function GearReceiptAdd(ctx, source, target, carrier, { ratingId, ar, effects }) {
  const hits = GearHitAdds(GearProps(source)?.cardRules, carrier, target, GearState(ctx, source));
  let add = hits.damage;
  const strAgain = ratingId === 'ar' ? Math.max(0, carrier?.gear?.addStr || 0) : 0;
  if (strAgain) add += ar * ChannelWeight(effects, 'ar') * strAgain;
  const dexTimes = ratingId === 'ar' ? Math.max(0, carrier?.gear?.addDex || 0) + hits.addDex : 0;
  if (dexTimes) add += sourceRatingValue(ctx, source, 'dr', carrier?.sourceArmamentId, carrier?.equipmentScoped) * ChannelWeight(effects, 'dr') * dexTimes;
  return add;
}

/** True for a melee physical attack, a Smash or a Sweep: what a wearer Vulnerable to melee takes extra from. */
export function GearMeleeHit(profile, carrier) {
  const tags = [...(carrier?.tags || []), ...(carrier?.authoredTags || [])];
  if (tags.includes('maneuver:smash') || tags.includes('maneuver:sweep') || ['smash', 'sweep'].includes(carrier?.combatProfile?.maneuver)) return true;
  const range = carrier?.combatProfile?.range ?? profile?.range ?? 'melee';
  const spell = tags.includes('camp:spell') || (carrier?.combatProfile?.camp ?? profile?.camp) === 'spell';
  return range === 'melee' && !spell;
}
