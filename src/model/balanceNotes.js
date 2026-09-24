// src/model/balanceNotes.js — reads the sentence written beside each balance
// number, and fills in the names it needs.
//
// Settings → Advanced generates one row per leaf of `balance`
// (model/advancedConfig.js `leafRows`). Every one of those rows used to carry
// the SAME note — "Authored balance value: <path>. Applies to a new run." —
// so 325 dials described themselves identically (owner, 2026-09-21: "the
// description for most of the settings say the same thing and aren't very
// helpful descriptions"). #1243 gave each its own sentence, in this file.
//
// THE SENTENCES LIVE BESIDE THEIR NUMBERS NOW, in src/content/balance.js
// (owner, 2026-09-23: "move the descriptions into balance.js"). Two of the
// sentences #1243's reviews caught as wrong had been copied from a balance.js
// comment the code had since outgrown — a description kept in a second file
// drifts from the number it describes, because nobody editing the number
// sees it. Each object in balance.js carries a `[NOTE]` block beside its own
// numbers. The key is a Symbol, so `validate.js`'s unknown-field checks,
// `leafRows`, JSON and every engine reader walk straight past it and the
// numbers stay plain numbers.
//
// WHAT IS LEFT HERE IS NO PROSE. This file matches a path to the sentence
// written for it, and fills that sentence's blanks — a relic's name from the
// relic, a talent's from its node, a class's from the class. A blank's filler
// may CHOOSE between phrases balance.js wrote (see `recipient`), but it
// writes none of its own; the vocabulary it chooses from is `balanceWords`,
// beside the numbers too.
//
// THE NOTE LANGUAGE, as balance.js writes it. Inside an object's `[NOTE]`:
//
//   sellFraction: 'What the merchant pays …'        one number, by its key
//   '{kind}Cost.{rarity}.{end}': 'The {band} of …'  a family, by a path pattern
//   '{statId}.perLevel': { text: '…', inert: true } a number nothing reads
//
// A key names a path RELATIVE TO THE OBJECT THAT HOLDS THE BLOCK. `{name}`
// captures one path segment, or part of one (`{kind}Cost`). In a sentence,
// `{name}` is replaced by a filler below or, failing that, by the capture of
// the same name; `{a name}` does the same with its article ("an uncommon").
// A blank nothing fills is left as `{name}`, braces and all — a visible brace
// is a bug report, and the test that reads every note fails on one.
//
// WHICH SENTENCE WINS. A key naming the number outright beats any pattern, at
// whatever depth; between patterns the deepest block wins. Two patterns in one
// block that both claim a path are refused by a test, not ordered here.
//
// An inert note is a number nothing reads. It says so, and it does not then
// promise to apply to a new run — every other note ends with that clause.

import { balance as authoredBalance, balanceWords, NOTE } from '../content/balance.js';

export { NOTE };
export const NEW_RUN_CLAUSE = balanceWords.newRun;

const word = (value) => String(value)
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const an = (noun) => `${/^[aeiou]/i.test(String(noun)) ? 'an' : 'a'} ${noun}`;

// EVERY TABLE IS READ BY OWN PROPERTY. A bare `TABLE[key]` walks the
// prototype chain, so a balance path or a node variable named `toString` or
// `constructor` would answer with a function — truthy, and printed into the
// row. Nothing in the shipped bundle is named that; a row read off authored
// content should not have to be lucky.
const look = (table, key) => (table && Object.hasOwn(table, key) ? table[key] : undefined);

// Lookups derived from the bundle, once per bundle. advancedConfigRows runs
// over 2,700 leaves and is called from several screens; a linear scan of the
// relic list per leaf is the kind of cost that only shows up on a phone.
const INDEXES = new WeakMap();
function indexes(bundle) {
  if (!bundle || typeof bundle !== 'object') return { relics: new Map(), nodes: new Map(), classes: new Map(), talents: new Map(), cards: new Map(), cardsByName: new Map(), statuses: new Map() };
  const cached = INDEXES.get(bundle);
  if (cached) return cached;
  const built = {
    relics: new Map((bundle.relics || []).map((relic) => [relic.id, relic])),
    nodes: new Map((bundle.nodes || []).map((node) => [node.id, node])),
    classes: new Map((bundle.classes || []).map((classDef) => [classDef.id, classDef])),
    cards: new Map((bundle.cards || []).map((card) => [card.id, card])),
    cardsByName: (bundle.cards || []).reduce((map, card) => {
      if (!map.has(card.name)) map.set(card.name, []);
      map.get(card.name).push(card);
      return map;
    }, new Map()),
    statuses: new Map((bundle.statuses || []).map((status) => [status.id, status])),
    talents: (bundle.classTree || []).reduce((map, row) => {
      // A LIST PER NODE, not a row per node. `new Map(rows.map(...))` let the
      // last tree that claimed a node win in silence, so a talent shared by
      // two classes would have named one of them and read as settled.
      if (!map.has(row.nodeId)) map.set(row.nodeId, []);
      map.get(row.nodeId).push(row);
      return map;
    }, new Map()),
  };
  INDEXES.set(bundle, built);
  return built;
}

