#!/usr/bin/env node
// tools/onevocab.mjs — Sten, 2026-08-15.
//
// ONE QUESTION: is the relic-modifier vocabulary ONE vocabulary, or two?
//
// Codex's #178 gave relics the power to grant a resource. A relic now says
//
//     passives: { modifiers: [{ tag: 'resource.flat', resource: 'hp', amount: 2 }] }
//
// and that sentence has to mean the same thing everywhere, forever, or one of
// its spellings quietly stops being read. Law 0 clause 4 — one home per fact —
// with a long fuse: two spellings for one concept do not fail on the day they
// are born. They fail the day somebody edits one of them.
//
// THE SEAM THIS FILLS, and it was named for me before I got here.
// tools/closedsets.mjs (Viki, 2026-08-08) asks whether an exported closed set
// has a READER. Its own boundary says what it cannot ask:
//
//     "it cannot see whether a SECOND, hand-typed copy of a set exists
//      somewhere. Green here means 'every closed set is read by something',
//      never 'no set is duplicated'. Finding the duplicate is still a
//      person's job."
//
// tests/run-node.mjs prints the same hole in its own boundary (cases 52–53:
// "silent on whether a set has a second, hand-typed copy somewhere — the defect
// that made the question worth asking"). This is that person's job, made a
// machine's, for exactly one vocabulary: the one a relic uses to modify you.
//
// THE TWO FACTS IT GUARDS. Both derived from the tree at run time; neither is
// typed in this file, because a sentinel that re-types the vocabulary it
// watches IS the defect it is watching for.
//
//   FACT 1 — WHICH TAGS EXIST.   Authority: RELIC_MODIFIER_TAGS (schemas.js).
//   FACT 2 — WHICH RESOURCES A RELIC MAY NAME. Authority: the derived-stat rule
//            rows, because derivedStats.js `resolveSnapshotNumbers` folds a
//            relic bonus INTO `rules[resource].base` / `.gainPerTier` and
//            throws on a resource with no row. What the fold accepts is what
//            the word means; every other list of resource ids is a copy of it.
//
// SEVEN CHECKS. A1/A2 read the tree's bytes; A3–A6 and ONEANSWER drive the
// production doors.
//
//   A1  no second TYPED home for the tag set — no file outside the declaration
//       may carry two or more tags in one list literal.
//   A2  every ENGINE tag-dispatch site handles EVERY tag — a src/ site that
//       branches on two of three has a silent hole, and the third falls through
//       an `else`. Scoped to src/ minus src/content/: a tool asking a narrow
//       question may read a subset and a content row merely carries a tag, but
//       neither may re-type the set (that is A1's job).
//   A3  the two production doors accept exactly the declared tags, and agree
//       with each other tag for tag.
//   A4  the relic resource set is a subset of what the fold can accept.
//   A5  the two production doors accept exactly the same resource ids — this is
//       the check that goes red the day one door learns a word the other
//       does not.
//   A6  ONE DERIVATION PATH: a relic's resource grant is entirely mediated by
//       the derived-stat snapshot, and the max-HP addend list stays closed —
//       (a) pinned BY NAME against the three source homes AND by value at the
//       door, because a list can change without a number moving.
//   ONEANSWER  every door that re-derives max HP returns the same number.
//       Called A7 until 2026-08-15; renamed because that name already belonged
//       to another artifact (see its own comment block). It exists because a
//       plant got away from A6 — also its own comment. The
//       composition `derived + equipment + ledger` has THREE homes today, and
//       a drift in the one that runs first is invisible to anything that only
//       reads a freshly created run.
//
// THE DOORS, stated because an observation that cannot name its entry point has
// not made the claim (the instrument rule's same-door clause):
//   census (A1, A2)  — FILE BYTES under src/, tools/, tests/, comments blanked.
//   pin (A6(a))      — FILE BYTES of the three files that compose max HP. This
//                      half reads TERMS, so its door is the source, not a run.
//   probes (A3–A6,   — the real content bundle -> validateContent ->
//    ONEANSWER)          createRegistries -> createRunState, and for ONEANSWER also
//                      createSaveManager.loadRun. Nothing is handed to an inner
//                      function directly; a planted row travels the whole road a
//                      shipped row travels.
//   --selftest       — tools/doorplant.mjs: each known-bad is written into a
//                      COPY OF THE REAL TREE and this tool is run whole from
//                      that copy.
//
// Run:  node tools/onevocab.mjs             the tree — exit 1 on findings
//       node tools/onevocab.mjs --selftest  the corpus — exit 1 if a plant lives
// Exit 2 = the check had nothing to rule on (SOP 2's ⚙ clause).
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day relic modifiers stop
// being a separate vocabulary — when a relic states a resource grant in the
// same words a piece of equipment does, through one registry, this file has no
// two things to compare and is decoration. It is NOT removed for being red.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentBundle } from '../src/content/index.js';
import { RELIC_MODIFIER_TAGS } from '../src/model/schemas.js';
import { RELIC_RESOURCE_IDS } from '../src/model/relicModifiers.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRunState } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { runMods } from '../src/model/loadout.js';
import { createMemoryStorage, createSaveManager, RUN_KEY } from '../src/engine/save.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'tools', 'tests'];
const SELF = 'tools/onevocab.mjs';
// Where the tag set is DECLARED. Derived, not typed: the one file whose export
// this module imported. If the declaration ever moves, this moves with it.
const DECLARATION_HOME = 'src/model/schemas.js';

