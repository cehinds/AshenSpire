// Wave 2 (wording): one word for one thing. Players saw two names for the same thing (Armory/Armoury, SP/Stamina,
// Back/Back to Saves, Quick menu/Menu ...). This scans the generated interface strings and the shipped Core 2 card,
// relic and event text for the losing spellings, and pins the one rule for the character's printed name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { uiStrings } from '../src/content/generated/uiStrings.js';
import { CharacterDisplayName } from '../src/model/characterName.js';

const TEXT_KEYS = new Set(['name', 'text', 'textTemplate', 'flavor', 'description', 'tooltip', 'label', 'title', 'short', 'full', 'tip', 'summary', 'blurb', 'resultText', 'prompt']);
const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

// Every string a player can read under a text-bearing key, with where it lives. `provenance` holds the approved source
// proposal digests of the base-card pack: it is never shown, and rewording it breaks its digest.
function playerText(value, where, out = []) {
  if (Array.isArray(value)) value.forEach((item, at) => playerText(item, `${where}[${at}]`, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'provenance') continue;
      if (typeof item === 'string' && TEXT_KEYS.has(key)) out.push({ where: `${where}.${key}`, text: item });
      else playerText(item, `${where}.${key}`, out);
    }
  }
  return out;
}

const interfaceText = uiStrings.flatMap(row => ['short', 'full', 'tip'].map(field => ({ where: `${row.id}.${field}`, text: row[field] || '' })));
const contentText = [
  'games/ashenspire/packs/core/cards.json', 'games/ashenspire/packs/core/enemyCards.json', 'games/ashenspire/packs/core/enemyRelics.json',
  'games/ashenspire/packs/base-cards/cards.json', 'content/source/relics.json', 'content/source/events.json',
  'content/source/statuses.json', 'content/source/act2Enemies.json',
].flatMap(path => playerText(json(path), path));
const everything = [...interfaceText, ...contentText];

const offenders = (pattern, rows = everything) => rows.filter(row => pattern.test(row.text)).map(row => `${row.where}: ${row.text.slice(0, 80)}`);

test('Armoury and Armour are spelled the British way wherever a player reads them', () => {
  assert.deepEqual(offenders(/\bArmory\b/i), []);
  assert.deepEqual(offenders(/\bArmor\b/i), []);
});

test('Block is the resource: no Guard where the words mean Block', () => {
  const rows = interfaceText.filter(row => /\b(Block|Guard)\b/.test(row.text));
  assert.deepEqual(offenders(/\bfull Guard\b|GUARD BREAK/, rows), []);
});

test('Stamina and Mana are never abbreviated to SP or MP', () => {
  assert.deepEqual(offenders(/\b(SP|MP)\b/, interfaceText), []);
});

test('every return control reads Back, never Back to a place', () => {
  const back = interfaceText.filter(row => /^(common\.backTo|smith\.back\.shrine|deckEditor\.back|armoury\.destination\.back|creation\.feats\.return)\./.test(row.where) && /\.short$/.test(row.where));
  assert.ok(back.length >= 5);
  for (const row of back) assert.equal(row.text, 'Back', row.where);
  const source = readFileSync(new URL('../src/ui/components/saveSlotSelector.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /back: 'Back to /);
});

test('Confirm commits a selection and Continue leaves a finished screen, in sentence case', () => {
  assert.deepEqual(offenders(/^(CHOOSE|CONFIRM|CONTINUE|Accept)$/, interfaceText), []);
  for (const file of ['src/ui/components/holdconfirm.js', 'src/ui/models/SaveSlotSelectionModel.js']) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), /(confirmLabel = |label: )'(CONFIRM|CONTINUE)'/, file);
  }
});

test('the menu control is Menu everywhere, never Quick menu', () => {
  assert.deepEqual(offenders(/\bQuick menu\b/i, interfaceText), []);
  const row = uiStrings.find(entry => entry.id === 'common.menu');
  assert.equal(row.short, 'Menu');
});

test('the rest site has one name, and it is the one SPEC.md uses', () => {
  assert.deepEqual(offenders(/Shrine of Ember(?!light)/), []);
  assert.equal(uiStrings.find(row => row.id === 'location.shrine.title').short, 'Shrine of Emberlight');
  assert.equal(json('content/config/ui/presentation/uiContent.json').nodeTypes?.rest?.name ?? 'Shrine of Emberlight', 'Shrine of Emberlight');
});

test('no shipped-profile help says attacks roll to hit or that intents can be hidden or guessed', () => {
  assert.deepEqual(offenders(/hit chance|roll to hit|rolls to hit|chance to hit/i, interfaceText), []);
  const tutorial = readFileSync(new URL('../src/ui/components/tutorial.js', import.meta.url), 'utf8');
  assert.doesNotMatch(tutorial, /unknown action|broad clue|exact read/);
  assert.match(tutorial, /Every enemy move is shown/);
  assert.deepEqual(offenders(/intent read|improves intent/i, interfaceText), []);
});

test('only one card is named Evade; the base-pack twin is Sidestep', () => {
  const names = [...json('games/ashenspire/packs/core/cards.json').cards ?? json('games/ashenspire/packs/core/cards.json')].map(card => card.name);
  assert.equal(names.filter(name => name === 'Evade').length, 1);
  const twin = json('games/ashenspire/packs/base-cards/cards.json').cards.find(card => card.definition.id === 'base.evade');
  assert.equal(twin.definition.name, 'Sidestep');
  assert.equal(names.includes('Sidestep'), false);
});

test('the character name: a typed name wins, otherwise the class name, and a stored Forsaken counts as not typed', () => {
  assert.equal(CharacterDisplayName('Mira', 'Reaver'), 'Mira');
  assert.equal(CharacterDisplayName('  Mira  ', 'Reaver'), 'Mira');
  assert.equal(CharacterDisplayName('', 'Reaver'), 'Reaver');
  assert.equal(CharacterDisplayName(undefined, 'Reaver'), 'Reaver');
  assert.equal(CharacterDisplayName(null, 'Reaver'), 'Reaver');
  assert.equal(CharacterDisplayName('Forsaken', 'Reaver'), 'Reaver');
  assert.equal(CharacterDisplayName(' forsaken ', 'Reaver'), 'Reaver');
  assert.equal(CharacterDisplayName('Forsaken Wren', 'Reaver'), 'Forsaken Wren');
});
