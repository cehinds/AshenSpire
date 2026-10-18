// The content-authority flip (owner, 2026-10-17): relics, stances, flasks and the
// authored statuses are authored as JSON under content/source;
// src/content/generated/<kind>.js is the compiled mirror; src/content/<kind>.js is
// a re-export shim for importers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { relics } from '../src/content/relics.js';
import { stances } from '../src/content/stances.js';
import { flasks } from '../src/content/flasks.js';
import { statuses } from '../src/content/statuses.js';
import { expansionStatuses } from '../src/content/combatStatusRules.js';
import * as eventModule from '../src/content/events.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = { relics, stances, flasks };

for (const [kind, exported] of Object.entries(KINDS)) {
  test(`${kind}: the export deep-equals the authored JSON`, () => {
    const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/${kind}.json`), 'utf8'));
    assert.ok(Array.isArray(authored) && authored.length > 0, `${kind}.json is a non-empty array`);
    assert.deepStrictEqual(exported, authored);
  });

  test(`${kind}: src/content/${kind}.js is a shim with no object literal`, () => {
    const text = readFileSync(resolve(ROOT, `src/content/${kind}.js`), 'utf8');
    assert.ok(!/\{\s*id\s*:/.test(text), `${kind}.js authors a row (\`{ id:\`) — edit content/source/${kind}.json instead`);
    assert.ok(!/^\s*name\s*:/m.test(text), `${kind}.js authors a \`name:\` line — edit content/source/${kind}.json instead`);
    assert.match(text, new RegExp(`from './generated/${kind}\\.js'`));
  });
}

// Statuses are the one kind with two sources: the authored rows are JSON, the
// expansion rows are derived in combatStatusRules.js (they stay JS), and the
// shim joins them, authored first.
test('statuses: the export is the authored JSON rows followed by expansionStatuses', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/statuses.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0, 'statuses.json is a non-empty array');
  assert.ok(expansionStatuses.length > 0, 'the derived expansion rows exist');
  assert.equal(statuses.length, authored.length + expansionStatuses.length);
  assert.deepStrictEqual(statuses.slice(0, authored.length), authored);
  assert.deepStrictEqual(statuses.slice(authored.length), expansionStatuses);
});

test('statuses: src/content/statuses.js is a shim with no row literal', () => {
  const text = readFileSync(resolve(ROOT, 'src/content/statuses.js'), 'utf8');
  assert.ok(!/\{\s*id\s*:/.test(text), 'statuses.js authors a row (`{ id:`) — edit content/source/statuses.json instead');
  assert.ok(!/^\s*name\s*:/m.test(text), 'statuses.js authors a `name:` line — edit content/source/statuses.json instead');
  assert.match(text, /from '\.\/generated\/statuses\.js'/);
  assert.match(text, /from '\.\/combatStatusRules\.js'/);
});

// Events: one array and five tables, each its own JSON file. The shim keeps the
// freeze depths the hand-written module had: `events` unfrozen, the three
// `event*` tables frozen at the top, `questChains` and `eventSpeakers` deeply.
const readJson = (name) => JSON.parse(readFileSync(resolve(ROOT, `content/source/${name}.json`), 'utf8'));
const isDeepFrozen = (value) => !value || typeof value !== 'object'
  || (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));
const EVENT_TABLES = ['eventChoiceIds', 'eventChoiceHistoryRequirements', 'eventHistoryRequirements', 'questChains', 'eventSpeakers'];

test('events: the export deep-equals content/source/events.json', () => {
  const authored = readJson('events');
  assert.ok(Array.isArray(authored) && authored.length > 0, 'events.json is a non-empty array');
  assert.deepStrictEqual(eventModule.events, authored);
});

for (const table of EVENT_TABLES) {
  test(`events: ${table} deep-equals content/source/${table}.json`, () => {
    const authored = readJson(table);
    assert.ok(authored && typeof authored === 'object' && !Array.isArray(authored), `${table}.json is an object`);
    if (table === 'eventChoiceHistoryRequirements') {
      // JSON `null` in a slot means "no requirement"; the export holds `undefined`.
      for (const slots of Object.values(authored)) {
        assert.ok(Array.isArray(slots));
        slots.forEach((slot, i) => { if (slot === null) slots[i] = undefined; });
      }
    }
    assert.deepStrictEqual(eventModule[table], authored);
  });
}

test('events: the frozen exports are frozen at the depth they always were', () => {
  assert.equal(Object.isFrozen(eventModule.events), false);
  for (const table of ['eventChoiceIds', 'eventChoiceHistoryRequirements', 'eventHistoryRequirements']) {
    assert.ok(Object.isFrozen(eventModule[table]), `${table} is frozen`);
  }
  assert.ok(isDeepFrozen(eventModule.questChains), 'questChains is deeply frozen');
  assert.ok(isDeepFrozen(eventModule.eventSpeakers), 'eventSpeakers is deeply frozen');
});

test('events: every event has one history id per choice', () => {
  for (const event of eventModule.events) {
    assert.equal(eventModule.eventChoiceIds[event.id]?.length, event.choices.length, `${event.id}: eventChoiceIds length`);
    assert.equal(eventModule.eventChoicesWithHistory(event).length, event.choices.length, event.id);
  }
});

test('events: src/content/events.js is a shim with no event literal', () => {
  const text = readFileSync(resolve(ROOT, 'src/content/events.js'), 'utf8');
  assert.ok(!/\{\s*id\s*:/.test(text), 'events.js authors a row (`{ id:`) — edit content/source/events.json instead');
  assert.ok(!/^\s*(name|label|resultText)\s*:/m.test(text), 'events.js authors event text — edit content/source/events.json instead');
  for (const name of ['events', ...EVENT_TABLES]) {
    assert.match(text, new RegExp(`from './generated/${name}\\.js'`));
  }
});

test('the generated modules are current (content-build --check exits 0)', () => {
  const r = spawnSync(process.execPath, ['tools/content-build.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `content-build --check:\n${r.stdout}\n${r.stderr}`);
});
