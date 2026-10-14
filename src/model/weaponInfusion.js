// Derived source properties, shared by previews and solo/co-op resolution.
// Stored armaments and profiles remain immutable; old subclasses have no recipe.
import { effectiveSubclassId } from './subclasses.js';
import { attackDescriptor } from './attackTags.js';
import { equippedIn, slotHand } from './loadout.js';

export function effectiveWeaponSource(registries, entity, source) {
  const result = structuredClone(source);
  if (!source || !entity || (entity.kind && entity.kind !== 'player') || entity.classUnequipped || entity.subclassId === undefined) return result;
  const id = effectiveSubclassId(registries, entity);
  const recipe = id && registries.subclasses?.has(id) && registries.subclasses.get(id).weaponInfusion;
  if (!recipe) return result;
  if ((source.sourceType || attackDescriptor(source).source || (source.family === 'focus' ? 'spell' : 'weapon')) !== 'weapon') return result;
  result.tags = [...new Set([...(source.tags || []), ...(recipe.tags || [])])];
  result.weaponInfusion = structuredClone(recipe);
  return result;
}

/** A resolved physical weapon, never the spell focus or another co-op seat. */
export function weaponSourceFor(ctx, entity, carrier = {}) {
  if (entity?.kind !== 'player' || !carrier) return null;
  const seatId = ctx.playerIdForEntity?.(entity);
  const registries = ctx.registriesForPlayer?.(seatId) || ctx.registries;
  if (!registries?.subclasses || !entity.subclassId) return null;
  const subclassId = entity.subclassId && effectiveSubclassId(registries, entity);
  if (!subclassId || !registries.subclasses?.get(subclassId)?.weaponInfusion) return null;
  // Spell/focus and bare-hand faces have no weapon recipe. Their projected
  // damage identity may differ from an equipment profile's authored tags;
  // weapon resolution must not parse or reclassify those unrelated sources.
  const taggedSource = (carrier.tags || carrier.cardTags || []).find(tag => tag.startsWith('source:'))?.slice(7);
  if ((carrier.attack?.source && carrier.attack.source !== 'weapon') || (taggedSource && taggedSource !== 'weapon')) return null;
  const attack = attackDescriptor(carrier);
  if (!attack.source && !carrier.cardId && !carrier.sourceArmamentId && !carrier.weaponSource) return null;
  const kind = attack.source || (carrier.combatProfile?.camp === 'spell' ? 'spell' : 'weapon');
  if (kind !== 'weapon') return null;
  const hand = { right: 'mainHand', left: 'offHand' }[attack.hand || carrier.sourceHand]
    || attack.hand || carrier.sourceHand;
  const captured = carrier.weaponSource || carrier.resolvedSource;
  if (captured && (captured.sourceType || (captured.family === 'focus' ? 'spell' : 'weapon')) === kind
    && (!hand || captured.hand === hand)) return captured;
  const profile = ctx.foundation?.profiles[seatId || entity.id];
  const hands = hand ? [hand] : [...new Set([profile?.defaultSource || 'mainHand', 'mainHand', 'offHand'])];
  if (profile?.sources) {
    for (const key of hands) {
      const source = profile.sources[key];
      if (source && (source.sourceType || (source.family === 'focus' ? 'spell' : 'weapon')) === kind)
        return effectiveWeaponSource(registries, entity, { ...source, hand: key });
    }
    return null;
  }
  const loadout = ctx.players?.get(seatId)?.loadout || (entity === ctx.player ? ctx.loadout : null);
  if (!loadout) return null;
  const pieces = registries.equipment?.armaments || [];
  for (const key of hands) for (const slot of registries.equipment?.slots || []) {
    if (slotHand(slot) !== (key === 'offHand' ? 'left' : 'right')) continue;
    const piece = equippedIn(registries, loadout, entity.classId, slot.id);
    if (!piece || (attackDescriptor(piece).source !== kind
      && !(carrier.sourceArmamentId === piece.id && attack.source === 'weapon' && carrier.combatProfile?.camp === 'physical'))) continue;
    // A card explicitly lent by another armament cannot borrow this hand.
    if (carrier.sourceArmamentId && pieces.some(row => row.id === carrier.sourceArmamentId)
      && piece.id !== carrier.sourceArmamentId) continue;
    return effectiveWeaponSource(registries, entity, { ...piece, id: `armament/${piece.id}/${key}`, itemId: piece.id, sourceType: kind, hand: key });
  }
  return null;
}

export function infusionForAttack(ctx, entity, carrier) {
  // The overwhelmingly common legacy/unselected path pays no equipment scan.
  const registries = ctx.registriesForPlayer?.(ctx.playerIdForEntity?.(entity)) || ctx.registries;
  if (!registries?.subclasses || !entity?.subclassId) return null;
  const subclassId = entity?.subclassId && effectiveSubclassId(registries, entity);
  if (!subclassId || !registries.subclasses?.get(subclassId)?.weaponInfusion) return null;
  return weaponSourceFor(ctx, entity, carrier)?.weaponInfusion || null;
}
