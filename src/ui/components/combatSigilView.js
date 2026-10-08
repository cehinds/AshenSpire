import { ACTION_SIGILS, SCHOOL_SIGILS } from '../../content/combatSigils.js';
import { esc } from './tooltip.js';

export function sigilHtml(id, kind = 'action', { tooltip = true } = {}) {
  const catalog = kind === 'school' ? SCHOOL_SIGILS : ACTION_SIGILS;
  const mark = Object.hasOwn(catalog, id) ? catalog[id] : null;
  if (!mark) return '';
  return `<span class="combat-sigil combat-sigil-${kind}" role="img" aria-label="${esc(mark.label)}" aria-description="${esc(mark.help)}"${tooltip ? ` title="${esc(mark.label + ': ' + mark.help)}"` : ''} data-sigil="${esc(id)}"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mark.shape}</svg></span>`;
}

export function cardSigilsHtml(identity, damageTypes = []) {
  if (!identity) return '';
  // Card taps belong to selection; Information owns their explanations.
  return `<div class="card-sigil-band" data-card-binding="tags" data-primary-sigil="${esc(identity.action)}">${sigilHtml(identity.action, 'action', {tooltip:false})}${sigilHtml(identity.school, 'school', {tooltip:false})}${damageTypes.length ? `<span class="card-damage-types">${damageTypes.map(esc).join(' · ')}</span>` : ''}</div>`;
}

export function sigilExplanationHtml(identity) {
  if (!identity) return '';
  return `<div class="inspection-sigils">${[['action', identity.action], ['school', identity.school]].map(([kind, id]) => {
    const catalog = kind === 'school' ? SCHOOL_SIGILS : ACTION_SIGILS;
    const mark = Object.hasOwn(catalog, id) ? catalog[id] : null;
    return mark ? `<div class="inspection-sigil-row">${sigilHtml(id, kind)}<span><b>${esc(mark.label)}</b> — ${esc(mark.help)}</span></div>` : '';
  }).join('')}</div>`;
}

// Only remove the redundant damage verb and layout whitespace; conditions,
// targets, durations, damage names and live numeric markup stay verbatim.
export function compactCardRules(html) {
  return html.replace(/\s+/g, ' ').replace(/(^|\. )Deal /g, '$1').trim();
}
