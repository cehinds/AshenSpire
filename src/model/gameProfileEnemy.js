import { characterSettings,resolveEnemyAttributes,enemyItemBonuses,enemyPools,enemyLevel,enemyAttributeTotal,enemyEffectiveLevel,enemyScalingHpFactor } from '../../engine/kernel/gameConfig.js';
import { fixCoreEnabled } from './fixCoreMechanics.js';
import { EnemyHpOverride } from './enemyHpOverride.js';
import { LevelCardsFor, LevelCardMoves, LevelMoveId } from './enemyLevelCards.js';
// Project only the configured enemy's actual held gear. The source catalog is
// the pinned profile, and the kernel resolves the same points as player gear.
// `actLevelled`: the fight supplied this enemy's level (createRunCombat's enemyLevelsForFight), so an act level applies.
// `levelStep`: its floor step under characters.enemyLevelScaling (createRunCombat's EnemyLevelStepsForFight).
export function gameProfileEnemyRatings(ctx,enemy,{actLevelled=false,levelStep=null}={}) {
  if (!fixCoreEnabled(ctx)) return null;
  const content=ctx.gameProfile?.content, definition=content?.enemies?.find(row=>row.id===enemy.enemyId);
  if (!definition) return null;
  const settings=characterSettings(ctx.gameProfile.modules);
  // An elite or boss with an act level (enemies.effectiveLevelByAct, owner 2026-11-17) is priced at the level the fight gave it.
  // With characters.enemyLevelScaling (owner, 2026-11-20) every tier is, and that table replaces the by-act levels.
  const scaling=settings.enemyLevelScaling || null, levelHpTier=enemyEffectiveLevel(definition,settings,1)!==null;
  const effective=actLevelled && (scaling || levelHpTier) && Number.isSafeInteger(enemy.level) && enemy.level>0;
  const level=effective ? enemy.level : enemyLevel(definition,settings);
  const step=scaling && effective && Number.isSafeInteger(levelStep) && levelStep>0 ? levelStep : 0;
  // Each floor step is a gear upgrade: gearPerStep AR on the weapon, DR on the armour (a boss at bossSteps).
  const gearStep={ar:(scaling?.gearPerStep?.ar || 0)*step,dr:(scaling?.gearPerStep?.dr || 0)*step};
  // HP: the level row for an elite or boss under effectiveLevelHp (it climbs with level); else the rolled range, plus hpPerStep a step.
  const levelHp=effective && levelHpTier && settings.effectiveLevelHp;
  const allocated=resolveEnemyAttributes(effective ? {...definition,level} : definition,settings,`${ctx.rng.seed}/${enemy.id}`);
  const bonus=enemyItemBonuses(definition,content,ctx.gameProfile.modules.gear);
  const attributes=Object.fromEntries(Object.entries(allocated).map(([id,value])=>[id,enemyAttributeTotal(definition,settings,id,value,bonus)]));
  const pools=enemyPools({...definition,resolvedAttributes:allocated},settings,level,bonus);
  // An authored HP override replaces the level row's HP; the fight's multipliers still apply.
  const levelMaxHp=EnemyHpOverride(definition) ?? pools.hp;
  const attributeBonuses=Object.fromEntries(Object.keys(allocated).map(id=>[id,bonus[id] || 0]));
  return {attributes,ownAttributes:allocated,attributeBonuses,level,maxStamina:pools.sp,stamina:pools.sp,maxMana:pools.mp,mana:pools.mp,baseEvasionBonus:bonus.evasion || 0,basePrecisionBonus:bonus.precision || 0,
    // Owner, 2026-11-18: AR and DR are not stats. An enemy's physical damage channel is its STR and its Block channel its DEX (the
    // attribute totals above, gear points included): the numbers the retired `statRules.ar` (STR x 1) and `statRules.dr` (DEX x 1)
    // rows gave, so no enemy's damage or Block moves. Its PR stays 0 in data: enemies keep the STR channel for their spells.
    ratings:{ar:(attributes.strength || 0)+gearStep.ar,dr:(attributes.dexterity || 0)+gearStep.dr,pr:0,
      poise:(enemy.ratings?.poise || 0)+(bonus.poise || 0),ward:(enemy.ratings?.ward || 0)+(bonus.ward || 0)},
    // Its HP is the characters module's HP row at that level instead of the authored range (effectiveLevelHp).
    ...(levelHp ? {effectiveMaxHp:levelMaxHp} : {}),
    ...(scaling && !levelHp && enemyScalingHpFactor(definition,settings,step)!==1 ? {hpStepScale:enemyScalingHpFactor(definition,settings,step)} : {}),
    // The floor step, for the level-card wiring (owner, 2026-11-20); absent on profiles without the table.
    // Either HP is then scaled by its tier (enemies.hpScaleByTier, #2820 review balance pass).
    ...(Number.isFinite(settings.hpScaleByTier?.[definition.tier]) ? {hpScale:settings.hpScaleByTier[definition.tier]} : {}),
    ...(scaling ? {levelStep:step} : {}),
    mechanicTags:definition.mechanicTags,mechanicBindings:definition.mechanicBindings};
}

// Level cards (owner, 2026-11-20; docs/plans/enemy-level-scaling.md, "Level-card lists"): an enemy at floor step N fights
// with the first N cards of its list in the pinned profile (content.enemyLevelCards), picked by LevelCardsFor from
// `${seed}/${instanceId}` (no RNG draw). Each becomes an enemy move named for the card, costing the card's SP, with the
// identity tags (camp, maneuver, damage, range...) of what it came from: its own move for a unique card, the player
// card for a shared one. null without the table, the list or a step (an older snapshot, a step-0 fight).
const LEVEL_TAG_FAMILIES = ['camp:', 'maneuver:', 'damage:', 'school:', 'source:', 'delivery:', 'range:', 'reach:', 'targeting:', 'counter:'];
function levelMoveTags(registries,enemyId,entry) {
  const own=entry.from?.startsWith(`${enemyId}.`) ? registries?.enemies?.get(enemyId)?.moves?.[entry.from.slice(enemyId.length+1)] : null;
  if (own) return [...(own.tags || [])];
  const card=entry.from && registries?.cards?.has?.(entry.from) ? registries.cards.get(entry.from) : null;
  return (card?.tags || []).filter(tag=>LEVEL_TAG_FAMILIES.some(family=>tag.startsWith(family)));
}
export function GameProfileEnemyLevelMoves(ctx,enemy) {
  if (!fixCoreEnabled(ctx) || !Number.isSafeInteger(enemy.levelStep) || enemy.levelStep<=0) return null;
  const settings=ctx.gameProfile?.modules ? characterSettings(ctx.gameProfile.modules) : null;
  const lists=ctx.gameProfile?.content?.enemyLevelCards;
  if (!settings?.enemyLevelScaling || !lists || !Array.isArray(lists[enemy.enemyId])) return null;
  const entries=LevelCardsFor(lists,enemy.enemyId,enemy.levelStep,`${ctx.rng.seed}/${enemy.id}`);
  const moves=LevelCardMoves(entries);
  if (!Object.keys(moves).length) return null;
  return Object.fromEntries(entries.map(entry=>{
    const moveId=LevelMoveId(entry);
    return [moveId,{...moves[moveId],name:entry.name,id:moveId,enemyId:enemy.enemyId,levelCard:entry.id,tags:levelMoveTags(ctx.registries,enemy.enemyId,entry),kindIds:['classification.enemyMove']}];
  }));
}
