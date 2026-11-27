// tools/score-studio/cardTemplates.js — card templates (SS-004): a card's mechanics saved under a name, and
// new cards started from them. Pure data helpers: no DOM, no Studio state. Every result is a deep copy, so a
// template never shares an array with a card (copy, not linked).

export const CARD_TEMPLATES_KIND = 'ashenspire.studioCardTemplates';
export const CARD_TEMPLATES_FORMAT_VERSION = 1;
export const CARD_TEMPLATES_PATH = 'content/source/studio/templates.json';
export const TEMPLATE_NAME_LIMIT = 60;

// The card fields a template keeps: type, target (tags and effect targets), school (damageSchool, magicShare
// and the camp tag), costs, effects, tags and keywords, and rarity. Everything else is dropped: the id, the
// name, every `_` flag, scoringOverride, class, textTemplate, upgradeMenu and any other field.
export const TEMPLATE_CARD_FIELDS = Object.freeze([
  'type',
  'rarity',
  'cost',
  'staminaCost',
  'manaCost',
  'costRule',
  'damageSchool',
  'magicShare',
  'effects',
  'tags',
  'keywords',
]);

// Card types in the order the picker and the list group them.
export const TEMPLATE_TYPE_ORDER = Object.freeze(['attack', 'strike', 'skill', 'guard', 'power', 'curse', 'status']);

// What a card made from a template takes for the fields a template drops (New card's defaults).
const NEW_CARD_DEFAULTS = Object.freeze({
  name: 'New card',
  class: 'colorless',
  rarity: 'common',
  type: 'skill',
  cost: 1,
  staminaCost: 1,
  manaCost: 0,
  costRule: 'fixed',
  damageSchool: 'physical',
});

const TEMPLATE_ID_PATTERN = /^template\.[a-z0-9][a-z0-9-]*$/;
const SLUG_LIMIT = 40;

const clone = value => structuredClone(value);
const nameKey = name => String(name ?? '').trim().toLowerCase();
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** The template's copy of a card: only the kept fields, deep-cloned. */
export function TemplateCardFields(card)
{
  const kept = {};
  for (const field of TEMPLATE_CARD_FIELDS)
  {
    if (card?.[field] !== undefined) kept[field] = clone(card[field]);
  }
  return kept;
}

/** Why a template name cannot be used, or '' when it can. */
export function TemplateNameProblem(name)
{
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return 'Give the template a name.';
  if (trimmed.length > TEMPLATE_NAME_LIMIT) return `Keep the name to ${TEMPLATE_NAME_LIMIT} characters.`;
  return '';
}

/** The template with this name, ignoring case and outer spaces; null when the name is free. */
export function FindTemplateByName(templates, name, { exceptId = null } = {})
{
  const key = nameKey(name);
  return (templates || []).find(template => template.id !== exceptId && nameKey(template.name) === key) || null;
}

function slugOf(name)
{
  const slug = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, SLUG_LIMIT).replace(/-+$/, '');
  return slug || 'template';
}

