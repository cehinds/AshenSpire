import { attackHitPreview, resolveAttackHit } from './stanceHit.js';
// Counter attack reach, Accuracy and base Evasion are independent of protection
// coverage and prepared Evade. One committed check gates the entire return.
import { accuracyFor, evasionFor, parseEvasionArmor } from './combatRounds/resolver.js';
import { EVASION_ARMOR_CSV } from '../content/combatRounds.js';
import { counterReturnRules } from '../content/counterReturnRules.js';
import { combatExpansionEquipment } from '../content/combatExpansionEquipment.js';
import { enemyAttributesOf } from '../model/actionCosts.js';
import { equippedIn } from '../model/loadout.js';

const armorDefaults = parseEvasionArmor(EVASION_ARMOR_CSV);
const finite = value => Number.isFinite(value) ? value : 0;
const ATTR_KEYS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', wisdom: 'WIS', intelligence: 'INT' };

function seatOf(ctx, entity) {
  const key = ctx.playerIdForEntity?.(entity);
  return key ? ctx.players?.get(key) : null;
}
function enemyDefinition(ctx, entity) {
  return entity?.enemyId && ctx.registries?.enemies?.has?.(entity.enemyId)
    ? ctx.registries.enemies.get(entity.enemyId) : null;
}
export function attributesOf(ctx, entity) {
  const seat = seatOf(ctx, entity), enemy = enemyDefinition(ctx, entity);
  return ctx.attributesForEntity?.(entity) || entity?.attributes || seat?.attributes
    || (entity === ctx.player ? ctx.attributes : null) || (enemy ? enemyAttributesOf(enemy) : {});
}
export function timelineAttrs(attrs) {
  return Object.fromEntries(Object.entries(ATTR_KEYS).filter(([id]) => Number.isFinite(Number(attrs?.[id])))
    .map(([id, key]) => [key, Number(attrs[id])]));
}
function wornPieces(ctx, entity) {
  const seat = seatOf(ctx, entity);
  const loadout = seat?.loadout || (entity === ctx.player ? ctx.loadout : null);
  if (!loadout || !ctx.registries) return [];
  return (ctx.registries.equipment?.slots || []).map(slot =>
    equippedIn(ctx.registries, loadout, entity.classId || seat?.classId, slot.id)).filter(Boolean);
}

/** Base Evasion excludes a prepared Evade/card bonus. Explicit evasion is a full override. */
export function counterBaseEvasion(ctx, entity) {
  if (Number.isFinite(entity?.evasion)) return Math.max(0, entity.evasion);
  const def = enemyDefinition(ctx, entity);
  if (Number.isFinite(def?.evasion)) return Math.max(0, def.evasion);
  const cfg = ctx.counterReturnRules || counterReturnRules;
  if (def && Number.isFinite(cfg.enemyBaseEvasion[entity.enemyId])) return cfg.enemyBaseEvasion[entity.enemyId];
  const attrs = timelineAttrs(attributesOf(ctx, entity)), pieces = wornPieces(ctx, entity);
  const armour = pieces.find(piece => piece.kind === 'armor');
  const equippedRules = ctx.combatExpansionRules?.equipment || combatExpansionEquipment;
  const armourRule = armour && (equippedRules.armour?.[`${entity.classId}:${armour.id}`] || equippedRules.sharedArmour?.[armour.id]);
  const tables = ctx.combatRounds?.rules?.tables?.evasionArmor;
  const armor = tables ? new Map(Object.entries(tables)) : armorDefaults;
  const explicit = entity?.evasionArmor || armour?.evasionArmor;
  const materialTag = (armour?.tags || []).find(tag => tag.startsWith('material:'))?.slice(9);
  const material = materialTag && [...armor.keys()].find(key => key.toLowerCase() === materialTag.toLowerCase());
  const named = armour && (cfg.starterMaterials[`${entity.classId}:${armour.id}`] || cfg.starterMaterials[armour.id]);
  const armorClass = armourRule?.armorClass || entity?.armorClass || entity?.combatArmorClass;
  const evasionArmor = explicit || material || named || (armour || def ? cfg.armorClassMaterials[armorClass] : null) || 'Cloth';
  const buckler = pieces.some(piece => piece.kind === 'shield' && piece.id === 'buckler');
  return evasionFor({ attrs, evasionArmor, shield: buckler ? 'buckler' : undefined }, { armor });
}

export function attackAccuracy(ctx, source, carrier) {
  const seat = seatOf(ctx, source);
  const level = source?.level?.level ?? source?.level ?? seat?.characterLevel ?? (source === ctx.player ? ctx.characterLevel : 0);
  return accuracyFor({ attrs: timelineAttrs(attributesOf(ctx, source)), level: finite(level), tags: carrier?.tags || [], accuracy: finite(source?.accuracy) });
}

export function counterAttackPreview(ctx, source, target, carrier) {
  if (ctx.combatExpansionVersion !== 2 || !carrier?.counterReturnAttack) return null;
  return attackHitPreview(ctx, source, target, carrier);
}

/** Counter replies use the same group Accuracy and Evasion decision as other offense. */
export function resolveCounterAttack(ctx, source, target, carrier) {
  if (ctx.combatExpansionVersion !== 2 || !carrier?.counterReturnAttack) return null;
  return resolveAttackHit(ctx, source, target, carrier);
}