const relicName = (bundle, id) => (indexes(bundle).relics.get(id) || {}).name || word(id);
const className = (bundle, id) => (indexes(bundle).classes.get(id) || {}).name || word(id);

// A node's blurb is the authored one-liner beside it in the tree, and only the
// talent sentences read one — every talent node in the shipped tree has an
// authored blurb, and the relic sentences ask for none. The guard below is for
// the OTHER blurb: 52 nodes (all of them relics, today) carry one generated
// line, "What <name> does when the fight gives it its moment", which says
// nothing a reader does not already have. It does not fire on the shipped
// bundle and is not claimed to; it is here so that the day a talent node
// acquires that generated line, it does not become the one sentence on many
// rows that this file exists to remove.
function blurbOf(bundle, nodeId) {
  const blurb = (indexes(bundle).nodes.get(nodeId) || {}).blurb;
  if (typeof blurb !== 'string' || !blurb.trim()) return '';
  if (/^What .+ does when the fight gives it its moment\.?$/.test(blurb.trim())) return '';
  return blurb.trim().replace(/\.?$/, '.');
}

// ---- the fillers ------------------------------------------------------------
// One per blank. Each reads the path's captures (`c`), the bundle, and the
// object or array row the number sits in (`parent`), and returns a NAME or a
// phrase balance.js wrote — never words of its own. A blank with no filler
// reads the capture of the same name.
const FILLERS = Object.freeze({
  pool: (c) => look(balanceWords.pools, c.kind) || an(`${word(c.kind).toLowerCase()} node`),
  band: (c) => look(balanceWords.bands, c.end) || `entry ${Number(c.end) + 1}`,
  relicName: (c, { bundle }) => relicName(bundle, c.relic),
  effect: (c) => look(balanceWords.effects, c.variable) || `the ${word(c.variable).toLowerCase()} it uses`,
  className: (c, { bundle }) => className(bundle, c.classId),
  stat: (c) => look(balanceWords.stats, c.statId) || word(c.statId).toLowerCase(),
  costItem: (c) => {
    const noun = look(balanceWords.shopNouns, c.kind) || word(c.kind).toLowerCase();
    return c.rarity ? `${c.rarity} ${noun}` : noun;
  },
  stockNoun: (c) => word(c.kind).toLowerCase(),
  fieldWords: (c) => word(c.field).toLowerCase(),
  ordinal: (c) => String(Number(c.i) + 1),
  valueOf: (c) => look(balanceWords.cardValues, c.config) || word(c.config).toLowerCase(),
  // A card by its name — and, where two cards share one ("Enter: Bulwark" is a
  // Reaver card and a colorless one), by its class too, then its id, so two
  // rows never describe themselves with the same words.
  cardName: (c, { bundle }) => {
    const { cards, cardsByName } = indexes(bundle);
    const card = cards.get(c.cardId);
    if (!card || !card.name) return word(c.cardId);
    const namesakes = cardsByName.get(card.name) || [];
    if (namesakes.length < 2) return card.name;
    const owner = className(bundle, card.class || 'colorless');
    const sameOwner = namesakes.filter((other) => (other.class || 'colorless') === (card.class || 'colorless'));
    return sameOwner.length < 2 ? `${card.name} (${owner})` : `${card.name} (${owner}, ${card.id})`;
  },
  // An armament by its authored name (the Art charge meter's per-weapon row).
  weaponName: (c, { bundle }) => ((bundle && bundle.equipment && bundle.equipment.armaments) || [])
    .find((piece) => piece && piece.id === c.weapon)?.name || word(c.weapon),
  statusLabel: (c, { bundle }) => (indexes(bundle).statuses.get(c.status) || {}).name || word(c.status),

  // A talent's place in the tree. The three phrases are balance.js's; this
  // only picks one and names the classes, so a talent shared by two trees
  // names both rather than whichever row was read last.
  talent: (c, { bundle }) => (indexes(bundle).nodes.get(c.node) || {}).label || word(c.node),
  talentPlace: (c, { bundle }) => {
    const rows = indexes(bundle).talents.get(c.node) || [];
    const phrases = balanceWords.talentPlace;
    if (!rows.length) return phrases.unplaced;
    const names = [...new Set(rows.map((row) => className(bundle, row.classId)))];
    const tiers = [...new Set(rows.map((row) => row.tier))];
    const owners = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    const phrase = tiers.length === 1 ? phrases.tiered : phrases.untiered;
    return phrase.replace('{tier}', String(tiers[0])).replace('{owners}', owners);
  },
  blurbSuffix: (c, { bundle }) => (blurbOf(bundle, c.node) ? ` ${blurbOf(bundle, c.node)}` : ''),

  // A row inside an authored list names itself by its own id, tag or label,
  // never by its index — the index is the one thing a reorder changes.
  ruleLabel: (c, { parent }) => (parent && (parent.label || parent.id)) || `rule ${c.i}`,
  tag: (c, { parent }) => (parent && parent.tag) || `category ${c.i}`,
  viewId: (c, { parent }) => (parent && parent.id) || `view ${c.i}`,
  flaskKind: (c, { parent }) => look(balanceWords.flaskKinds, parent && parent.kind) || balanceWords.flaskKinds.hp,
  carrier: (c, { parent, bundle }) => (parent && parent.source === 'relic'
    ? relicName(bundle, parent.id) : word((parent && parent.id) || 'the carrier')),
  statusName: (c, { parent }) => word(c.status || (parent && parent.status) || 'the status'),
  recipient: (c, { parent }) => ((parent && parent.target) === 'self'
    ? balanceWords.onFill.self
    : `${balanceWords.onFill.other} ${(parent && parent.target) || 'its target'}`),
});

