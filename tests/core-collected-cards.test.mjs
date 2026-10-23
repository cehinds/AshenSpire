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

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const live = () => createRunState({ registries, seed: 511, classId: 'reaver' });

test('Core collection knowledge survives acquisition and last removal before any save', () => {
  const run = live();
  assert.deepEqual(run.collectedCardIds, ['core.strike', 'core.defend', 'core.counter', 'core.reaverSpecial']);
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
