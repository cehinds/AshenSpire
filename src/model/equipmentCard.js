import { parseMod } from './loadout.js';

/** Authored facts only; live comparison and smithing receipts stay beside this card. */
export function equipmentCardModel(registries, piece) {
  const armor = piece.kind === 'armor';
  const tags = piece.tags || [];
  const tag = id => (registries.tags || []).find(row => row.id === id);
  const className = armor ? registries.classes.get(piece.classId)?.name || piece.classId : '';
  const types = (piece.itemTypes || []).map(t => t.label).join(' / ');
  const type = armor ? `Armor · ${className}` : piece.kind === 'weapon' ? `Weapon · ${types}` : piece.kind === 'staff' ? `Staff · ${types}` : types || piece.kind;
  const field = (label, value, explanation) => ({ label, value, explanation });
  const facts = armor
    ? [field('Poise', piece.poiseThreshold, 'Authored player Poise threshold contribution. Currently displayed only: players do not receive Poise damage. This is separate from enemy Stagger.')]
    : [field('Attack', piece.attackRating, 'Base intrinsic Attack Rating, before attributes and smithing. This is not the final damage of a played card.'), field('Defense', piece.defenseRating, 'Base intrinsic Defense Rating. See the live comparison and resulting cards for actual Block and combat bonuses.'), field('Weight', piece.weight, 'Weight contributed by this equipped item to equip load. Total load and capacity determine your Weight Class.')];
  const bonuses = (piece.mods || []).map(raw => {
    const mod = parseMod(raw);
    const spec = registries.equipment.modFields[mod.field];
    const target = mod.prefix === 'self' ? '' : mod.prefix === 'power' ? 'Class power: ' : `${mod.prefix[0].toUpperCase()}${mod.prefix.slice(1)}: `;
    const value = mod.mode === 'set' ? `Set to ${mod.value}` : `${mod.value >= 0 ? '+' : ''}${mod.value}`;
    const label = spec.apply === 'startStatus' ? `starting ${spec.label}` : mod.field === 'poise' ? 'poise damage' : spec.label;
    return field(`${target}${value} ${label}`, raw, `${mod.mode === 'set' ? 'Replaces the value' : 'Adjusts the value'} ${mod.prefix === 'self' ? 'on the wearer' : `on ${mod.prefix === 'power' ? 'the class power card' : mod.prefix}`}. ${spec.blurb}`);
  });
  const requirements = Object.entries(piece.requirements?.attributes || {}).map(([id, value]) => `${registries.attributes.get(id)?.shortLabel || id} ${value}`).join(' · ');
  return { id: piece.id, name: piece.name, armor, type, facts, bonuses,
    tags: tags.map(id => field(tag(id)?.label || id, id, tag(id)?.blurb || 'Authored equipment classification.')),
    typeExplanation: (piece.itemTypes || []).map(t => tag(t.tag)?.blurb).filter(Boolean).join(' ') || `${type}. Compatibility is determined by the equipment position.`,
    flavor: piece.blurb || 'No flavor text authored.',
    requirement: requirements ? `Requires ${requirements}` : armor ? `${className} outfit` : 'Either hand',
    requirementExplanation: requirements ? `Minimum attributes to use this item: ${requirements}. The live equip action checks current requirements.` : armor ? `An armor set for ${className}.` : 'No minimum attributes authored. Hand placement still follows slot compatibility and two-handed restrictions.',
    rarity: piece.rarity || 'Armor set',
    accent: piece.kind === 'staff' ? '#87b5d0' : piece.kind === 'shield' && types.includes('Blade') ? '#aebdc6' : '#d0ac5d',
  };
}