// ---------------------------------------------------------------------------
// A6(a)'s PIN — the one list in this file that is TYPED ON PURPOSE.
// ---------------------------------------------------------------------------
// Everything else here is derived from the tree, because a sentinel that
// re-types the vocabulary it watches IS the defect it watches for. This is the
// deliberate exception, and the reason is the finding itself: the max-HP addend
// list HAS NO DECLARED HOME to derive it from. Three files compose
// `derived + equipment + ledger` in three different spellings and no module
// exports the list, so the only place it can be pinned is here — where an edit
// to run creation must come and change it, in review, by hand.
//
// WHY BY NAME AND NOT BY NUMBER (Marina's condition, 2026-08-16, and she was
// right about the disease and generous about its severity). A6(a) used to be a
// VALUE identity: maxHp === derived + equipment + ledger, recomputed from the
// same three terms. That assertion cannot see a change to the LIST when the
// SUM does not move, and both ways in happen for free:
//   · a FOURTH addend guarded to zero — `+ (run.relicHpFlat || 0)` — the shape
//     a real one arrives in, reader wired this week and writer next week;
//   · a term SWAPPED for a second spelling of itself — `run.maxHpAdjustment`
//     read into `hpLedger` and the ledger term rewritten to `hpLedger`.
// Both were planted through doorplant into a copy of the real tree on
// 2026-08-16 and both were NOT CAUGHT, exit 0, the whole tool green — while
// this check's own comment said "three terms decide max HP and no more". The
// comment was making a claim the assertion never checked. That is the same
// agreement-is-not-synchronization shape I collapsed in conhp.mjs, committed by
// me, in the check I wrote to catch it.
//
// So the names are asserted at the source and the arithmetic is asserted at the
// door, and A6(a) is BOTH. Names catch a list that changed while the numbers
// held; numbers catch a value that changed while the names held. Either alone
// is half a check.
//
// BY NAME, AND BY MULTISET — the second hole, one level down (Vira, 2026-08-15).
// The name half above was written as a SET comparison, and a set cannot see a
// term written twice: `+ run.maxHpAdjustment + run.maxHpAdjustment` is four
// addends and three names, nothing added, nothing gone, exit 0, whole tool
// green. It was NOT CAUGHT, planted through doorplant, and it is in the corpus
// below. The value half could not cover for it, and the reason is the whole
// point: `maxHpAdjustment` measures 0 on all three classes at birth, so a
// DUPLICATED ZERO MOVES NO TOTAL. The two halves were blind in the same place at
// once — one defect, not two — and a double-count of that exact term is the
// historical defect this seam was built around. Occurrences are now counted.
//
// `addends` is the exact top-level `+`-separated text inside `Math.max(1, ...)`,
// whitespace-normalized. It is verbatim on purpose: a spelling change IS the
// thing being watched, so a lenient match would be the hole again.
//
// WHERE THIS PIN WILL LIE, said before it does. Comparison is by SET, so
// reordering the three terms passes — reorder is not a defect. But bracketing
// them differently (`a + (b + c)`) reads as two top-level terms and goes red
// with nothing wrong, and so does renaming a local that holds a term. Both are
// TRUE reds by this pin's own question — the written list changed — and both
// are fixed the same way: read the diff, then edit the pin. A pin whose whole
// job is to force a human edit cannot also promise never to ask for one.
const MAX_HP_COMPOSITION = [
  {
    file: 'src/model/state.js',
    key: 'state.js#load-door',
    role: 'the load-door integrity assertion',
    anchor: 'const expectedMaxHp = Math.max(1,',
    addends: [
      "deriveStat(restored.rules, 'hp', { attributes: run.attributes, classDef }).value",
      'hpEquipmentBonus',
      'run.maxHpAdjustment',
    ],
  },
  {
    file: 'src/model/state.js',
    key: 'state.js#fresh-derivation',
    role: 'the fresh derivation (which reconcile then overwrites)',
    // RE-AIMED 2026-08-16, and this is the pin working rather than failing.
    // Vira's run-creation visibility act (e63f9cd) named this value so the heal
    // ledger could report it: `run.maxHp = Math.max(1, ...)` became
    // `const derivedMaxHp = Math.max(1, ...)` with the assignment a few lines
    // down. The pin went red as MAX-HP PIN CANNOT READ ITS SITE, a human read
    // the diff, and the three addends were confirmed UNCHANGED — only the
    // assignment target moved. That is the whole intended lifecycle of this
    // list: a change to run creation cannot pass without someone looking.
    anchor: 'const derivedMaxHp = Math.max(1,',
    addends: ['hp.value', 'hpEquipmentBonus', 'run.maxHpAdjustment'],
  },
  {
    file: 'src/model/loadout.js',
    key: 'loadout.js#reconcile',
    role: 'reconcileRunLoadoutHp — runs LAST at run creation and decides the run',
    anchor: 'const nextMax = Math.max(1,',
    addends: ['derived.value', 'equipmentBonus', 'run.maxHpAdjustment'],
  },
];

let checks = 0;
let failures = 0;
const findings = [];

function check(name, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    const msg = error && error.message ? error.message : String(error);
    findings.push(`${name}: ${msg}`);
    console.log(`FAIL  ${name} — ${msg}`);
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sorted = (set) => [...set].sort();
const same = (a, b) => sorted(a).join(',') === sorted(b).join(',');

// ---------------------------------------------------------------------------
// The census door: file bytes
// ---------------------------------------------------------------------------

/**
 * Blank comments, keep strings. A tag named in a comment is prose; a tag named
 * in a string literal is a home. Getting that backwards is how PASSIVE_KEYS
 * looked alive for a month (closedsets.mjs's finding).
 */
function blankComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n === undefined ? '' : n; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; out += c; i += 1; continue; }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i += 1; }
      continue;
    }
    if (c === '/' && n === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i += 1; }
      out += '  ';
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function walk(dir, acc) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const entry of entries) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).split('\\').join('/');
    if (/(^|\/)(node_modules|results|shots|generated)(\/|$)/.test(rel)) continue;
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(js|mjs)$/.test(entry)) acc.push(rel);
  }
  return acc;
}

