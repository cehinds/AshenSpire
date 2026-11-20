import { characterSettings,resolveEnemyAttributes,enemyItemBonuses,enemyPools,enemyLevel,enemyAttributeTotal,enemyEffectiveLevel } from '../../engine/kernel/gameConfig.js';
import { fixCoreEnabled } from './fixCoreMechanics.js';
// Project only the configured enemy's actual held gear. The source catalog is
// the pinned profile, and the kernel resolves the same points as player gear.
// `actLevelled`: the fight supplied this enemy's level (createRunCombat's enemyLevelsForFight), so an act level applies.
export function gameProfileEnemyRatings(ctx,enemy,{actLevelled=false}={}) {
  if (!fixCoreEnabled(ctx)) return null;
  const content=ctx.gameProfile?.content, definition=content?.enemies?.find(row=>row.id===enemy.enemyId);
  if (!definition) return null;
  const settings=characterSettings(ctx.gameProfile.modules);
  // An elite or boss with an act level (enemies.effectiveLevelByAct, owner 2026-11-17) is priced at the level the fight gave it.
  const effective=actLevelled && enemyEffectiveLevel(definition,settings,1)!==null && Number.isSafeInteger(enemy.level) && enemy.level>0;
  const level=effective ? enemy.level : enemyLevel(definition,settings);
  const allocated=resolveEnemyAttributes(effective ? {...definition,level} : definition,settings,`${ctx.rng.seed}/${enemy.id}`);
  const bonus=enemyItemBonuses(definition,content,ctx.gameProfile.modules.gear);
  const attributes=Object.fromEntries(Object.entries(allocated).map(([id,value])=>[id,enemyAttributeTotal(definition,settings,id,value,bonus)]));
  const pools=enemyPools({...definition,resolvedAttributes:allocated},settings,level,bonus);
  const attributeBonuses=Object.fromEntries(Object.keys(allocated).map(id=>[id,bonus[id] || 0]));
  return {attributes,ownAttributes:allocated,attributeBonuses,level,maxStamina:pools.sp,stamina:pools.sp,maxMana:pools.mp,mana:pools.mp,baseEvasionBonus:bonus.evasion || 0,basePrecisionBonus:bonus.precision || 0,
    ratings:{ar:(pools.ar || 0)+(bonus.ar || 0),dr:(pools.dr || 0)+(bonus.dr || 0),pr:0,
      poise:(enemy.ratings?.poise || 0)+(bonus.poise || 0),ward:(enemy.ratings?.ward || 0)+(bonus.ward || 0)},
    // Its HP is the characters module's HP row at that level instead of the authored range (effectiveLevelHp).
    ...(effective && settings.effectiveLevelHp ? {effectiveMaxHp:pools.hp} : {}),
    // Either HP is then scaled by its tier (enemies.hpScaleByTier, #2820 review balance pass).
    ...(Number.isFinite(settings.hpScaleByTier?.[definition.tier]) ? {hpScale:settings.hpScaleByTier[definition.tier]} : {}),
    mechanicTags:definition.mechanicTags,mechanicBindings:definition.mechanicBindings};
}
