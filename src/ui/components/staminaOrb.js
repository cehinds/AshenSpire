import { staminaOrb } from '../../content/staminaOrb.js';
import { staminaOrbModel } from '../models/StaminaOrbModel.js';
import { assetUrl } from '../assetmap.js';
import { esc } from './tooltip.js';

export function staminaOrbHtml() {
  return '<div class="energy-orb stamina-orb cell" role="status" tabindex="0" aria-label="Stamina"><svg viewBox="0 0 900 900" aria-hidden="true" focusable="false"></svg><span class="sp-v sr-only"></span></div>';
}

export function paintStaminaOrb(orb, values) {
  if (!orb) return;
  const model = staminaOrbModel(values);
  const urls = Object.fromEntries(Object.entries(staminaOrb.assets).map(([id, path]) => [id, assetUrl(path)]));
  const key = JSON.stringify([model, urls]);
  if (orb.dataset.orbPaint === key) return;
  orb.dataset.orbPaint = key;
  orb.dataset.manaRing = String(model.ring);
  orb.setAttribute('aria-label', model.label);
  orb.querySelector('.sp-v').textContent = String(model.current);
  const image = (id, x, y, size) => {
    const l = staminaOrb.layers[id];
    if (!l.visible) return '';
    // Alpha-trimmed images retain the editor's height-based sizing and aspect.
    const width = size * staminaOrb.aspectRatios[id];
    return `<image data-orb-part="${id}" href="${esc(urls[id])}" x="${x + l.x * 9 - width / 2}" y="${y + l.y * 9 - size / 2}" width="${width}" height="${size}" preserveAspectRatio="xMidYMid meet" opacity="${l.opacity / 100}" style="filter:hue-rotate(${l.hue}deg)"/>`;
  };
  let html = ['orb', 'frame', 'sigil'].map(id => image(id, 450, 450, staminaOrb.layers[id].size * 9)).join('');
  html += model.gems.map(gem => image(gem.id, gem.x, gem.y, gem.size * staminaOrb.layers[gem.id].size / 100)).join('');
  for (const [id, value, font, baseline] of [['number', model.current, 145, 430], ['label', 'SP', 68, 540]]) {
    const l = staminaOrb.layers[id];
    if (l.visible) html += `<text data-orb-part="${id}" x="${450 + l.x * 9}" y="${baseline + l.y * 9}" text-anchor="middle" dominant-baseline="central" opacity="${l.opacity / 100}" style="font:${font * l.size / 100}px Georgia,serif;fill:#f1f1dc">${value}</text>`;
  }
  orb.querySelector('svg').innerHTML = html;
}