const sources = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), []))
  .filter((rel) => rel !== SELF)
  .sort();

/**
 * Every site in a file where a declared tag appears as a quoted literal, with
 * the syntactic context that tells a LIST from a BRANCH:
 *   list   — the char before is `[` or `,` and the char after is `,` or `]`.
 *            That is a vocabulary being re-typed.
 *   branch — anything else (`row.tag === 'resource.flat'`, an object key).
 *            That is a dispatch, which is legitimate; A2 checks it is complete.
 */
function tagSites(text) {
  const out = [];
  for (const tag of RELIC_MODIFIER_TAGS) {
    for (const q of ['\'', '"']) {
      const needle = `${q}${tag}${q}`;
      let at = text.indexOf(needle);
      while (at !== -1) {
        let before = at - 1;
        while (before >= 0 && /\s/.test(text[before])) before -= 1;
        let after = at + needle.length;
        while (after < text.length && /\s/.test(text[after])) after += 1;
        const listy = (text[before] === '[' || text[before] === ',')
          && (text[after] === ',' || text[after] === ']');
        out.push({ tag, kind: listy ? 'list' : 'branch' });
        at = text.indexOf(needle, at + 1);
      }
    }
  }
  return out;
}

const census = new Map();
for (const rel of sources) {
  const sites = tagSites(blankComments(readFileSync(join(ROOT, rel), 'utf8')));
  if (sites.length) census.set(rel, sites);
}

/**
 * The top-level addends of a `Math.max(1, ...)` composition, read as FILE BYTES.
 *
 * Returns { addends } on success, or { why } naming what stopped it. It never
 * guesses: an anchor that is gone, or duplicated, or a paren run that does not
 * close is UNKNOWN, and A6(a) renders unknown as RED, never as green — a pin
 * that quietly stops finding its site is the corpus-that-stopped-running shape
 * doorplant already refuses.
 *
 * Splitting tracks depth AND quotes, because one real addend is a call carrying
 * both commas and a string literal:
 *   deriveStat(restored.rules, 'hp', { attributes: run.attributes, classDef }).value
 * A naive split on `+` or `,` would tear that into pieces and then complain
 * about names nobody wrote.
 */
function compositionAddends(rel, anchor) {
  const text = blankComments(readFileSync(join(ROOT, rel), 'utf8'));
  const at = text.indexOf(anchor);
  if (at === -1) return { why: `the anchor \`${anchor}\` is GONE from ${rel}` };
  if (text.indexOf(anchor, at + 1) !== -1) {
    return { why: `the anchor \`${anchor}\` appears MORE THAN ONCE in ${rel}, so the pin cannot say which site it read` };
  }
  let i = at + anchor.length; // just past `Math.max(1,` — inside the arg list
  let depth = 1;
  let quote = null;
  let buf = '';
  const parts = [];
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      buf += c;
      if (c === '\\') { buf += text[i + 1] === undefined ? '' : text[i + 1]; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') { quote = c; buf += c; i += 1; continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) { parts.push(buf); buf = ''; break; }
    }
    if (depth === 1 && c === '+') { parts.push(buf); buf = ''; i += 1; continue; }
    buf += c;
    i += 1;
  }
  if (depth !== 0) return { why: `the \`Math.max(\` opened at \`${anchor}\` in ${rel} never closes` };
  return { addends: parts.map((p) => p.replace(/\s+/g, ' ').trim()) };
}

// ---------------------------------------------------------------------------
// The probe door: the real content road
// ---------------------------------------------------------------------------

const cloneBundle = () => ({
  ...contentBundle,
  attributes: structuredClone(contentBundle.attributes),
  classes: structuredClone(contentBundle.classes),
  relics: structuredClone(contentBundle.relics),
  attributeRules: structuredClone(contentBundle.attributeRules),
  derivedStatRules: structuredClone(contentBundle.derivedStatRules),
});

const HOST_CLASS = contentBundle.classes[0];
const HOST_RELIC = HOST_CLASS && HOST_CLASS.startingRelic;

/** Plant one modifier row on a real class's real starting relic. */
function plantRow(row) {
  const bundle = cloneBundle();
  const relic = bundle.relics.find((r) => r.id === HOST_RELIC);
  relic.passives = { ...(relic.passives || {}), modifiers: [row] };
  // The template requirement binds a token per authored row; strip the prose so
  // a template complaint cannot masquerade as a vocabulary complaint.
  relic.textTemplate = undefined;
  return { bundle, path: `relics.${HOST_RELIC}.passives.modifiers[0]` };
}

/** Errors validateContent raises at exactly one field of the planted row. */
function validateFieldErrors(bundle, path, field) {
  const result = validateContent(bundle);
  return (result.errors || []).filter((e) => e.path === `${path}.${field}`);
}

/** What createRegistries -> resolveRelicModifiers does with the planted row. */
function resolveOutcome(bundle) {
  try {
    createRegistries(bundle);
    return { threw: false, message: '' };
  } catch (error) {
    return { threw: true, message: (error && error.message) || String(error) };
  }
}

// ---------------------------------------------------------------------------

