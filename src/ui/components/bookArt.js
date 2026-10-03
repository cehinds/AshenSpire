import { bookArtRecipe, bookArtLayers } from '../../content/bookArt.js';
import { assetUrl } from '../assetmap.js';

const ns = 'http://www.w3.org/2000/svg';

let nextId = 0;
const svgNode = (tag, attrs = {}) => {
  const node = document.createElementNS(ns, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};
const rgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);

// Recolor the neutral leather across the entire sprite. Warm brass and
// parchment are protected by their red-blue separation, not a front-face mask.
function bindingFilter(id, color) {
  const filter = svgNode('filter', { id, 'color-interpolation-filters': 'sRGB', x: '0%', y: '0%', width: '100%', height: '100%' });
  filter.append(svgNode('feColorMatrix', { in: 'SourceGraphic', type: 'saturate', values: '0', result: 'gray' }));
  const tint = svgNode('feComponentTransfer', { in: 'gray', result: 'tinted' });
  rgb(color).forEach((value, index) => tint.append(svgNode(['feFuncR', 'feFuncG', 'feFuncB'][index], { type: 'table', tableValues: `0 ${value * .48} ${value} ${value + (1 - value) * .38} 1` })));
  filter.append(tint);
  filter.append(svgNode('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -8 0 8 0 1', result: 'neutral' }));
  filter.append(svgNode('feComposite', { in: 'neutral', in2: 'SourceAlpha', operator: 'in', result: 'leather' }));
  filter.append(svgNode('feComposite', { in: 'tinted', in2: 'leather', operator: 'in', result: 'coloredLeather' }));
  filter.append(svgNode('feComposite', { in: 'SourceGraphic', in2: 'leather', operator: 'out', result: 'hardware' }));
  const merge = svgNode('feMerge');
  merge.append(svgNode('feMergeNode', { in: 'hardware' }), svgNode('feMergeNode', { in: 'coloredLeather' }));
  filter.append(merge);
  return filter;
}

function metalFilter(id, color, treatment) {
  const filter = svgNode('filter', { id, 'color-interpolation-filters': 'sRGB', x: '-10%', y: '-10%', width: '120%', height: '120%' });
  filter.append(svgNode('feColorMatrix', { type: 'saturate', values: '0' }));
  const transfer = svgNode('feComponentTransfer');
  const aged = treatment === 'line' ? .66 : 1;
  rgb(color).forEach((value, index) => transfer.append(svgNode(['feFuncR', 'feFuncG', 'feFuncB'][index], { type: 'table', tableValues: `0 ${value * .25 * aged} ${value * .64 * aged} ${value * aged} 1` })));
  filter.append(transfer);
  return filter;
}

export function bookSymbolUrl(symbol) { return assetUrl(`assets/shop/painted/symbols/${symbol}.webp`); }

export function renderBookArt(def, { recipe, className = '', resolveAsset = assetUrl } = {}) {
  const art = bookArtRecipe(def, recipe);
  const paths = bookArtLayers(art);
  const id = `painted-book-${++nextId}`;
  const root = document.createElement('span');
  root.className = `book-art painted-book ${className}`.trim();
  root.setAttribute('aria-hidden', 'true');
  root.dataset.bookCover = art.cover;
  root.dataset.bookSymbol = art.symbol;
  const svg = svgNode('svg', { viewBox: '0 0 1000 1000', width: '100%', height: '100%' });
  const defs = svgNode('defs');
  defs.append(bindingFilter(`${id}-binding`, art.color), metalFilter(`${id}-metal`, art.ink, art.treatment));
  svg.append(defs);
  svg.append(svgNode('image', { href: resolveAsset(paths.base), width: 1000, height: 1000, filter: `url(#${id}-binding)` }));
  // The emblem is a separate painted relief, projected into the cover plane.
  const group = svgNode('g', { transform: 'matrix(1 -.20 .32 .95 206 223)' });
  if (art.treatment === 'seal') group.append(svgNode('circle', { cx: 250, cy: 255, r: 222, fill: '#201509', 'fill-opacity': '.35', stroke: art.ink, 'stroke-opacity': '.5', 'stroke-width': 5 }));
  group.append(svgNode('image', { class: 'painted-emblem book-art-symbol', href: resolveAsset(paths.symbol), width: 500, height: 510, filter: `url(#${id}-metal)` }));
  svg.append(group);
  // Optional secondary tooling remains independent of the painted fittings.
  if (art.trim === 'arcane') {
    const marks = svgNode('g', { transform: 'matrix(1 -.20 .32 .95 206 223)', stroke: art.ink, 'stroke-width': 2, fill: 'none', opacity: '.65' });
    marks.append(svgNode('circle', { cx: 250, cy: 255, r: 242 }), svgNode('path', { d: 'M250 2v30 M250 478v30 M5 255h30 M465 255h30' }));
    svg.append(marks);
  } else if (art.trim !== 'none') {
    const tooling = svgNode('path', { transform: 'matrix(1 -.20 .32 .95 206 223)', d: art.trim === 'frame' ? 'M0 0H500V510H0Z' : 'M0 50V0H50 M450 0H500V50 M500 460V510H450 M50 510H0V460', stroke: art.ink, 'stroke-width': 2, fill: 'none', opacity: '.42' });
    svg.append(tooling);
  }
  root.append(svg);
  return root;
}
