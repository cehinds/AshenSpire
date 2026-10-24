// The content-authority flip (owner, 2026-10-17): relics, stances, flasks and the
// authored statuses, events and the six class/armament card pools are authored as JSON under content/source;
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
import { heraldCards } from '../src/content/cards/herald.js';
import { reaverCards } from '../src/content/cards/reaver.js';
import { starseerCards } from '../src/content/cards/starseer.js';
import { armamentCards } from '../src/content/cards/armaments.js';
import { colorlessCards } from '../src/content/cards/colorless.js';
import { corruptedCards } from '../src/content/cards/corrupted.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { act2Enemies } from '../src/content/enemies/act2.js';
import { act3Enemies } from '../src/content/enemies/act3.js';
import { classes, LOCKED_CLASSES } from '../src/content/classes.js';
import { contentBundle } from '../src/content/index.js';
import { combatExpansionLore } from '../src/content/combatExpansionLore.js';

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

// Cards: six class/armament pools are JSON under content/source/cards, named for the
// export they compile to. rogue.js and coop.js hold builder functions and stay JS.
// None of the old pools was frozen, and none is now.
const CARD_POOLS = {
  herald: ['heraldCards', heraldCards],
  reaver: ['reaverCards', reaverCards],
  starseer: ['starseerCards', starseerCards],
  armaments: ['armamentCards', armamentCards],
  colorless: ['colorlessCards', colorlessCards],
  corrupted: ['corruptedCards', corruptedCards],
};

for (const [file, [exportName, exported]] of Object.entries(CARD_POOLS)) {
  test(`cards: ${exportName} deep-equals content/source/cards/${exportName}.json`, () => {
    const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/cards/${exportName}.json`), 'utf8'));
    assert.ok(Array.isArray(authored) && authored.length > 0, `${exportName}.json is a non-empty array`);
    assert.deepStrictEqual(exported, authored);
    assert.equal(new Set(authored.map((card) => card.id)).size, authored.length, `${exportName}: card ids are unique`);
  });

  test(`cards: src/content/cards/${file}.js is a shim with no card literal`, () => {
    const text = readFileSync(resolve(ROOT, `src/content/cards/${file}.js`), 'utf8');
    assert.ok(!/\{\s*id\s*:/.test(text), `${file}.js authors a card (\`{ id:\`) — edit content/source/cards/${exportName}.json instead`);
    assert.ok(!/^\s*(name|id|flavor|textTemplate)\s*:/m.test(text), `${file}.js authors a card field — edit content/source/cards/${exportName}.json instead`);
    assert.match(text, new RegExp(`from '\\.\\./generated/cards/${exportName}\\.js'`));
    assert.ok(text.split('\n').filter((line) => line && !line.startsWith('//')).length <= 4, `${file}.js is more than an import and an export`);
  });
}

test('cards: the pools keep the freeze depth they had (unfrozen, top level and rows)', () => {
  for (const [, [exportName, exported]] of Object.entries(CARD_POOLS)) {
    assert.equal(Object.isFrozen(exported), false, `${exportName} is not frozen`);
    assert.equal(Object.isFrozen(exported[0]), false, `${exportName}[0] is not frozen`);
  }
});

test('cards: the shim for a builder pool (rogue, coop) still authors its cards in JS', () => {
  for (const file of ['rogue', 'coop']) {
    const text = readFileSync(resolve(ROOT, `src/content/cards/${file}.js`), 'utf8');
    assert.ok(!/generated\/cards\//.test(text), `${file}.js holds builder functions and stays JS`);
  }
});

// Enemies and classes: act1-3Enemies.json and classes.json sit at the top of
// content/source (the file name is the export name). The old files are shims.
const ENEMY_ACTS = { act1: act1Enemies, act2: act2Enemies, act3: act3Enemies };

for (const [act, exported] of Object.entries(ENEMY_ACTS)) {
  const exportName = `${act}Enemies`;
  test(`enemies: ${exportName} deep-equals content/source/${exportName}.json`, () => {
    const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/${exportName}.json`), 'utf8'));
    assert.ok(Array.isArray(authored) && authored.length > 0, `${exportName}.json is a non-empty array`);
    assert.deepStrictEqual(exported, authored);
  });

  test(`enemies: src/content/enemies/${act}.js is a shim with no enemy literal`, () => {
    const text = readFileSync(resolve(ROOT, `src/content/enemies/${act}.js`), 'utf8');
    assert.ok(!/\{\s*id\s*:/.test(text), `${act}.js authors a row (\`{ id:\`) — edit content/source/${exportName}.json instead`);
    assert.ok(!/^\s*name\s*:/m.test(text), `${act}.js authors a \`name:\` line — edit content/source/${exportName}.json instead`);
    assert.match(text, new RegExp(`from '\\.\\./generated/${exportName}\\.js'`));
  });
}

test('enemies: the three acts still compose the 33-enemy roster', () => {
  assert.equal(contentBundle.enemies.length, 33);
});

test('classes: the export deep-equals content/source/classes.json', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/classes.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0, 'classes.json is a non-empty array');
  assert.deepStrictEqual(classes, authored);
});

test('classes: src/content/classes.js is a shim; LOCKED_CLASSES stays an empty JS export', () => {
  const text = readFileSync(resolve(ROOT, 'src/content/classes.js'), 'utf8');
  assert.ok(!/\{\s*id\s*:/.test(text), 'classes.js authors a row (`{ id:`) — edit content/source/classes.json instead');
  assert.ok(!/^\s*name\s*:/m.test(text), 'classes.js authors a `name:` line — edit content/source/classes.json instead');
  assert.match(text, /from '\.\/generated\/classes\.js'/);
  assert.deepStrictEqual(LOCKED_CLASSES, []);
});

// Combat expansion tables: top-level tables whose file name is the export name.
// The combatExpansion*.js module re-exports each one; any logic in the module stays JS.
const EXPANSION_TABLES = {
  combatExpansionLore: [combatExpansionLore, 'combatExpansionLore'],
};

for (const [name, [exported, moduleName]] of Object.entries(EXPANSION_TABLES)) {
  test(`expansion tables: ${name} deep-equals content/source/${name}.json`, () => {
    const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/${name}.json`), 'utf8'));
    assert.ok(authored && typeof authored === 'object' && Object.keys(authored).length > 0, `${name}.json is non-empty`);
    assert.deepStrictEqual(exported, authored);
  });

  test(`expansion tables: ${moduleName}.js imports ${name} from generated/ and authors no row`, () => {
    const text = readFileSync(resolve(ROOT, `src/content/${moduleName}.js`), 'utf8');
    assert.match(text, new RegExp(`from '\\./generated/${name}\\.js'`));
  });
}

test('the generated modules are current (content-build --check exits 0)', () => {
  const r = spawnSync(process.execPath, ['tools/content-build.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `content-build --check:\n${r.stdout}\n${r.stderr}`);
});
