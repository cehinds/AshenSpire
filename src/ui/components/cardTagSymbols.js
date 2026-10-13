import { ACTION_SIGILS } from '../../content/combatSigils.js';
import { constantFormulaValue } from '../../model/formulas.js';
import { cardArtElement } from '../cardArtComposition.js';
import { t, tFull } from '../strings.js';
import { esc } from './tooltip.js';

// Original solid silhouettes, matching the approved B footer treatment.
const SHAPES = Object.freeze({
  evade: '<path d="M7 2h13l-2 12 4 6 7 3 2 5-2 3H13L2 25l2-8Zm1 5-1 4 10 2 1-4ZM5 21l-1 3 10 5h14v-3H15Z"/>',
  earth: '<path d="m8 5 13-2 9 11-3 14-16 3L2 20Zm1 4-4 10 7 8 1-12Zm6 6-1 12 10-2 3-10Zm1-3h9l-6-6-7 2Z"/>',
  fire: '<path d="M18 1c4 9-5 11-1 16 4-2 6-6 6-10 12 14 9 24-7 24C1 31-2 19 9 10c-1 6 1 9 4 9-4-9 3-13 5-18ZM16 21c-7 7-3 9 0 9s8-4 0-9Z"/>',
  ritual: '<path d="M16 2 31 28H1Zm0 7L7 25h18Z"/><circle cx="16" cy="19" r="4"/>',
  skill: '<path d="m16 2 5 9 9 5-9 5-5 9-5-9-9-5 9-5Zm0 9-5 5 5 5 5-5Z"/>',
  bleed: '<path d="M16 1C13 8 5 15 5 21a11 11 0 0 0 22 0C27 15 19 8 16 1ZM9 21h3c0 4 2 5 5 5v3c-5 0-8-3-8-8Z"/>',
  frost: '<path d="M14 1h4v8l6-5 3 3-8 7 10-1v4l-10 1 8 7-3 3-6-7v10h-4V21l-7 7-3-3 8-7-10-1v-4l10 1-8-7 3-3 7 5Z"/>',
  lightning: '<path d="M18 1 3 19h11l-2 12L30 12H18l4-11Z"/>',
  force: '<path d="M16 2 30 16 16 30 2 16Zm0 6-8 8 8 8 8-8Z"/><circle cx="16" cy="16" r="4"/>',
  alteration: '<path d="m1 25 10-20 8 13 5-7 7 14ZM3 28h26v3H3Z"/>',
  illusion: '<path d="M1 16Q16-3 31 16 16 35 1 16Zm8 0a7 7 0 1 0 14 0 7 7 0 1 0-14 0Z"/><circle cx="16" cy="16" r="4"/>',
  divine: '<path d="m16 0 3 7 7-4-1 8 7 5-7 4 1 9-7-5-3 8-3-8-7 5 1-9-7-4 7-5-1-8 7 4Z"/>',
  decay: '<path d="M16 14C6 17 1 9 7 3l6 8ZM18 14l2-11c9 0 13 10 3 13ZM17 19l8 8c-5 8-17 5-15-5Z"/><circle cx="16" cy="16" r="4"/>',
  slashing: '<path d="M26 1h5C26 16 16 24 1 31l5-7C16 17 23 8 26 1Zm2 15 3 3-10 11-3-3Z"/>',
  piercing: '<path d="m28 1 3 3-9 16-4-4ZM15 13l10 10-3 3-10-10ZM4 25l10-10 4 4L8 29H4Z"/>',
  blunt: '<path d="M5 2h22v12H5Zm8 14h6v15h-6Z"/>',
  guard: '<path d="M16 2 29 7v10c0 7-13 14-13 14S3 24 3 17V7Zm-2 8v8H8v4h16v-4h-6v-8Z"/>',
  guile: '<path d="M2 7q14 8 28 0v12L19 30l-3-9-3 9L2 19Zm4 6v5l6 1v-4Zm20 0-6 2v4l6-1Z"/>',
});

const ALIASES = Object.freeze({ fire:'fire', burn:'fire', cold:'frost', arcane:'force', psychic:'illusion', alternation:'alteration', sacred:'divine', holy:'divine', necrotic:'decay', crimsonBlight:'decay', necroticBlight:'decay', blight:'decay', blood:'bleed', gorefire:'fire', blade:'slashing', pierce:'piercing', heavy:'blunt', starstone:'force', astral:'force', venom:'decay', oath:'divine', weak:'lightning', vulnerable:'guard', staggered:'blunt', poise:'blunt', precision:'ranged', cleave:'attack', counter:'counter', flourish:'skill', prepared:'guile', concealed:'guile', ash:'guile' });

function shapeFor(tag) {
  const key = tag.id.split(':').at(-1);
  const id = key === 'physical' ? 'guard' : ['evade', 'evasion', 'dodge'].includes(key) ? 'evade' : key === 'slashing' || key === 'blade' ? 'attack' : ALIASES[key] || key;
  return ACTION_SIGILS[id]?.solid ? ACTION_SIGILS[id].shape : SHAPES[id] || SHAPES.skill;
}