/** A `template.<slug>` id no template in `templates` (or `takenIds`) has. */
export function TemplateIdFor(name, templates = [], takenIds = [])
{
  const taken = new Set([...(templates || []).map(template => template.id), ...takenIds]);
  const base = `template.${slugOf(name)}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Saves `card` as a template named `name`. Returns `{ problem }` for a bad name, `{ taken }` when the name is
 * used and `replace` is not set, or `{ templates, template, replaced }` with a new list. A replaced template
 * keeps its id. The input list is never changed.
 */
export function SaveCardAsTemplate(templates, card, { name, artLayerIds = [], now = new Date().toISOString(), replace = false } = {})
{
  const problem = TemplateNameProblem(name);
  if (problem) return { problem };
  const trimmed = String(name).trim();
  const existing = FindTemplateByName(templates, trimmed);
  if (existing && !replace) return { taken: existing };
  const fields = TemplateCardFields(card);
  const template = {
    id: existing ? existing.id : TemplateIdFor(trimmed, templates),
    name: trimmed,
    cardType: String(fields.type || NEW_CARD_DEFAULTS.type),
    createdAt: existing ? existing.createdAt : now,
    card: fields,
    artLayerIds: [...new Set((artLayerIds || []).map(String))],
  };
  const next = existing
    ? (templates || []).map(entry => (entry.id === existing.id ? template : clone(entry)))
    : [...(templates || []).map(clone), template];
  return { templates: next, template: clone(template), replaced: Boolean(existing) };
}

/** Renames a template; its id and content stay. Returns `{ problem }` or `{ templates }`. */
export function RenameTemplate(templates, id, name)
{
  const problem = TemplateNameProblem(name);
  if (problem) return { problem };
  if (!(templates || []).some(template => template.id === id)) return { problem: 'That template no longer exists.' };
  const trimmed = String(name).trim();
  const clash = FindTemplateByName(templates, trimmed, { exceptId: id });
  if (clash) return { problem: `A template is already named "${clash.name}".` };
  return { templates: templates.map(template => (template.id === id ? { ...clone(template), name: trimmed } : clone(template))) };
}

/** The list without the template `id`. */
export function DeleteTemplate(templates, id)
{
  return (templates || []).filter(template => template.id !== id).map(clone);
}

/**
 * A new card from a template: a fresh id, a generated name (Auto-name on), New card's defaults for the
 * fields a template drops, and a deep copy of the template's mechanics. It keeps no link to the template.
 * `normalize` (normalizeStudioCard) and `textFor` (automatic card text) come from the Studio.
 */
export function CardFromTemplate(template, { id, normalize = card => card, textFor = null } = {})
{
  if (!id) throw new Error('A card from a template needs a fresh id.');
  const card = {
    ...clone(NEW_CARD_DEFAULTS),
    effects: [],
    keywords: [],
    tags: [],
    ...TemplateCardFields(template?.card),
    id,
    _custom: true,
    _edited: true,
    _autoName: true,
  };
  const normalized = normalize(card) || card;
  if (textFor) normalized.textTemplate = textFor(normalized);
  return normalized;
}

/** New card's id loop: `custom.card_<time>`, lengthened until no card in `cards` has it. */
export function FreshCardId(cards, now = Date.now())
{
  const taken = new Set((cards || []).map(card => card.id));
  let id = `custom.card_${Number(now).toString(36)}`;
  while (taken.has(id)) id += '_new';
  return id;
}

/** The layer ids a template recorded that no longer exist among `layers`. */
export function MissingArtLayerIds(template, layers)
{
  const present = new Set((layers || []).map(layer => layer.id));
  return (template?.artLayerIds || []).filter(id => !present.has(id));
}

/** Templates grouped by card type, known types first in TEMPLATE_TYPE_ORDER, then by name. */
export function GroupTemplatesByType(templates)
{
  const groups = new Map();
  for (const template of templates || [])
  {
    const type = template.cardType || template.card?.type || 'skill';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(template);
  }
  const rank = type => {
    const index = TEMPLATE_TYPE_ORDER.indexOf(type);
    return index < 0 ? TEMPLATE_TYPE_ORDER.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([type, list]) => ({ type, templates: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** The file written to templates.json and used by Export and Import. */
export function TemplateFile(templates)
{
  return { kind: CARD_TEMPLATES_KIND, formatVersion: CARD_TEMPLATES_FORMAT_VERSION, templates: (templates || []).map(clone) };
}

function templateProblem(entry, index, checkCard)
{
  const label = `Template ${index + 1}`;
  if (!isPlainObject(entry)) return `${label} must be an object.`;
  const named = typeof entry.name === 'string' && entry.name.trim() ? `${label} ("${entry.name.trim()}")` : label;
  if (typeof entry.name !== 'string') return `${label} needs a "name" text.`;
  const nameProblem = TemplateNameProblem(entry.name);
  if (nameProblem) return `${named}: ${nameProblem}`;
  if (typeof entry.id !== 'string' || !TEMPLATE_ID_PATTERN.test(entry.id)) return `${named}: "id" must look like "template.<name>".`;
  if (!isPlainObject(entry.card)) return `${named}: "card" must be an object.`;
  if (typeof entry.card.type !== 'string' || !entry.card.type) return `${named}: the card needs a "type".`;
  if (entry.artLayerIds !== undefined && (!Array.isArray(entry.artLayerIds) || entry.artLayerIds.some(id => typeof id !== 'string'))) return `${named}: "artLayerIds" must be a list of text.`;
  if (entry.createdAt !== undefined && typeof entry.createdAt !== 'string') return `${named}: "createdAt" must be text.`;
  const cardProblem = checkCard ? checkCard(TemplateCardFields(entry.card)) : '';
  if (cardProblem) return `${named}: ${cardProblem}`;
  return '';
}

/**
 * Reads a templates file (text or parsed JSON). The whole file is checked first: returns `{ problem }` naming
 * the first problem, or `{ templates }` holding only the kept card fields. `checkCard(card)` returns a problem
 * text for a card the Studio would refuse (the JSON dialog's checks).
 */
export function ParseTemplateFile(raw, { checkCard = null } = {})
{
  let data = raw;
  if (typeof raw === 'string')
  {
    try { data = JSON.parse(raw); } catch (error) { return { problem: `Not valid JSON: ${error.message}` }; }
  }
  if (!isPlainObject(data)) return { problem: 'The file must be one JSON object.' };
  if (data.kind !== CARD_TEMPLATES_KIND) return { problem: `Not a card templates file: "kind" must be "${CARD_TEMPLATES_KIND}".` };
  if (data.formatVersion !== CARD_TEMPLATES_FORMAT_VERSION) return { problem: `Format version ${JSON.stringify(data.formatVersion)} is not supported; expected ${CARD_TEMPLATES_FORMAT_VERSION}.` };
  if (!Array.isArray(data.templates)) return { problem: '"templates" must be a list.' };
  const ids = new Set(), names = new Set();
  for (const [index, entry] of data.templates.entries())
  {
    const problem = templateProblem(entry, index, checkCard);
    if (problem) return { problem };
    if (ids.has(entry.id)) return { problem: `Template ${index + 1}: the id "${entry.id}" is used twice.` };
    if (names.has(nameKey(entry.name))) return { problem: `Template ${index + 1}: the name "${entry.name.trim()}" is used twice.` };
    ids.add(entry.id); names.add(nameKey(entry.name));
  }
  const templates = data.templates.map(entry => {
    const card = TemplateCardFields(entry.card);
    return {
      id: entry.id,
      name: entry.name.trim(),
      cardType: card.type,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      card,
      artLayerIds: [...new Set(entry.artLayerIds || [])],
    };
  });
  return { templates };
}

function freeName(name, usedKeys)
{
  if (!usedKeys.has(nameKey(name))) return name;
  for (let n = 2; ; n++)
  {
    const candidate = `${name} ${n}`;
    if (!usedKeys.has(nameKey(candidate))) return candidate;
  }
}

/**
 * Adds imported templates to `existing`. Every imported template gets a fresh id; a name already in use gets
 * a number ("Heavy blow 2"). Returns `{ templates, added }`; the inputs are not changed.
 */
export function MergeImportedTemplates(existing, imported)
{
  const next = (existing || []).map(clone);
  const usedKeys = new Set(next.map(template => nameKey(template.name)));
  const added = [];
  for (const entry of imported || [])
  {
    const name = freeName(entry.name, usedKeys);
    const template = { ...clone(entry), name, id: TemplateIdFor(name, next) };
    usedKeys.add(nameKey(name));
    next.push(template);
    added.push(clone(template));
  }
  return { templates: next, added };
}

/**
 * The in-memory template store: the default until the SS-003 Save path provides the committed file. `load()`
 * returns the stored file or null; `save(file)` keeps a copy.
 */
export function createMemoryTemplateStore(initialFile = null)
{
  let stored = initialFile ? clone(initialFile) : null;
  return {
    load: () => (stored ? clone(stored) : null),
    save: file => { stored = clone(file); },
  };
}
