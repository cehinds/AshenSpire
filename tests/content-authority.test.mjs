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
import { rogueCards } from '../src/content/cards/rogue.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { act2Enemies } from '../src/content/enemies/act2.js';
import { act3Enemies } from '../src/content/enemies/act3.js';
import { classes, LOCKED_CLASSES } from '../src/content/classes.js';
import { contentBundle } from '../src/content/index.js';
import { combatExpansionLore } from '../src/content/combatExpansionLore.js';
import { combatExpansionEquipment } from '../src/content/combatExpansionEquipment.js';
import { combatExpansionCardOverlay, combatExpansionSpellProfiles, combatExpansionNewCards } from '../src/content/combatExpansionCards.js';
import { combatExpansionCardTables } from '../src/content/generated/combatExpansionCardTables.js';
import { combatExpansionMartialOverlay } from '../src/content/combatExpansionMartial.js';
import { combatExpansionMartialTables } from '../src/content/generated/combatExpansionMartialTables.js';
import { attributes, creationModes, attributeRules } from '../src/content/attributes.js';
import { derivedStatRules } from '../src/content/derivedStats.js';
import * as actionCostsModule from '../src/content/actionCosts.js';

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

// Cards: seven class/armament pools are JSON under content/source/cards, named for the
// export they compile to. coop.js holds builder functions and stays JS.
// None of the old pools was frozen, and none is now.
const CARD_POOLS = {
  herald: ['heraldCards', heraldCards],
  reaver: ['reaverCards', reaverCards],
  starseer: ['starseerCards', starseerCards],
  armaments: ['armamentCards', armamentCards],
  colorless: ['colorlessCards', colorlessCards],
  corrupted: ['corruptedCards', corruptedCards],
  rogue: ['rogueCards', rogueCards],
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

test('cards: the shim for a builder pool (coop) still authors its cards in JS', () => {
  for (const file of ['coop']) {
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
  combatExpansionEquipment: [combatExpansionEquipment, 'combatExpansionEquipment'],
  combatExpansionMartialOverlay: [combatExpansionMartialOverlay, 'combatExpansionMartial'],
  combatExpansionMartialTables: [combatExpansionMartialTables, 'combatExpansionMartial'],
  combatExpansionCardOverlay: [combatExpansionCardOverlay, 'combatExpansionCards'],
  combatExpansionSpellProfiles: [combatExpansionSpellProfiles, 'combatExpansionCards'],
  combatExpansionCardTables: [combatExpansionCardTables, 'combatExpansionCards'],
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

// The expansion's colorless counters and cantrips are a card pool: JSON under
// content/source/cards, re-exported by combatExpansionCards.js (which keeps the projection).
test('expansion cards: combatExpansionNewCards deep-equals content/source/cards/combatExpansionNewCards.json', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/cards/combatExpansionNewCards.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0, 'combatExpansionNewCards.json is a non-empty array');
  assert.deepStrictEqual(combatExpansionNewCards, authored);
  assert.equal(new Set(authored.map((card) => card.id)).size, authored.length, 'card ids are unique');
  assert.ok(authored.every((card) => card.minCombatExpansionVersion === 2), 'every row is a version 2 card');
  assert.equal(Object.isFrozen(combatExpansionNewCards), false);
  const text = readFileSync(resolve(ROOT, 'src/content/combatExpansionCards.js'), 'utf8');
  assert.match(text, /from '\.\/generated\/cards\/combatExpansionNewCards\.js'/);
  assert.ok(!/^const (counter|cantrip) = \(/m.test(text), 'the counter and cantrip row builders are gone: edit the JSON rows');
});

// Progression: the constant tables are authored in content/source/progression*.json.
// Each module still derives from other content in JS (lessons, cards, feat
// descriptions, item-gate unlock rows), so only the data-only modules must be shims.
const PROGRESSION_SOURCES = {
  cardFamilies: [['progressionCardFamilies', 'cardFamilies']],
  cardLore: [['progressionCardLore', 'progressionCardLore']],
  gear: [['progressionGearRequirements', 'progressionGearRequirements']],
  relics: [['progressionRelics', 'progressionRelics'], ['progressionRelicUnlocks', 'progressionRelicUnlocks']],
};
for (const [file, sources] of Object.entries(PROGRESSION_SOURCES)) {
  test(`progression: ${file}.js re-exports its JSON source and authors no row`, async () => {
    const mod = await import(`../src/content/progression/${file}.js`);
    const text = readFileSync(resolve(ROOT, `src/content/progression/${file}.js`), 'utf8');
    for (const [source, exportName] of sources) {
      const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/${source}.json`), 'utf8'));
      assert.deepStrictEqual(JSON.parse(JSON.stringify(mod[exportName])), authored, `${exportName} deep-equals ${source}.json`);
      assert.match(text, new RegExp(`from '\\.\\./generated/${source}\\.js'`));
    }
    assert.ok(!/\{\s*(id|classId)\s*:/.test(text) && !/^\s*["']?(name|id|classId|ref)["']?\s*:/m.test(text), `${file}.js authors a row — edit content/source/ instead`);
  });
}

test('progression: feats, unlocks, lessons and cards keep their derivations in JS over generated rows', async () => {
  const read = (f) => readFileSync(resolve(ROOT, `src/content/progression/${f}.js`), 'utf8');
  assert.match(read('feats'), /getFeatDescription/);
  assert.match(read('feats'), /generated\/progressionFeatRows\.js/);
  assert.match(read('unlocks'), /ARMAMENTS/);
  assert.match(read('unlocks'), /generated\/progressionUnlockRows\.js/);
  assert.match(read('lessons'), /generated\/progressionLessonRecipes\.js/);
  assert.match(read('cards'), /generated\/progressionGradeRules\.js/);
  const { progressionFeats, progressionFeatUnlocks } = await import('../src/content/progression/feats.js');
  assert.ok(Object.isFrozen(progressionFeats) && Object.isFrozen(progressionFeatUnlocks));
  assert.ok(progressionFeats.every((feat) => typeof feat.description === 'string' && feat.description.length > 0));
});

test('the generated modules are current (content-build --check exits 0)', () => {
  const r = spawnSync(process.execPath, ['tools/content-build.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `content-build --check:\n${r.stdout}\n${r.stderr}`);
});

// Stats tables (cleanup plan step 5): attributes, creation modes, attribute presets, derived-stat rules and the
// action-cost tunables are JSON under content/source; the old modules are shims. equipment.js is the exception: it holds
// normalisers and lookups over generated CSV tables (no data of its own), so it stays JS.
const STATS_TABLES = { attributes, creationModes, attributeRules, derivedStatRules };
for (const [name, exported] of Object.entries(STATS_TABLES)) {
  test(`stats tables: ${name} deep-equals content/source/${name}.json`, () => {
    assert.deepStrictEqual(exported, readJson(name));
  });
}

test('stats tables: actionCosts.json holds one key per data export, and each export deep-equals it', () => {
  const authored = readJson('actionCosts');
  for (const [key, value] of Object.entries(authored)) assert.deepStrictEqual(actionCostsModule[key], value, key);
  const derived = new Set(['TWO_COST_EFFECT_MULTIPLIER']);
  assert.deepStrictEqual(Object.keys(actionCostsModule).filter((key) => !derived.has(key)).sort(), Object.keys(authored).sort());
  assert.equal(actionCostsModule.TWO_COST_EFFECT_MULTIPLIER, authored.COST_BUDGET.twoCostMultiplier);
});

test('stats tables: the shims import the generated modules and author no data', () => {
  for (const [file, generated] of [['attributes', ['attributes', 'creationModes', 'attributeRules']], ['derivedStats', ['derivedStatRules']], ['actionCosts', ['actionCosts']]]) {
    const text = readFileSync(resolve(ROOT, `src/content/${file}.js`), 'utf8');
    for (const name of generated) assert.match(text, new RegExp(`from './generated/${name}\\.js'`), `${file}.js imports generated/${name}.js`);
    assert.ok(!/^\s*(id|label|base|weight)\s*:/m.test(text), `${file}.js authors a data row — edit content/source instead`);
  }
});

test('stats tables: equipment.js still stays JS (normalisers over generated tables, no rows of its own)', () => {
  const text = readFileSync(resolve(ROOT, 'src/content/equipment.js'), 'utf8');
  assert.match(text, /from '\.\/generated\/weapons\.js'/);
  assert.ok(!/^\s*\{\s*id\s*:/m.test(text), 'equipment.js authors a row — edit the CSV under content/source instead');
});

test('stats tables: the action-cost constants keep the freeze depth they had', () => {
  const isDeep = (v) => !v || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(isDeep));
  for (const key of ['COST_BUDGET', 'KEYWORD_TAGS', 'RANGE_TAGS', 'ENEMY_SP_BANDS', 'ACTION_COST_TABLE']) assert.ok(isDeep(actionCostsModule[key]), `${key} is deeply frozen`);
  assert.ok(Object.isFrozen(actionCostsModule.COST_TAGS), 'COST_TAGS is frozen');
  assert.equal(Object.isFrozen(actionCostsModule.COST_TAGS['camp:spell']), false, 'COST_TAGS rows were never frozen');
});

// Plan row 9b, batch A: data-only modules moved from JS to content/source JSON.
import { sigils } from '../src/content/sigils.js';
test('sigils: the export deep-equals the authored JSON array', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/sigils.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0);
  assert.deepStrictEqual(sigils, authored);
});

import { feats } from '../src/content/feats.js';
test('feats: the export deep-equals the authored JSON array', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/feats.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0);
  assert.deepStrictEqual(feats, authored);
});

import { classSkillFeats } from '../src/content/classSkillFeats.js';
test('classSkillFeats: the export deep-equals the authored JSON array', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/classSkillFeats.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0);
  assert.deepStrictEqual(classSkillFeats, authored);
});

import { skillFeats } from '../src/content/skillFeats.js';
test('skillFeats: the export deep-equals the authored JSON array', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/skillFeats.json'), 'utf8'));
  assert.ok(Array.isArray(authored) && authored.length > 0);
  assert.deepStrictEqual(skillFeats, authored);
});

import { surveyQuestLore } from '../src/content/surveyQuestLore.js';
test('surveyQuestLore: the export deep-equals the authored JSON and stays frozen at both depths', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/surveyQuestLore.json'), 'utf8'));
  assert.deepStrictEqual(surveyQuestLore, authored);
  assert.ok(Object.isFrozen(surveyQuestLore));
  for (const entry of Object.values(surveyQuestLore)) assert.ok(Object.isFrozen(entry));
});

import { withNotes } from '../src/content/noteKeys.js';
import { combatIntent, combatMatchups, combatExpansionMatchups } from '../src/content/combatMatchups.js';
for (const [name, exported] of Object.entries({ combatIntent, combatMatchups, combatExpansionMatchups })) {
  test(`${name}: the export deep-equals the authored JSON (with its NOTE blocks)`, () => {
    const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/${name}.json`), 'utf8'));
    assert.deepStrictEqual(exported, withNotes(authored));
  });
}

import { mapConfigs, MAP_SHAPE_LIMITS, LEGACY_ACT_BOSSES } from '../src/content/mapconfig.js';
test('mapconfig: the three tables deep-equal their authored JSON and keep their frozen state', () => {
  const read = (name) => JSON.parse(readFileSync(resolve(ROOT, `content/source/${name}.json`), 'utf8'));
  assert.deepStrictEqual(MAP_SHAPE_LIMITS, read('mapShapeLimits'));
  assert.deepStrictEqual(LEGACY_ACT_BOSSES, read('legacyActBosses'));
  assert.deepStrictEqual(mapConfigs, { 1: read('mapActShape'), 2: read('mapActShape'), 3: read('mapActShape') });
  assert.ok(Object.isFrozen(MAP_SHAPE_LIMITS) && Object.isFrozen(LEGACY_ACT_BOSSES));
  assert.ok(!Object.isFrozen(mapConfigs) && mapConfigs[1] !== mapConfigs[2]);
});

// Plan row 9b, batch B: the next five modules.
import { DIFFICULTY_MODS, CHAOS_MODS, DECK_MODES, ASCENSION_ORDER, MAX_ASCENSION } from '../src/content/customMods.js';
test('customMods: the four tables deep-equal their authored JSON; MAX_ASCENSION stays computed', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/customMods.json'), 'utf8'));
  assert.deepStrictEqual(DIFFICULTY_MODS, authored.difficultyMods);
  assert.deepStrictEqual(CHAOS_MODS, authored.chaosMods);
  assert.deepStrictEqual(DECK_MODES, authored.deckModes);
  assert.deepStrictEqual(ASCENSION_ORDER, authored.ascensionOrder);
  assert.equal(MAX_ASCENSION, authored.ascensionOrder.length);
  assert.ok([DIFFICULTY_MODS, CHAOS_MODS, DECK_MODES, ASCENSION_ORDER].every((t) => !Object.isFrozen(t)), 'these tables were never frozen');
});

