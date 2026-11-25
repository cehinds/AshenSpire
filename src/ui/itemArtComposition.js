// src/ui/itemArtComposition.js — declarative layered art composition for weapons, armours, and relics.
//
// Mirrors src/ui/cardArtComposition.js: reads authored rules from content/source/itemArtLayers.json
// (compiled to src/content/generated/itemArtLayers.js) and produces a pure, serializable layer
// stack for equipmentCard.js, collectibleCard.js, and Score Studio's Art & Layers tab.

import { itemArtLayers as shippedItemArtLayers } from '../content/generated/itemArtLayers.js';
import { GEAR_TYPES } from '../content/gearTypes.js';
import { GearWeaponTypeOf, GearArmourGroupOf, GearPieceMods, ParseGearMod } from '../model/gearEffects.js';
import { reviewedCardArtCatalog } from '../content/reviewedCardArt.generated.js';

const ELEMENT_TOKENS = Object.freeze({
  fire: ['fire', 'burn', 'ember', 'cinder', 'flame', 'flamberge', 'torch', 'lantern', 'gorefire'],
  frost: ['frost', 'chill', 'rime', 'ice', 'starstone', 'moonlit', 'moonglaive'],
  lightning: ['lightning', 'shock', 'storm', 'thunder'],
  blight: ['blight', 'decay', 'rot', 'ossuary', 'crimsonblight', 'necroticblight'],
  divine: ['divine', 'sacred', 'holy', 'hallowed', 'sun', 'prayer', 'blessed'],
  arcane: ['arcane', 'astral', 'nightweave', 'mana', 'sceptre', 'staff', 'tome', 'grimoire'],
});

