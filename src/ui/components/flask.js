import { esc } from './tooltip.js';
import { assetUrl } from '../assetmap.js';

/** One data-owned identity fragment; every surface may add its own surrounding copy. */
export function flaskIdentityHtml(def, { showName = true, className = '' } = {}) {
  const art = def.artAsset
    ? `<img class="flask-art-image" src="${esc(assetUrl(def.artAsset))}" alt="">`
    : `<span class="flask-art-glyph">${esc(def.icon)}</span>`;
  return `<span class="flask-identity ${esc(className)}" data-flask-art="${esc(def.artKey)}" style="--flask-tint:${esc(def.tint)}" aria-label="${esc(def.name)}">`
    + `<span class="flask-art" aria-hidden="true">${art}</span>`
    + (showName ? `<span class="flask-name">${esc(def.name)}</span>` : '')
    + '</span>';
}

export function flaskPresentation(def, options = {}) {
  const el = document.createElement(options.tag || 'span');
  el.className = options.hostClass || '';
  el.innerHTML = flaskIdentityHtml(def, options);
  return el;
}
