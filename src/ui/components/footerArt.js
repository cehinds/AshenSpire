import { footerLayout, footerAssets, footerFonts } from '../../content/footerLayout.js';
import { footerLayoutModel, footerText, footerStaminaLayers } from '../models/FooterLayoutModel.js';
import { assetUrl } from '../assetmap.js';
import { esc } from './tooltip.js';
import { t } from '../strings.js';

const plan = footerLayoutModel(footerLayout);
const selectors = { sp: '.energy-orb', draw: '.pile.draw', end: '.end-turn', discard: '.pile.spent', potions: '.combat-potions' };
const states = new WeakMap();
export function paintFooterOrb(orb, resource, urls) {
  if (!orb.closest?.('[data-footer-art]')) return false;
  const canvas = orb.querySelector(':scope > svg'), b = plan.groups.sp.bounds;
  canvas.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
  canvas.innerHTML = footerStaminaLayers(footerLayout, resource).map(n => `<image data-orb-part="${esc(n.asset)}" href="${esc(urls[n.asset])}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" opacity="${n.opacity}" preserveAspectRatio="none"/>`).join('');
  return true;
}
function svg(nodes, b) {
  return `<svg class="footer-art-face" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" aria-hidden="true" focusable="false">${nodes.map(n => {
    if (n.asset !== 'text') return footerAssets[n.asset] ? `<image data-footer-asset="${esc(n.asset)}" href="${esc(assetUrl(footerAssets[n.asset]))}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" opacity="${n.opacity}" preserveAspectRatio="none"/>` : '';
    const align = n.textAlign || 'center', x = n.x + (align === 'right' ? n.w : align === 'center' ? n.w / 2 : 0);
    return `<text data-footer-text="${esc(n.id)}" data-footer-binding="${esc(n.binding || 'static')}" x="${x}" y="${n.y + n.h / 2}" text-anchor="${align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'}" dominant-baseline="central" font-family="${esc(footerFonts[n.fontFamily] || footerFonts.serif)}" font-size="${n.fontSize}" font-weight="${n.fontWeight || 400}" font-style="${esc(n.fontStyle || 'normal')}" fill="${esc(n.color)}" opacity="${n.opacity}" lengthAdjust="spacingAndGlyphs"></text>`;
  }).join('')}</svg>`;
}
export function installFooterArt(row) {
  if (!row || states.has(row)) return;
  row.dataset.footerArt = 'true';
  states.set(row, {});
  const b = plan.bounds;
  for (const [role, selector] of Object.entries(selectors)) {
    const control = row.querySelector(selector), group = plan.groups[role];
    if (!control) continue;
    const box = group.bounds;
    control.style.setProperty('--art-x', `${(box.x - b.x) / b.w * 100}%`);
    control.style.setProperty('--art-y', `${(box.y - b.y) / b.h * 100}%`);
    control.style.setProperty('--art-w', `${box.w / b.w * 100}%`);
    control.style.setProperty('--art-h', `${box.h / b.h * 100}%`);
    if (role === 'sp') {
      // Keep the resource renderer's dynamic ring; its text is a separate,
      // authored overlay so font/position changes reach stamina as well.
      control.insertAdjacentHTML('beforeend', `<span class="footer-sp-text">${svg(group.items.filter(n => n.asset === 'text'), box)}</span>`);
      continue;
    }
    control.innerHTML = svg(group.items, box) + '<span class="footer-compact-label" aria-hidden="true"></span>';
    if (role === 'draw') control.insertAdjacentHTML('beforeend', '<span class="sp-v n sr-only"></span>');
  }
  row.insertAdjacentHTML('afterbegin', `<div class="footer-art-rails">${svg(plan.rails, b)}</div>`);
}
// A word longer than its authored box is squeezed into it (textLength). That
// takes a measurement, and a measurement after a write is a synchronous style
// and layout pass. Measured where it was written, the first render of a fight
// paid one per word, and again for each painter (End Turn's key, then the
// counts), each a restyle of the whole half-built screen. So the words are
// written now and measured once, together, at the next animation frame, before
// that frame paints: a render from an event or a timer never shows a word
// uncapped.
const pendingCaps = new Map();
const pendingCompactRows = new Set();
let capFrame = 0;
function capLongWords() {
  capFrame = 0;
  const list = [...pendingCaps].filter(([node]) => node.isConnected);
  pendingCaps.clear();
  const long = list.filter(([node, w]) => node.getComputedTextLength() > w);
  for (const [node, w] of long) node.setAttribute('textLength', String(w));
  // Marked only once measured: a word dropped here because it was detached is
  // measured again by the next paint that finds it.
  for (const [node] of list) node.dataset.measured = 'true';
  const lines = [...pendingCompactRows].filter(row => row.isConnected && row.dataset.footerCompact === 'true')
    .flatMap(row => [...row.querySelectorAll('.footer-compact-line')]);
  pendingCompactRows.clear();
  for (const line of lines) line.style.removeProperty('font-size');
  const sizes = lines.map(line => ({ line, width: line.getBoundingClientRect().width,
    available: line.parentElement.getBoundingClientRect().width,
    font: parseFloat(getComputedStyle(line).fontSize) }));
  for (const { line, width, available, font } of sizes) {
    if (width > available && available > 0) line.style.fontSize = `${font * available / width}px`;
  }
}
function scheduleCaps() {
  if ((!pendingCaps.size && !pendingCompactRows.size) || capFrame) return;
  if (typeof requestAnimationFrame !== 'function') { capLongWords(); return; }
  capFrame = requestAnimationFrame(capLongWords);
}
// The layout adapter calls this after resizing; count changes use the same
// batch. Measure complete lines so Discard/Exhaust never break inside a word.
export function fitFooterCompactLabels(row) {
  if (!row) return;
  pendingCompactRows.add(row);
  scheduleCaps();
}
export function paintFooterArt(row, values = {}) {
  if (!row?.dataset?.footerArt) return;
  installFooterArt(row);
  if (!row) return;
  const next = { ...states.get(row), endTurn: t('combat.endTurn'), drawLabel: 'DRAW', spLabel: 'SP', discardLabel: t('combat.discard'), exhaustLabel: t('combat.exhaust'), potions: t('potions.run.title'), ...values };
  states.set(row, next);
  const textNodes = new Map([...row.querySelectorAll('[data-footer-text]')].map(node => [node.dataset.footerText, node]));
  for (const group of Object.values(plan.groups)) for (const item of group.items) {
    if (item.asset !== 'text') continue;
    const node = textNodes.get(item.id), value = footerText(item, next);
    if (node && (node.textContent !== value || !node.dataset.measured)) {
      node.textContent = value;
      node.removeAttribute('textLength');
      pendingCaps.set(node, item.w);
    }
  }
  scheduleCaps();
  row.querySelector('.end-turn')?.setAttribute('aria-label', next.endTurnKey ? `${next.endTurn} (${next.endTurnKey})` : next.endTurn);
  row.querySelector('.combat-potions')?.setAttribute('aria-label', next.potions);
  // The authored face remains separate from these readable narrow-host labels.
  for (const [role, text] of Object.entries({ draw: `${next.draw ?? 0} Draw`, end: next.endTurn, discard: `${t('combat.discard')} ${next.discard ?? 0}\n${t('combat.exhaust')} ${next.exhaust ?? 0}`, potions: next.potions })) {
    const label = row.querySelector(`${selectors[role]} .footer-compact-label`);
    if (label && label.dataset.labelText !== text) {
      label.replaceChildren(...text.split('\n').map(value => {
        const line = document.createElement('span');
        line.className = 'footer-compact-line';
        line.textContent = value;
        return line;
      }));
      label.dataset.labelText = text;
    }
  }
  fitFooterCompactLabels(row);
  // Refresh references after switching between light and high-resolution packs.
  for (const image of row.querySelectorAll('[data-footer-asset]')) image.setAttribute('href', assetUrl(footerAssets[image.dataset.footerAsset]));
}
