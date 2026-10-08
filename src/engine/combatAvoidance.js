// Chance calculations are pure; only resolveAvoidance owns a committed draw.
import { combatExpansionMatchups } from '../content/combatMatchups.js';
import * as Statuses from './statuses.js';

const finite = value => Number.isFinite(value) ? value : 0;
export function chanceMode({ advantage = false, disadvantage = false } = {}) {
  return Boolean(advantage) === Boolean(disadvantage) ? 'normal' : advantage ? 'advantage' : 'disadvantage';
}

export function effectiveChance(basePercent, flags = {}) {
  const p = Math.max(0, Math.min(100, finite(basePercent))) / 100;
  const mode = chanceMode(flags);
  return 100 * (mode === 'advantage' ? 1 - (1 - p) ** 2 : mode === 'disadvantage' ? p ** 2 : p);
}

/** The caller's seeded stream owns both dice; flags never stack. */
export function rollChanceDie(rng, die, flags = {}, stream = 'combatAvoidance') {
  const draw = () => typeof rng.int === 'function' ? rng.int(stream, 1, die)
    : 1 + Math.floor((typeof rng.float === 'function' ? rng.float(stream) : rng.next(stream)) * die);
  const mode = chanceMode(flags);
  const dice = [draw()];
  if (mode !== 'normal') dice.push(draw());
  const favorableHigh = die !== 100;
  const keepHigh = mode === 'normal' || ((mode === 'advantage') === favorableHigh);
  return { dice, roll: keepHigh ? Math.max(...dice) : Math.min(...dice), mode };
}

function attributesFor(ctx, entity) {
  if (typeof ctx?.attributesForEntity === 'function') return ctx.attributesForEntity(entity) || {};
  if (entity?.attributes) return entity.attributes;
  const key = ctx?.playerIdForEntity?.(entity);
  const seat = key && ctx?.players?.get?.(key);
  return seat?.attributes || seat?.entity?.attributes || (entity === ctx?.player ? ctx.attributes : null) || {};
}

function trait(profile, name) {
  return profile?.[name] === true || profile?.traits?.includes(name);
}

/** Armor class is authored equipment identity, distinct from carried load. */
export function evadeRollPreview(ctx, entity, profile, incomingDamage, { evadeBonus = 0, evadeDisabled = false } = {}) {
  const cfg = (ctx?.combatExpansionRules?.matchups || ctx?.combatExpansionMatchupRules || combatExpansionMatchups).evade;
  const prepared = entity?.combatEvade;
  const attrs = attributesFor(ctx, entity);
  const armorClass = entity?.armorClass || entity?.combatArmorClass || ctx?.armorClassForEntity?.(entity) || 'light';
  const penalty = cfg.armorPenalty[armorClass] ?? cfg.armorPenalty.light;
  const bonus = finite(attrs.dexterity) + Math.floor(finite(attrs.wisdom) / 5)
    + Math.floor(finite(attrs.intelligence) / 10) + finite(prepared?.bonus) + finite(entity?.evadeBonus)
    + finite(evadeBonus) - penalty;
  const difficulty = cfg.baseDC + Math.max(0, finite(incomingDamage)) + finite(profile?.difficultyBonus)
    + (profile?.targeting === 'area' ? cfg.areaDifficulty[profile.reach] || 0 : 0);
  const eligible = !!prepared?.charges && !evadeDisabled && !trait(profile, 'unavoidable') && profile?.dodgeable !== false
    && (!prepared.whileStatus || entity.statuses?.[prepared.whileStatus]?.stacks > 0);
  let successes = 0;
  if (eligible) for (let roll = 1; roll <= cfg.die; roll++) if (roll + bonus > difficulty) successes++;
  const flags = { advantage: prepared?.advantage || entity?.evadeAdvantage || entity?.nextEvadeMode?.advantage,
    disadvantage: prepared?.disadvantage || entity?.evadeDisadvantage || entity?.nextEvadeMode?.disadvantage };
  const baseChance = 100 * successes / cfg.die;
  return { eligible, bonus, difficulty, baseChance, chance: effectiveChance(baseChance, flags), flags };
}

