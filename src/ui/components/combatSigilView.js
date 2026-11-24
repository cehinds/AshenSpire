import { ACTION_SIGILS, SCHOOL_SIGILS, TRADITION_SIGILS, mirrorSigil } from '../../content/combatSigils.js';
import { esc } from './tooltip.js';
import { t } from '../strings.js';

export function sigilHtml(id, kind = 'action', { tooltip = true } = {}) {
  const catalog = kind === 'school' ? SCHOOL_SIGILS : kind === 'tradition' ? TRADITION_SIGILS : ACTION_SIGILS;
  const mark = Object.hasOwn(catalog, id) ? catalog[id] : null;
  if (!mark) return '';
  return `<span class="combat-sigil combat-sigil-${kind}" role="img" aria-label="${esc(mark.label)}" aria-description="${esc(mark.help)}"${tooltip ? ` title="${esc(mark.label + ': ' + mark.help)}"` : ''} data-sigil="${esc(id)}"><svg viewBox="0 0 32 32" fill="${mark.solid ? 'currentColor' : 'none'}" fill-rule="evenodd" stroke="${mark.solid ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mark.shape}</svg></span>`;
}

export function cardSigilsHtml(identity) {
  if (!identity) return '';
  const mark = identity.mirror ? mirrorSigil(identity.mirror).mark : ACTION_SIGILS[identity.action];
  // The existing bottom layer owns the footer. School and other tags use the rail.
  // A mirrored Spell retains its basic's mark. Tradition-aware cards use the
  // new type label; generic callers retain the historical basic's word.
  const mirror = identity.mirror ? `<span class="card-action-icon card-mirror-icon" data-card-layer="7">${sigilHtml(mirrorSigil(identity.mirror).id, 'action', {tooltip:false})}</span>` : '';
  const traditionIcons = identity.traditions?.map(id => `<span class="card-action-icon card-tradition-icon" data-tradition="${esc(id)}" data-card-layer="7">${sigilHtml(id, 'tradition', {tooltip:false})}</span>`).join('');
  const icons = traditionIcons || `<span class="card-action-icon" data-card-layer="7">${sigilHtml(identity.action, 'action', {tooltip:false})}</span>`;
  return `<div class="card-sigil-band" data-card-binding="tags" data-primary-sigil="${esc(identity.action)}"${identity.traditions ? ` data-traditions="${esc(identity.traditions.join(' '))}"` : ''}${identity.mirror ? ` data-mirror="${esc(identity.mirror)}"` : ''}>${icons}${mirror}<span class="card-type-name" data-card-layer="8">${esc(identity.displayLabel || mark.label)}</span></div>`;
}

export function sigilExplanationHtml(identity) {
  if (!identity) return '';
  const traditions = (identity.traditions || []).map(id => ['tradition', id]);
  const identities = [...traditions, ...(!traditions.length || identity.action !== 'spell' ? [['action', identity.action]] : []),
    ['mirror', identity.mirror], ['school', identity.school]];
  return `<div class="inspection-sigils">${identities.map(([kind, rawId]) => {
    const catalog = kind === 'school' ? SCHOOL_SIGILS : kind === 'tradition' ? TRADITION_SIGILS : ACTION_SIGILS;
    const id = kind === 'mirror' && rawId ? mirrorSigil(rawId).id : rawId;
    const mark = kind === 'mirror' && rawId ? mirrorSigil(rawId).mark : Object.hasOwn(catalog, id) ? catalog[id] : null;
    return mark ? `<div class="inspection-sigil-row">${sigilHtml(id, kind)}<span><b>${esc(mark.label)}</b>: ${esc(mark.help)}</span></div>` : '';
  }).join('')}</div>`;
}

// Shorten repeated prose, keeping numeric markup, target scope, turn limits,
// charge expiry/stacking and HP-payment floors intact.
export function compactCardRules(html) {
  return html.replace(/\s+/g, ' ').replace(/(^|\. |: )Deal /g, '$1')
    .replace(/, plus (\d+) for each ((?:<span class="st-bleed">)?[A-Za-z][A-Za-z ]*?(?:<\/span>)?) on the target(?=[.;]|$)/g, ', +$1 per target $2')
    .replace(/At the start of your turn, gain (\d+) ([A-Za-z][A-Za-z ]*?) and take (\d+) damage(?=[.;]|$)/g, 'Your turn start: +$1 $2; take $3 damage')
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
    .replace(/Your next /g, t('combat.sigil.nextShort') + ' ')
    .replace(/minimum zero/g, 'min 0')
    .replace(/this charge cannot stack with itself/g, 'cannot stack with itself').trim();
}
