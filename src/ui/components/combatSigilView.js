import { ACTION_SIGILS, SCHOOL_SIGILS } from '../../content/combatSigils.js';
import { esc } from './tooltip.js';

export function sigilHtml(id, kind = 'action', { tooltip = true } = {}) {
  const catalog = kind === 'school' ? SCHOOL_SIGILS : ACTION_SIGILS;
  const mark = Object.hasOwn(catalog, id) ? catalog[id] : null;
  if (!mark) return '';
  return `<span class="combat-sigil combat-sigil-${kind}" role="img" aria-label="${esc(mark.label)}" aria-description="${esc(mark.help)}"${tooltip ? ` title="${esc(mark.label + ': ' + mark.help)}"` : ''} data-sigil="${esc(id)}"><svg viewBox="0 0 32 32" fill="${mark.solid ? 'currentColor' : 'none'}" fill-rule="evenodd" stroke="${mark.solid ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mark.shape}</svg></span>`;
}

export function cardSigilsHtml(identity) {
  if (!identity) return '';
  const mark = ACTION_SIGILS[identity.action];
  // The existing bottom layer owns the footer. School and other tags use the rail.
  return `<div class="card-sigil-band" data-card-binding="tags" data-primary-sigil="${esc(identity.action)}"><span class="card-action-icon" data-card-layer="7">${sigilHtml(identity.action, 'action', {tooltip:false})}</span><span class="card-type-name" data-card-layer="8">${esc(mark.label)}</span></div>`;
}

export function sigilExplanationHtml(identity) {
  if (!identity) return '';
  return `<div class="inspection-sigils">${[['action', identity.action], ['school', identity.school]].map(([kind, id]) => {
    const catalog = kind === 'school' ? SCHOOL_SIGILS : ACTION_SIGILS;
    const mark = Object.hasOwn(catalog, id) ? catalog[id] : null;
    return mark ? `<div class="inspection-sigil-row">${sigilHtml(id, kind)}<span><b>${esc(mark.label)}</b> — ${esc(mark.help)}</span></div>` : '';
  }).join('')}</div>`;
}

// Shorten repeated prose, keeping numeric markup, target scope, turn limits,
// charge expiry/stacking and HP-payment floors intact.
export function compactCardRules(html) {
  return html.replace(/\s+/g, ' ').replace(/(^|\. |: )Deal /g, '$1')
    .replace(/to the selected enemy/g, 'to target')
    .replace(/to every living enemy/g, 'to all enemies')
    .replace(/card\(s\)/g, 'cards')
    .replace(/Draw ((?:<[^>]+>)*\d+(?:<\/[^>]+>)*) cards/g, 'Draw $1')
    .replace(/If you have (?:starstoneCharge|Starstone Charge)/g, 'With Starstone')
    .replace(/Apply (<span\b[^>]*>[^<]*<\/span>|\{starstoneCharge\}|\d+) starstoneCharge to yourself/g, 'Gain $1 Starstone')
    .replace(/Starstone Charge/g, 'Starstone')
    // Concealed's amount and duration stay on the face; inspection owns its
    // shared definition, including the effects that reveal it.
    .replace(/\. Concealment\. Sweep and Holy revelation clear it\./g, '.')
    .replace(/If you previously played at least (\d+) ([\w-]+) cards this turn/g, 'If $1+ $2 cards played this turn')
    .replace(/ and If /g, ' and ')
    .replace(/once per turn from this family/g, 'once per turn per family')
    .replace(/HP; the payment must leave at least one HP/g, 'HP (leave at least 1 HP)')
    .replace(/Your next /g, 'Next ')
    .replace(/minimum zero/g, 'min 0')
    .replace(/this charge cannot stack with itself/g, 'cannot stack with itself').trim();
}
