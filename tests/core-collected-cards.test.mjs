import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun, syncZones } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { removeDeckCard } from '../src/model/cardRemoval.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { unlimitedCardIds, addBasicCard, commitDeckEditDraft, moveToSideboard, deckCopyLimit } from '../src/model/deckRules.js';
import { deckEditorModel, openDeckEdit } from '../src/ui/models/DeckEditorModel.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const live = (classId = 'reaver') => createRunState({ registries, seed: 511, classId,
  profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const collect = (run, card) => executeRunEffects({ run, registries, rng: createRng(run.seed) }, [{ op: 'addCardToDeck', card }]);

test('Core collection knowledge survives acquisition and last removal before any save', () => {
  const run = live();
  // The lent weapon art is item-owned, so the ledger no longer starts with the class special.
  assert.deepEqual(run.collectedCardIds, ['core.strike', 'core.defend', 'core.counter']);
  executeRunEffects({ run, registries, rng: createRng(run.seed) }, [
    { op: 'addCardToDeck', card: 'core.cantrip' }, { op: 'removeCardFromDeck', card: 'core.cantrip' },
  ]);
  assert.ok(run.collectedCardIds.includes('core.cantrip'), 'knowledge is independent of current Martial entitlement');
  assert.ok(!run.deck.some(card => card.cardId === 'core.cantrip'));
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(run.seed));
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  assert.deepEqual(loaded.collectedCardIds, run.collectedCardIds);
  assert.ok(!loaded.collection.some(card => card.cardId === 'core.cantrip'), 'instance ownership remains a separate projection');
});

test('old Core saves backfill present loose cards without inventing history or learning grants', () => {
  const run = live();
  delete run.collectedCardIds;
  run.deck.push({ instanceId: 'temporary', cardId: 'core.cantrip', grantedBy: 'some-item', equipmentRole: 'granted' });
  run.sideboard.push({ instanceId: 'bound', cardId: 'core.manaSurge', equipmentRole: 'weaponArt' });
  const loaded = deserializeRun(JSON.stringify(run));
  assert.ok(!loaded.collectedCardIds.includes('core.cantrip'));
  assert.ok(!loaded.collectedCardIds.includes('core.manaSurge'));
  assert.ok(!loaded.collectedCardIds.includes('core.evade'));
  delete loaded.collectedCardIds;
  const counter = loaded.deck.find(card => card.cardId === 'core.counter');
  assert.equal(removeDeckCard(loaded, counter.instanceId), true);
  assert.ok(loaded.collectedCardIds.includes('core.counter'), 'an unsaved old run records the final copy before destruction');
});

test('invalid collection ledgers fail by name and non-Core saves retain their existing shape', () => {
  const run = live();
  for (const value of [null, ['missing'], ['core.strike', 'core.strike'], [1]]) {
    run.collectedCardIds = value;
    assert.ok(validateRunShape(run).some(problem => /collectedCardIds/.test(problem)));
    assert.throws(() => deserializeRun(JSON.stringify(run)), /collectedCardIds/);
  }
  const legacy = createRunState({ registries: createRegistries(contentBundle), seed: 511, classId: 'reaver' });
  const before = JSON.stringify(legacy);
  syncZones(legacy);
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(Object.hasOwn(legacy, 'collectedCardIds'), false);
  assert.equal(Object.hasOwn(deserializeRun(serializeRun(legacy)), 'collectedCardIds'), false);
});

for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) test(`${classId} mints only the collected card kind granted by its active Adept`, () => {
  const run = live(classId), martial = ['reaver', 'rogue'].includes(classId);
  const allowed = martial ? 'core.strike' : 'core.cantrip';
  const wrong = martial ? 'core.cantrip' : 'core.strike';
  collect(run, allowed); collect(run, wrong);
  const model = deckEditorModel({ registries, run });
  assert.equal(model.adept.label, martial ? 'Martial Adept' : 'Magic Adept');
  assert.ok(model.collection.some(tile => tile.key === `basic:${allowed}` && tile.unlimited));
  assert.ok(!model.collection.some(tile => tile.cardId === 'core.backstep'), 'an uncollected definition remains hidden');
  assert.ok(!unlimitedCardIds(run).includes(wrong));
  assert.equal(deckCopyLimit(registries, wrong, {}, run), run.deck.filter(card => card.cardId === wrong).length);
  const before = run.deck.filter(card => card.cardId === allowed).length;
  for (let i = 0; i < 8; i++) addBasicCard(registries, run, allowed, { plain: true, freshOnly: true });
  assert.equal(run.deck.filter(card => card.cardId === allowed).length, before + 8);
  assert.equal(new Set(run.deck.map(card => card.instanceId)).size, run.deck.length);
  assert.throws(() => addBasicCard(registries, run, wrong, { plain: true }), /not an unlimited/);
  assert.throws(() => addBasicCard(registries, run, 'core.backstep', { plain: true }), /not an unlimited/);
  run.classUnequipped = true;
  assert.deepEqual(unlimitedCardIds(run), []);
});

