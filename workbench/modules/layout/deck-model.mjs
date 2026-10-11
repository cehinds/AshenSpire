// workbench/modules/layout/deck-model.mjs — the pure model of Layout Studio's Deck row mode,
// for the part the game reads. No DOM and no fetch.
//
// The game reads content/config/ui/presentation/deckEditorCosts.json: the deck editor's cost
// badges. Its components.resourceGroups lists the groups in display order, each with the
// resources it shows (mana, stamina, or the legacy action alias) and a label. The game draws
// them through src/ui/models/deckEditorCosts.js and the config compiler refuses a group set
// that hides or double-counts a pool (tools/config-build.mjs, deckEditorCostProblems).
//
// The file is hand-formatted: one group per line in inline objects. serializeDeck writes that
// form, which reproduces the authored file byte for byte when nothing was edited. A file in
// any other shape is refused rather than rewritten.
//
// Every edit below returns a new object and refuses (throws) a result the compiler would refuse.
// The badges themselves are the game's own (src/ui/models/deckEditorCosts.js); the model does not restate them.

export const DECK_FILE = 'content/config/ui/presentation/deckEditorCosts.json';
export const RESOURCES = Object.freeze(['mana', 'stamina', 'action']);
/** The pool a resource stands for: action is a legacy alias of stamina. */
export const pool = (resource) => (resource === 'action' ? 'stamina' : resource);
const DEFAULT_LABEL = Object.freeze({ mana: 'MP', stamina: 'SP', action: 'Action' });
const ID = /^[a-z][a-z0-9-]*$/;
const SAFE_ART = /^assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|svg)$/i;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inlineValue = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));
const inlineGroup = (g) => `{ ${Object.keys(g).map((k) => `${JSON.stringify(k)}: ${inlineValue(g[k])}`).join(', ')} }`;

/** The groups in order, or throws when the file is not in the form this model writes. */
export function groupsOf(data) {
  if (!isObject(data) || !isObject(data.components) || !Array.isArray(data.components.resourceGroups)) {
    throw Error(`${DECK_FILE}: components.resourceGroups must be an array`);
  }
  return data.components.resourceGroups;
}

/** Parse the text. Throws when the file has keys this editor does not write or is not in the authored form. */
export function parseDeck(text) {
  const data = JSON.parse(text);
  const groups = groupsOf(data);
  if (Object.keys(data).join() !== 'components' || Object.keys(data.components).join() !== 'resourceGroups') {
    throw Error(`${DECK_FILE}: the file has keys Layout Studio does not write; edit it in the file`);
  }
  if (serializeDeck({ components: { resourceGroups: groups } }) !== text) {
    throw Error(`${DECK_FILE} is not in the form Layout Studio saves; edit it in the file`);
  }
  return data;
}

/** The file text for a groups object. */
export function serializeDeck(data) {
  const groups = groupsOf(data);
  return `{\n  "components": {\n    "resourceGroups": [\n${groups.map((g) => `      ${inlineGroup(g)}`).join(',\n')}\n    ]\n  }\n}\n`;
}

/** The problems the compiler would name for these groups (tools/config-build.mjs deckEditorCostProblems), empty when sound. */
export function groupProblems(data) {
  const out = [];
  let groups;
  try { groups = groupsOf(data); } catch (err) { return [err.message]; }
  const at = `${DECK_FILE}: components.resourceGroups`;
  if (!groups.length) return [`${at} must be a non-empty array`];
  const ids = new Set(), seen = new Set();
  groups.forEach((g, index) => {
    if (!isObject(g) || typeof g.id !== 'string' || !ID.test(g.id)) { out.push(`${at}[${index}] needs a lowercase resource group id`); return; }
    if (ids.has(g.id)) out.push(`${at}: duplicate group id "${g.id}"`);
    ids.add(g.id);
    if (typeof g.label !== 'string' || !g.label.trim()) out.push(`${at}[${index}].label must be a non-empty string`);
    if (g.art !== undefined && (typeof g.art !== 'string' || !SAFE_ART.test(g.art))) out.push(`${at}[${index}].art must be a safe assets/ image path`);
    if (!Array.isArray(g.resources) || !g.resources.length) { out.push(`${at}[${index}].resources must be a non-empty array`); return; }
    for (const r of g.resources) if (!RESOURCES.includes(r)) out.push(`${at}: unknown resource "${r}"`);
    for (const p of new Set(g.resources.map(pool))) {
      if (seen.has(p)) out.push(`${at}: resource "${p}" is included more than once`);
      seen.add(p);
    }
  });
  for (const p of ['mana', 'stamina']) if (!seen.has(p)) out.push(`${at}: resource "${p}" is missing`);
  return out;
}

/** Return the next groups object, or throw with the first problem it would have. */
function accept(data, groups) {
  const next = { ...data, components: { ...data.components, resourceGroups: groups } };
  const problems = groupProblems(next);
  if (problems.length) throw Error(problems[0]);
  return next;
}

/** Move the group at `index` to position `to` (display order). */
export function reorderGroup(data, index, to) {
  const groups = groupsOf(data).slice();
  if (!Number.isInteger(index) || index < 0 || index >= groups.length) throw Error('no such group');
  if (!Number.isInteger(to) || to < 0 || to >= groups.length) throw Error('that position is outside the row');
  const [moved] = groups.splice(index, 1);
  groups.splice(to, 0, moved);
  return accept(data, groups);
}

/** Set a group's label. Labels are the words the badge shows, so they must not be blank. */
export function setLabel(data, index, label) {
  const groups = groupsOf(data);
  if (!groups[index]) throw Error('no such group');
  if (typeof label !== 'string' || !label.trim()) throw Error('a group label must not be blank');
  return accept(data, groups.map((g, i) => (i === index ? { ...g, label: label.trim() } : g)));
}

/**
 * Combine: move a resource into another group. Its old group is removed when that leaves it
 * empty, so a pool is shown once. Refused when the target already shows the same pool.
 */
export function moveResource(data, resource, toIndex) {
  const groups = groupsOf(data);
  const from = groups.findIndex((g) => g.resources.includes(resource));
  if (from < 0) throw Error(`${resource} is not in any group`);
  if (!groups[toIndex]) throw Error('no such group');
  if (from === toIndex) return data;
  const rest = groups[from].resources.filter((r) => r !== resource);
  const target = groups[toIndex];
  const merged = { ...target, resources: [...target.resources, resource] };
  const next = groups.flatMap((g, i) => {
    if (i === toIndex) return [merged];
    if (i !== from) return [g];
    return rest.length ? [{ ...g, resources: rest }] : [];
  });
  return accept(data, next);
}

/** Split: take a resource out of a group that shows several, into a group of its own at the end. */
export function splitResource(data, resource) {
  const groups = groupsOf(data);
  const from = groups.findIndex((g) => g.resources.includes(resource));
  if (from < 0) throw Error(`${resource} is not in any group`);
  if (groups[from].resources.length < 2) throw Error(`${groups[from].label} shows only ${resource}; there is nothing to split off`);
  const taken = new Set(groups.map((g) => g.id));
  let id = pool(resource);
  for (let n = 2; taken.has(id); n++) id = `${pool(resource)}-${n}`;
  const alone = { id, label: DEFAULT_LABEL[resource], resources: [resource] };
  const next = groups.map((g, i) => (i === from ? { ...g, resources: g.resources.filter((r) => r !== resource) } : g));
  return accept(data, [...next, alone]);
}

/** The file text a save would write for these groups, or null when it matches the original. */
export function changedText(original, data) {
  const text = serializeDeck(data);
  return text === original ? null : text;
}