console.log('onevocab — is the relic-modifier vocabulary ONE vocabulary or two?\n');
console.log(`DOOR (census A1/A2): FILE BYTES of ${sources.length} file(s) under ${SCAN_DIRS.join('/, ')}/, comments blanked, strings kept.`);
console.log('DOOR (probes A3-A6, ONEANSWER): src/content/index.js -> validateContent -> createRegistries -> createRunState.');
console.log(`DOOR (pin A6(a)):   FILE BYTES of the ${MAX_HP_COMPOSITION.length} site(s) in `
  + `${new Set(MAX_HP_COMPOSITION.map((h) => h.file)).size} file(s) that compose max HP, comments blanked — `
  + `it reads the TERMS, not the numbers: ${MAX_HP_COMPOSITION.map((h) => h.key).join(', ')}.`);
console.log(`AUTHORITY (tags):      RELIC_MODIFIER_TAGS = ${RELIC_MODIFIER_TAGS.join(', ')}  [${DECLARATION_HOME}]`);
console.log(`AUTHORITY (resources): derivedStatRules.rules = ${Object.keys(contentBundle.derivedStatRules.rules).join(', ')}  [the set the fold accepts]\n`);

if (!RELIC_MODIFIER_TAGS.length || !HOST_RELIC) {
  console.error('NOTHING TO RULE ON — no declared relic modifier tags, or no class starting relic. Exit 2 (SOP 2 ⚙).');
  process.exit(2);
}

// --- A1 -------------------------------------------------------------------

check('A1 the tag set has ONE typed home; nothing else re-types it as a list', () => {
  const copies = [];
  for (const [rel, sites] of census) {
    if (rel === DECLARATION_HOME) continue;
    const listed = new Set(sites.filter((s) => s.kind === 'list').map((s) => s.tag));
    if (listed.size >= 2) copies.push(`${rel} lists ${sorted(listed).join(' + ')}`);
  }
  assert(!copies.length,
    `SECOND TYPED HOME for the tag vocabulary — ${copies.join('; ')}. `
    + `Agreement is not synchronization (SOP 5): a copy that agrees today is the interval before a defect. `
    + `Import RELIC_MODIFIER_TAGS from ${DECLARATION_HOME} instead of re-typing it.`);
  const home = census.get(DECLARATION_HOME) || [];
  const declared = new Set(home.filter((s) => s.kind === 'list').map((s) => s.tag));
  assert(same(declared, RELIC_MODIFIER_TAGS),
    `the declaration home ${DECLARATION_HOME} lists ${sorted(declared).join(', ') || '(nothing)'} `
    + `but the import yields ${RELIC_MODIFIER_TAGS.join(', ')} — the set moved and this check is pointing at the wrong file.`);
  return `1 declaration, ${census.size - 1} dispatch site(s), 0 copies`;
});

// --- A2 -------------------------------------------------------------------

check('A2 every ENGINE tag-dispatch site handles EVERY declared tag', () => {
  // SCOPED TO src/ ON PURPOSE, and the scope is the claim. A site under src/
  // that branches on a tag is DECIDING WHAT THE TAG MEANS: miss one and the
  // row is legal input with no output. A tool or test that filters rows by tag
  // is a reader with a narrow question — tools/conhp.mjs sums only `resource.*`
  // because it is asking about HP, and that is not a hole. A1 still binds them:
  // a reader may narrow, it may never re-type the set.
  //
  // src/content/ IS EXCLUDED, and the exclusion is load-bearing rather than
  // tidy. A content row CARRIES a tag; it does not decide what one means. Left
  // in, this check would have gone red the day the last `damage.school.flat`
  // row was retired from relics.js — a content edit failing an engine
  // invariant, which is the false red that teaches people to ignore a tool.
  const engine = [...census].filter(([rel]) => rel.startsWith('src/')
    && !rel.startsWith('src/content/')
    && rel !== DECLARATION_HOME);
  const holes = [];
  for (const [rel, sites] of engine) {
    const named = new Set(sites.map((s) => s.tag));
    const missing = RELIC_MODIFIER_TAGS.filter((t) => !named.has(t));
    if (missing.length) holes.push(`${rel} never names ${missing.join(', ')}`);
  }
  assert(!holes.length,
    `PARTIAL DISPATCH — ${holes.join('; ')}. An engine site that branches on some tags and not others does `
    + `not refuse the rest, it FALLS THROUGH: legal input, no output, no complaint — Law 0 clause 5's `
    + `invisible half. Either handle the tag or delete the site.`);
  assert(engine.length, 'no engine dispatch site names any tag — the vocabulary has no reader in src/');
  return `${engine.length} engine site(s), each naming all ${RELIC_MODIFIER_TAGS.length}`;
});

// --- A3 -------------------------------------------------------------------

check('A3 the boot door and the resolve door accept exactly the declared tags', () => {
  const alphabet = [...new Set([...RELIC_MODIFIER_TAGS, '__notatag', 'resource.percent'])];
  const acceptedByValidate = new Set();
  const executedByResolve = new Set();
  for (const tag of alphabet) {
    const { bundle, path } = plantRow({ tag, resource: RELIC_RESOURCE_IDS[0], amount: 1 });
    if (!validateFieldErrors(bundle, path, 'tag').length) acceptedByValidate.add(tag);
    const outcome = resolveOutcome(bundle);
    // resolveRelicModifiers refuses an unknown tag BY NAME. Any other throw is
    // the row's fields being wrong for a tag it does know — still executed.
    if (!(outcome.threw && /tag '.*' is unknown/.test(outcome.message))) executedByResolve.add(tag);
  }
  assert(same(acceptedByValidate, executedByResolve),
    `TWO TAG VOCABULARIES — validateContent accepts {${sorted(acceptedByValidate).join(', ')}} but `
    + `resolveRelicModifiers executes {${sorted(executedByResolve).join(', ')}}. `
    + `A tag one door knows and the other does not is a word that means nothing where it counts.`);
  assert(same(acceptedByValidate, RELIC_MODIFIER_TAGS),
    `the doors agree with each other on {${sorted(acceptedByValidate).join(', ')}} but not with the `
    + `declared set {${RELIC_MODIFIER_TAGS.join(', ')}} — the closed set is decoration.`);
  return `${alphabet.length} candidate(s) probed; both doors say ${RELIC_MODIFIER_TAGS.join(', ')}`;
});

