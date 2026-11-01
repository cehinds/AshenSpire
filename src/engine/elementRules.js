// Element rules, pure (owner, 2026-10-31; SPEC 4.7 "Lightning, Shocked, Damp and Bedrock"). Headless, and it imports
// no engine module, so statuses.js and stanceHit.js can read it without an import cycle. The numbers are data
// (content/framework/mechanics.json `elements`). The contest itself lives in elementLightning.js.
import { mechanics } from '../framework/data/mechanics.js';
import { equippedIn } from '../model/loadout.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';

export const elementRules = () => mechanics.elements;
export const lightningRules = () => mechanics.elements.lightning;

const stacksOf = (entity, id) => {
  const inst = entity?.statuses?.[id];
  return inst ? Math.max(0, Number(inst.meter ? inst.meter.value : inst.stacks) || 0) : 0;
};
export const statusStacks = stacksOf;

/** A lightning hit: the card or move carries a lightning tag, or its damage type or school is lightning. */
export function isLightning(carrier) {
  const tags = [...(carrier?.cardTags || []), ...(carrier?.tags || [])].map(tag => (typeof tag === 'string' ? tag : tag?.id));
  const profile = carrier?.combatProfile || {};
  return tags.some(tag => tag === 'lightning' || tag === 'school:lightning' || tag === 'damage:lightning')
    || [carrier?.damageType, carrier?.school, carrier?.element, profile.damageType, profile.school].includes('lightning');
}

/** Precision a Shocked holder loses: 1 per stack. */
export const shockedPenalty = entity => stacksOf(entity, 'shocked');

/** Burn applied to a Damp holder is halved, rounded down, at least 1 when any was applied. */
export function dampBurnStacks(target, stacks) {
  if (!(stacks > 0) || stacksOf(target, 'damp') <= 0) return stacks;
  return Math.max(1, Math.floor(stacks * lightningRules().dampBurnMult));
}

/** An entity's element: a combatant's own `element`, else its definition's (passed as `def`). */
export const elementOf = (entity, def = null) => entity?.element ?? def?.element ?? null;

/** The element an enemy move or card carries: its element, damage type or school. */
export function carrierElement(carrier) {
  const profile = carrier?.combatProfile || {};
  const direct = carrier?.element ?? carrier?.damageType ?? profile.element ?? profile.damageType ?? carrier?.school ?? profile.school;
  if (direct) return direct;
  const tag = [...(carrier?.cardTags || []), ...(carrier?.tags || [])].map(t => (typeof t === 'string' ? t : t?.id)).find(t => /^(school|damage|element):/.test(t || ''));
  return tag ? tag.split(':')[1] : null;
}

/** Own-element bonus: an enemy using an ability of its own element multiplies an amount by 1.25 and floors it, never below the printed amount. */
export function ownElementAmount(amount, userElement, abilityElement) {
  const base = Number(amount);
  if (!(base > 0) || !userElement || userElement !== abilityElement) return amount;
  return Math.max(base, Math.floor(base * elementRules().ownElementMult));
}

/** The pieces an entity wears (the player's or a seat's loadout). Enemies carry no loadout. */
export function wornPieces(ctx, entity) {
  const key = ctx.playerIdForEntity?.(entity);
  const seat = key ? ctx.players?.get(key) : null;
  const loadout = seat?.loadout || (entity === ctx.player ? ctx.loadout : null);
  if (!loadout || !ctx.registries) return [];
  return (ctx.registries.equipment?.slots || []).map(slot => equippedIn(ctx.registries, loadout, entity.classId || seat?.classId, slot.id)).filter(Boolean);
}
export const isMetalPiece = piece => piece?.material === 'metal';
/** True when the entity wears metal equipment; an enemy counts when it or its definition says `material: 'metal'`. */
export function wearsMetal(ctx, entity) {
  if (!entity) return false;
  if (entity.material === 'metal') return true;
  const def = entity.kind === 'enemy' && entity.enemyId && ctx.registries?.enemies?.has?.(entity.enemyId) ? ctx.registries.enemies.get(entity.enemyId) : null;
  return def?.material === 'metal' || wornPieces(ctx, entity).some(isMetalPiece);
}

/** +1 Precision on a lightning hit whose target uses metal equipment; 0 otherwise. */
export const lightningPrecisionBonus = (ctx, target, carrier) => (fixCoreEnabled(ctx) && isLightning(carrier) && wearsMetal(ctx, target) ? lightningRules().metalPrecision : 0);


/**
 * Elemental affinity (SPEC 4.7): an armament with `affinity: { element, count }` adds `count` element tags
 * (`element:<element>`, one per count, not deduplicated) to its card. An enemy's attuned weapon gets floor(count x 1.25).
 */
export function affinityTags(piece, { enemy = false } = {}) {
  const row = piece?.affinity;
  if (!row?.element || !(Number(row.count) > 0)) return [];
  const count = enemy ? ownElementAmount(Math.floor(Number(row.count)), row.element, row.element) : Math.floor(Number(row.count));
  return Array.from({ length: count }, () => `element:${row.element}`);
}
/** Infuse an element into an armament: a copy of the piece with the affinity set (a repeat of the same element adds to its count). */
export function withAffinity(piece, element, count = 1) {
  const prior = piece?.affinity?.element === element ? Number(piece.affinity.count) || 0 : 0;
  return { ...piece, affinity: { element, count: prior + Math.max(1, Math.floor(count)) } };
}