import { SEATS, CAUSEWAY_REGION_ID } from '../src/content/seats.js';
test('seats: SEATS and CAUSEWAY_REGION_ID deep-equal the authored JSON; the array is frozen, its rows are not', () => {
  const authored = JSON.parse(readFileSync(resolve(ROOT, 'content/source/seats.json'), 'utf8'));
  assert.deepStrictEqual(SEATS, authored.seats);
  assert.equal(CAUSEWAY_REGION_ID, authored.causewayRegionId);
  assert.ok(Object.isFrozen(SEATS) && SEATS.every((row) => !Object.isFrozen(row)));
});

import * as combatFeelModule from '../src/content/combatFeel.js';
test('combatFeel: the tables deep-equal their authored JSON, stay frozen to the row, and keep the numbers that must agree', () => {
  const a = JSON.parse(readFileSync(resolve(ROOT, 'content/source/combatFeel.json'), 'utf8'));
  const m = combatFeelModule;
  assert.deepStrictEqual(m.SHAKE_STEPS, a.shakeSteps);
  assert.deepStrictEqual(m.SHAKE_STEPS_HP, a.shakeStepsHp);
  assert.deepStrictEqual(m.HIT_STOP, a.hitStop);
  assert.deepStrictEqual([m.BIG_HIT_SHARE, m.HUGE_HIT_SHARE, m.SHAKE_MAX_PX, m.SHAKE_FLOOR_PX], [a.bigHitShare, a.hugeHitShare, a.shakeMaxPx, a.shakeFloorPx]);
  for (const table of [m.SHAKE_STEPS, m.SHAKE_STEPS_HP]) assert.ok(Object.isFrozen(table) && table.every(Object.isFrozen));
  assert.ok(Object.isFrozen(m.HIT_STOP));
  // These were one constant each in the old module, so they cannot be allowed to drift.
  assert.equal(m.SHAKE_STEPS.find((step) => step.px === 7).minShare, m.BIG_HIT_SHARE);
  assert.equal(m.SHAKE_STEPS.find((step) => step.px === 10).minShare, m.HUGE_HIT_SHARE);
  assert.equal(m.HIT_STOP.hugeShare, m.HUGE_HIT_SHARE);
});

