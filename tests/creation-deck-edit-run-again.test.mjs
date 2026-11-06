// Core 2 creation: the deck edited on the review step is kept in run.beginChoices, so Run again and a reload start
// from the same piles; a beginChoices without the field (every older save) still starts from the class default.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { beginDeckEdit, cancelDeckEdit } from '../src/model/deckRules.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = () => createRunState({ seed: 5, classId: 'reaver', registries });
const piles = run => JSON.stringify([run.deck, run.sideboard]);

test('an edited starting deck survives beginChoices (JSON, as saved) and Run again applies it', () => {
  const edited = fresh();
  const moved = edited.deck.pop();
  assert.ok(moved, 'the starting deck has a card to move');
  edited.sideboard = [...(edited.sideboard || []), moved];
  const beginChoices = JSON.parse(JSON.stringify({ classId: 'reaver', deckEdit: beginDeckEdit(edited) }));
  const again = fresh();
  assert.notEqual(piles(again), piles(edited), 'the class default differs from the edit');
  cancelDeckEdit(again, beginChoices.deckEdit);
  assert.equal(piles(again), piles(edited), 'Run again starts from the same piles');
});

test('a beginChoices without deckEdit (an older save) leaves the class default', () => {
  const beginChoices = { classId: 'reaver' };
  const again = fresh();
  const before = piles(again);
  if (beginChoices.deckEdit) cancelDeckEdit(again, beginChoices.deckEdit);
  assert.equal(piles(again), before);
});

test('the host stores deckEdit in beginChoices and applies it to the new run', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /attributes, \.\.\.\(deckEdit \? \{ deckEdit \} : \{\}\) \}\);/);
  assert.match(main, /if \(deckEdit && isConfiguredRun\(run\)\) cancelDeckEdit\(run, deckEdit\);/);
  assert.match(main, /structuredClone\(finishedRun\.beginChoices\)/);
});