test('last-copy removal and a later class change retain known definitions without unlocking foreign specials or item grants', () => {
  const run = live('rogue');
  collect(run, 'core.cantrip'); collect(run, 'core.reaverSpecial');
  const cantrip = run.deck.find(card => card.cardId === 'core.cantrip');
  removeDeckCard(run, cantrip.instanceId);
  run.deck.push({ cardId: 'core.manaSurge', instanceId: 'equipment-only', equipmentRole: 'granted', grantedBy: 'boneSceptre' });
  syncZones(run);
  assert.ok(!run.collectedCardIds.includes('core.manaSurge'));
  assert.ok(!unlimitedCardIds(run).includes('core.reaverSpecial'), 'a foreign class special never matches generic starter rules');
  const knownTile = deckEditorModel({ registries, run }).collection.find(tile => tile.cardId === 'core.cantrip');
  assert.equal(knownTile.owned, 0);
  assert.equal(knownTile.addable, false);
  const loaded = deserializeRun(serializeRun(run));
  loaded.class = 'starseer';
  assert.ok(unlimitedCardIds(loaded).includes('core.cantrip'), 'entitlement follows the current saved class, not the collection-time class');
  addBasicCard(registries, loaded, 'core.cantrip', { plain: true });
  assert.throws(() => addBasicCard(registries, loaded, 'core.manaSurge', { plain: true }), /not an unlimited/);
});

test('minting keeps upgraded variants exact and Undo, Cancel and draft commits preserve ownership and bounds', () => {
  const run = live();
  run.sideboard.push({ cardId: 'core.strike', instanceId: 'enhanced', upgraded: true, mods: ['damage=8'], rank: 2 });
  const original = JSON.stringify(run);
  const settings = { deckMinUnlimited: true, deckMaxUnlimited: false, deckMaxSize: run.deck.length + 1 };
  const edited = structuredClone(run), session = openDeckEdit(registries, edited, settings);
  assert.equal(session.add('basic:core.strike').ok, true);
  const minted = edited.deck.at(-1);
  assert.deepEqual(Object.keys(minted).sort(), ['cardId', 'instanceId', 'upgraded']);
  assert.equal(minted.upgraded, false);
  assert.equal(edited.sideboard.find(card => card.instanceId === 'enhanced').mods[0], 'damage=8');
  assert.equal(session.undo().ok, true);
  assert.equal(JSON.stringify(edited), original);
  session.add('basic:core.strike'); session.add('basic:core.strike');
  assert.equal(session.confirm().ok, false, 'overall maximum remains authoritative at confirmation');
  session.undo();
  assert.equal(session.confirm().ok, true);
  commitDeckEditDraft(registries, run, edited, settings);
  assert.equal(run.deck.length, settings.deckMaxSize);
  const kept = deckEditorModel({ registries, run }).collection.find(tile => tile.key.startsWith('kept:'));
  const restore = openDeckEdit(registries, run, { deckMinUnlimited: true });
  assert.equal(restore.add(kept.key).ok, true);
  assert.deepEqual(run.deck.at(-1), { cardId: 'core.strike', instanceId: 'enhanced', upgraded: true, mods: ['damage=8'], rank: 2 });
  restore.cancel();
  assert.ok(run.sideboard.some(card => card.instanceId === 'enhanced'));
  const forged = structuredClone(run);
  forged.collectedCardIds.push('core.evade');
  assert.throws(() => commitDeckEditDraft(registries, run, forged, settings), /collection knowledge/);
  const uncollected = structuredClone(run);
  uncollected.deck.push({ instanceId: 'forged', cardId: 'core.evade', upgraded: false });
  assert.throws(() => commitDeckEditDraft(registries, run, uncollected, { deckMinUnlimited: true }), /invent/);
  run.sideboard.push({ cardId: 'core.strike', instanceId: 'graded', upgraded: false, abilityRank: 1 });
  const dropped = structuredClone(run);
  dropped.sideboard = dropped.sideboard.filter(card => card.instanceId !== 'graded');
  assert.throws(() => commitDeckEditDraft(registries, run, dropped, { deckMinUnlimited: true }), /delete an owned limited/);
});
