// Original icon geometry from the reviewed player-polish kit. Masks inherit
// the caller's semantic colour; canonical item/character paintings stay intact.
import { assetUrl, assetTier } from '../assetmap.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';

const ICONS = new Set('accessibility actions armour attack audio back bleed blight block boss burn check cinders close collapse combat compare compendium connected contrast controls coop deck dexterity dialogue discard disconnected display draw equipment expand flask-health flask-mana frail frost health history info insanity inventory journey link location lock madness mana map menu merchant motion next poise profile progression quest regen relic reset rest reward save search seed settings shield skill smith staggered stamina strength sword target touch unknown vulnerable warning weak weight world'.split(' '));
const ALIASES = Object.freeze({ hp: 'health', action: 'actions', energy: 'actions', crimsonBlight: 'blight' });
const GLYPHS = Object.freeze({ '☰': 'menu', '×': 'close', '✕': 'close', '✖': 'close', '←': 'back', '‹': 'back', '›': 'next', '⚙': 'settings', '⚔': 'attack', '⚒': 'smith', '♥': 'health', '❤': 'health', '🛡': 'shield', '🔒': 'lock', '✓': 'check', '✔': 'check', '⚠': 'warning', '🔍': 'search', '🔥': 'burn', '💧': 'mana', '📜': 'quest', '🎲': 'seed', '↻': 'reset', 'ℹ': 'info' });

export function engravedIconId(id) {
  const resolved = ALIASES[id] || id;
  return ICONS.has(resolved) ? resolved : null;
}
const CARD_GLYPHS = Object.freeze({ '🗡': 'sword', '💨': 'motion', '🩸': 'bleed', '💀': 'madness', '🕯': 'burn', '📣': 'audio', '🩹': 'health', '🤚': 'actions', '❄': 'frost' });
export function engravedGlyphId(char) { return GLYPHS[char] || CARD_GLYPHS[char] || null; }
export function engravedIconUrl(id) {
  const resolved = engravedIconId(id);
  return resolved ? assetUrl(`assets/player-polish/ui/icons/${resolved}.svg`) : null;
}
// CSS carries an exporter-inlined fallback for file play. Chromium rejects
// relative/file SVG masks in CORS mode; picked-folder blob URLs are usable.
// The original vectors are identical in both built-in tiers. A served high-res
// manifest can name missing files; CSS masks have no error event, so keep the
// embedded original for that unverified overlay. Picked-folder blobs are real
// files and may override it without making icon-only controls disappear.
export function engravedMaskUrl(id, protocol = globalThis.location?.protocol) {
  const url = engravedIconUrl(id);
  const resolved = engravedIconId(id);
  if (resolved && assetTier(`assets/player-polish/ui/icons/${resolved}.svg`) === 'high' && !/^(data:|blob:)/i.test(url)) return null;
  if (protocol === 'file:' && url && !/^(data:|blob:|https?:)/i.test(url)) return null;
  // CSS custom-property URLs resolve at the consuming stylesheet. Resolve
  // against the document first so native ESM and exported builds agree.
  return url && /^https?:$/.test(protocol) && globalThis.location?.href
    ? new URL(url, globalThis.location.href).href : url;
}
const maskValue = (url) => `url("${String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, '')}")`;
const htmlAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function engravedIconHtml(id) {
  const resolved = engravedIconId(id);
  if (!resolved) return '';
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
