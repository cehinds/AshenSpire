// tools/score-studio/nameSets.js — card name sets for Score Studio's Rename all (owner, 2026-11-24).
//
// A name set is {id, label, savedAt, names: {cardId: {name, autoName}}}. "Default names" is built from the repo's
// authored card names and is never stored or overwritten; saved sets live with the studio (local draft and the saved
// JSON config), never in the game's scoring.json. No DOM here, so tests/score-studio.test.mjs runs it in Node.

export const DEFAULT_NAME_SET_ID = 'default';
export const DEFAULT_NAME_SET_LABEL = 'Default names';
// The key a saved studio config carries its name sets under; Open saved strips it before staging the weights.
export const SAVED_CONFIG_NAME_SETS_KEY = '$nameSets';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const pad = (n) => String(n).padStart(2, '0');

/** The name field's default: "Names 2026-11-24 14:05". */
export function DefaultNameSetLabel(date = new Date())
{
  return `Names ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function namesOf(cards, autoNameOf)
{
  const names = {};
  for (const card of cards || []) if (card?.id && typeof card.name === 'string') names[card.id] = { name: card.name, autoName: autoNameOf(card) };
  return names;
}

/** The authored names of the repo's cards, as a set. */
export function DefaultNameSet(repoCards)
{
  return { id: DEFAULT_NAME_SET_ID, label: DEFAULT_NAME_SET_LABEL, savedAt: '', names: namesOf(repoCards, () => false) };
}

/** Every card's current name and Auto-name flag, as a new set. */
export function CaptureNameSet(cards, label, date = new Date())
{
  const savedAt = date.toISOString();
  return { id: `names-${date.getTime()}`, label: String(label || '').trim() || DefaultNameSetLabel(date), savedAt, names: namesOf(cards, (card) => Boolean(card._autoName)) };
}

/** Turns Auto-name on for every card; returns how many it turned on. The caller renames them (syncAutoNames). */
export function TurnOnAutoNames(cards)
{
  let count = 0;
  for (const card of cards || [])
  {
    if (card._autoName) continue;
    card._autoName = true;
    card._edited = true;
    count += 1;
  }
  return count;
}

/** Gives each card in the set its stored name with Auto-name off; returns how many cards changed. Cards not in the set stay. */
export function ApplyNameSet(cards, set)
{
  let count = 0;
  for (const card of cards || [])
  {
    const entry = set?.names?.[card.id];
    if (!entry || typeof entry.name !== 'string') continue;
    if (card.name === entry.name && !card._autoName) continue;
    card.name = entry.name;
    card._autoName = false;
    card._edited = true;
    count += 1;
  }
  return count;
}

/** Saved sets, newest first. */
export function SortedNameSets(sets)
{
  return [...(sets || [])].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

/** The well-formed saved sets from stored data (a draft or a saved config); anything else is dropped. */
export function ValidNameSets(raw)
{
  if (!Array.isArray(raw)) return [];
  return raw.filter((set) => isPlainObject(set) && typeof set.id === 'string' && set.id && set.id !== DEFAULT_NAME_SET_ID
    && typeof set.label === 'string' && typeof set.savedAt === 'string' && isPlainObject(set.names)
    && Object.values(set.names).every((entry) => isPlainObject(entry) && typeof entry.name === 'string'));
}

/** Saved sets from two sources, one per id (the second wins). */
export function MergeNameSets(current, incoming)
{
  const byId = new Map(ValidNameSets(current).map((set) => [set.id, set]));
  for (const set of ValidNameSets(incoming)) byId.set(set.id, set);
  return SortedNameSets([...byId.values()]);
}

/** A saved studio config split into its weights and its name sets. */
export function SplitSavedConfig(config)
{
  if (!isPlainObject(config)) return { scoring: config, nameSets: [] };
  const { [SAVED_CONFIG_NAME_SETS_KEY]: nameSets, ...scoring } = config;
  return { scoring, nameSets: ValidNameSets(nameSets) };
}

/** The weights with the name sets attached, for the studio's own saved config. */
export function JoinSavedConfig(scoring, nameSets)
{
  return { ...scoring, [SAVED_CONFIG_NAME_SETS_KEY]: ValidNameSets(nameSets) };
}
