import { applyStatus } from './statuses.js';
import { attackHitPreview, precisionEntryGrant } from './stanceHit.js';
import { sourceRatingValue, magicShareOf, splitContactParts, isMagicalAttack } from '../model/combatRatings.js';
import { sameStance, stanceEntryBonuses, stanceStaminaCost, stanceManaCost, stanceEffectiveness } from '../model/stanceRules.js';
import { fixCoreEnabled, fixCoreRules, protectionReceipt, damageReceipt, fixCoreWardDisabled } from '../model/fixCoreMechanics.js';
import { mirroredManeuver } from '../model/stanceRules.js';
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
// A Spell that mirrors a basic card (owner 2026-10-18) keeps that basic's stance; it is still a Spell.
export const mirroredStance = mirroredManeuver;
export function configuredStance(carrier) {
  if (mirroredStance(carrier)) return mirroredStance(carrier);
  if (cardPreparationCategory(carrier)) return 'prepared';
  const raw = carrier?.stanceTrigger?.stance || carrier?.combatProfile?.maneuver || carrier?.maneuver
    || (carrier?.cardTags || carrier?.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id).find(tag => tag.startsWith('maneuver:'))?.slice(9);
  return ({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack' })[raw] || raw || 'neutral';
}
export function setProfileStance(ctx, entity, carrier) {
  if (!configuredCombat(ctx)) return false;
  if (fixCoreEnabled(ctx) && carrier && carrier.fixCoreSameStance === undefined) carrier.fixCoreSameStance = sameStance(entity, carrier);
  if (fixCoreEnabled(ctx)) entity.matchingStanceCardMultiplier = carrier?.fixCoreSameStance ? fixCoreRules(ctx, entity, carrier).stance.effectivenessMultiplier - 1 : 0;
  const previous=entity.combatStance;
  const grants = fixCoreEnabled(ctx) && !sameStance(entity,carrier) ? stanceEntryBonuses(carrier,ctx) : null;
  const rule = configuredModule(ctx, 'stances');
  const stance = configuredStance(carrier);
  entity.combatStance = rule?.include?.includes(stance)
    ? { maneuver: stance, camp: carrier?.combatProfile?.camp || 'physical', range: carrier?.combatProfile?.range || 'melee',
      ...(mirroredStance(carrier) ? { mirrored: true, camp: 'spell' } : {}) }
    : { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  if (grants?.precision > 0) applyStatus(ctx,entity,'precision',precisionEntryGrant(ctx,entity,grants.precision,carrier),entity);
  if (grants?.evade > 0 && !carrier?.appliedStatuses?.includes('evade')) applyStatus(ctx,entity,'evade',grants.evade,entity);
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
  const modern = fixCoreEnabled(ctx);
  const sources = [{id:'base',label:'Card damage (including enhancements)',amount:base,stage:'offense',operation:'set'}];
  // The chain keeps full precision and is floored once where it is applied (the quantity-rounding step);
  // receipt lines show the running floor so every shown number is whole (owner, 2026-10-18 16:05).
  const whole = value => modern ? Math.max(0, Math.floor(value)) : value;
  const transition = (id,label,before,after,stage='offense',multiplier) => {
    if (before !== after) sources.push({id,label,amount:whole(after)-whole(before),requested:whole(before),effective:whole(after),stage,operation:multiplier === undefined ? 'add' : 'multiply',...(multiplier === undefined ? {} : {multiplier})});
    return after;
  };
  const profile = {...(carrier.combatProfile || {}), ...(Number.isFinite(carrier.magicShare) ? {magicShare:carrier.magicShare} : {})};
  const share = magicShareOf(profile,ctx.ratingsRules);
  // Owner, 2026-10-19: spell effectiveness uses PR; a spell (camp spell or magic school, whatever its Barrier split) reads PR where a physical attack reads AR.
  // A hit with any magic share (a school-only technique included, as magicShareOf reads it) reads PR.
  // Enemies keep AR for their spells: their PR is 0 in data, so reading it would zero their spell damage.
  const ratingId = modern && source?.kind !== 'enemy' && (profile.camp === 'spell' || share > 0 || isMagicalAttack(ctx, carrier)) ? 'pr' : 'ar', ratingLabel = ratingId.toUpperCase();
  const ar = modern ? sourceRatingValue(ctx, source, ratingId, carrier.sourceArmamentId, carrier.equipmentScoped) : rating(source,'ar');
  const ratingBonus = modern && carrier.skipRatingBonus ? 0 : ar * (effects?.attackRatingWeight || 0);
  let raw = base;
  const applicable = (source?.ratingSources || []).filter(row => row.kind !== 'equipment' || !carrier.sourceArmamentId && !carrier.equipmentScoped
    || row.slot === 'armor' || row.sourceId?.startsWith('armor/') || row.sourceId === carrier.sourceArmamentId || row.sourceId === `armament/${carrier.sourceArmamentId}`);
  const sourceAR = applicable.reduce((sum,row)=>sum+(row[ratingId] || 0),0);
  if (modern && sourceAR > 0 && ratingBonus > 0) {
    for (const [index,row] of applicable.entries()) {
      const contribution = (row[ratingId] || 0) * (effects?.attackRatingWeight || 0);
      raw = transition(`${ratingId}:${row.sourceId || index}`,`${row.name || row.kind}: ${ratingLabel}`,raw,raw+contribution);
    }
    raw = transition('ar:adjustments',`${ratingLabel} stance/status modifiers (including Weak)`,raw,base+ratingBonus);
  } else raw = transition('ar','Attack rating',raw,raw+ratingBonus);
  const stanceMultiplier = stanceEffectiveness(ctx,source,carrier);
  raw = transition('matching-stance','Matching stance effectiveness',raw,raw*stanceMultiplier,'offense',stanceMultiplier);
  if (modern && target?.statuses?.vulnerable?.stacks > 0) raw=transition('vulnerable','Vulnerable',raw,raw*fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier,'offense',fixCoreRules(ctx, target).statuses.vulnerabilityMultiplier);
  if (!modern) raw=Math.max(0,Math.floor(raw));
  if(proposal && target) raw=transition('status-rules','Other status modifiers',raw,proposalHitPlan(ctx,source,target,raw,carrier,{roundDamage:!modern}).amount);
  const defense = stanceMitigation(ctx, attacking, defending);
  const advantageMultiplier = advantage ? stances.advantageMultiplier ?? 1 : 1;
  let amount=transition('stance-advantage','Offensive stance advantage',raw,raw*advantageMultiplier,'stance',advantageMultiplier);
  amount=transition('stance-defense','Defensive stance advantage',amount,amount*defense.multiplier,'stance',defense.multiplier);
  amount=modern ? Math.max(0,Math.floor(amount)) : transition('quantity-rounding','Damage quantity rounding',amount,Math.max(0,Math.floor(amount)),'rounding');
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
  else if (evade && !modern) amount = Math.floor(amount * (stances.evadeFailureMultiplier ?? 2));
  let blocked = 0, poiseMitigated = 0, wardMitigated = 0;
  const incoming = amount;
  const parts = splitContactParts({amount:incoming,base,ratingBonus,share,ratingPart:ratingId === 'pr' || share >= 1 ? 'magic' : 'physical',primary:share >= 1 ? 'magic' : 'physical'});
  let physical = modern ? parts.physical : incoming, magical = modern ? parts.magic : 0;
  let barrierMitigated = 0;
  if (modern) {
    blocked = Math.min(Math.max(0,target?.block || 0),physical);
    barrierMitigated = Math.min(Math.max(0,target?.barrier || 0),magical);
    transition('block','Block',physical,physical-blocked,'mitigation');
    transition('barrier','Barrier',magical,magical-barrierMitigated,'mitigation');
    // Ward off: the magic Barrier left meets Poise with the physical residual (matches actions.js).
    const poiseMeetsMagic = fixCoreWardDisabled(ctx);
    const poise = protectionReceipt(ctx,target,'physical',physical-blocked+(poiseMeetsMagic ? magical-barrierMitigated : 0));
    const ward = protectionReceipt(ctx,target,'magical',poiseMeetsMagic ? 0 : magical-barrierMitigated);
    poiseMitigated=poise.reduced;wardMitigated=ward.reduced;
    sources.push(...poise.sources,...ward.sources);
    amount=poise.amount+ward.amount;
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
  return { raw, wardMitigated, barrierMitigated,
    damageReceipt: damageReceipt(target?.id, [{incoming,physical,magical,blocked,barrierReduced:barrierMitigated,wardReduced:wardMitigated,poiseReduced:poiseMitigated,hpLoss:amount,sources}]),
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
  const baseMp = authored.mp ?? def.manaCost ?? 0;
  const sp = fixCoreEnabled(ctx) ? stanceStaminaCost(baseSp, ctx.player, def, ctx, baseMp) : baseSp;
  const mp = stanceManaCost(baseMp, ctx.player, def, ctx);
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
