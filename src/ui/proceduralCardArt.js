import { layeredCardArtCatalog as base } from '../content/layeredCardArt.generated.js';
import { reviewedCardArtCatalog as reviewed } from '../content/reviewedCardArt.generated.js';
import { approvedCardArt } from './layeredCardArt.js';
import { cardRank } from '../model/cardRank.js';

const actions = ['attack', 'smash', 'counter', 'evade', 'sweep', 'defend'];
const aliases = { defense: 'defend', evasion: 'evade' };
const elements = ['force', 'fire', 'lightning', 'earth', 'frost', 'psychic', 'alteration', 'divine', 'necrotic', 'wind'];
const elementAliases = { alternation: 'alteration', illusion: 'psychic', decay: 'necrotic', cold: 'frost', holy: 'divine', sacred: 'divine', arcane: 'force' };
const elementOf = value => elements.includes(value) ? value : Object.hasOwn(elementAliases, value) ? elementAliases[value] : null;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const clone = value => structuredClone(value);
// Color blending replaces hue/saturation while retaining the source luminance.
// A matching status color takes precedence over the element color.
export const PROCEDURAL_BACKGROUND_COLORS = freeze({
  element: { earth: '#88552f' },
  status: { burn: '#b3271b' },
});
// Build a semantic sprite/template pool once. Record IDs and labels never route art.
const spritesByAsset = new Map(), statusObjects = new Map();
for (const recipe of Object.values(reviewed.records)) {
  for (const sprite of recipe.sprites) if (!spritesByAsset.has(sprite.assetId)) spritesByAsset.set(sprite.assetId, freeze(clone(sprite)));
  if (recipe.rule === 'status-symbol') for (const cue of recipe.visualCues) {
    if (cue.startsWith('status:') && !statusObjects.has(cue.slice(7))) {
      statusObjects.set(cue.slice(7), freeze(clone(recipe.sprites.find(sprite => sprite.id.startsWith('object')))));
    }
  }
}
const statusesById = new Map();
for (const [assetId, sprite] of spritesByAsset) {
  const match = /^cue\.([\w-]+)\.(glow|mark)$/.exec(assetId);
  if (match) {
    const row = statusesById.get(match[1]) || [];
    row.push(sprite); statusesById.set(match[1], row);
  }
}
const statusAliases = { bleeding: 'bleed', burning: 'burn', frozen: 'frost', chilled: 'frost', blight: 'necroticBlight' };
const statusCueId = id => Object.hasOwn(statusAliases, id) ? statusAliases[id] : id;
const globalCache = new Map(), registryCaches = new WeakMap();
const canonicalTags = tags => [...new Set((Array.isArray(tags) ? tags : []).map(tag => typeof tag === 'string' ? tag : tag?.id)
  .filter(tag => typeof tag === 'string' && tag.length <= 100 && /^[\w:.-]+$/.test(tag))
  .map(tag => ['fx:heal', 'fx:draw', 'fx:cleanse'].includes(tag) ? `effect:${tag.slice(3)}` : tag))].sort();
const identity = (tags, prefix) => {
  const values = [...new Set(tags.filter(tag => tag.startsWith(prefix)).map(tag => tag.slice(prefix.length)))];
  return values.length === 1 ? values[0] : null;
};
function elementIdentity(tags) {
  for (const prefix of ['element:', 'school:', 'damage:']) {
    const values = [...new Set(tags.filter(tag => tag.startsWith(prefix)).map(tag => {
      const raw = tag.slice(prefix.length);
      return elementOf(raw) || raw;
    }))];
    // Mixed damage is a valid unthemed identity; conflicting explicit art
    // elements/schools cannot silently become a lower-priority school.
    if (values.length > 1) return { conflict: prefix !== 'damage:', element: null };
    if (values.length && elementOf(values[0])) return { element: elementOf(values[0]) };
  }
  return { element: null };
}
function statusExists(registries, id) {
  const registry = registries?.statuses;
  if (!registry) return statusesById.has(statusCueId(id));
  if (typeof registry.has === 'function' && !registry.has(id)) return false;
  try { return !!(typeof registry.get === 'function' ? registry.get(id) : registry.find?.(row => row.id === id)); }
  catch { return false; }
}
function withOpacity(sprite, intensity) {
  const result = clone(sprite);
  const opacity = Number((Number(result.css.opacity ?? 1) * intensity).toFixed(4));
  result.css.opacity = String(opacity);
  if (result.transform) result.transform.opacity = opacity;
  return result;
}

