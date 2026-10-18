import { attackHitPreview } from './stanceHit.js';
import { sourceRatingValue } from '../model/combatRatings.js';
import { sameStance, stanceStaminaCost, stanceManaCost, stanceEffectiveness } from '../model/stanceRules.js';
import { fixCoreEnabled, fixCoreRules, protectionReceipt, damageReceipt } from '../model/fixCoreMechanics.js';
import { stanceMitigation } from './stanceMitigation.js';
import { cardPreparationCategory } from '../model/cardClassification.js';
import { rememberCombatStance, defensiveCombatStance } from './concurrentStances.js';
import { proposalHitPlan, proposalTargetPlan } from './proposalStatusRuntime.js';
// Configured combat adapter. All rules are scoped to the saved resolved profile;
// a missing/current profile leaves the existing interpreter untouched.
import { gameModule, gameContent } from '../model/gameProfile.js';

export function configuredCombat(subject) {
  const profile = subject?.gameProfile;
  return !!profile && (profile.foundation?.mode === 'configured'
    || Object.values(profile.modules || {}).some(rule => rule?.mode === 'configured'));
}
export function configuredModule(subject, id) {
  const rule = gameModule(subject, id);
  return rule?.mode === 'configured' ? rule : null;
}
export function configuredStance(carrier) {
  if (cardPreparationCategory(carrier)) return 'prepared';
  const raw = carrier?.stanceTrigger?.stance || carrier?.combatProfile?.maneuver || carrier?.maneuver
    || (carrier?.cardTags || carrier?.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id).find(tag => tag.startsWith('maneuver:'))?.slice(9);
  return ({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack' })[raw] || raw || 'neutral';
}
export function setProfileStance(ctx, entity, carrier) {
  if (!configuredCombat(ctx)) return false;
  if (fixCoreEnabled(ctx) && carrier && carrier.fixCoreSameStance === undefined) carrier.fixCoreSameStance = sameStance(entity, carrier);
  if (fixCoreEnabled(ctx)) entity.matchingStanceCardMultiplier = carrier?.fixCoreSameStance ? fixCoreRules(ctx).stance.effectivenessMultiplier - 1 : 0;
  const previous=entity.combatStance;
  const rule = configuredModule(ctx, 'stances');
  const stance = configuredStance(carrier);
  entity.combatStance = rule?.include?.includes(stance)
    ? { maneuver: stance, camp: carrier?.combatProfile?.camp || 'physical', range: carrier?.combatProfile?.range || 'melee' }
    : { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  rememberCombatStance(ctx,entity,previous);
  ctx.emit?.('combatStanceChanged', { targetId: entity.id, maneuver: entity.combatStance.maneuver });
  return true;
}
function rating(entity, name) {
  const aliases = { ar: 'attackRating', dr: 'defenseRating' };
  const value = entity?.ratings?.[name] ?? entity?.[name] ?? entity?.[aliases[name]] ?? 0;
  return Number.isFinite(value) ? value : 0;
}
function hasPoise(target) {
  return (target?.gameProfilePoise ?? target?.poise ?? target?.ratings?.poise
    ?? target?.poiseMax ?? target?.poiseMeter?.max ?? 0) > 0;
}

// Pure probability/receipt math: execution supplies a transactional RNG roll. No RNG,
// source mutation, legacy elemental/rank riders, or protection-pool depletion.
export function profileDamageReceipt(ctx, source, target, base, carrier = {}, { roll = null, proposal = true } = {}) {
  const effects = configuredModule(ctx, 'effects');
  const stances = configuredModule(ctx, 'stances');
  const defenses = configuredModule(ctx, 'defenses');
  const attacking = configuredStance(carrier);
  const defending = configuredStance(defensiveCombatStance(ctx,target,carrier));
  const advantage = !!stances?.include?.includes(attacking)
    && !!stances?.matchups?.[attacking]?.includes(defending);
  let raw = Math.max(0, Math.floor((base + (fixCoreEnabled(ctx) ? sourceRatingValue(ctx, source, 'ar') : rating(source, 'ar')) * (effects?.attackRatingWeight || 0)) * stanceEffectiveness(ctx, source, carrier)));
  if (fixCoreEnabled(ctx) && target?.statuses?.vulnerable?.stacks > 0) raw = Math.floor(raw * fixCoreRules(ctx).statuses.vulnerabilityMultiplier);
  if(proposal && target) raw=proposalHitPlan(ctx,source,target,raw,carrier).amount;
  const defense = stanceMitigation(ctx, attacking, defending);
  let amount = Math.max(0, Math.floor(raw * (advantage ? stances.advantageMultiplier ?? 1 : 1) * defense.multiplier));
  const evade = stances?.include?.includes('evade') && defending === 'evade';
  const targeting=proposalTargetPlan(ctx,source,target,carrier);
  let hitChance = evade ? Math.max(stances.minimumHitChance ?? 0.05,
    Math.min(stances.maximumHitChance ?? 0.95, (stances.accuracyBase ?? 0.75)
      + (rating(source, stances.accuracyStat || 'ar') - rating(target, stances.evasionStat || 'dr'))
        * (stances.accuracyWeight ?? 0.02))) : 1;
  hitChance=targeting.unavoidable ? 1 : Math.max(0.05,Math.min(1,hitChance+targeting.accuracyDelta/100));
  if (fixCoreEnabled(ctx)) hitChance = (attackHitPreview(ctx, source, target, carrier)?.hitChance ?? 100) / 100;
  const evaded = roll !== null && roll >= hitChance;
  if (evaded) amount = 0;
  else if (evade) amount = Math.floor(amount * (stances.evadeFailureMultiplier ?? 2));
  let blocked = 0, poiseMitigated = 0, wardMitigated = 0;
  const incoming = amount;
  const magical = ['spell', 'spells', 'magic', 'magical'].includes(carrier?.combatProfile?.camp) || carrier.damageSchool && carrier.damageSchool !== 'physical';
  const sources = [{id:'incoming',label:'Offensive damage',amount:incoming,stage:'offense',operation:'set'}];
  if (fixCoreEnabled(ctx)) {
    if (!magical) { blocked = Math.min(Math.max(0, target?.block || 0), amount); amount -= blocked; }
    const protection = protectionReceipt(ctx, target, magical ? 'magical' : 'physical', amount);
    amount = protection.amount;
    if (magical) wardMitigated = protection.reduced; else poiseMitigated = protection.reduced;
    sources.push(...protection.sources, {id:'block',label:'Block',amount:-blocked,stage:'mitigation',operation:'add'});
  }
  for (const stage of fixCoreEnabled(ctx) ? [] : defenses?.order || []) {
    if (!defenses.include?.includes(stage)) continue;
    if (stage === 'block') {
      const spent = Math.min(Math.max(0, target?.block || 0), amount);
      blocked += spent; amount -= spent;
    } else if (stage === 'poise' && amount > 0
      && (defenses.poiseActive === 'always' || defenses.poiseActive === 'positive' && hasPoise(target))) {
      const mitigated = Math.max(defenses.minimumPositiveDamage ?? 1,
        Math.floor(amount * (defenses.poiseMultiplier ?? 0.75)));
      poiseMitigated += amount - mitigated; amount = mitigated;
    }
  }
  return { raw, wardMitigated,
    damageReceipt: damageReceipt(target?.id, [{incoming,physical:magical ? 0 : incoming,magical:magical ? incoming : 0,blocked,wardReduced:wardMitigated,poiseReduced:poiseMitigated,hpLoss:amount,sources}]),
    hitChance, uncertain: (fixCoreEnabled(ctx) ? hitChance < 1 : evade) && roll === null,
    hpLossBounds: (fixCoreEnabled(ctx) ? hitChance < 1 : evade) ? [0, amount] : [amount, amount], amount: amount + blocked, hpLoss: amount, blocked, poiseMitigated,
    blockRemaining: Math.max(0, (target?.block || 0) - blocked), evaded, advantage,
    defenseAdvantage: defense.defenseAdvantage, stanceMitigation: defense.mitigation,
    attackStance: attacking, defenseStance: defending,
    interrupted: advantage && stances?.staggerOnAdvantage === true
      && (stances.staggerManeuvers || ['smash']).includes(attacking) };
}
export function profileCardCosts(ctx, def) {
  const resources = configuredModule(ctx, 'resources');
  const include = resources?.include || [];
  const authored = def.resourceCosts || def.costs || {};
  const baseSp = def.cost==='X' && include.includes('sp') ? Math.max(0,ctx.player?.stamina ?? ctx.player?.energy ?? 0) : authored.sp ?? def.staminaCost ?? (typeof def.cost === 'number' ? def.cost : 0);
  const sp = fixCoreEnabled(ctx) ? stanceStaminaCost(baseSp, ctx.player, def, ctx) : baseSp;
  const mp = stanceManaCost(authored.mp ?? def.manaCost ?? 0, ctx.player, def, ctx);
  if ((!include.includes('sp') && sp > 0) || (!include.includes('mp') && mp > 0)) {
    throw new Error(`Card ${def.id || 'unknown'} requires an authored disabled-resource variant`);
  }
  return { energy: include.includes('sp') ? Math.max(0, sp) : 0,
    stamina: include.includes('sp') ? Math.max(0, sp) : 0,
    mana: include.includes('mp') ? Math.max(0, mp) : 0 };
}
export function profileHandSize(ctx) {
  const cards = configuredModule(ctx, 'cards');
  if (!cards) return 0;
  return Math.max(0, Math.floor((cards.handBase ?? 4)
    + (ctx.attributes?.[cards.handAttribute || 'intelligence'] || 0)));
}
export function profileFallbackDamage(ctx) {
  return gameContent(ctx, 'fallback')?.attackDamage ?? ctx.gameProfile?.foundation?.attackDamage ?? 5;
}
export function refreshProfileRound(ctx, returned) {
  const cards = configuredModule(ctx, 'cards');
  if (!cards || cards.roundShuffle !== 'entireDeck') return false;
  // Exhausted instances stay exhausted. Persistent power application state is
  // retained on entities; never recreate an instance or replay its hooks here.
  ctx.piles.draw.push(...returned, ...ctx.piles.discard);
  ctx.piles.discard = [];
  ctx.piles.draw = ctx.rng.shuffle('shuffle', ctx.piles.draw);
  ctx.emit('deckShuffled', { size: ctx.piles.draw.length, reason: 'configuredRoundRefresh' });
  return true;
}

export function freezeProfile(profile) {
  if (!profile || typeof profile !== 'object' || Object.isFrozen(profile)) return profile;
  for (const value of Object.values(profile)) freezeProfile(value);
  return Object.freeze(profile);
}