/** A key in a `[NOTE]` block, as the path it claims. Literal keys hold no `{`. */
function keyPattern(key) {
  const source = key.split('.').map((segment) => segment
    .split(/(\{\w+\})/)
    .map((part) => (/^\{\w+\}$/.test(part)
      ? `(?<${part.slice(1, -1)}>[^.]+?)`
      : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')).join('\\.');
  return new RegExp(`^${source}$`);
}
const PATTERNS = new Map();
const patternFor = (key) => {
  if (!PATTERNS.has(key)) PATTERNS.set(key, keyPattern(key));
  return PATTERNS.get(key);
};

function fill(template, captures, ctx) {
  return template.replace(/\{(a )?(\w+)\}/g, (whole, article, name) => {
    const filler = look(FILLERS, name);
    const value = filler ? filler(captures, ctx) : look(captures, name);
    if (value == null || value === '') return filler ? '' : whole;
    return article ? an(value) : String(value);
  });
}

const finish = (note) => (note.inert ? note.text : `${note.text} ${NEW_RUN_CLAUSE}`);
const asNote = (entry) => (typeof entry === 'string' ? { text: entry } : entry);

/**
 * The `[NOTE]` blocks a path passes through, deepest first, each with the
 * part of the path still left below it. The walk stops where the path leaves
 * the authored tree: a relic id no `powers` row carries still meets the block
 * on `powers` itself, which is how a relic added tomorrow describes itself.
 */
function blocksAlong(root, segs) {
  const blocks = [];
  let node = root;
  for (let depth = 0; depth < segs.length; depth += 1) {
    if (!node || typeof node !== 'object') break;
    const block = node[NOTE];
    if (block && typeof block === 'object') blocks.push({ block, rest: segs.slice(depth), depth });
    if (!Object.hasOwn(node, segs[depth])) break;
    node = node[segs[depth]];
  }
  return blocks.reverse();
}

/**
 * noteMatches(path, root) → every `[NOTE]` key that claims `path`, as
 * `{ key, literal, depth }`. Exported for the tests that refuse two patterns
 * claiming one number, and a note that claims none.
 */
export function noteMatches(path, root = authoredBalance) {
  const found = [];
  for (const { block, rest, depth } of blocksAlong(root, String(path).split('.'))) {
    const remaining = rest.join('.');
    for (const key of Object.keys(block)) {
      if (!key.includes('{')) {
        if (key === remaining) found.push({ key, literal: true, depth });
      } else if (patternFor(key).test(remaining)) {
        found.push({ key, literal: false, depth });
      }
    }
  }
  return found;
}

/**
 * balanceNote(path, { bundle, parent }) → the row's whole description, or null
 * for a path no note in balance.js claims.
 *
 * `path` is the dotted balance path without the `gameConfig.balance.` prefix.
 * `parent` is the object or array the leaf sits in, which is how a row inside
 * an authored list names itself by its own id, tag or label. The notes are
 * read from `bundle.balance` when there is one, so a synthetic bundle in a
 * test brings its own; the authored balance answers otherwise.
 */
export function balanceNote(path, { bundle = null, parent = null } = {}) {
  if (typeof path !== 'string' || !path) return null;
  const root = (bundle && bundle.balance) || authoredBalance;
  const blocks = blocksAlong(root, path.split('.'));

  // A key naming the number outright wins at any depth.
  for (const { block, rest } of blocks) {
    const literal = rest.join('.');
    if (!literal.includes('{') && Object.hasOwn(block, literal)) return finish(asNote(block[literal]));
  }
  // Then the deepest pattern that claims it.
  for (const { block, rest } of blocks) {
    const remaining = rest.join('.');
    for (const key of Object.keys(block)) {
      if (!key.includes('{')) continue;
      const match = patternFor(key).exec(remaining);
      if (!match) continue;
      const note = asNote(block[key]);
      return finish({ ...note, text: fill(note.text, { ...match.groups }, { bundle, parent }) });
    }
  }
  return null;
}
