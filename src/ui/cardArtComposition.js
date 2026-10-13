import { objectTagIds } from '../content/tags.js';
import { tagService } from '../model/tagService.js';

export const CARD_ART_MANEUVERS = Object.freeze(['attack', 'smash', 'counter', 'evade', 'sweep', 'defend']);
// Presentation only: these palettes do not introduce damage schools or rules.
export const CARD_ART_ELEMENTS = Object.freeze(Object.fromEntries(Object.entries({
  force: { variant: 4, color: '#b7baff', glow: '#777fe8', motif: 'rings', filter: 'hue-rotate(-28deg) saturate(.75)' },
  fire: { variant: 2, color: '#ffc17e', glow: '#ee7237', motif: 'embers', filter: '' },
  lightning: { variant: 3, color: '#fff0a2', glow: '#ddbb4e', motif: 'bolts', filter: '' },
  earth: { variant: 5, color: '#d2b486', glow: '#a17e42', motif: 'shards', filter: 'hue-rotate(-65deg) saturate(.6)' },
  frost: { variant: 1, color: '#c0edff', glow: '#72b7d7', motif: 'crystals', filter: '' },
  psychic: { variant: 4, color: '#eebcfa', glow: '#c974d7', motif: 'ripples', filter: 'hue-rotate(24deg)' },
  alteration: { variant: 5, color: '#b2e6cf', glow: '#60b59e', motif: 'orbits', filter: 'hue-rotate(27deg)' },
  divine: { variant: 3, color: '#fff4d6', glow: '#dcc492', motif: 'rays', filter: 'saturate(.45) brightness(1.06)' },
  necrotic: { variant: 5, color: '#c2d2a1', glow: '#779368', motif: 'wisps', filter: 'hue-rotate(-28deg) saturate(.55)' },
}).map(([id, row]) => [id, Object.freeze({ id, ...row })])));

const ALIASES = Object.freeze({ alternation: 'alteration', illusion: 'psychic', decay: 'necrotic', cold: 'frost', holy: 'divine', sacred: 'divine', arcane: 'force' });
export function cardArtElement(value) {
  const key = typeof value === 'string' ? value.toLowerCase().split(':').at(-1) : '';
  return Object.hasOwn(CARD_ART_ELEMENTS, key) ? key : Object.hasOwn(ALIASES, key) ? ALIASES[key] : null;
}

const STATUS_MOTIFS = Object.freeze({
  bleed: 'drops', bleeding: 'drops', burn: 'embers', burning: 'embers', frost: 'crystals', frozen: 'crystals', chilled: 'crystals',
  weak: 'fractures', vulnerable: 'fractures', frail: 'fractures', staggered: 'fractures', offBalance: 'fractures', prone: 'fractures',
  paralysis: 'bolts', grounded: 'shards', sleep: 'ripples', dazed: 'stars', insanity: 'ripples', madness: 'ripples',
  venom: 'wisps', blight: 'wisps', crimsonBlight: 'wisps', necroticBlight: 'wisps', envenom: 'wisps', regen: 'sprouts', strength: 'rays', dexterity: 'orbits',
  invulnerability: 'rings', decoy: 'orbits', concealed: 'wisps', afterimage: 'orbits', prepared: 'rings',
});
const STATUS_COLORS = Object.freeze({ drops: '#d87c85', embers: '#e8a06a', crystals: '#a9ddeb', fractures: '#c6ab90', bolts: '#e7d387', shards: '#b4ac82', ripples: '#cba5e3', stars: '#d9c8ec', wisps: '#a3be8e', sprouts: '#afcca0', rays: '#e6cea0', orbits: '#aac5dd', rings: '#c9d2dc' });
const tagIds = tags => Array.isArray(tags) ? tags.map(tag => typeof tag === 'string' ? tag : tag?.id).filter(id => typeof id === 'string') : [];
const uniqueIdentity = (tags, prefix) => {
  const ids = [...new Set(tags.filter(tag => tag.startsWith(prefix)).map(tag => tag.slice(prefix.length)))];
  return ids.length === 1 ? ids[0] : null;
};
const statusRow = (registry, id) => {
  if (!registry) return null;
  if (typeof registry.has === 'function' && !registry.has(id)) return null;
  if (typeof registry.get === 'function') return registry.get(id) || null;
  return Array.isArray(registry) ? registry.find(row => row.id === id) : null;
};
const safeTint = value => typeof value === 'string' && /^(#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|var\(--[a-z][a-z\d-]*\))$/i.test(value) ? value : null;
const physicalVariant = (def, ref) => {
  const key = `${def.id || def.cardId || ref?.cardId || ''}:${def.equipmentProfileId || def.profileId || ref?.profileId || ''}`;
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash % 5) + 1;
};
const damageElement = (def, tags) => {
  const components = def.attack?.components;
  const types = [...new Set(Array.isArray(components) ? components.map(row => row?.type).filter(type => typeof type === 'string')
    : typeof def.attack?.damageType === 'string' ? [def.attack.damageType]
      : tags.filter(tag => tag.startsWith('damage:')).map(tag => tag.slice(7)))];
  // Even one elemental component beside a physical component is mixed damage.
  return types.length === 1 ? cardArtElement(types[0]) : null;
};

