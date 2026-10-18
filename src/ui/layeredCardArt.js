import { layeredCardArtCatalog as catalog } from '../content/layeredCardArt.generated.js';
import { assetUrl } from './assetmap.js';

/* CARD_CUTOUTS_START */
const cardCutoutMap = {};
/* CARD_CUTOUTS_END */
export const cardCutoutUrl = path => cardCutoutMap[path] || assetUrl(path);

const own = (map, key) => Object.hasOwn(map, key) ? map[key] : undefined;
function effectOperations(def, target) {
  const result = new Set(), visited = new Set();
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) return;
    visited.add(value);
    if (typeof value.op === 'string' && (!target || value.target === target)) result.add(value.op);
    for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child, depth + 1);
  }
  // Main authored payload only: conditional branches are still authored effects.
  visit(def.effects);
  return result;
}

/** Only approved catalog entries may become art. Names never select mechanics. */
export function approvedCardArt({ category, maneuver, element, tags, def }) {
  const rules = catalog.selection;
  let choice;
  if (maneuver === 'skill') {
    choice = rules.utility.find(row => row.operations.some(op => effectOperations(def, row.target).has(op)) || row.tags.some(tag => tags.includes(tag)));
    choice ||= category === 'magical' ? rules.spellUtility : null;
  } else if (category === 'magical' && Object.hasOwn(rules.melee, maneuver)) {
    const ranged = maneuver === 'attack' && rules.projectileTags.some(tag => tags.includes(tag));
    const digit = ranged ? own(rules.projectiles, element) ?? rules.projectiles.force
      : rules.melee[maneuver] + (rules.mintElements.includes(element) ? rules.meleePalettes.mint : rules.meleePalettes.blue);
    choice = {code: `${ranged ? 'Z' : 'Y'}0${digit}`};
  } else if (category === 'physical') choice = own(rules.physical, maneuver);
  const composition = choice && own(catalog.compositions, choice.code);
  if (!composition) return null;
  const sprites = composition.layers.filter(layer => !choice.hideLayers?.includes(layer.id)).map(layer => ({
    ...layer, path:catalog.assets[layer.assetId].path, label:catalog.assets[layer.assetId].name,
  }));
  return {code:composition.code, label:composition.label, sprites,
    path:sprites.find(layer => layer.id === 'background').path,
    coordinateSpace:rules.coordinateSpace, maxVisibleTags:rules.maxVisibleTags};
}
