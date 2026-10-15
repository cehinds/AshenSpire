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
  const raw = carrier?.stanceTrigger?.stance || carrier?.combatProfile?.maneuver || carrier?.maneuver
    || (carrier?.cardTags || carrier?.tags || []).find(tag => tag.startsWith('maneuver:'))?.slice(9);
  return ({ casting: 'prepared', cast: 'prepared', spell: 'prepared', ranged: 'attack' })[raw] || raw || 'neutral';
}
export function setProfileStance(ctx, entity, carrier) {
  if (!configuredCombat(ctx)) return false;
  const rule = configuredModule(ctx, 'stances');
  const stance = configuredStance(carrier);
  entity.combatStance = rule?.include?.includes(stance)
    ? { maneuver: stance, camp: carrier?.combatProfile?.camp || 'physical', range: carrier?.combatProfile?.range || 'melee' }
    : { maneuver: 'neutral', camp: 'physical', range: 'melee' };
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
export function profileDamageReceipt(ctx, source, target, base, carrier = {}, { roll = null } = {}) {
  const effects = configuredModule(ctx, 'effects');
  const stances = configuredModule(ctx, 'stances');
  const defenses = configuredModule(ctx, 'defenses');
  const attacking = configuredStance(carrier);
  const defending = configuredStance(target?.combatStance);
  const advantage = !!stances?.include?.includes(attacking)
    && !!stances?.matchups?.[attacking]?.includes(defending);
  const raw = Math.max(0, Math.floor(base + rating(source, 'ar') * (effects?.attackRatingWeight || 0)));
  let amount = Math.max(0, Math.floor(raw * (advantage ? stances.advantageMultiplier ?? 1 : 1)));
  const evade = stances?.include?.includes('evade') && defending === 'evade';
  const hitChance = evade ? Math.max(stances.minimumHitChance ?? 0.05,
    Math.min(stances.maximumHitChance ?? 0.95, (stances.accuracyBase ?? 0.75)
      + (rating(source, stances.accuracyStat || 'ar') - rating(target, stances.evasionStat || 'dr'))
        * (stances.accuracyWeight ?? 0.02))) : 1;
  const evaded = !!evade && roll !== null && roll >= hitChance;
  if (evaded) amount = 0;
  else if (evade) amount = Math.floor(amount * (stances.evadeFailureMultiplier ?? 2));
  let blocked = 0, poiseMitigated = 0;
  for (const stage of defenses?.order || []) {
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
  return { raw, hitChance, uncertain: evade && roll === null,
    hpLossBounds: evade ? [0, amount] : [amount, amount], amount: amount + blocked, hpLoss: amount, blocked, poiseMitigated,
    blockRemaining: Math.max(0, (target?.block || 0) - blocked), evaded, advantage,
    attackStance: attacking, defenseStance: defending,
    interrupted: advantage && stances?.staggerOnAdvantage === true
      && (stances.staggerManeuvers || ['smash']).includes(attacking) };
}
export function profileCardCosts(ctx, def) {
  const resources = configuredModule(ctx, 'resources');
  const include = resources?.include || [];
  const authored = def.resourceCosts || def.costs || {};
  const sp = authored.sp ?? def.staminaCost ?? (typeof def.cost === 'number' ? def.cost : 0);
  const mp = authored.mp ?? def.manaCost ?? 0;
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