/** Pure presentation: only type, canonical tags and one-based rank select art. */
export function proceduralCardArt({ type, tags, rank } = {}, { registries } = {}) {
  tags = canonicalTags(tags);
  const camp = identity(tags, 'camp:');
  if (camp !== 'physical' && camp !== 'spell') return null;
  const explicit = tags.some(tag => tag.startsWith('maneuver:'));
  let maneuver = identity(tags, 'maneuver:');
  let projectile = tags.some(tag => ['delivery:projectile', 'delivery:ranged', 'delivery:cast', 'maneuver:casting', 'maneuver:ranged'].includes(tag));
  if (explicit && !maneuver) return null;
  type = Object.hasOwn(aliases, type) ? aliases[type] : type;
  if (['casting', 'ranged'].includes(maneuver)) maneuver = ['skill', 'power'].includes(type) ? 'skill' : 'attack';
  maneuver = (Object.hasOwn(aliases, maneuver) ? aliases[maneuver] : maneuver) || (['skill', 'power'].includes(type) ? 'skill' : type);
  if (!actions.includes(maneuver) && maneuver !== 'skill') return null;
  if (tags.includes('delivery:melee')) projectile = false;
  const category = camp === 'spell' ? 'magical' : 'physical';
  const identityElement = elementIdentity(tags);
  if (identityElement.conflict) return null;
  const element = identityElement.element || (category === 'magical' ? 'force' : null);
  rank = cardRank({ rank });
  const statuses = tags.filter(tag => tag.startsWith('status:')).map(tag => tag.slice(7))
    .filter(id => statusExists(registries, id)).slice(0, element ? 2 : 3);
  // Explicit effect identities outrank compatibility aliases such as Retain.
  // Multiple explicit effects retain the approved catalog's deterministic order.
  const utility = base.selection.utility.find(rule => rule.tags.some(tag => tag.startsWith('effect:') && tags.includes(tag)))
    || base.selection.utility.find(rule => rule.tags.some(tag => tags.includes(tag)));
  const key = JSON.stringify([category, maneuver, element, projectile, utility?.code, statuses, rank]);
  let cache = globalCache;
  if (registries && typeof registries === 'object') {
    if (!registryCaches.has(registries)) registryCaches.set(registries, new Map());
    cache = registryCaches.get(registries);
  }
  if (cache.has(key)) return cache.get(key);
  const deliveryTags = projectile ? [...tags, 'delivery:projectile'] : tags.filter(tag => !base.selection.projectileTags.includes(tag));
  // Pass the chosen cue alone so the lower-level compatibility selector cannot
  // restore a generic alias's priority over the explicit semantic choice.
  const selectionTags = maneuver === 'skill' ? utility?.tags.filter(tag => tag.startsWith('effect:')) || [] : deliveryTags;
  let art = approvedCardArt({ category, maneuver, element, tags: selectionTags, def: {} });
  if (maneuver === 'counter') art = approvedCardArt({ category: 'physical', maneuver, element, tags: [], def: {} });
  if (maneuver === 'skill' && !art) art = approvedCardArt({ category: 'magical', maneuver, element, tags: selectionTags, def: {} });
  if (maneuver === 'evade') {
    art = approvedCardArt({ category: 'magical', maneuver: 'skill', element, tags: [], def: {} });
    art = { ...art, code: 'procedural-evade', sprites: [art.sprites[0], { ...clone(spritesByAsset.get('symbol.feather')), id: 'object' }] };
  }
  if (!art) return null;
  art = clone(art);
  const colorStatus = statuses.map(statusCueId).find(id => Object.hasOwn(PROCEDURAL_BACKGROUND_COLORS.status, id));
  art.backgroundColor = colorStatus ? { id: `status:${colorStatus}`, color: PROCEDURAL_BACKGROUND_COLORS.status[colorStatus] }
    : PROCEDURAL_BACKGROUND_COLORS.element[element] ? { id: `element:${element}`, color: PROCEDURAL_BACKGROUND_COLORS.element[element] } : null;
  if (maneuver === 'counter') {
    const shield = art.sprites.find(sprite => sprite.id === 'object');
    const hammer = art.sprites.find(sprite => sprite.id === 'secondaryObject');
    const source = approvedCardArt({ category: 'physical', maneuver: 'smash', tags: [], def: {} }).sprites.find(sprite => sprite.id === 'object');
    // Change only the cloned procedural recipe, never the approved catalog.
    Object.assign(hammer, { assetId: source.assetId, path: source.path, label: source.label, zIndex: Number(shield.zIndex) + 5 });
    // The approved hammer points head-down; turn it head-up/right and size its
    // complete silhouette inside the 512×640 well rather than reuse sword bounds.
    Object.assign(hammer.transform, { x: 280, y: 310, width: 340, height: 425, rotationDeg: 180, scaleX: 1, scaleY: 1 });
    hammer.affine = [-1, 0, 0, -1];
    Object.assign(hammer.css, { left: '54.6875%', top: '48.4375%', width: '66.40625%', height: '66.40625%',
      transform: 'translate(-50%, -50%) rotate(180deg) scale(1, 1)', zIndex: String(hammer.zIndex) });
    hammer.css.filter = [hammer.css.filter === 'none' ? '' : hammer.css.filter,
      'drop-shadow(0 0 0.8px rgba(225,230,235,0.85))'].filter(Boolean).join(' ');
  }
  // Status utilities can use their approved symbol, while action silhouettes stay fixed.
  if (maneuver === 'skill' && !utility && statuses.length && statusObjects.get(statusCueId(statuses[0]))) {
    art.sprites = [art.sprites.find(sprite => sprite.id === 'background'), { ...clone(statusObjects.get(statusCueId(statuses[0]))), id: 'object' }];
  }
  const cueSprites = [];
  // A projectile already carries its element. Every other action retains its
  // silhouette and adds the approved elemental PNG (blue/mint alone is not an
  // element identity, and Counter deliberately uses the separate real weapon).
  if (element && !art.sprites.some(sprite => sprite.assetId === `Z.effect.${base.selection.projectiles[element]}`)) {
    const source = base.compositions[`Z0${base.selection.projectiles[element]}`].layers.find(sprite => sprite.id === 'foreground');
    cueSprites.push({ ...clone(source), id: 'element-cue', path: base.assets[source.assetId].path, css: { ...source.css, opacity: '0.23' } });
  }
  for (const id of statuses) {
    const cues = statusesById.get(statusCueId(id)) || statusesById.get('prepared');
    for (const source of cues || []) cueSprites.push({ ...clone(source), id: `status-${id}-${source.assetId.endsWith('.mark') ? 'mark' : 'glow'}` });
  }
  const intensity = 0.55 + (Math.min(rank, 5) - 1) * 0.1125;
  art.sprites = [...art.sprites, ...cueSprites].map(sprite => {
    const decorative = sprite.id !== 'background' && !/^(?:object|secondaryObject)(?:-|$)/.test(sprite.id);
    return decorative ? withOpacity(sprite, intensity) : sprite;
  });
  // Every valid recipe has a decorative PNG whose opacity changes with rank.
  if (!art.sprites.some(sprite => sprite.id !== 'background' && !/^(?:object|secondaryObject)(?:-|$)/.test(sprite.id))) {
    art.sprites.push({ ...withOpacity(spritesByAsset.get('I.effect.0'), intensity * 0.5), id: 'rank-aura' });
  }
  art.code = `procedural-${maneuver}-${element || 'physical'}-${utility?.code || ''}`;
  art.path = art.sprites.find(sprite => sprite.id === 'background').path;
  const result = freeze({ kind: 'simple', path: art.path, fit: 'cover', position: '50% 50%', filter: '',
    category, maneuver, element, rank, variant: Math.min(rank, 5), componentArt: art,
    statuses: statuses.map(id => ({ id })), layers: [],
    visualCues: [`action:${maneuver}`, ...(element ? [`element:${element}`] : []), ...statuses.map(id => `status:${id}`)] });
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}