export function distancePreview(ctx, entity, incomingProfile) {
  const cfg = (ctx?.combatExpansionRules?.matchups || ctx?.combatExpansionMatchupRules || combatExpansionMatchups).distance;
  const stance = entity?.combatStance;
  const position = stance?.reach;
  const eligible = stance?.maneuver === 'ranged' && incomingProfile?.reach === 'contact'
    && !trait(incomingProfile, 'closing') && !trait(incomingProfile, 'adequateReach')
    && !trait(incomingProfile, 'unavoidable');
  const base = position === 'far' ? cfg.farChance : position === 'near' ? cfg.nearChance : 0;
  const baseChance = eligible ? Math.max(0, Math.min(cfg.maximumBaseChance, base + finite(entity.distanceAvoidanceBonus))) : 0;
  const flags = { advantage: entity?.distanceAdvantage, disadvantage: entity?.distanceDisadvantage };
  return { eligible: eligible && baseChance > 0, baseChance, chance: effectiveChance(baseChance, flags), flags };
}

export function previewAvoidance(ctx, entity, profile, incomingDamage, options = {}) {
  const distance = distancePreview(ctx, entity, profile);
  const evade = evadeRollPreview(ctx, entity, profile, incomingDamage, options);
  if (!(incomingDamage > 0)) {
    distance.eligible = evade.eligible = false;
    distance.baseChance = distance.chance = evade.baseChance = evade.chance = 0;
  }
  const prevention = ctx?.combatExpansionVersion === 2 && incomingDamage > 0
    ? entity?.statuses?.invulnerability?.stacks > 0 ? 'invulnerability'
      : entity?.statuses?.decoy?.stacks > 0 && profile?.targeting === 'single' && ['near', 'far'].includes(profile?.reach) ? 'decoy' : null
    : null;
  return { distance, evade, prevention, chance: prevention ? 100 : distance.chance + (1 - distance.chance / 100) * evade.chance };
}

/** Mutates only a prepared charge and receipt after the action is accepted. */
export function resolveAvoidance(ctx, source, target, profile, incomingDamage, options = {}, saved = null) {
  if (saved?.resolved) return saved;
  const preview = previewAvoidance(ctx, target, profile, incomingDamage, options);
  const outcome = { resolved: true, avoided: false, distance: null, evade: null, chance: preview.chance };
  if (preview.prevention) {
    Statuses.removeStatus(ctx, target, preview.prevention, { amount: 1, reason: 'consumed' });
    outcome.avoided = true;
    outcome.prevention = preview.prevention;
  }
  if (incomingDamage > 0 && !outcome.avoided && preview.distance.eligible) {
    const roll = rollChanceDie(ctx.rng, 100, preview.distance.flags);
    outcome.distance = { ...roll, chance: preview.distance.baseChance, success: roll.roll <= preview.distance.baseChance };
    outcome.avoided = outcome.distance.success;
  }
  if (incomingDamage > 0 && !outcome.avoided && preview.evade.eligible) {
    const roll = rollChanceDie(ctx.rng, 20, preview.evade.flags);
    target.combatEvade.charges--;
    delete target.nextEvadeMode;
    outcome.evade = { ...roll, total: roll.roll + preview.evade.bonus,
      difficulty: preview.evade.difficulty, success: roll.roll + preview.evade.bonus > preview.evade.difficulty };
    outcome.avoided = outcome.evade.success;
  }
  if (outcome.prevention || outcome.distance || outcome.evade) ctx.emit?.('combatAvoidanceResolved', {
    sourceId: source?.id, targetId: target?.id,
    ...(ctx.playerIdForEntity ? { sourcePlayerId: ctx.playerIdForEntity(source), targetPlayerId: ctx.playerIdForEntity(target) } : {}),
    ...outcome,
  });
  return outcome;
}