// --- A4 -------------------------------------------------------------------

check('A4 every relic resource id is one the derived-stat fold can accept', () => {
  const foldable = Object.keys(contentBundle.derivedStatRules.rules);
  const orphans = RELIC_RESOURCE_IDS.filter((id) => !foldable.includes(id));
  assert(!orphans.length,
    `RELIC_RESOURCE_IDS names ${orphans.join(', ')}, which has no derivedStatRules row — `
    + `resolveSnapshotNumbers throws 'targets unknown derived resource' on it. A word the vocabulary `
    + `permits and the fold refuses is a second vocabulary with a one-run fuse.`);
  return `${RELIC_RESOURCE_IDS.join(', ')} ⊆ ${foldable.join(', ')}`;
});

// --- A5 -------------------------------------------------------------------

check('A5 the boot door and the resolve door accept exactly the same resource ids', () => {
  const alphabet = [...new Set([
    ...Object.keys(contentBundle.derivedStatRules.rules),
    ...RELIC_RESOURCE_IDS,
    ...(contentBundle.resources || []).map((row) => row.id),
    '__notaresource',
  ])];
  const acceptedByValidate = new Set();
  const acceptedByResolve = new Set();
  for (const resource of alphabet) {
    const { bundle, path } = plantRow({ tag: 'resource.flat', resource, amount: 1 });
    if (!validateFieldErrors(bundle, path, 'resource').length) acceptedByValidate.add(resource);
    if (!resolveOutcome(bundle).threw) acceptedByResolve.add(resource);
  }
  assert(same(acceptedByValidate, acceptedByResolve),
    `TWO RESOURCE VOCABULARIES — validateContent accepts {${sorted(acceptedByValidate).join(', ')}} but `
    + `resolveRelicModifiers accepts {${sorted(acceptedByResolve).join(', ')}}. `
    + `The disagreement is {${sorted(new Set([...acceptedByValidate, ...acceptedByResolve]))
      .filter((id) => acceptedByValidate.has(id) !== acceptedByResolve.has(id)).join(', ')}}. `
    + `Two hand-typed lists of the same fact drifted; collapse them onto the derived-stat rows.`);
  assert(same(acceptedByValidate, RELIC_RESOURCE_IDS),
    `both doors accept {${sorted(acceptedByValidate).join(', ')}} but RELIC_RESOURCE_IDS declares `
    + `{${RELIC_RESOURCE_IDS.join(', ')}} — the exported set is not the one being enforced.`);
  return `${alphabet.length} candidate(s) probed; both doors say ${sorted(acceptedByValidate).join(', ')}`;
});

// --- A6 -------------------------------------------------------------------

