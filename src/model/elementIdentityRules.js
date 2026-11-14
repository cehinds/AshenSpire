// Element identity rules, read side (W25, owner 2026-11-14): which element a hit carries and the numbers of
// content/source/fixCoreMechanics.json `elements`. Pure and headless; the engine effects live in
// src/engine/elementIdentity.js. A fight copies the rules into itself when it is created, so a fight (or a run
// profile) without an `elements` block keeps every pre-W25 behaviour: ElementRulesOf returns null.
import { fixCoreEnabled } from './fixCoreMechanics.js';

/** The element rules this fight plays under, or null (old fights, other profiles). */
export function ElementRulesOf(ctx) {
  const rules = ctx?.fixCoreRules?.elements;
  return rules?.version === 1 && fixCoreEnabled(ctx) ? rules : null;
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
export function ElementOfHit(carrier) {
  const profile = carrier?.combatProfile || {};
  const named = raw => (raw && ELEMENT_OF[raw] ? ELEMENT_OF[raw] : null);
  const tagged = kind => tagIds(carrier).map(tag => String(tag || '').split(':')).filter(([k]) => k === kind).map(([, id]) => named(id)).find(Boolean) || null;
  // An authored element, then an explicit `damage:` tag, then the school; a spell's default damage type (arcane) is the last resort, so a fire spell is fire.
  return named(carrier?.element) || named(profile.element) || tagged('damage') || tagged('element') || named(carrier?.school) || named(profile.school) || tagged('school')
    || named(carrier?.damageType) || named(profile.damageType);
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
    return `Each stack: +${pct(rules.burn.damageTakenPerStack)} damage taken and 1 HP lost at the start of its turn (ignores Block); each turn start it has a ${rules.burn.explodeChancePerStack * 1}% chance per stack to explode (a chance, never previewed), hurting its allies for its stacks and clearing the Burn. One stack burns out each turn. At most ${rules.burn.cap}.`;
  }
  return null;
}
