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
      if (node.getComputedTextLength() > item.w) node.setAttribute('textLength', String(item.w));
      node.dataset.measured = 'true';
    }
  }
  row.querySelector('.end-turn')?.setAttribute('aria-label', next.endTurnKey ? `${next.endTurn} (${next.endTurnKey})` : next.endTurn);
  row.querySelector('.combat-potions')?.setAttribute('aria-label', next.potions);
  // The authored face remains separate from these readable narrow-host labels.
  for (const [role, text] of Object.entries({ draw: `${next.draw ?? 0} Draw`, end: next.endTurn, discard: `${t('combat.discard')} ${next.discard ?? 0}\n${t('combat.exhaust')} ${next.exhaust ?? 0}`, potions: next.potions })) {
    const label = row.querySelector(`${selectors[role]} .footer-compact-label`);
    if (label) label.textContent = text;
  }
  // Refresh references after switching between light and high-resolution packs.
  for (const image of row.querySelectorAll('[data-footer-asset]')) image.setAttribute('href', assetUrl(footerAssets[image.dataset.footerAsset]));
}
