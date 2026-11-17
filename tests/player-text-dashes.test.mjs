// Player text reads plainly: no em or en dash anywhere a player reads authored copy, and event copy stays
// short (owner, 2026-11-17: event text was "too wordy" and read as AI-written; chore/EventCopy rewrote it).
// Scans the authored sources, not the generated modules: the events, the UI string table, every content and
// pack JSON a screen draws from, the presentation config and the CSV rows. Comments are not player text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DASH = /[–—]/;
const ELLIPSIS = /…|\.\.\./;

// The rewritten bodies run 16 to 26 words; 35 leaves room for a new event without letting a paragraph back in.
const EVENT_BODY_MAX_WORDS = 35;

// A cell that is only a dash is the empty-value glyph ("nothing bound"), not prose.
const PLACEHOLDER = '—';

// SPEC.md names this callout with its dash ("Hit — Evade Failed"); rewording it is a SPEC change first.
const EXEMPT_UI_ROWS = new Set(['combat.callout.evadeFailed']);

// Text the mechanics generator copies into engine/mechanics/*/mechanic.json, which the save-compatibility runtime
// hash covers (tools/game-config.mjs): rewording it rejects every saved fight, so it keeps its dash until that is
// decided on purpose. The generated mechanic already reads " - " there.
const RUNTIME_HASHED = new Set([
  'content/source/statuses.json[8].tooltip', // frost
  'content/source/statuses.json[9].tooltip', // insanity
  'content/source/statuses.json[10].tooltip', // bleedResist
  'content/source/statuses.json[11].tooltip', // frostResist
  'content/source/statuses.json[12].tooltip', // insanityResist
]);
const RUNTIME_HASHED_CSV_ROWS = new Set(['from:global']);

// Keys that annotate data for authors and never reach a screen.
const AUTHOR_KEYS = new Set(['comment', '$comment', '_comment', 'notes', 'provenance']);

const words = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

function filesUnder(rel, extension) {
  const dir = join(ROOT, rel);
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(relative(ROOT, full), extension);
    return name.endsWith(extension) ? [relative(ROOT, full).replace(/\\/g, '/')] : [];
  });
}

function stringsIn(value, where, out = []) {
  if (typeof value === 'string') out.push({ where, text: value });
  else if (Array.isArray(value)) value.forEach((item, at) => stringsIn(item, `${where}[${at}]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (!AUTHOR_KEYS.has(key)) stringsIn(item, `${where}.${key}`, out);
    }
  }
  return out;
}

const dashed = (rows) => rows
  .filter((row) => row.text !== PLACEHOLDER && DASH.test(row.text))
  .map((row) => `${row.where}: ${row.text.slice(0, 90)}`);

const events = readJson('content/source/events.json');

test('event bodies, choice labels and results carry no em dash, en dash or ellipsis', () => {
  const offenders = [];
  for (const event of events) {
    const lines = [['text', event.text], ...event.choices.flatMap((choice, at) => [
      [`choices[${at}].label`, choice.label],
      [`choices[${at}].resultText`, choice.resultText],
    ])];
    for (const [key, text] of lines) {
      if (DASH.test(text) || ELLIPSIS.test(text)) offenders.push(`${event.id}.${key}: ${text}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test(`every event body is at most ${EVENT_BODY_MAX_WORDS} words`, () => {
  assert.ok(events.length >= 20, 'the event table was read');
  const long = events.filter((event) => words(event.text) > EVENT_BODY_MAX_WORDS)
    .map((event) => `${event.id}: ${words(event.text)} words`);
  assert.deepEqual(long, []);
});

test('authored JSON a player reads carries no em or en dash', () => {
  const files = [
    ...filesUnder('content/source', '.json'),
    ...filesUnder('content/config/ui/presentation', '.json'),
    ...filesUnder('games/ashenspire/packs', '.json'),
  ];
  assert.ok(files.includes('content/source/relics.json') && files.includes('games/ashenspire/packs/core/cards.json'));
  const rows = files.flatMap((file) => stringsIn(readJson(file), file)).filter((row) => !RUNTIME_HASHED.has(row.where));
  assert.deepEqual(dashed(rows), []);
  const statuses = readJson('content/source/statuses.json');
  assert.deepEqual([8, 9, 10, 11, 12].map((at) => statuses[at].id), ['frost', 'insanity', 'bleedResist', 'frostResist', 'insanityResist'],
    'the runtime-hashed exemptions still point at the statuses they name');
});

test('CSV rows carry no em or en dash; only # comment lines may', () => {
  const offenders = [];
  for (const file of filesUnder('content/source', '.csv')) {
    readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/).forEach((line, at) => {
      if (line.startsWith('#') || !DASH.test(line)) return;
      if (file.endsWith('uiStrings.csv') && EXEMPT_UI_ROWS.has(line.split(',')[0])) return;
      if (file.endsWith('/nodes.csv') && RUNTIME_HASHED_CSV_ROWS.has(line.split(',')[0])) return;
      offenders.push(`${file}:${at + 1}: ${line.slice(0, 90)}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('the shipped UI string table carries no em or en dash', async () => {
  const { uiStrings } = await import('../src/content/generated/uiStrings.js');
  const rows = uiStrings.filter((row) => !EXEMPT_UI_ROWS.has(row.id))
    .flatMap((row) => ['short', 'full', 'tip'].map((field) => ({ where: `${row.id}.${field}`, text: row[field] || '' })));
  assert.ok(rows.length > 1000, 'the string table was read');
  assert.deepEqual(dashed(rows), []);
});

test('a dash in an event body, or a long one, is caught', () => {
  const planted = { id: 'planted', text: 'A shrine — and something waits.', choices: [] };
  assert.ok(DASH.test(planted.text));
  assert.ok(words('word '.repeat(EVENT_BODY_MAX_WORDS + 1)) > EVENT_BODY_MAX_WORDS);
  assert.deepEqual(dashed([{ where: 'x', text: PLACEHOLDER }]), [], 'a lone placeholder glyph is not prose');
  assert.equal(dashed([{ where: 'x', text: 'a – b' }]).length, 1);
});
