// Core 2 creation: the deck edited on the review step is kept in run.beginChoices, so Run again and a reload start
// from the same piles; a beginChoices without the field (every older save) still starts from the class default.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { beginDeckEdit } from '../src/model/deckRules.js';
import { CreatePreparedRun } from '../src/services/runBirth.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = () => createRunState({ seed: 5, classId: 'reaver', registries });
const piles = run => JSON.stringify([run.deck, run.sideboard]);

const prepare = choices => CreatePreparedRun({
  seed: 5, classId: 'reaver', registries, gameProfile: profile,
  configSnapshot: { schemaVersion: 1, overrides: {}, breakMeterVersion: 2 }, ...choices,
});

test('an edited starting deck survives beginChoices (JSON, as saved) and Run again applies it', () => {
  const edited = fresh();
  const moved = edited.deck.pop();
  assert.ok(moved, 'the starting deck has a card to move');
  edited.sideboard = [...(edited.sideboard || []), moved];
  const deckEdit = beginDeckEdit(edited);
  const customization = { name: 'Test Reaver', glyph: 'sword', tint: 'gold' };
  const custom = { deckMode: 'standard', firstSeat: 'reach' };
  const { run, rng } = prepare({ deckEdit, customization, custom });

  assert.notEqual(piles(fresh()), piles(edited), 'the class default differs from the edit');
  assert.equal(piles(run), piles(edited), 'the new run uses the edited piles');
  assert.equal(run.customization, customization);
  assert.equal(run.custom, custom);
  assert.notEqual(run.beginChoices.customization, customization);
  assert.notEqual(run.beginChoices.custom, custom);
  assert.notEqual(run.beginChoices.deckEdit, deckEdit);
  assert.equal(run.seatOrder[0], 'reach');
  assert.deepEqual(rng.getCounters(), prepare({}).rng.getCounters(), 'rotating seats preserves all counters');

  const again = prepare(JSON.parse(JSON.stringify(run.beginChoices))).run;
  assert.equal(piles(again), piles(edited));
  assert.notEqual(again.deck[0], run.deck[0]);
});

test('a beginChoices without deckEdit (an older save) leaves the class default', () => {
  const { run } = prepare({ classId: 'reaver' });
  assert.equal(piles(run), piles(fresh()));
  assert.equal(Object.hasOwn(run.beginChoices, 'deckEdit'), false);
});

test('the Run again host clones the saved choices before starting', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /structuredClone\(finishedRun\.beginChoices\)/);
});