const splitList = (value) => String(value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

function normalizeKind(item, explicitKind) {
  if (explicitKind === 'weapon' || explicitKind === 'armour' || explicitKind === 'relic') return explicitKind;
  if (explicitKind === 'armor') return 'armour';
  if (item?.kind === 'armor' || item?.kind === 'armour') return 'armour';
  if (item?.kind === 'relic') return 'relic';
  return 'weapon';
}

/** Extract mechanical art facts from a weapon, armour, or relic definition. */
export function ItemArtFacts(item, { kind = null, registries = null, rules = null } = {}) {
  const itemKind = normalizeKind(item, kind);
  const rarity = String(item?.rarity || (item?.unlock ? 'uncommon' : 'common')).toLowerCase();
  const gearType = itemKind === 'weapon' ? (item?.gearType || GearWeaponTypeOf(item) || null) : null;
  const armourGroup = itemKind === 'armour' ? (item?.gearGroup || GearArmourGroupOf(item) || null) : null;
  const poiseDamage = itemKind === 'weapon'
    ? (Number.isFinite(item?.poiseDamage) ? item.poiseDamage
      : Number.isFinite(GEAR_TYPES.itemPoiseDamage?.[item?.id]) ? GEAR_TYPES.itemPoiseDamage[item.id]
        : (GEAR_TYPES.weaponTypes?.[gearType]?.poiseDamage ?? 1))
    : 0;

  const traits = new Set();
  const tags = new Set((item?.tags || []).map((t) => String(t).toLowerCase()));
  const rawMods = Array.isArray(item?.typeMods) || (Array.isArray(item?.mods) && Array.isArray(item.mods[0]))
    ? [...(item.typeMods || []), ...(item.mods || [])].map(([k, v]) => `${k}=${v}`)
    : (itemKind === 'relic' ? [] : GearPieceMods(item, true));

  let armourPoiseBonus = itemKind === 'armour' && Number(item?.poiseThreshold || item?.poise || 0) >= 4 ? 1 : 0;
  for (const raw of rawMods) {
    const parsed = ParseGearMod(raw);
    if (!parsed) continue;
    traits.add(parsed.field.toLowerCase());
    if (parsed.arg) tags.add(parsed.arg.toLowerCase());
    if (parsed.field === 'statPoise' && parsed.value > 0) armourPoiseBonus += parsed.value;
  }

  // Relic property rules and passives
  if (itemKind === 'relic') {
    for (const mod of item?.passives?.modifiers || []) {
      if (mod?.resource) traits.add(`max${mod.resource}`.toLowerCase());
      if (mod?.school) tags.add(String(mod.school).toLowerCase());
      if (mod?.tag) traits.add(String(mod.tag).toLowerCase());
    }
    if (Number(item?.passives?.poiseThresholdAdd) > 0) {
      traits.add('statpoise');
      armourPoiseBonus += Number(item.passives.poiseThresholdAdd);
    }
    const ruleMap = rules || null;
    const propTags = new Set([item?.id, ...(item?.props || []), ...(item?.properties || [])].filter(Boolean));
    for (const propTag of propTags) {
      const rule = ruleMap?.[propTag] || (registries?.propertyRules?.has?.(propTag) ? registries.propertyRules.get(propTag) : null);
      if (!rule) continue;
      for (const trig of rule.triggers || []) {
        for (const op of trig.do || []) {
          if (op?.op) traits.add(String(op.op).toLowerCase());
          if (op?.status) traits.add(String(op.status).toLowerCase());
        }
      }
      for (const pk of Object.keys(rule.passives || {})) traits.add(pk.toLowerCase());
    }
    if (item?.icon) tags.add(String(item.icon).toLowerCase());
  }

  // Infer elements strictly from mechanical traits, tags, and school modifiers (never overriding mechanics)
  const elements = new Set();
  const signalText = [...traits, ...tags, gearType || '', armourGroup || ''].join(' ').toLowerCase();
  for (const [el, needles] of Object.entries(ELEMENT_TOKENS)) {
    if (needles.some((needle) => signalText.includes(needle))) elements.add(el);
  }
  if (item?.physicalDamageType) tags.add(`damage:${String(item.physicalDamageType).toLowerCase()}`);

  return {
    itemKind,
    rarity,
    gearType,
    armourGroup,
    poiseDamage,
    armourPoiseBonus,
    poiseThreshold: Number(item?.poiseThreshold ?? item?.poise ?? 0) || 0,
    traits,
    tags,
    elements,
  };
}

function matchesRule(rule, facts) {
  if (rule?.enabled === false) return false;
  if (Array.isArray(rule.entityKinds) && rule.entityKinds.length && !rule.entityKinds.includes(facts.itemKind)) return false;
  const targets = splitList(rule.matchValue);
  switch (rule.matchKind) {
    case 'default':
      return true;
    case 'element':
      return targets.some((t) => facts.elements.has(t));
    case 'trait':
      return targets.some((t) => facts.traits.has(t));
    case 'tag':
      return targets.some((t) => facts.tags.has(t));
    case 'gearType':
      return Boolean(facts.gearType) && targets.includes(facts.gearType.toLowerCase());
    case 'armourGroup':
      return Boolean(facts.armourGroup) && targets.includes(facts.armourGroup.toLowerCase());
    case 'rarity':
      return targets.includes(facts.rarity);
    case 'poise': {
      const expr = String(rule.matchValue || '').trim();
      const m = /^(weaponPoise|armourPoise|poiseThreshold)\s*(>=|>|<=|<|==|=)\s*(\d+(?:\.\d+)?)$/.exec(expr);
      if (!m) return false;
      const lhs = m[1] === 'weaponPoise' ? facts.poiseDamage
        : m[1] === 'armourPoise' ? facts.armourPoiseBonus
          : facts.poiseThreshold;
      const rhs = Number(m[3]);
      if (m[2] === '>=') return lhs >= rhs;
      if (m[2] === '>') return lhs > rhs;
      if (m[2] === '<=') return lhs <= rhs;
      if (m[2] === '<') return lhs < rhs;
      return lhs === rhs;
    }
    default:
      return false;
  }
}

/**
 * Compose the layered art stack for a weapon, armour, or relic.
 * Accepts an optional `layerConfig` override so Score Studio can preview unsaved layer edits live.
 */
export function itemArtComposition(item, { kind = null, registries = null, rules = null, layerConfig = shippedItemArtLayers } = {}) {
  if (!item) return null;
  const cfg = layerConfig && Array.isArray(layerConfig.layers) ? layerConfig : shippedItemArtLayers;
  const facts = ItemArtFacts(item, { kind, registries, rules });
  const rarityTheme = cfg.rarityThemes?.[facts.rarity] || cfg.rarityThemes?.common || { glow: '#c9a227', rimOpacity: 0.16 };
  const maxOverlays = Number.isInteger(cfg.maxOverlays) && cfg.maxOverlays > 0 ? cfg.maxOverlays : 3;
  const assets = reviewedCardArtCatalog?.assets || {};

  const matched = [];
  for (const rule of cfg.layers || []) {
    if (!matchesRule(rule, facts)) continue;
    const asset = rule.assetId ? assets[rule.assetId] : null;
    matched.push({
      id: rule.id || `layer-${matched.length}`,
      name: rule.name || rule.id || 'Layer',
      assetId: asset ? rule.assetId : '',
      path: asset ? asset.path : '',
      motif: rule.motif || '',
      color: rule.color || rarityTheme.glow,
      glow: rule.glow || '',
      mode: rule.mode === 'under' ? 'under' : 'stack',
      blendMode: rule.blendMode || 'screen',
      x: Number.isFinite(Number(rule.x)) ? Number(rule.x) : 50,
      y: Number.isFinite(Number(rule.y)) ? Number(rule.y) : 50,
      scale: Number.isFinite(Number(rule.scale)) ? Number(rule.scale) : 85,
      opacity: Number.isFinite(Number(rule.opacity)) ? Number(rule.opacity) : 70,
      zIndex: Number.isFinite(Number(rule.zIndex)) ? Number(rule.zIndex) : 1,
    });
  }

  // Prefer specific trait/element layers before default fallbacks, capped at maxOverlays per placement band.
  const under = matched.filter((l) => l.mode === 'under').sort((a, b) => a.zIndex - b.zIndex).slice(0, maxOverlays);
  const stack = matched.filter((l) => l.mode !== 'under').sort((a, b) => a.zIndex - b.zIndex).slice(0, maxOverlays);
  const primaryGlow = under.find((l) => l.glow)?.glow || stack.find((l) => l.glow)?.glow || rarityTheme.glow;

  return {
    kind: 'item',
    itemKind: facts.itemKind,
    rarity: facts.rarity,
    glow: primaryGlow,
    rimColor: rarityTheme.glow,
    rimOpacity: rarityTheme.rimOpacity ?? 0.2,
    facts,
    under,
    stack,
    overlays: [...under, ...stack],
  };
}