check('A6 ONE derivation path: a relic resource grant is wholly inside the snapshot', () => {
  const registries = createRegistries(contentBundle);

  // (a) THE ADDEND LIST IS CLOSED, CHECKED BY NAME AT THE SOURCE. Runs once,
  // not per class, because it is a fact about three files and not about a run.
  // This is the half that fails on the TERMS; the per-class arithmetic below is
  // the half that fails on the NUMBERS, and A6(a) is not either one alone.
  const pinned = [];
  for (const home of MAX_HP_COMPOSITION) {
    const read = compositionAddends(home.file, home.anchor);
    assert(!read.why,
      `MAX-HP PIN CANNOT READ ITS SITE — ${read.why}. ${home.file} (${home.role}) is one of the three `
      + `homes of \`derived + equipment + ledger\`, and a pin that cannot find its site knows NOTHING `
      + `about the addend list; that is unknown, and unknown is not green. If run creation moved, `
      + `re-aim MAX_HP_COMPOSITION in ${SELF} by hand.`);
    const found = read.addends;
    // MULTISET, not set — Vira, 2026-08-15, and the fix is one line because the
    // defect was one word. `includes` cannot see a term written TWICE, so
    // `+ run.maxHpAdjustment + run.maxHpAdjustment` was four addends, three
    // names, nothing added, nothing gone, exit 0. Counting each occurrence is
    // the whole of it.
    const surplus = (a, b) => { const pool = [...b]; return a.filter((t) => { const i = pool.indexOf(t); if (i !== -1) { pool.splice(i, 1); return false; } return true; }); };
    const added = surplus(found, home.addends);
    const gone = surplus(home.addends, found);
    assert(!added.length && !gone.length,
      `THE MAX-HP ADDEND LIST IS NOT THE PINNED ONE — ${home.file} (${home.role}).\n`
      + `      PINNED (${home.addends.length}): ${home.addends.join('  |  ')}\n`
      + `      FOUND  (${found.length}): ${found.join('  |  ')}\n`
      + (added.length ? `      SURPLUS TERM(S) — unpinned, or a pinned term written more than once: ${added.join(', ')}\n` : '')
      + (gone.length ? `      PINNED TERM(S) GONE: ${gone.join(', ')}\n` : '')
      + `      A term here that is not on the pinned list — or a pinned one counted twice — is a SECOND way to say "+N max HP", and it `
      + `does not have to change any number to be one. If run creation genuinely changed, edit the pin `
      + `in ${SELF} deliberately, in review — that edit is the point of the pin.`);
    pinned.push(`${home.key} ${found.length} term(s)`);
  }

  // The stripped tree: the same content with every relic resource.* row removed.
  const stripped = cloneBundle();
  for (const relic of stripped.relics) {
    const rows = relic.passives && relic.passives.modifiers;
    if (!Array.isArray(rows)) continue;
    relic.passives.modifiers = rows.filter((row) => !String(row.tag).startsWith('resource.'));
  }
  const strippedRegistries = createRegistries(stripped);

  const notes = [];
  for (const cls of registries.classes.all()) {
    const seed = 0x5710 + cls.id.length;
    const run = createRunState({ seed, classId: cls.id, registries });
    const bare = createRunState({ seed, classId: cls.id, registries: strippedRegistries });
    const classDef = registries.classes.get(cls.id);

    // (a) continued — THE SAME LIST, CHECKED BY VALUE AT THE DOOR. The three
    // pinned terms are the whole of max HP at the door a real run comes
    // through. This edge catches a term whose NUMBER drifted while its name
    // held; the source pin above catches a term whose NAME changed while the
    // number held. Neither sees the other's case, which is why both are here.
    const derived = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', { attributes: run.attributes, classDef });
    const gear = runMods(registries, run.loadout, run.class).maxHp;
    const expected = Math.max(1, derived.value + gear + run.maxHpAdjustment);
    assert(run.maxHp === expected,
      `${cls.id}: maxHp ${run.maxHp} != derived ${derived.value} + equipment ${gear} + ledger ${run.maxHpAdjustment} `
      + `= ${expected}. A term outside that list is a SECOND derivation path for the same grant.`);

    // (b) Mana and Stamina have no outside addend at all — the snapshot is the
    // whole authority. If a carrier ever grants Mana off-table, this is where
    // it shows.
    for (const [statId, actual] of [['mana', run.maxMana], ['stamina', run.maxStamina]]) {
      const value = deriveStat(run.derivedStatRuleSnapshot.rules, statId, { attributes: run.attributes, classDef }).value;
      assert(actual === value,
        `${cls.id}: max${statId} ${actual} != the snapshot's ${value} — something adds to ${statId} outside the derived table.`);
    }

    // (c) THE RELIC CONTRIBUTION IS FULLY MEDIATED. Strip the relic's rows and
    // the whole difference must be visible inside the snapshot's own numbers.
    // If any part of the relic bonus travelled by a second road, these differ.
    const bareDerived = deriveStat(bare.derivedStatRuleSnapshot.rules, 'hp', { attributes: bare.attributes, classDef });
    assert(run.maxHp - bare.maxHp === derived.value - bareDerived.value,
      `${cls.id}: removing the relic's resource rows moved maxHp by ${run.maxHp - bare.maxHp} but moved the `
      + `snapshot's derived HP by ${derived.value - bareDerived.value} — part of the relic bonus is arriving off-table.`);
    notes.push(`${cls.id} +${derived.value - bareDerived.value}hp`);
  }
  assert(notes.length, 'no classes to rule on');
  return `addend list pinned BY NAME at ${pinned.join(', ')}; ${notes.length} class(es): `
    + `${notes.join(', ')} — all inside the snapshot`;
});

// --- ONEANSWER --------------------------------------------------------------
// RENAMED FROM A7, 2026-08-15 (Marina MR-35, naming mine). "A7" named two
// different artifacts: the act that built tools/runcreation.mjs, and this
// check. Vira nearly gated the wrong one, and a finding reported as "A7 failed"
// was ambiguous the day it was written. The act's name is in the packets, the
// thread and three logs and cannot be recalled; this label lived in one file,
// so this is the one that moves. (In this tree "A7" is ALSO a Saga ledger row
// and a Viki equipment clause — the name was never mine to hold.)
// Its subject was already the word: ONE ANSWER. Reports say ONEANSWER now.
// Viki's lens owns naming; if she wants a different word she takes it on sight.

check('ONEANSWER every door that re-derives max HP returns the SAME number', () => {
  // WHY THIS EXISTS, and it was found by a plant that got away. The composition
  // `derived + equipment + ledger` is written in THREE places:
  //   src/model/state.js:210    the load-door integrity assertion
  //   src/model/state.js:256    the fresh derivation
  //   src/model/loadout.js:1086 reconcileRunLoadoutHp, which runs LAST at run
  //                             creation and overwrites 256's answer
  // All three are live, at different doors. A known-bad planted in 256 was
  // invisible to a check that only reads a freshly created run, because 1086
  // had already clobbered it — A6 stayed green on a tree where one of the three
  // homes had drifted. A6 asks whether the relic grant travels one road; this
  // asks whether the road gives the same answer whoever drives it.
  //
  // BOTH ENTRY POINTS ARE PRODUCTION DOORS: createRunState, and
  // createSaveManager.loadRun on a persisted run whose snapshot is absent (the
  // pre-derived migration case), which is what forces the load door to
  // re-derive instead of trusting the stamped numbers.
  const registries = createRegistries(contentBundle);
  const notes = [];
  for (const cls of registries.classes.all()) {
    const created = createRunState({ seed: 0x5711 + cls.id.length, classId: cls.id, registries });
    const persisted = structuredClone(created);
    delete persisted.derivedStatRuleSnapshot;
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, JSON.stringify(persisted));
    const loaded = createSaveManager(storage).loadRun(registries);
    assert(loaded, `${cls.id}: the load door refused a run with no snapshot, so this check had nothing to compare`);
    assert(loaded.maxHp === created.maxHp,
      `${cls.id}: the creation door says maxHp ${created.maxHp} and the load door says ${loaded.maxHp}. `
      + `The same content, the same relic, the same equipment — TWO ANSWERS. One of the three homes of `
      + `\`derived + equipment + ledger\` has drifted from the others.`);
    for (const [key, statId] of [['maxMana', 'mana'], ['maxStamina', 'stamina']]) {
      assert(loaded[key] === created[key],
        `${cls.id}: creation says ${key} ${created[key]}, load says ${loaded[key]} — two answers for one pool.`);
    }
    notes.push(`${cls.id} ${created.maxHp}hp`);
  }
  // THE DENOMINATOR FLOOR (Vira, 2026-08-15; Marina MR-35). Empty the class
  // domain and this check used to print `PASS — 0 class(es) agree across both
  // doors:` — `verify-shipped: OK — 0 checks passed` in another tool's clothes.
  // It was masked only because A6 shares this domain and asserts notes.length:
  // a NEIGHBOUR'S assertion holding up a check that could not hold itself up.
  // A6 going red is A6's coverage, never this one's.
  assert(notes.length,
    'ONEANSWER HAS NO CLASS DOMAIN — 0 class(es) were compared across the two doors, so this check '
    + 'ruled on nothing and said PASS. An empty comparison and an agreeing one print the same word and '
    + 'mean the opposite (SOP 2\'s ⚙ clause). registries.classes.all() is empty: either the content '
    + 'bundle lost its classes or the registry stopped loading them.');
  return `${notes.length} class(es) agree across both doors: ${notes.join(', ')}`;
});

