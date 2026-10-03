import { el } from '../kit/index.js';
import { assetUrl } from '../assetmap.js';
import { bookArtRecipe, bookArtLayers } from '../../content/bookArt.js';

const url = (path) => {
  const resolved = assetUrl(path);
  return `url("${document.baseURI ? new URL(resolved, document.baseURI).href : resolved}")`;
};
/** Independent transparent layers, shared by shop, inventory and authoring. */
export function renderBookArt(def, { recipe, className = '' } = {}) {
  const art = bookArtRecipe(def, recipe);
  const paths = bookArtLayers(art);
  const root = el('span', { class: `book-art ${className}`.trim(), 'aria-hidden': 'true', dataset: { bookCover: art.cover, bookSymbol: art.symbol } });
  root.appendChild(el('img', { class: 'book-art-base', src: assetUrl(paths.base), alt: '', width: 320, height: 320, decoding: 'async' }));
  const layer = (name, path, color) => {
    const node = el('span', { class: `book-art-${name}` });
    node.style.setProperty('--book-layer-mask', url(path));
    node.style.setProperty('--book-layer-color', color);
    root.appendChild(node);
  };
  layer('tint', paths.tint, art.color);
  if (paths.trim) layer('trim', paths.trim, art.ink);
  layer('symbol', paths.symbol, art.ink);
  return root;
}
