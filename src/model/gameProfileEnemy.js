import { characterSettings,resolveEnemyAttributes,enemyItemBonuses,enemyPools,enemyLevel,enemyAttributeTotal } from '../../engine/kernel/gameConfig.js';
import { fixCoreEnabled } from './fixCoreMechanics.js';
// Project only the configured enemy's actual held gear. The source catalog is
// the pinned profile, and the kernel resolves the same points as player gear.
export function gameProfileEnemyRatings(ctx,enemy) {
  if (!fixCoreEnabled(ctx)) return null;
  const content=ctx.gameProfile?.content, definition=content?.enemies?.find(row=>row.id===enemy.enemyId);
  if (!definition) return null;
  const settings=characterSettings(ctx.gameProfile.modules), level=enemyLevel(definition,settings);
  const allocated=resolveEnemyAttributes(definition,settings,`${ctx.rng.seed}/${enemy.id}`);
  const bonus=enemyItemBonuses(definition,content,ctx.gameProfile.modules.gear);
  const attributes=Object.fromEntries(Object.entries(allocated).map(([id,value])=>[id,enemyAttributeTotal(definition,settings,id,value,bonus)]));
  const pools=enemyPools({...definition,resolvedAttributes:allocated},settings,level,bonus);
  return {attributes,level,maxStamina:pools.sp,stamina:pools.sp,maxMana:pools.mp,mana:pools.mp,baseEvasionBonus:bonus.evasion || 0,basePrecisionBonus:bonus.precision || 0,
    ratings:{ar:(pools.ar || 0)+(bonus.ar || 0),dr:(pools.dr || 0)+(bonus.dr || 0),pr:0,
      poise:(enemy.ratings?.poise || 0)+(bonus.poise || 0),ward:(enemy.ratings?.ward || 0)+(bonus.ward || 0)},
    mechanicTags:definition.mechanicTags,mechanicBindings:definition.mechanicBindings};
}
