// The damage type an untyped card resolves from the armament that deals it (owner #19): its lending piece, else the first piece
// of that kind in its hand, else the bare-handed profile for a physical weapon card. Shared by combat (tacticalCarrier) and the
// static card face outside combat, so both read the same type and the same physical/magic split.
import { attackDescriptor, weaponDamageType, weaponDamageComponents, dominantDamageType } from './attackTags.js';
import { combatRules } from '../content/combatRules.js';
import { equippedIn, slotHand } from './loadout.js';

/** The armament a card is dealt with: its lending piece, else the first piece of that kind in its hand. */
export function WieldedPiece(registries, loadout, classId, carrier, kind) {
  const pieces = registries?.equipment?.armaments || [];
  let piece = carrier.sourceArmamentId && pieces.find(row => row.id === carrier.sourceArmamentId);
  if (!piece && loadout) {
    const hand = { right: 'mainHand', left: 'offHand' }[carrier.sourceHand] || carrier.sourceHand || 'mainHand';
    for (const slot of registries?.equipment?.slots || []) {
      if (slotHand(slot) !== (hand === 'offHand' ? 'left' : 'right')) continue;
      const equipped = equippedIn(registries, loadout, classId, slot.id);
      if (equipped && attackDescriptor(equipped).source === kind) { piece = equipped; break; }
    }
  }
  return piece || null;
}

/** Resolves `carrier.combatProfile.damageType` (and a mixed card's weapon components) in place from the wielded armament. */
export function ResolveCarrierDamageType(carrier, registries, loadout, classId) {
  const weaponPart = !!(carrier.attack?.weaponDamage && carrier.attack.components);
  if ((carrier.combatProfile.damageType && !weaponPart) || !carrier.combatProfile.camp || !registries) return carrier;
  const attack = attackDescriptor(carrier);
  const kind = attack.source || (carrier.combatProfile.camp === 'spell' ? 'spell' : 'weapon');
  const piece = WieldedPiece(registries, loadout, classId, carrier, kind);
  // No piece of that kind in hand: a physical weapon card is thrown with bare hands and deals the unarmed profile's type.
  const unarmed = (registries.equipment?.basicCardProfiles || []).find(row => row.id === 'unarmedAttack');
  // A magical face (a staff's Strike, lent with a magic school) is never a bare-handed blow.
  const magical = carrier.combatProfile.camp === 'spell' || (carrier.damageSchool && carrier.damageSchool !== 'physical');
  const bare = piece || !['weapon', 'unarmed'].includes(kind) || magical ? null
    : (unarmed && attackDescriptor(unarmed).damageType) || combatRules.fallbackSource.damageType;
  const family = piece ? combatRules.equipmentSources?.itemFamilies?.[piece.id] || combatRules.equipmentSources?.profileFamilies?.[piece.attackProfile]
    : combatRules.fallbackSource.family;
  const pieceType = (piece && attackDescriptor(piece).damageType) || bare;
  if (weaponPart) {
    // The resolved parts travel on the carrier, so every effect and the damage rules read the same split as this profile.
    const components = weaponDamageComponents(attack, family, pieceType);
    carrier.attack = { ...carrier.attack, components };
    carrier.combatProfile.damageComponents = components.map(({ type, weight }) => ({ type, weight }));
    carrier.combatProfile.damageType = dominantDamageType(components);
  } else carrier.combatProfile.damageType = weaponDamageType(attack, family, pieceType) || null;
  return carrier;
}