/** Every active status can contribute a small motif; registry labels are data, not markup. */
export function cardArtStatuses(def, tags = [], registries = null) {
  const ids = tags.filter(id => id.startsWith('status:')).map(id => id.slice(7));
  const visited = new Set();
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) return;
    visited.add(value);
    if (['applyStatus', 'buildup'].includes(value.op) && typeof value.status === 'string') ids.push(value.status);
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child, depth + 1);
  }
  for (const key of ['effects', 'counterPayload', 'upcast', 'schoolEffect']) walk(def?.[key]);
  const rows = [];
  for (const id of [...new Set(ids)].sort()) {
    const row = statusRow(registries?.statuses, id);
    // An active registry is authoritative, including intentionally absent statuses.
    if (registries ? !row : !Object.hasOwn(STATUS_MOTIFS, id)) continue;
    const motif = STATUS_MOTIFS[id] || 'stars';
    rows.push(Object.freeze({ id, label: row?.name || id, motif, color: safeTint(row?.tint) || STATUS_COLORS[motif] }));
  }
  return Object.freeze(rows.slice(0, 3));
}

/** Resolved definitions win over refs and static content. No card-name guessing. */
export function simpleCardArt(def, { ref, registries = null, large = false, variant } = {}) {
  if (!def || typeof def !== 'object') return null;
  const tags = tagIds(def.cardTags ?? def.tags ?? (registries ? tagService(registries).idsOf('card', def) : objectTagIds('card', def.id || ref?.cardId || '')));
  const camp = uniqueIdentity(tags, 'camp:');
  if (!['physical', 'spell'].includes(camp)) return null;
  let maneuver = uniqueIdentity(tags, 'maneuver:');
  // Legacy attacks sometimes author their camp and type without a maneuver.
  // An unsupported/conflicting explicit maneuver must still fall back safely.
  if (!tags.some(tag => tag.startsWith('maneuver:')) && def.type === 'attack') maneuver = 'attack';
  // Evade is an explicit authored payload in the current combat schema.
  if ((def.evade && (def.evade === true || typeof def.evade === 'object'))
    || (Array.isArray(def.effects) && def.effects.some(effect => effect?.op === 'dodgeRoll'))) maneuver = 'evade';
  if (['casting', 'ranged'].includes(maneuver)) maneuver = 'attack';
  if (!CARD_ART_MANEUVERS.includes(maneuver)) return null;
  const category = camp === 'spell' ? 'magical' : 'physical';
  const school = uniqueIdentity(tags, 'school:');
  const element = cardArtElement(uniqueIdentity(tags, 'element:')) || cardArtElement(school) || damageElement(def, tags)
    || (category === 'magical' ? 'force' : null);
  const theme = element && CARD_ART_ELEMENTS[element];
  const requestedVariant = variant ?? def.art?.variant;
  const selectedVariant = Number.isInteger(requestedVariant) && requestedVariant >= 1 && requestedVariant <= 5
    ? requestedVariant : category === 'magical' ? theme.variant : physicalVariant(def, ref);
  const statuses = cardArtStatuses(def, tags, registries);
  const layers = Object.freeze([...(theme ? [Object.freeze({ kind: 'element', ...theme })] : []), ...statuses.map(status => Object.freeze({ kind: 'status', ...status }))]);
  return Object.freeze({
    path: `assets/cards/library/${category}-${maneuver}-${String(selectedVariant).padStart(2, '0')}-${large ? 1024 : 512}.webp`,
    kind: 'simple', fit: 'cover', position: '50% 50%', category, maneuver, element, variant: selectedVariant,
    filter: category === 'magical' ? theme.filter : '', statuses, layers,
  });
}

/** 54 preview faces by default; pass allVariants for all 270 base/theme combinations. */
export function cardArtPreviewFixtures({ allVariants = false } = {}) {
  return CARD_ART_MANEUVERS.flatMap(maneuver => Object.keys(CARD_ART_ELEMENTS).flatMap(element =>
    (allVariants ? [1, 2, 3, 4, 5] : [undefined]).map(variant => {
      const def = { id: `art-preview-${maneuver}-${element}${variant ? `-${variant}` : ''}`, cardTags: ['camp:spell', `maneuver:${maneuver}`, `element:${element}`] };
      return { id: def.id, title: `${element} ${maneuver}${variant ? ` ${variant}` : ''}`, def, composition: simpleCardArt(def, { variant }) };
    })));
}
