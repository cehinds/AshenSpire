import { layeredCardArtCatalog as base } from '../content/layeredCardArt.generated.js';
import { reviewedCardArtCatalog as reviewed } from '../content/reviewedCardArt.generated.js';
import { approvedCardArt } from './layeredCardArt.js';
import { cardRank } from '../model/cardRank.js';

const actions = ['attack', 'smash', 'counter', 'evade', 'sweep', 'defend'];
const aliases = { defense: 'defend', evasion: 'evade' };
const elements = ['force', 'fire', 'lightning', 'earth', 'frost', 'psychic', 'alteration', 'divine', 'necrotic', 'wind', 'blood'];
const elementAliases = { alternation: 'alteration', illusion: 'psychic', decay: 'necrotic', cold: 'frost', holy: 'divine', sacred: 'divine', arcane: 'force' };
const elementOf = value => elements.includes(value) ? value : Object.hasOwn(elementAliases, value) ? elementAliases[value] : null;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const clone = value => structuredClone(value);
const physicalWeapons = {
  spear: { assetId: 'weapon.spear', path: 'assets-display/card-cutouts/weapon.spear.png' },
  bow: { assetId: 'weapon.bow', path: 'assets/equipment/icon_shortbow.webp' },
};
const weaponAssets = new Set(['O.object.0', 'O.object.1', 'L.object.4', 'V.object.0', 'weapon.spear', 'weapon.bow']);
// Color blending replaces hue/saturation while retaining the source luminance.
// Element identity alone selects the background; statuses keep their own PNG cues.
export const PROCEDURAL_BACKGROUND_COLORS = freeze({
  physical: '#808080', magic: '#427ec7',
  element: {
    force: '#b3271b', blood: '#b3271b', fire: '#88552f', lightning: '#e7c63b', alteration: '#448956', earth: '#705440',
    frost: '#b9deef', psychic: '#8862bd', divine: '#e3d4a1', necrotic: '#68476c', wind: '#a9d7ce',
  },
  mixed: { 'fire+frost': '#9455c7', 'alteration+lightning': '#9aca35' },
});
function backgroundColor(selected, category) {
  if (!selected.length) return category === 'magical'
    ? { id: 'camp:spell', color: PROCEDURAL_BACKGROUND_COLORS.magic }
    : { id: 'camp:physical', color: PROCEDURAL_BACKGROUND_COLORS.physical };
  const key = selected.join('+');
  // Other combinations average the canonical palette's sRGB channels equally.
  const color = PROCEDURAL_BACKGROUND_COLORS.mixed[key] || (selected.length === 1
    ? PROCEDURAL_BACKGROUND_COLORS.element[selected[0]]
    : '#' + [1, 3, 5].map(offset => Math.round(selected.reduce((sum, id) =>
      sum + parseInt(PROCEDURAL_BACKGROUND_COLORS.element[id].slice(offset, offset + 2), 16), 0) / selected.length)
      .toString(16).padStart(2, '0')).join(''));
  return { id: `element:${key}`, color };
}
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
    if (!values.length) continue;
    if (prefix === 'damage:') return { elements: values.filter(value => elementOf(value)).sort() };
    // Physical damage types remain valid unthemed contacts. Invalid explicit
    // element/school identities cannot silently fall through to another school.
    if (values.some(value => !elementOf(value))) return { conflict: true, elements: [] };
    return { elements: values.sort() };
  }
  return { elements: [] };
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
  // Ranged identity wins over Reach on cards carrying both compatible ranges.
  // Defensive and utility icons keep their action silhouette.
  const rangedWeapon = tags.includes('range:ranged') || projectile
    && tags.some(tag => ['delivery:projectile', 'delivery:ranged', 'maneuver:ranged'].includes(tag));
  const weapon = category === 'physical' && ['attack', 'smash', 'sweep', 'counter'].includes(maneuver)
    ? rangedWeapon ? 'bow'
      : tags.includes('range:reach') ? 'spear' : null
    : null;
  const identityElement = elementIdentity(tags);
  if (identityElement.conflict) return null;
  const selectedElements = identityElement.elements;
  const element = selectedElements[0] || (category === 'magical' ? 'force' : null);
  const templateElement = element === 'blood' ? 'force' : element;
  const cueElements = selectedElements.length ? selectedElements : element ? [element] : [];
  rank = cardRank({ rank });
  const statuses = tags.filter(tag => tag.startsWith('status:')).map(tag => tag.slice(7))
    .filter(id => statusExists(registries, id)).slice(0, 3 - Math.min(cueElements.length, 2));
  // Explicit effect identities outrank compatibility aliases such as Retain.
  // Multiple explicit effects retain the approved catalog's deterministic order.
  const utility = base.selection.utility.find(rule => rule.tags.some(tag => tag.startsWith('effect:') && tags.includes(tag)))
    || base.selection.utility.find(rule => rule.tags.some(tag => tags.includes(tag)));
  const key = JSON.stringify([category, maneuver, selectedElements, projectile, weapon, utility?.code, statuses, rank]);
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
  let art = approvedCardArt({ category, maneuver, element: templateElement, tags: selectionTags, def: {} });
  if (maneuver === 'counter') art = approvedCardArt({ category: 'physical', maneuver, element: templateElement, tags: [], def: {} });
  if (maneuver === 'skill' && !art) art = approvedCardArt({ category: 'magical', maneuver, element: templateElement, tags: selectionTags, def: {} });
  if (maneuver === 'evade') {
    art = approvedCardArt({ category: 'magical', maneuver: 'skill', element: templateElement, tags: [], def: {} });
    art = { ...art, code: 'procedural-evade', sprites: [art.sprites[0], { ...clone(spritesByAsset.get('symbol.feather')), id: 'object' }] };
  }
  if (!art) return null;
  art = clone(art);
  art.backgroundColor = backgroundColor(selectedElements, category);
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
  }
  if (weapon) {
    const object = art.sprites.find(sprite => sprite.id === (maneuver === 'counter' ? 'secondaryObject' : 'object'));
    Object.assign(object, physicalWeapons[weapon]);
    delete object.label;
    // Both reused assets are square transparent cutouts. Preserve the complete
    // silhouette, its native diagonal and the Counter's front-of-shield order.
    // The accepted spear's 1254px alpha bounds are x69..1223/y25..1217.
    // Centering its enlarged silhouette keeps the complete tip and handle visible.
    const size = weapon === 'spear' ? maneuver === 'counter' ? 459 : 548 : maneuver === 'counter' ? 340 : 432;
    if (weapon === 'spear' && maneuver !== 'counter') {
      object.transform.x = 248;
      object.css.left = '48.4375%';
    }
    Object.assign(object.transform, { width: size, height: size, rotationDeg: 0, scaleX: 1, scaleY: 1 });
    object.affine = [1, 0, 0, 1];
    Object.assign(object.css, { width: `${size / 512 * 100}%`, height: `${size / 640 * 100}%`,
      transform: 'translate(-50%, -50%) rotate(0deg) scale(1, 1)' });
  }
  // Status utilities can use their approved symbol, while action silhouettes stay fixed.
  if (maneuver === 'skill' && !utility && statuses.length && statusObjects.get(statusCueId(statuses[0]))) {
    art.sprites = [art.sprites.find(sprite => sprite.id === 'background'), { ...clone(statusObjects.get(statusCueId(statuses[0]))), id: 'object' }];
  }
  for (const sprite of art.sprites.filter(sprite => /^(?:object|secondaryObject)(?:-|$)/.test(sprite.id))) {
    const outline = weaponAssets.has(sprite.assetId)
      ? 'drop-shadow(0 0 0.9px rgba(255,246,220,0.98))'
      : 'drop-shadow(0 0 0.9px rgba(242,211,153,0.95))';
    sprite.css.filter = [sprite.css.filter === 'none' ? '' : sprite.css.filter,
      outline].filter(Boolean).join(' ');
  }
  // Physical Sweep has independent slash PNGs. Align their curve with the
  // scythe blade without rotating its object or the combined magical blade.
  if (maneuver === 'sweep' && category === 'physical') {
    for (const sprite of art.sprites.filter(sprite => sprite.assetId === 'C.effect.0')) {
      sprite.transform.rotationDeg = 90;
      sprite.affine = [0, 1, -1, 0];
      sprite.css.transform = 'translate(-50%, -50%) rotate(90deg) scale(1, 1)';
    }
  }
  const cueSprites = [];
  // A projectile already carries its element. Every other action retains its
  // silhouette and adds the approved elemental PNG (blue/mint alone is not an
  // element identity, and Counter deliberately uses the separate real weapon).
  for (const selected of cueElements.slice(0, 2)) {
    const cueElement = selected === 'blood' ? 'force' : selected;
    if (art.sprites.some(sprite => sprite.assetId === `Z.effect.${base.selection.projectiles[cueElement]}`)) continue;
    const source = base.compositions[`Z0${base.selection.projectiles[cueElement]}`].layers.find(sprite => sprite.id === 'foreground');
    cueSprites.push({ ...clone(source), id: cueElements.length === 1 ? 'element-cue' : `element-cue-${selected}`,
      path: base.assets[source.assetId].path, css: { ...source.css, opacity: String(0.23 / Math.min(cueElements.length, 2)) } });
  }
  // Status overlays must paint over the complete weapon/shield assembly.
  // Boost the cloned cue only; keep the approved catalog and rank scale intact.
  let statusZ = Math.max(0, ...[...art.sprites, ...cueSprites].map(sprite => Number(sprite.css.zIndex ?? sprite.zIndex ?? 0))) + 1;
  for (const id of statuses) {
    const cues = statusesById.get(statusCueId(id)) || statusesById.get('prepared');
    for (const source of cues || []) {
      const cue = clone(source), opacity = Math.min(0.65, Number(cue.css.opacity ?? 1) * 1.3);
      cue.id = `status-${id}-${source.assetId.endsWith('.mark') ? 'mark' : 'glow'}`;
      cue.zIndex = statusZ++;
      Object.assign(cue.css, { zIndex: String(cue.zIndex), opacity: String(opacity) });
      if (cue.transform) cue.transform.opacity = opacity;
      cueSprites.push(cue);
    }
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
  art.code = `procedural-${maneuver}-${selectedElements.join('+') || 'physical'}-${utility?.code || ''}${weapon ? `-${weapon}` : ''}`;
  art.path = art.sprites.find(sprite => sprite.id === 'background').path;
  const result = freeze({ kind: 'simple', path: art.path, fit: 'cover', position: '50% 50%', filter: '',
    category, maneuver, element, elements: selectedElements, rank, variant: Math.min(rank, 5), componentArt: art,
    statuses: statuses.map(id => ({ id })), layers: [],
    visualCues: [`action:${maneuver}`, ...cueElements.slice(0, 2).map(id => `element:${id}`), ...statuses.map(id => `status:${id}`)] });
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}