function carriesHealthDamage(def) {
  const visited = new Set();
  const positiveOrVariable = amount => {
    const value = constantFormulaValue(amount);
    return amount !== undefined && (value === undefined || value > 0);
  };
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) return false;
    visited.add(value);
    if (value.op === 'damage' && positiveOrVariable(value.amount)) return true;
    return Object.values(value).some(child => child && typeof child === 'object' && walk(child, depth + 1));
  }
  // A school may stamp damage metadata onto a healing or defensive card.
  // Only actual HP damage uses a damage-type badge; Ward/Poise returns do not.
  return positiveOrVariable(def.counterPayload?.hp)
    || ['effects', 'counterPayload', 'upcast', 'schoolEffect'].some(key => walk(def[key]));
}

// Category, damage/effect identity, then authored statuses. No filler tags.
export function cardSideTags(model, def = {}, registries = null, preview = null) {
  const tags = Array.isArray(model?.tags) ? model.tags : [];
  const selected = [];
  const camp = tags.find(tag => ['camp:physical', 'camp:spell'].includes(tag.id));
  if (camp) selected.push(camp);
  const damage = carriesHealthDamage(def) ? tags.filter(tag => tag.id.startsWith('damage:')) : [];
  // One effect identity: an explicit supported element wins over its school,
  // including aliases, before the cap can displace a status icon.
  const element = tags.find(tag => tag.id.startsWith('element:') && cardArtElement(tag.id));
  const school = tags.find(tag => tag.id.startsWith('school:'));
  const evasion = Boolean(def.evade) || def.effects?.some(effect => effect?.op === 'dodgeRoll')
    || tags.some(tag => ['maneuver:evade', 'effect:evade', 'utility.evasion'].includes(tag.id));
  const effects = damage.length ? damage : evasion ? [{ id: 'effect:evade', label: t('card.tags.evade'), blurb: tFull('card.tags.evade') }]
    : [element || school].filter(Boolean);
  for (const tag of effects) if (!selected.some(row => row.id === tag.id) && selected.length < 5) selected.push(tag);
  const statuses = new Map();
  const add = (id, occurrence = null) => {
    if (!registries?.statuses?.has(id)) return;
    if (!statuses.has(id)) statuses.set(id, []);
    if (occurrence) statuses.get(id).push(occurrence);
  };
  for (const tag of tags) if (tag.id.startsWith('status:')) add(tag.id.slice(7));
  const visited = new Set();
  function walk(value, directIndex = null, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12 || visited.has(value)) return;
    visited.add(value);
    if (['applyStatus', 'buildup'].includes(value.op) && typeof value.status === 'string') {
      const live = directIndex !== null ? preview?.values?.[directIndex] : null;
      const resolved = live?.op === 'applyStatus' && live.status === value.status ? live.value : undefined;
      const count = directIndex !== null && value.op === 'applyStatus' && (value.chance === undefined || value.chance === 100) && !value.if
        ? (Number.isFinite(resolved) ? resolved : constantFormulaValue(value.stacks)) : undefined;
      add(value.status, { count: Number.isInteger(count) && count >= 0 ? count : undefined, target: value.target, op: value.op });
    }
    for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child, null, depth + 1);
  }
  for (const [index, effect] of (def.effects || []).entries()) walk(effect, index);
  for (const key of ['counterPayload', 'upcast', 'schoolEffect']) walk(def[key]);
  for (const [id, occurrences] of [...statuses].slice(0, 3)) {
    if (selected.length >= 5) break;
    const status = registries.statuses.get(id);
    // Several applications can target different actors or conditional branches.
    // Never add them together or print one occurrence as the combined amount.
    const count = occurrences.length === 1 ? occurrences[0].count : undefined;
    selected.push({ id: 'status:' + id, label: status.name, blurb: status.tooltip || status.name, ...(count !== undefined ? { count } : {}) });
  }
  return selected;
}

export function cardCategorySigilHtml(camp) {
  if (!['physical', 'spell'].includes(camp)) return '';
  return '<span class="combat-sigil" data-sigil="' + camp + '" aria-hidden="true"><svg viewBox="0 0 32 32" fill="currentColor" fill-rule="evenodd" focusable="false">' + shapeFor({ id: 'camp:' + camp }) + '</svg></span>';
}

// The combat hand's range chip (Melee / Reach / Ranged) closes the rail, in the
// tag chip's own style (as-tag), so it sits with the symbols and never over the cost or name.
export function cardRangeChipHtml(range) {
  if(!range)return '';
  return '<span class="as-tag card-range-chip" data-range="' + esc(range) + '">' + esc(t(`deckEditor.range.${range}`)) + '</span>';
}

export function cardTagRailHtml(tags, range = null) {
  if(!tags?.length && !range)return '';
  return '<div class="card-tag-rail" data-card-layer="7" aria-label="Primary card tags">' + (tags || []).slice(0,5).map(tag => {
    const count = Number.isInteger(tag.count) && tag.count >= 0 ? tag.count : null;
    const name = tag.label + (count === null ? '' : ' ' + count);
    return '<span class="card-tag-symbol" role="img" data-tag-id="' + esc(tag.id) + '" aria-label="' + esc(name) + '" aria-description="' + esc(tag.blurb || tag.label) + '"><svg viewBox="0 0 32 32" fill="currentColor" fill-rule="evenodd" aria-hidden="true" focusable="false">' + shapeFor(tag) + '</svg>' + (count === null ? '' : '<span class="card-tag-count" aria-hidden="true">' + count + '</span>') + '</span>';
  }).join('') + cardRangeChipHtml(range) + '</div>';
}
