import { BOOK_ART_PRESETS } from './bookArtPresets.js';

// Extend these catalogs to add another cover or symbol; paths use assetUrl.
export const BOOK_COVERS = ['classic', 'scholar', 'field'];
export const BOOK_SYMBOLS = ['blade', 'shield', 'focus', 'paired', 'spell', 'universal', 'reaver', 'starseer', 'rogue', 'herald'];
export const BOOK_TREATMENTS = ['solid', 'line', 'seal'];
export const BOOK_TRIMS = ['none', 'corners', 'frame', 'arcane'];
export const BOOK_PALETTE = ['#ac782d', '#277348', '#346e9f', '#7541a5', '#247c7a', '#a34237', '#514b9b', '#3e6261', '#98582d', '#6f737b'];
export const DEFAULT_BOOK_ART = { cover: 'classic', color: '#795342', symbol: 'universal', treatment: 'line', ink: '#efd083', trim: 'corners' };
const hex = /^#[0-9a-f]{6}$/i;
export function bookArtProblems(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) return ['Expected a book artwork recipe.'];
  const errors = [];
  for (const [key, choices] of Object.entries({ cover: BOOK_COVERS, symbol: BOOK_SYMBOLS, treatment: BOOK_TREATMENTS, trim: BOOK_TRIMS })) {
    if (!choices.includes(recipe[key])) errors.push(`Unknown ${key}: ${recipe[key]}`);
  }
  for (const key of ['color', 'ink']) if (!hex.test(recipe[key])) errors.push(`${key} must be a six-digit hex color.`);
  for (const key of Object.keys(recipe)) if (!Object.hasOwn(DEFAULT_BOOK_ART, key)) errors.push(`Unknown artwork field: ${key}`);
  return errors;
}
export function bookArtRecipe(def, override) {
  const recipe = override || BOOK_ART_PRESETS[def?.id] || DEFAULT_BOOK_ART;
  return bookArtProblems(recipe).length ? { ...DEFAULT_BOOK_ART } : { ...recipe };
}
export function bookArtLayers(recipe) {
  const root = 'assets/shop/layers';
  return {
    base: `${root}/covers/${recipe.cover}.webp`,
    tint: `${root}/cover-tint.svg`,
    symbol: `${root}/symbols/${recipe.symbol}-${recipe.treatment}.svg`,
    trim: recipe.trim === 'none' ? null : `${root}/trims/${recipe.trim}.svg`,
  };
}
