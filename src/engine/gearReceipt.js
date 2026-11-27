// Compatibility API: canonical worn-gear damage reads live in the shared model leaf.
import * as GearRead from '../model/gearDamageRead.js';

export const GearGainBonus = (entity, kind) => GearRead.GearGainBonus(entity, kind);
export const GearProps = entity => GearRead.GearProps(entity);
export const GearState = (ctx, entity) => GearRead.GearState(ctx, entity);
export function GearReceiptAdd(ctx, source, target, carrier, options) {
  return GearRead.GearReceiptAdd(ctx, source, target, carrier, options);
}
export function GearMeleeHit(profile, carrier) { return GearRead.GearMeleeHit(profile, carrier); }
