import { playerAttackSprites } from '../content/playerAttackSprites.js';
import { combatProfileFor } from './combatCardProfile.js';

const swords = new Set(['straightSword', 'katana']);
const shields = new Set(['buckler', 'kiteShield', 'roundShield', 'towerShield', 'spikedShield']);
const staves = new Set(['ashStaff', 'starstoneStaff', 'boneSceptre', 'emberlightSceptre', 'goldboughBranch', 'blightRod', 'gorefireBrand', 'wyrmhornStaff', 'duskChime']);

/** Only explicitly authored weapon shapes select these default-outfit attacks. */
export function playerAttackFamily(card, equipment, action) {
  const ids = equipment.map(item => item.id);
  const source = card.sourceArmamentId;
  const tags = new Set((card.cardTags || card.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id));
  if (action === 'spell') return tags.has('blade') || combatProfileFor({ ...card, cardTags: [...tags] }).maneuver === 'attack' ? 'energy-blade' : 'staff-casting';
  if (action === 'rangedMagic') return 'staff-casting';
  if (action === 'ranged') return ids.includes('shortbow') && (!source || source === 'shortbow') ? 'bow' : null;
  if (action !== 'attack') return null;
  if (source && !ids.includes(source)) return null;
  if (source && staves.has(source)) return 'staff-casting';
  if (source && shields.has(source)) return null; // A shield bash is not a sword swing.
  const held = equipment.filter(item => item.kind !== 'armor').map(item => item.id);
  if (held.length === 1) {
    if (held[0] === 'greatsword') return 'greatsword';
    if (swords.has(held[0])) return 'single-sword';
    if (held[0] === 'dagger') return 'single-dagger';
    if (staves.has(held[0])) return 'staff-casting';
  }
  if (held.length === 2) {
    if (held.includes('dagger') && held.includes('parryDagger')) return 'dual-daggers';
    if (held.some(id => swords.has(id)) && held.some(id => shields.has(id))) return 'sword-shield';
  }
  return null;
}

export function playerAttackSequence(classId, technique) {
  const [prefix, action, family] = technique?.split(':') || [];
  return prefix === 'weapon' && ['attack', 'spell', 'ranged', 'rangedMagic'].includes(action)
    ? playerAttackSprites[classId]?.[family]?.sequence || null : null;
}

export function playerAttackPlan(card, equipment, classId, plan) {
  const family = playerAttackFamily(card, equipment, plan.technique);
  return family && playerAttackSprites[classId]?.[family] ? { ...plan, technique: `weapon:${plan.technique}:${family}` } : plan;
}
