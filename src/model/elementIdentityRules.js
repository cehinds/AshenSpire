// Element identity rules, read side (W25, owner 2026-11-14): which element a hit carries and the numbers of
// content/source/fixCoreMechanics.json `elements`. Pure and headless; the engine effects live in
// src/engine/elementIdentity.js. A fight copies the rules into itself when it is created, so a fight (or a run
// profile) without an `elements` block keeps every pre-W25 behaviour: ElementRulesOf returns null.
import { fixCoreEnabled, StatusCapsLifted } from './fixCoreMechanics.js';
import { componentPartsOf, magicShareOf, schoolOf } from './combatRatings.js';

/** The element rules this fight plays under, or null (old fights, other profiles). */
export function ElementRulesOf(ctx) {
  const rules = ctx?.fixCoreRules?.elements;
  return rules?.version === 1 && fixCoreEnabled(ctx) ? rules : null;
}

/**
 * ForceRules(ctx) -> the Force rules this fight plays under (owner, 2026-11-18, section 20), read from its saved `elements.force`:
 *   magicShare (0: Force is physical), poiseShare (0.5 to Poise after Block), push and knockback (false: no built-in Retreat).
 * A fight whose snapshot lacks those keys keeps the old Force: a 0.5 magic share, the x1.5 Poise damage (when `poiseMultiplier` is saved), the push and the
 * Knockback. That covers a Core fight saved before the ruling, one with no `elements` block (made before W25), and any non-Core fight.
 */
export function ForceRules(ctx) {
  const force = ctx?.fixCoreRules?.elements?.force;
  // The new Force is data in the fight (elements.force.magicShare or poiseShare). A fight without it, Core or not (an old save, an unconfigured profile), keeps the old Force.
  const legacy = !(Number.isFinite(force?.magicShare) || Number.isFinite(force?.poiseShare));
  return {
    legacy,
    magicShare: Number.isFinite(force?.magicShare) ? Math.max(0, force.magicShare) : legacy ? 0.5 : 0,
    poiseShare: Number.isFinite(force?.poiseShare) ? Math.max(0, force.poiseShare) : null,
    poiseMultiplier: Number.isFinite(force?.poiseMultiplier) ? force.poiseMultiplier : null,
    push: force?.push ?? legacy,
    knockback: force?.knockback ?? legacy,
  };
}
/** FightMagicShare(ctx, profile, config) -> magicShareOf, except that a Force-school hit with no share of its own reads this fight's Force magic share. */
export function FightMagicShare(ctx, profile, config = null) {
  if (schoolOf(profile) === 'force' && !Number.isFinite(profile?.magicShare) && !componentPartsOf(profile)) return ForceRules(ctx).magicShare;
  return magicShareOf(profile, config);
}

const ELEMENT_OF = Object.freeze({
  fire: 'fire', burn: 'fire',
  lightning: 'lightning', shock: 'lightning',
  sacred: 'divine', divine: 'divine', holy: 'divine',
  decay: 'necrotic', necrotic: 'necrotic',
  frost: 'frost', cold: 'frost', chilled: 'frost',
  arcane: 'force', force: 'force',
});
const tagIds = carrier => [...(carrier?.cardTags || []), ...(carrier?.tags || []), ...(carrier?.combatProfile?.tags || [])]
  .map(tag => (typeof tag === 'string' ? tag : tag?.id));

/**
 * The element of a hit: the damage type or school of the card or enemy move that carries it, as one of
 * fire, lightning, divine, necrotic, frost, force (null for physical, earth, poison and the rest).
 * An explicit element or `damage:` tag wins, then the school, then the damage type.
 */
const notDefaultArcane = type => (type === 'arcane' ? null : type);
export function ElementOfHit(carrier) {
  const profile = carrier?.combatProfile || {};
  const named = raw => (raw && ELEMENT_OF[raw] ? ELEMENT_OF[raw] : null);
  const tagged = kind => tagIds(carrier).map(tag => String(tag || '').split(':')).filter(([k]) => k === kind).map(([, id]) => named(id)).find(Boolean) || null;
  // An authored element, then an explicit `damage:` tag, then the school, then the damage type. A spell's DEFAULT damage type (arcane) is not an element:
  // an unschooled spell carries none, and a fire spell is fire. Force comes from `school:force` or an explicit `damage:arcane` / `damage:force` tag.
  return named(carrier?.element) || named(profile.element) || tagged('damage') || tagged('element') || named(carrier?.school) || named(profile.school) || tagged('school')
    || named(notDefaultArcane(carrier?.damageType)) || named(notDefaultArcane(profile.damageType));
}

/** True when the card or move already hits every enemy (target allEnemies, or the area tag). */
export function HitsAllTargets(carrier) {
  if (carrier?.elementAllTargets) return true;
  if (tagIds(carrier).includes('targeting:area')) return true;
  return (carrier?.effects || []).some(effect => effect?.op === 'damage' && effect.target === 'allEnemies');
}

/** The element-specific tooltip a status shows when element rules are on (null otherwise). */
export function ElementStatusTooltip(ctx, id) {
  const rules = ElementRulesOf(ctx);
  if (!rules) return null;
  const pct = value => `${Math.round(value * 100)}%`;
  if (id === 'burn') {
    return `At the start of its turn, loses HP equal to Burn stacks (ignores Block). Each stack also adds +${pct(rules.burn.damageTakenPerStack)} damage taken, and each turn start it has a ${rules.burn.explodeChancePerStack}% chance per stack to explode (a chance, never previewed), hurting its allies for its stacks and clearing the Burn.`;
  }
  return null;
}

/** True when this fight lifts the cap of this status: every status under `statusCaps: "none"` (owner 2026-11-15), Burn under the element rules. Nothing limits its stacks. */
export function ElementStatusUncapped(ctx, id) {
  if (StatusCapsLifted(ctx)) return true;
  const rules = ElementRulesOf(ctx);
  return !!rules && id === 'burn' && !Number.isFinite(rules.burn.cap);
}
