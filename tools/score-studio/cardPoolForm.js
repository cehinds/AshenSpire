// tools/score-studio/cardPoolForm.js — the Generate cards modal's form (owner, 2026-11-24).
//
// Settings <-> form only: RenderPoolForm(settings, ctx) returns the form's HTML, ReadPoolForm(root) reads it back, and
// UpdatePoolSums(root) refreshes the live totals. The plan itself is src/model/cardPoolPlan.js; the studio wires the buttons.
import { SCHOOLS, CAMPS, CARD_TYPES, RANGES, KEYWORDS, RIDER_EFFECTS } from '../../src/model/cardGenerator.js';
import { RARITIES, COSTS, EFFECT_COUNTS, NormalisePercent } from '../../src/model/cardPoolPlan.js';

export const POOL_MODES = Object.freeze([
  { id: 'replaceGenerated', label: 'Replace generated only', tip: 'Hand-made cards stay. Cards made by an earlier Generate are removed and made again.' },
  { id: 'replaceAll', label: 'Replace everything', tip: 'The card list becomes only the new cards. Revert brings the Core cards back.' },
  { id: 'add', label: 'Add to the pool', tip: 'Keep every card and add the new ones beside them.' },
]);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const words = (id) => cap(id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
const SCHOOL_LABEL = { none: 'No school' };
const TYPE_TIP = {
  attack: 'A plain attack.',
  skill: 'A plain skill: Block plus riders.',
  smash: 'A heavy martial attack (Smash).',
  sweep: 'A martial attack that hits ALL enemies (Sweep).',
  counter: 'A martial counter: returns damage when hit.',
  defend: 'A martial Guard: Block plus riders.',
};
const EFFECT_LABEL = { poise: 'Poise damage', block: 'Block (attacks)', damage: 'Damage (skills)', draw: 'Draw', heal: 'Heal', cleanse: 'Remove Weak', restoreSp: 'Restore Stamina', restoreMp: 'Restore Mana', move: 'Close a band' };
const EFFECT_TIP = {
  poise: 'An attack may also deal Poise damage.',
  block: 'An attack may also give Block.',
  damage: 'A skill may also deal damage.',
  draw: 'A card may also draw a card.',
  heal: 'A card may also heal.',
  cleanse: 'A card may also remove your Weak.',
  restoreSp: 'A card may also restore 1 Stamina.',
  restoreMp: 'A card may also restore 1 Mana.',
  move: 'A card may also close one band.',
};

/** The percent groups, in form order. `keys` is filled per call for rank (0..maxRank). */
export function PercentGroups(maxRank) {
  return [
    { key: 'rarity', label: 'Rarity', keys: [...RARITIES], name: cap, tip: (k) => `Share of ${k} cards.` },
    { key: 'rank', label: 'Rank', keys: Array.from({ length: maxRank + 1 }, (_, k) => String(k)), name: (k) => (k === '0' ? 'Unranked' : `Rank ${k}`), tip: (k) => `Share of cards at ${k === '0' ? 'Unranked' : `Rank ${k}`}.` },
    { key: 'sp', label: 'SP cost', keys: [...COSTS], name: (k) => `${k} SP`, tip: (k) => `Share of cards that cost ${k} Stamina.` },
    { key: 'mp', label: 'MP cost (magic and hybrid)', keys: [...COSTS], name: (k) => `${k} MP`, tip: (k) => `Share of magic and hybrid cards that cost ${k} Mana. Martial cards cost no Mana.` },
    { key: 'type', label: 'Card type', keys: [...CARD_TYPES], name: cap, tip: (k) => `Share of cards of this type. ${TYPE_TIP[k]} A magic card casts, so its smash or sweep is a plain attack and its counter or guard a plain skill.` },
    { key: 'range', label: 'Range (single-target attacks)', keys: [...RANGES], name: cap, tip: (k) => `Share of single-target attacks at ${k} range.` },
    { key: 'effects', label: 'Effects per card', keys: [...EFFECT_COUNTS], name: (k) => (k === '1' ? '1 effect' : `${k} effects`), tip: (k) => `Share of cards with ${k} effect${k === '1' ? '' : 's'}. Riders that do not fit the card's power are dropped.` },
  ];
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function numberBox(attr, key, label, value, tip, { min = 0, max = 999 } = {}) {
  return `<label class="gen-field" title="${esc(tip)}"><span>${esc(label)}</span><input type="number" min="${min}" max="${max}" step="1" ${attr}="${esc(key)}" value="${esc(value ?? '')}" aria-label="${esc(label)}" /></label>`;
}
function checkBox(list, key, label, checked, tip) {
  return `<label class="gen-check" title="${esc(tip)}"><input type="checkbox" data-list="${esc(list)}" data-key="${esc(key)}" ${checked ? 'checked' : ''} /> <span>${esc(label)}</span></label>`;
}

/**
 * The form's HTML. ctx = {maxRank, statuses: [id], classes: [id]}. Every control has a tooltip (owner copy rule).
 */
export function RenderPoolForm(s, ctx) {
  const modes = POOL_MODES.map((m) => `<label class="gen-check" title="${esc(m.tip)}"><input type="radio" name="gen-mode" value="${m.id}" ${s.mode === m.id ? 'checked' : ''} /> <span>${esc(m.label)}</span></label>`).join('');
  const classes = ctx.classes.map((c) => `<option value="${esc(c)}" ${s.cls === c ? 'selected' : ''}>${esc(cap(c))}</option>`).join('');
  const schools = SCHOOLS.map((k) => numberBox('data-count-school', k, SCHOOL_LABEL[k] || cap(k), s.perSchool?.[k] || '', k === 'none' ? 'Cards with no magic school (martial cards have none).' : `Cards of the ${cap(k)} school.`)).join('');
  const camps = CAMPS.map((k) => numberBox('data-count-camp', k, cap(k), s.perCamp?.[k] || '', { martial: 'Martial cards: weapons, no Mana.', magic: 'Magic cards: spells that cast.', hybrid: 'Hybrid cards: a martial hit with a magic share.' }[k])).join('');
  const groups = PercentGroups(ctx.maxRank).map((g) => `
    <fieldset class="gen-group" data-group="${g.key}">
      <legend title="Shares of the cards. Generate scales them to 100%.">${esc(g.label)} % <span class="gen-sum" data-sum="${g.key}"></span></legend>
      <div class="gen-grid">${g.keys.map((k) => numberBox('data-pct-' + g.key, k, g.name(k), s[g.key]?.[k] ?? 0, g.tip(k), { max: 100 })).join('')}</div>
    </fieldset>`).join('');
  const allowedEffects = new Set(s.allowedEffects || []), allowedStatuses = new Set(s.allowedStatuses || []), allowedKeywords = new Set(s.allowedKeywords || []);
  return `
    <fieldset class="gen-group"><legend title="What happens to the cards already in the studio">Mode</legend><div class="gen-row">${modes}</div></fieldset>
    <fieldset class="gen-group"><legend title="How many cards, for which class, from which seed">Cards</legend>
      <div class="gen-grid">
        ${numberBox('id', 'gen-total', 'Total cards', s.total, 'How many cards to make. Per-school counts win when any is set.', { min: 0, max: 999 })}
        <label class="gen-field" title="The class every new card belongs to. Colorless cards are for every class."><span>Class</span><select id="gen-class" aria-label="Class">${classes}</select></label>
        <label class="gen-field gen-seed" title="The same seed and settings always make the same cards."><span>Seed</span><span class="gen-seed-row"><input id="gen-pool-seed" type="text" maxlength="24" value="${esc(s.seed)}" aria-label="Seed" /><button id="btn-gen-dice" type="button" class="s-btn" title="Pick a new random seed" aria-label="Random seed">🎲</button></span></label>
      </div>
      <p class="studio-muted gen-note" id="gen-count-note"></p>
    </fieldset>
    <fieldset class="gen-group"><legend title="Exact card counts per magic school. Leave all blank to use Total.">Cards per school <span class="gen-sum" data-sum="perSchool"></span></legend><div class="gen-grid">${schools}</div></fieldset>
    <fieldset class="gen-group"><legend title="Exact card counts per camp, scaled to the card count. Leave all blank to take the camp from the school.">Cards per camp <span class="gen-sum" data-sum="perCamp"></span></legend><div class="gen-grid">${camps}</div></fieldset>
    ${groups}
    <fieldset class="gen-group"><legend title="Riders a card may get beside its main effect">Allowed effects</legend><div class="gen-checks">${RIDER_EFFECTS.map((k) => checkBox('allowedEffects', k, EFFECT_LABEL[k], allowedEffects.has(k), EFFECT_TIP[k])).join('')}</div></fieldset>
    <fieldset class="gen-group"><legend title="Statuses a card may apply. Debuffs go on the enemy, buffs on you.">Allowed statuses</legend><div class="gen-checks">${ctx.statuses.map((k) => checkBox('allowedStatuses', k, words(k), allowedStatuses.has(k), `A card may apply ${words(k)}.`)).join('')}</div></fieldset>
    <fieldset class="gen-group"><legend title="Keywords a card may get, and how often">Keywords and odds</legend>
      <div class="gen-checks">${KEYWORDS.map((k) => checkBox('allowedKeywords', k, cap(k), allowedKeywords.has(k), `A card with a keyword may get ${cap(k)}.`)).join('')}</div>
      <div class="gen-grid">
        ${numberBox('data-odds', 'keywordOdds', 'Keyword %', s.keywordOdds, 'Share of cards that get one of the ticked keywords.', { max: 100 })}
        ${numberBox('data-odds', 'drawbackOdds', 'HP cost %', s.drawbackOdds, 'Share of cards that cost HP to play.', { max: 100 })}
        ${numberBox('data-odds', 'areaOdds', 'Area %', s.areaOdds, 'Share of attacks (not sweeps) that hit ALL enemies.', { max: 100 })}
      </div>
    </fieldset>`;
}

/** Reads the form back into settings (percent groups as typed; NormaliseSettings scales them). */
export function ReadPoolForm(root, maxRank) {
  const read = (attr) => Object.fromEntries([...root.querySelectorAll(`[${attr}]`)].map((el) => [el.getAttribute(attr), num(el.value)]));
  const listOf = (list) => [...root.querySelectorAll(`[data-list="${list}"]`)].filter((el) => el.checked).map((el) => el.dataset.key);
  const s = {
    mode: root.querySelector('input[name="gen-mode"]:checked')?.value || 'replaceGenerated',
    total: num(root.querySelector('#gen-total')?.value),
    cls: root.querySelector('#gen-class')?.value || 'colorless',
    seed: root.querySelector('#gen-pool-seed')?.value.trim() || '1',
    perSchool: read('data-count-school'),
    perCamp: read('data-count-camp'),
    allowedEffects: listOf('allowedEffects'),
    allowedStatuses: listOf('allowedStatuses'),
    allowedKeywords: listOf('allowedKeywords'),
    ...read('data-odds'),
  };
  for (const g of PercentGroups(maxRank)) s[g.key] = read(`data-pct-${g.key}`);
  return s;
}

/** Settings with every percent group scaled to whole numbers adding up to 100. */
export function NormaliseSettings(s, maxRank) {
  const out = structuredClone(s);
  for (const g of PercentGroups(maxRank)) out[g.key] = NormalisePercent(s[g.key] || {}, g.keys);
  return out;
}

const sumOf = (obj) => Object.values(obj || {}).reduce((t, v) => t + Math.max(0, num(v)), 0);

/** Refreshes the live totals: a percent group not at 100 shows its sum in red; the count note says what sets the card count. */
export function UpdatePoolSums(root, maxRank) {
  const s = ReadPoolForm(root, maxRank);
  for (const g of PercentGroups(maxRank)) {
    const el = root.querySelector(`[data-sum="${g.key}"]`);
    const total = sumOf(s[g.key]);
    el.textContent = `Total ${total}%`;
    el.classList.toggle('is-off', total !== 100);
    el.title = total === 100 ? 'Adds up to 100%' : 'Does not add up to 100%. Generate scales it to 100%.';
  }
  const schools = sumOf(s.perSchool), camps = sumOf(s.perCamp);
  root.querySelector('[data-sum="perSchool"]').textContent = schools ? `Sum ${schools}` : 'Blank';
  root.querySelector('[data-sum="perCamp"]').textContent = camps ? `Sum ${camps}` : 'Blank';
  const total = root.querySelector('#gen-total');
  total.disabled = schools > 0;
  root.querySelector('#gen-count-note').textContent = schools > 0
    ? `Per-school counts are set, so ${schools} cards will be made. Total is not used.`
    : `${s.total} cards will be made.`;
  return s;
}