import * as musicModule from '../src/content/music.js';
import { MUSIC_SILENCE_WORD } from '../src/model/schemas.js';
test('music: the tables deep-equal their authored JSON; quiet leads BEDS and the region beds share the map bed', () => {
  const a = JSON.parse(readFileSync(resolve(ROOT, 'content/source/music.json'), 'utf8'));
  const m = musicModule;
  assert.equal(m.SHIPPED_MUSIC_FOLDER, a.shippedMusicFolder);
  assert.deepStrictEqual(m.SCALES, a.scales);
  assert.deepStrictEqual(m.MAP_REGIONS, a.mapRegions);
  assert.equal(Object.keys(m.BEDS)[0], 'quiet');
  assert.equal(m.BEDS.quiet, MUSIC_SILENCE_WORD);
  assert.ok(!('quiet' in a.beds), 'the silence word has one home (MUSIC_SILENCE_WORD), not the JSON');
  for (const [name, bed] of Object.entries(a.beds)) assert.deepStrictEqual(m.BEDS[name], bed);
  assert.deepStrictEqual(Object.keys(m.BEDS), ['quiet', ...Object.keys(a.beds), ...a.mapRegions.map((id) => `map-${id}`)]);
  for (const id of a.mapRegions) {
    assert.equal(m.BEDS[`map-${id}`], m.BEDS.map);
    assert.equal(m.MUSIC_TRACK_FALLBACK[`map-${id}`], 'map');
  }
});
