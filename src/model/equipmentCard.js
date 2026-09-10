import { parseMod } from './loadout.js';
import { balance } from '../content/balance.js';

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


/**
 * The face's geometry and type scale, derived from balance.ui.equipmentCard.
 *
 * ROWS ARE SOLVED, NOT WRITTEN DOWN. The old face carried seven pixel values in
 * the stylesheet; whatever overflowed was cut wherever the row ended, which is
 * how a player came to read the flavour line in full while the class-power
 * bonus was sliced through the middle. Here each region declares a floor and a
 * priority, the floors are laid down first, and only what is genuinely spare is
 * shared out by `grow`. If the floors alone do not fit, the region with the
 * LOWEST priority gives up its slack first — so flavour shrinks before the
 * bonuses do, which is the ordering the config states out loud.
 *
 * Type sizes are emitted as clamps rather than fixed pixels so a long line
 * shrinks to stay whole instead of being cut. `idealCh` is expressed against
 * the card's own width, so the face scales with the card and not the viewport.
 */
export function equipmentCardTokens(config = balance.ui.equipmentCard) {
  const { regions, text, frameWidthPx, frameHeightPx, paddingPx, gapPx } = config;
  const order = Object.keys(regions);
  const gaps = gapPx * Math.max(0, order.length - 1);
  const budget = frameHeightPx - paddingPx * 2 - gaps;
  const floors = order.reduce((sum, key) => sum + regions[key].minPx, 0);

  const height = {};
  if (floors <= budget) {
    // Room to spare: hand it out by `grow`, leaving anything unclaimed unspent
    // rather than stretching a region that did not ask to be stretched.
    const growth = order.reduce((sum, key) => sum + (regions[key].grow || 0), 0);
    const spare = budget - floors;
    for (const key of order) {
      const share = growth ? (spare * (regions[key].grow || 0)) / growth : 0;
      height[key] = regions[key].minPx + share;
    }
  } else {
    // Over budget: take the shortfall from the least important regions first,
    // and never take a region below its own floor's half — a row that has
    // collapsed to nothing is not a smaller row, it is a missing one.
    let debt = floors - budget;
    for (const key of order) height[key] = regions[key].minPx;
    for (const key of [...order].sort((a, b) => regions[a].priority - regions[b].priority)) {
      if (debt <= 0) break;
      const give = Math.min(debt, regions[key].minPx / 2);
      height[key] -= give;
      debt -= give;
    }
  }

  const rows = order.map(key => `${+height[key].toFixed(2)}px`).join(' ');
  // The authored clamp scales with the card; the floor keeps it readable on the
  // glass after the frame's own transform has shrunk it.
  const clamp = spec => {
    const scaled = `clamp(${spec.minPx}px, ${spec.idealCh}cqw, ${spec.maxPx}px)`;
    return spec.floorPx ? `max(${scaled}, calc(${spec.floorPx}px / var(--card-scale, 1)))` : scaled;
  };
  const type = Object.fromEntries(Object.entries(text).map(([key, spec]) => [key, clamp(spec)]));
  return { rows, type, frameWidthPx, frameHeightPx, paddingPx, gapPx,
    bonusMaxLines: config.bonusMaxLines, info: config.info,
    /** Exposed so a gate can assert the solver honoured the declared floors. */
    heights: height, budget };
}
