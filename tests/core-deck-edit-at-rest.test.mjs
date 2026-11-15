// Core 2 edits the deck only at a rest site (cards.editorWhere 'rest'), as a free door, and mints no unlimited basics.
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { noncombatEditing, armouryOpensDeckEditor, RestOpensDeckEditor } from '../src/model/armouryRules.js';
import { unlimitedCardIds } from '../src/model/deckRules.js';
import { configuredDeckCopyLimit } from '../src/model/deckCopyLimit.js';
import { openDeckEdit } from '../src/ui/models/DeckEditorModel.js';
import { beginGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

const bind = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const core = resolveGameProfile('core');
const coreRegistries = bind(core);
const OLD_RULES = JSON.parse(readFileSync(new URL('./fixtures/legacy-core-unlimited-rules.json', import.meta.url), 'utf8'));
// The pre-rest Core: editorWhere 'noncombat' and the two unlimited training rules.
const legacy = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { cards: { editorWhere: 'noncombat' }, 'deck-training': { unlimited: OLD_RULES } } });
const legacyRegistries = bind(legacy);
const make = (profile, registries) => createRunState({ seed: 7, classId: 'reaver', registries, runId: 'deck-edit-at-rest' });
const owned = (run, id) => [...run.deck, ...(run.sideboard || [])].filter(card => card.cardId === id).length;

test('shipped Core: noncombat equipment rules, no Armoury deck door, a rest deck door', () => {
  const run = make(core, coreRegistries);
  assert.equal(noncombatEditing(run), true);
  assert.equal(armouryOpensDeckEditor(run, {}), false);
  assert.equal(RestOpensDeckEditor(run), true);
});

test('shipped Core Reaver: no unlimited basics; a card has only the copies the run owns', () => {
  const run = make(core, coreRegistries);
  assert.deepEqual(unlimitedCardIds(run), []);
  assert.equal(configuredDeckCopyLimit(run, 'core.strike'), owned(run, 'core.strike'));
  const session = openDeckEdit(coreRegistries, run);
  const before = owned(run, 'core.strike');
  let refused = false;
  try { refused = session.add('basic:core.strike').ok === false; } catch { refused = true; }
  assert.equal(refused, true, 'a spare copy cannot be minted');
  assert.equal(owned(run, 'core.strike'), before);
});

test('legacy fixture (noncombat + the old unlimited rules): Armoury door, Strike unlimited, as before', () => {
  const run = make(legacy, legacyRegistries);
  assert.equal(armouryOpensDeckEditor(run, {}), true);
  assert.equal(RestOpensDeckEditor(run), false);
  assert.equal(configuredDeckCopyLimit(run, 'core.strike'), Infinity);
  assert.ok(unlimitedCardIds(run).includes('core.strike'));
});

test('the Core rest component offers the deck-opt door, which is not a service and leaves the visit unspent', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/ui/components/gameProfileRest.js', import.meta.url), 'utf8');
  assert.match(main, /deckEditor: deckDoors\(\)\.rest \? \{ onOpen: \(\) => showDeckEditor\(\(\) => showRest\(\), true, null, 'shrine'\) \} : null/);
  assert.match(main, /if \(RestOpensDeckEditor\(run\)\) return Object\.freeze\(\{ armoury: false, rest: deckEditingOn\(settings\) \}\)/);
  assert.match(component, /id: 'deck-opt'/);
  // The door calls only deckEditor.onOpen: no commit, no visit write.
  const door = component.slice(component.indexOf("id: 'deck-opt'"));
  assert.match(door, /deckEditor\.onOpen\(\)/);
  assert.doesNotMatch(door.slice(0, door.indexOf('// The recovery ledger')), /onCommit|commit\(|visit\.service/);
  const run = make(core, coreRegistries);
  run.mapGraph = buildActMap(coreRegistries, createRng(7), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id;
  const visit = beginGameProfileRest(run, '1:' + run.mapNodeId);
  assert.equal(visit.service, null);
});

test('profile validation accepts editorWhere "rest" and rejects an unknown value', () => {
  const catalog = loadGameProfileCatalog();
  const resolve = editorWhere => resolveGameAuthor({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { cards: { editorWhere } } }, catalog);
  assert.doesNotThrow(() => resolve('rest'));
  assert.throws(() => resolve('anywhere'));
});