// ---------------------------------------------------------------------------

const SELFTEST = process.argv.includes('--selftest');
const treeVerdict = `${checks - failures}/${checks} checks passed over ${sources.length} scanned file(s), `
  + `${RELIC_MODIFIER_TAGS.length} declared tag(s), ${RELIC_RESOURCE_IDS.length} relic resource id(s).`;

console.log('');
// Under --selftest the RESULT line belongs to the CORPUS, not to the tree: a
// harness that quotes the first RESULT it finds would otherwise print the same
// sentence beside both suite cases, and one of them would be describing
// something it never measured.
console.log(`${SELFTEST ? 'TREE (baseline, not this run\'s verdict):' : 'RESULT:'} ${treeVerdict}`);
console.log(`EXCLUDED from the census: ${SELF} — a sentinel may not cite itself as a home for the `
  + `vocabulary it watches, and its plant strings name tags on purpose. The hole is real and stated: `
  + `a second copy planted IN THIS FILE would not be seen.`);
console.log('BOUNDARY: this asks whether the relic-modifier vocabulary has one home and one derivation');
console.log('  path. It is SILENT on whether the numbers are balanced, on whether a relic bonus is');
console.log('  legible to a player, and on the OTHER modifier vocabularies this game already carries —');
console.log("  equipment's `self.maxHp=+N` mods column, relic PASSIVE_TYPES scalars, and status");
console.log('  MODIFIER_TYPES. A6(a) pins the max-HP addend list BY NAME at its three source homes so a');
console.log('  fourth road cannot appear quietly — not even one that adds zero — and that is the whole');
console.log('  of what it claims about them. The pin is the one list TYPED in this file, because the');
console.log('  addend list has no declared home to derive it from; that absence is itself the finding.');
console.log('STANDING FINDING, watched here and NOT fixed here: the composition');
console.log('  `derived + equipment + ledger` has THREE homes — src/model/state.js (the load-door');
console.log('  assertion, and the fresh derivation) and src/model/loadout.js (reconcile, which');
console.log('  runs last at run creation and overwrites the second). All three are live at');
console.log('  different doors. ONEANSWER makes them disagree out loud; collapsing them to one is a');
console.log('  change to run creation and belongs to whoever owns that seam, not to a sentinel.');

if (findings.length) {
  console.log('');
  console.log('FINDINGS:');
  for (const f of findings) console.log(`  - ${f}`);
}

