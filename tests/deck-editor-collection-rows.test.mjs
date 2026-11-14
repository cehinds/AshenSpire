import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { deckEditorModel, openDeckEdit } from '../src/ui/models/DeckEditorModel.js';
import { deckEditorCollectionRows } from '../src/ui/models/deckEditorCollectionRows.js';
import { legacyCoreProfile } from './helpers/legacy-core-profile.mjs';
// 'legacy-core' is the pre-rest Core (unlimited trained Basics); 'core' is the shipped one (owned copies only).
const fixture = id => {
  const profile = id === 'legacy-core' ? legacyCoreProfile() : resolveGameProfile(id);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const rows = () => deckEditorCollectionRows({ registries, run, collection: deckEditorModel({ registries, run }).collection });
  return { registries, run, rows };
};
test('the eleven-card core starter retains owned counts and exposes trained basics', () => {
  const { run, rows } = fixture('legacy-core');
  assert.equal(run.deck.length, 11);
  assert.deepEqual(rows().filter(row => row.inDeck > 0).map(row => row.cardId).sort(), [...new Set(run.deck.map(card => card.cardId))].sort());
  assert.equal(rows().reduce((sum, row) => sum + row.inDeck, 0), 11);
  // Owner ruling 2026-10-23: collected Basics are unlimited under Martial
  // Adept; uncollected cards remain hidden and actual deck counts stay exact.
  assert.equal(rows().find(row => row.cardId === 'core.strike').owned, Infinity);
  assert.equal(rows().find(row => row.cardId === 'core.strike').inDeck, 2);
  assert.equal(rows().some(row => row.cardId === 'core.evade'), false);
  assert.equal(rows().some(row => row.cardId === 'base.draw'), false);
});
