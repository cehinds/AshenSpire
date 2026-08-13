import { esc } from './tooltip.js';

/** One data-owned identity fragment; every surface may add its own surrounding copy. */
export function flaskIdentityHtml(def, { showName = true, className = '' } = {}) {
  return `<span class="flask-identity ${esc(className)}" data-flask-art="${esc(def.artKey)}" style="--flask-tint:${esc(def.tint)}" aria-label="${esc(def.name)}">`
    + `<span class="flask-art" aria-hidden="true">${esc(def.icon)}</span>`
    + (showName ? `<span class="flask-name">${esc(def.name)}</span>` : '')
    + '</span>';
}

export function flaskPresentation(def, options = {}) {
  const el = document.createElement(options.tag || 'span');
  el.className = options.hostClass || '';
  el.innerHTML = flaskIdentityHtml(def, options);
  return el;
}
