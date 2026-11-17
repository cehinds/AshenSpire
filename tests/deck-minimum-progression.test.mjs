// Owner, 2026-11-17 (playtest theme D, items 22-23): character levels and
// min-slot relics lower the deck editor's minimum in Core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { deckRules } from '../src/content/deckRules.js';
import { deckEditBounds, deckMinDelta, levelMinDeckDelta } from '../src/model/deckRules.js';
import { deckEditorModel } from '../src/ui/models/DeckEditorModel.js';

const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
const make = (level = 1) => {
  const run = createRunState({ seed: 11, classId: 'reaver', registries, runId: 'deck-min' });
  run.level.level = level;
  return run;
};

test('the reduction levels are data and rise', () => {
  assert.deepEqual([...deckRules.minimumReductionLevels], [6, 12]);
});

test('a Core run loses one minimum slot at each reduction level', () => {
  assert.equal(levelMinDeckDelta(make(1)), 0);
  assert.equal(levelMinDeckDelta(make(5)), 0);
  assert.equal(levelMinDeckDelta(make(6)), 1);
  assert.equal(levelMinDeckDelta(make(12)), 2);
  assert.equal(levelMinDeckDelta(make(20)), 2);
  const run = make(12);
  assert.equal(deckEditBounds({}, deckMinDelta(run)).min, deckRules.defaults.deckMinSize - 2);
});

test('the deck editor counter reads the lowered minimum', () => {
  const model = deckEditorModel({ registries, run: make(6) });
  assert.equal(model.counter.min, deckRules.defaults.deckMinSize - 1);
});

test('a legacy run keeps the settings minimum whatever its level', () => {
  const legacy = createRunState({ seed: 11, classId: 'reaver', registries: createRegistries(contentBundle) });
  legacy.level = { level: 12, xp: 0, unspentPoints: 0 };
  assert.equal(levelMinDeckDelta(legacy), 0);
});
