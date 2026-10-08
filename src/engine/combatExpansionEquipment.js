import { combatExpansionEquipment } from '../content/combatExpansionEquipment.js';
import { equippedIn } from '../model/loadout.js';

const positive = value => Number.isFinite(value) ? Math.max(0, value) : 0;
function projection(rows, armorClass = 'light') {
  const result = { armorClass, damageResistanceFlat: {}, damageWeaknessPercent: {}, combatTraits: {} };
  for (const row of rows) {
    if (!row) continue;
    if (row.armorClass) result.armorClass = row.armorClass;
    for (const [key, value] of Object.entries(row.flat || {})) result.damageResistanceFlat[key] = (result.damageResistanceFlat[key] || 0) + positive(value);
    // Weakness is one maximum component modifier, never two multiplicative edges.
    for (const [key, value] of Object.entries(row.weak || {})) result.damageWeaknessPercent[key] = Math.max(result.damageWeaknessPercent[key] || 0, positive(value));
    for (const [key, value] of Object.entries(row.traits || {})) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const map = result.combatTraits[key] ||= {};
        for (const [id, amount] of Object.entries(value)) map[id] = (map[id] || 0) + positive(amount);
      } else if (Array.isArray(value)) result.combatTraits[key] = [...new Set([...(result.combatTraits[key] || []), ...value])];
      else if (typeof value === 'boolean') result.combatTraits[key] = result.combatTraits[key] || value;
    }
  }
  return result;
}

/** Active slot/class identities only. Unworn storage and other classes do not count. */
export function expandedEquipmentProjection(registries, loadout, classId, rules = combatExpansionEquipment) {
  if (!loadout) return projection([]);
  const rows = [];
  for (const slot of registries.equipment?.slots || []) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (!piece) continue;
    const armour = slot.kinds?.includes('armor');
    rows.push(armour ? rules.armour?.[`${classId}:${piece.id}`] || rules.sharedArmour?.[piece.id] : rules.armaments?.[piece.id]);
    if (piece.combatExpansion) rows.push(piece.combatExpansion);
  }
  return projection(rows);
}

export function expandedEnemyProjection(enemyId, rules = combatExpansionEquipment) {
  return projection([rules.enemies?.[enemyId]], 'medium');
}

/** Derive visible incoming traits from the actual attacker, never its name. */
export function expansionCarrierTraits(carrier, entity) {
  const grounded = entity?.combatTraits?.grounded === true || entity?.statuses?.grounded?.stacks > 0;
  const inherited = Object.entries(entity?.combatTraits || {}).filter(([name, enabled]) => enabled === true && !(grounded && name === 'conductive')).map(([name]) => name);
  if (grounded) inherited.push('grounded');
  return { ...carrier, combatProfile: { ...carrier.combatProfile,
    traits: [...new Set([...(carrier.combatProfile?.traits || []), ...inherited])] } };
}
