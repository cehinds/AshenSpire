// Original icon geometry from the reviewed player-polish kit. Masks inherit
// the caller's semantic colour; canonical item/character paintings stay intact.
import { uiIconId, uiIconGlyph } from '../../content/uiIcons.js';
import { assetUrl } from '../assetmap.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';


export function engravedIconId(id) {
  return uiIconId(id);
}
export function engravedGlyphId(char) { return uiIconId(char); }
export function engravedIconUrl(id) {
  const resolved = engravedIconId(id);
  const glyph = uiIconGlyph(resolved);
  if (glyph) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(glyphSvgHtml(glyph, '#d8b976', URL_GLYPH_FONT_FAMILY));
  return resolved ? assetUrl(`assets/player-polish/ui/icons/${resolved}.svg`) : null;
}
// Both tiers carry identical vectors. Keep the exporter-inlined CSS mask so
// file play and external builds share a CORS-safe source. A verified picked
// folder may override it with its already-loaded blob or data URL.
export function engravedMaskUrl(id) {
  if (uiIconGlyph(engravedIconId(id))) return null;
  const url = engravedIconUrl(id);
  return url && /^(data:|blob:)/i.test(url) ? url : null;
}
const maskValue = (url) => `url("${String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, '')}")`;
const htmlAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Only fixed registered glyphs enter SVG markup; arbitrary overrides remain
// on the existing named-vector/fallback path. URL consumers need an explicit
// fill because currentColor cannot inherit through an SVG <image> or <img>.
const GLYPH_SVG_ATTRS = Object.freeze({ viewBox: '-2 -2 68 68', width: '100%', height: '100%', 'aria-hidden': 'true' });
const GLYPH_TEXT_ATTRS = Object.freeze({ x: '32', y: '32', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': '46' });
// In-document glyphs inherit the existing UI font and its original symbol
// fallback. Standalone SVG images cannot inherit that stack from their caller.
const URL_GLYPH_FONT_FAMILY = '"Inter", "Segoe UI", system-ui, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif';
const svgAttrs = (attrs) => Object.entries(attrs).map(([key, value]) => `${key}="${htmlAttribute(value)}"`).join(' ');
function glyphSvgHtml(glyph, fill, family = null) {
  const attrs = { ...GLYPH_TEXT_ATTRS, fill, ...(family ? { 'font-family': family } : {}) };
  return `<svg xmlns="http://www.w3.org/2000/svg" ${svgAttrs(GLYPH_SVG_ATTRS)}><text ${svgAttrs(attrs)}>${htmlAttribute(glyph)}</text></svg>`;
}
function appendGlyphSvg(node, glyph) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries(GLYPH_SVG_ATTRS)) svg.setAttribute(key, value);
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  for (const [key, value] of Object.entries({ ...GLYPH_TEXT_ATTRS, fill: 'currentColor' })) text.setAttribute(key, value);
  text.textContent = glyph;
  svg.appendChild(text); node.appendChild(svg);
}
export function engravedIconHtml(id) {
  const resolved = engravedIconId(id);
  if (!resolved) return '';
  const glyph = uiIconGlyph(resolved);
  if (glyph) return `<span class="engraved-icon engraved-glyph" data-component="${UI.playerEngravedIcon}" data-engraved-icon="${resolved}" aria-hidden="true">${glyphSvgHtml(glyph, 'currentColor')}</span>`;
  const url = engravedMaskUrl(resolved);
  return `<span class="engraved-icon" data-component="${UI.playerEngravedIcon}" data-engraved-icon="${resolved}" aria-hidden="true"${url ? ` style="${htmlAttribute('--engraving:' + maskValue(url))}"` : ''}></span>`;
}
export function engravedIcon(id) {
  const resolved = engravedIconId(id);
  if (!resolved) return null;
  const node = document.createElement('span');
  node.className = 'engraved-icon';
  node.dataset.engravedIcon = resolved;
  node.dataset.component = UI.playerEngravedIcon;
  node.setAttribute('aria-hidden', 'true');
  const glyph = uiIconGlyph(resolved);
  if (glyph) { node.className += ' engraved-glyph'; appendGlyphSvg(node, glyph); return node; }
  const url = engravedMaskUrl(resolved);
  if (url) node.style.setProperty('--engraving', maskValue(url));
  return node;
}
// An open screen follows both built-in tier changes and a local high-res overlay.
export function refreshEngravedIcons(doc = globalThis.document) {
  for (const node of doc?.querySelectorAll('[data-engraved-icon]') || []) {
    if (!node.dataset?.engravedIcon || !node.style?.setProperty) continue;
    const url = engravedMaskUrl(node.dataset.engravedIcon);
    if (url) node.style.setProperty('--engraving', maskValue(url));
    else node.style.removeProperty?.('--engraving');
  }
}
