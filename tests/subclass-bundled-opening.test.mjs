import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';

// The real shipped compiler/loader executes main's imports in their actual
// order. ESM unit tests preserve live bindings and masked the captured
// openingWeaponArtRef/resolveCard failures in the generated classic bundle.
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { validateContent } = require('src/model/validate.js');
const { createRunState } = require('src/model/state.js');
const { startingAbilityPlan } = require('src/model/startingAbilities.js');
const { subclassDeckPreview } = require('src/model/subclassDeck.js');
const { creationDraftStartingDeck } = require('src/ui/models/CreationSubclassModel.js');
const { stampDeck } = require('src/model/loadout.js');
const { runClassIdentity } = require('src/model/classCard.js');
const registries = createRegistries(contentBundle);

test('main production import order leaves bundled content validation usable', () => {
  const result = validateContent(contentBundle);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

for (const def of registries.subclasses.all()) test(`main-initialized bundle creates and previews ${def.name}'s eleven-card opening`, () => {
  const options = { registries, seed: 42, classId: def.classId, subclassId: def.id, enemyKnowledgeVersion: null };
  const run = createRunState(options);
  assert.equal(run.deck.length, 11);
  for (const [source, count] of [['subclass',5],['class',1],['weaponArt',1],['basic',4]]) {
    assert.equal(run.deck.filter(card => card.openingSource === source).length, count);
  }
  assert.equal(runClassIdentity(registries, run).name, def.name);
  assert.equal(subclassDeckPreview(registries, run).length, 11);
  assert.equal(creationDraftStartingDeck(registries, run, []).length, 11);
  const plan = startingAbilityPlan(registries, run);
  const ids = plan.choices.slice(0, plan.count).map(card => card.id);
  assert.equal(creationDraftStartingDeck(registries, run, ids.slice(0, 1)).length, 11);
  const chosen = createRunState({ ...options, startingAbilityIds: ids });
  assert.equal(chosen.deck.length, 11);
  for (const id of ids) assert.ok(chosen.deck.some(card => card.cardId === id && card.abilityRank === 1));
  stampDeck(registries, chosen);
  assert.equal(chosen.deck.length, 11);
});
