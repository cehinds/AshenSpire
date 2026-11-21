import { ACTION_SIGILS, SCHOOL_SIGILS, TRADITION_SIGILS, mirrorSigil } from '../../content/combatSigils.js';
import { esc } from './tooltip.js';
import { t } from '../strings.js';

export function sigilHtml(id, kind = 'action', { tooltip = true } = {}) {
  const catalog = kind === 'school' ? SCHOOL_SIGILS : kind === 'tradition' ? TRADITION_SIGILS : ACTION_SIGILS;
  const mark = Object.hasOwn(catalog, id) ? catalog[id] : null;
  if (!mark) return '';
  return `<span class="combat-sigil combat-sigil-${kind}" role="img" aria-label="${esc(mark.label)}" aria-description="${esc(mark.help)}"${tooltip ? ` title="${esc(mark.label + ': ' + mark.help)}"` : ''} data-sigil="${esc(id)}"><svg viewBox="0 0 32 32" fill="${mark.solid ? 'currentColor' : 'none'}" fill-rule="evenodd" stroke="${mark.solid ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${mark.shape}</svg></span>`;
}

// Under spell traditions only an Arcane or Divine Spell wears its category mark; Shared and schoolless Spells wear the Spell mark alone.
const categoryMark = identity => ['arcane', 'divine'].includes(identity.category) ? identity.category : null;
const iconHtml = (inner, className = '', attributes = '') => `<span class="card-action-icon${className}"${attributes} data-card-layer="7">${inner}</span>`;

export function cardSigilsHtml(identity) {
  if (!identity) return '';
  const mark = identity.mirror ? mirrorSigil(identity.mirror).mark : ACTION_SIGILS[identity.action];
  // The existing bottom layer owns the footer. School and other tags use the rail.
  // Order: the action mark, the category mark (Arcane or Divine only), then a
  // mirrored Spell's basic mark. Tradition-aware cards use the type label;
  // generic callers retain the historical basic's word.
  const category = identity.traditions ? categoryMark(identity) : null;
  const action = iconHtml(sigilHtml(identity.action, 'action', {tooltip:false}));
  const categoryIcon = category ? iconHtml(sigilHtml(category, 'tradition', {tooltip:false}), ' card-tradition-icon', ` data-tradition="${esc(category)}"`) : '';
  const mirror = identity.mirror ? iconHtml(sigilHtml(mirrorSigil(identity.mirror).id, 'action', {tooltip:false}), ' card-mirror-icon') : '';
  const attributes = (identity.traditions ? ` data-traditions="${esc(identity.traditions.join(' '))}" data-spell-category="${esc(identity.category || 'spell')}"` : '')
    + (identity.mirror ? ` data-mirror="${esc(identity.mirror)}"` : '');
  return `<div class="card-sigil-band" data-card-binding="tags" data-primary-sigil="${esc(identity.action)}"${attributes}>${action}${categoryIcon}${mirror}<span class="card-type-name" data-card-layer="8">${esc(identity.displayLabel || mark.label)}</span></div>`;
}

export function sigilExplanationHtml(identity) {
  if (!identity) return '';
  const category = identity.traditions ? categoryMark(identity) : null;
  const identities = [['action', identity.action], ...(category ? [['tradition', category]] : []),
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