if (SELFTEST) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const [FLAT, TIER, SCHOOL] = RELIC_MODIFIER_TAGS;
  const PLANTS = [
      {
        // A tag is declared and nothing implements it: legal input, no output.
        name: 'a fourth tag joins the closed set with no dispatch anywhere',
        file: DECLARATION_HOME,
        find: `  '${SCHOOL}',`,
        replace: `  '${SCHOOL}',\n  'resource.percent',`,
        // Matched on the FAIL line, never on the banner that merely echoes the
        // declared set — a red for the wrong reason is not a catch.
        expectRed: /PARTIAL DISPATCH.*never names resource\.percent/,
      },
      {
        // The historical shape: a check re-types the vocabulary it checks.
        name: 'a tool re-types the tag list instead of importing it',
        file: 'tools/conhp.mjs',
        find: 'assert(RELIC_MODIFIER_TAGS.includes(row.tag),',
        replace: `assert(['${FLAT}', '${TIER}', '${SCHOOL}'].includes(row.tag),`,
        expectRed: /SECOND TYPED HOME/,
      },
      {
        // One door learns a word the other does not.
        name: 'the boot door learns a resource the resolver never heard of',
        file: 'src/model/validate.js',
        find: "const resourceIds = new Set(['hp', 'mana', 'stamina']);",
        replace: "const resourceIds = new Set(['hp', 'mana', 'stamina', 'poise']);",
        expectRed: /TWO RESOURCE VOCABULARIES/,
      },
      {
        // The same fact drifting from the other side.
        name: 'the resolver forgets a resource the boot door still accepts',
        file: 'src/model/relicModifiers.js',
        find: "Object.freeze(['hp', 'mana', 'stamina'])",
        replace: "Object.freeze(['hp', 'mana'])",
        expectRed: /TWO RESOURCE VOCABULARIES|not the one being enforced/,
      },
      {
        // A second road for a grant that already has one, planted in the writer
        // that DECIDES a freshly created run (reconcile runs last).
        name: 'a relic resource grant is added a second time, outside the table',
        file: 'src/model/loadout.js',
        find: 'const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment);',
        replace: 'const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment + 2);',
        expectRed: /SECOND derivation path|arriving off-table|TWO ANSWERS/,
      },
      {
        // The plant that got away, and the reason ONEANSWER exists: a drift in the
        // fresh-derivation home is invisible at run creation, because reconcile
        // overwrites it. Only a second door can see it.
        name: 'one of the three max-HP homes drifts where creation cannot see it',
        file: 'src/model/state.js',
        find: 'const derivedMaxHp = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment);',
        replace: 'const derivedMaxHp = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment) + 2;',
        expectRed: /TWO ANSWERS/,
      },
      {
        // A FOURTH addend, guarded to zero — the shape a real one arrives in:
        // the reader is wired this week and the writer next week, and in
        // between the list has four terms and the sum has not moved. This
        // plant was NOT CAUGHT by A6(a) before it read the terms by name.
        name: 'a fourth max-HP addend appears and adds nothing today',
        file: 'src/model/loadout.js',
        find: 'const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment);',
        replace: 'const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment + (run.relicHpFlat || 0));',
        expectRed: /SURPLUS TERM\(S\)[^\n]*: \(run\.relicHpFlat \|\| 0\)/,
      },
      {
        // One term SWAPPED for a second spelling of itself. Same number
        // forever, so no value assertion can ever see it; the list is four
        // words long and one of the words changed. Also NOT CAUGHT before.
        name: 'a max-HP term is swapped for a second spelling of itself',
        file: 'src/model/loadout.js',
        find: '  const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment);',
        replace: '  const hpLedger = run.maxHpAdjustment;\n  const nextMax = Math.max(1, derived.value + equipmentBonus + hpLedger);',
        expectRed: /PINNED TERM\(S\) GONE: run\.maxHpAdjustment/,
      },
      {
        // The pin's own unknown edge: the site moves and the pin finds
        // nothing. A pin that goes quiet must go RED, not green.
        name: 'a max-HP composition home is renamed out from under the pin',
        file: 'src/model/state.js',
        find: 'const derivedMaxHp = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment);',
        replace: 'const freshMax = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment);\n  const derivedMaxHp = freshMax;',
        expectRed: /MAX-HP PIN CANNOT READ ITS SITE/,
      },
      {
        // VIRA'S PLANT, 2026-08-15, and it is the reason the comparison is a
        // multiset. A pinned term written TWICE: four addends, three names.
        // Set-difference sees nothing added and nothing gone and the whole tool
        // exits 0. The value half cannot cover for it either — `maxHpAdjustment`
        // measures 0 on all three classes at birth, so a duplicated zero moves
        // no total and no arithmetic assertion twitches. THE ZERO IS WHY THIS IS
        // FATAL RATHER THAN COSMETIC: the ledger term is pinned by name only,
        // and the name half was blind to its own duplication. A double-count of
        // that exact term is the historical defect this whole seam was built
        // around.
        name: 'a pinned max-HP term is written TWICE — four addends, three names, no number moves',
        file: 'src/model/loadout.js',
        find: 'const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment);',
        replace: 'const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment + run.maxHpAdjustment);',
        expectRed: /SURPLUS TERM\(S\)[^\n]*run\.maxHpAdjustment/,
      },
      {
        // ONEANSWER's own denominator. The class domain it iterates is produced
        // by createRegistries; empty it there and the check used to print
        // `PASS A7 — 0 class(es) agree across both doors:` — an empty green,
        // standing only because A6 shares the loop and asserts notes.length. A
        // neighbour's assertion holding up a check that cannot hold itself up.
        // The tool goes red under this plant either way; the plant is armed
        // against ONEANSWER'S OWN LINE, because a neighbour's red is not this
        // check's coverage.
        name: "the class domain goes empty at the registry — ONEANSWER's denominator dies",
        file: 'src/model/registries.js',
        find: '    registries[type] = makeRegistry(TYPE_SINGULAR[type], bundle[type]);',
        replace: "    registries[type] = makeRegistry(TYPE_SINGULAR[type], type === 'classes' ? [] : bundle[type]);",
        expectRed: /ONEANSWER HAS NO CLASS DOMAIN/,
      },
      {
        // A dispatch site quietly stops handling one tag.
        name: 'a dispatch site drops one tag and lets it fall through',
        file: 'src/model/validate.js',
        find: `else if (row.tag === '${SCHOOL}') add(`,
        replace: 'else if (false) add(',
        expectRed: /PARTIAL DISPATCH/,
      },
  ];
  const code = await doorSelftest({ tool: 'onevocab.mjs', plants: PLANTS });
  // The corpus's own verdict, in the shape tests/run-node.mjs quotes. The plant
  // count is read off the array, never typed — a corpus that silently shrinks
  // would otherwise still print the number it used to be.
  console.log(`\nRESULT: known-bad recall ${code === 0 ? `${PLANTS.length}/${PLANTS.length}` : 'INCOMPLETE'} `
    + `— ${PLANTS.length} plants + 1 clean baseline, each entering as file bytes in a copied real tree, `
    + `tool run whole from that copy.`);
  process.exit(code);
}

if (failures) process.exitCode = 1;
