import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { beginDeckEdit } from '../src/model/deckRules.js';
import { deckVariantKey, openDeckEdit } from '../src/ui/models/DeckEditorModel.js';

const REG = createRegistries(contentBundle);
const freshRun = () => createRunState({ seed: 0x5eed, classId: 'reaver', registries: REG });

test('Undo restores every successful add, remove and reorder including allocation and mint state', () => {
  const run = freshRun();
  const edit = openDeckEdit(REG, run, { playInDeckOrder: true });
  const snapshots = [];
  const act = (action) => {
    snapshots.push(beginDeckEdit(run));
    assert.equal(action().ok, true);
  };
  const reward = run.deck.find((card) => !card.equipmentRole && !card.grantedBy);
  const attack = run.deck.find((card) => card.equipmentRole === 'attack' && !card.grantedBy);
  const guard = run.deck.find((card) => card.equipmentRole === 'guard' && !card.grantedBy);
  assert.equal(edit.canUndo, false);
  act(() => edit.remove(reward.instanceId));
  act(() => edit.add(`card:${deckVariantKey(reward)}`));
  act(() => edit.remove(attack.instanceId));
  act(() => edit.add('basic:attack'));
  act(() => edit.add('basic:attack'));
  act(() => edit.remove(guard.instanceId));
  act(() => edit.add('basic:guard'));
  act(() => edit.add('basic:guard'));
  act(() => edit.moveTo(run.deck[0].instanceId, run.deck.length - 1));
  act(() => edit.move(run.deck[0].instanceId, 1));
  for (const expected of snapshots.reverse()) {
    assert.equal(edit.canUndo, true);
    assert.equal(edit.undo().ok, true);
    assert.deepEqual(beginDeckEdit(run), expected);
  }
  assert.equal(edit.canUndo, false);
  assert.equal(edit.undo().ok, false);
  assert.equal(edit.closed, false, 'Undo does not close the editor');
});

test('Undo returns a kept upgraded basic to the sideboard with its exact variant', () => {
  const run = {
    class: 'reaver', deck: [{ instanceId: 's1', cardId: 'strike', upgraded: false }],
    sideboard: [{ instanceId: 's2', cardId: 'strike', upgraded: true, mods: [] }],
  };
  const before = beginDeckEdit(run);
  const edit = openDeckEdit(REG, run);
  assert.equal(edit.add(`kept:${deckVariantKey(run.sideboard[0])}`).ok, true);
  assert.equal(edit.undo().ok, true);
  assert.deepEqual(beginDeckEdit(run), before);
});

test('Failed mutations and reorder no-ops do not consume an Undo step', () => {
  const run = freshRun();
  const before = beginDeckEdit(run);
  const edit = openDeckEdit(REG, run, { playInDeckOrder: true });
  assert.equal(edit.moveTo(run.deck[0].instanceId, 0).ok, false);
  assert.equal(edit.remove('missing').ok, false);
  assert.equal(edit.canUndo, false);
  assert.equal(edit.add('basic:guard').ok, true);
  const changed = beginDeckEdit(run);
  const reward = run.deck.find((card) => !card.equipmentRole && !card.grantedBy);
  assert.equal(edit.remove('missing').ok, false);
  assert.equal(edit.add(`card:${deckVariantKey(reward)}`).ok, false);
  assert.equal(edit.add('kept:missing~~').ok, false);
  assert.equal(edit.moveTo(run.deck[0].instanceId, 0).ok, false);
  assert.equal(edit.move('missing', 1).ok, false);
  assert.deepEqual(beginDeckEdit(run), changed);
  assert.equal(edit.undo().ok, true);
  assert.deepEqual(beginDeckEdit(run), before);
  assert.equal(edit.canUndo, false);
});

test('Cancel after Undo and further edits still restores the opening snapshot', () => {
  const run = freshRun();
  const before = beginDeckEdit(run);
  const edit = openDeckEdit(REG, run);
  assert.equal(edit.add('basic:attack').ok, true);
  assert.equal(edit.add('basic:guard').ok, true);
  assert.equal(edit.undo().ok, true);
  assert.equal(edit.add('basic:attack').ok, true);
  edit.cancel();
  assert.deepEqual(beginDeckEdit(run), before);
  assert.equal(edit.canUndo, false);
  assert.throws(() => edit.undo(), /closed/);
});

test('Confirm preserves the state reached by Undo and closes its history', () => {
  const run = freshRun();
  const edit = openDeckEdit(REG, run, { deckMinSize: 1 });
  assert.equal(edit.add('basic:attack').ok, true);
  const expected = beginDeckEdit(run);
  assert.equal(edit.add('basic:guard').ok, true);
  assert.equal(edit.undo().ok, true);
  assert.equal(edit.confirm().ok, true);
  assert.deepEqual(beginDeckEdit(run), expected);
  assert.equal(edit.canUndo, false);
  assert.throws(() => edit.undo(), /closed/);
});

test('Refused confirmation keeps Undo available and an unordered move creates no history', () => {
  const run = freshRun();
  const before = beginDeckEdit(run);
  const edit = openDeckEdit(REG, run, { deckMinSize: run.deck.length + 5 });
  assert.equal(edit.moveTo(run.deck[0].instanceId, 1).ok, false);
  assert.equal(edit.canUndo, false);
  assert.equal(edit.add('basic:guard').ok, true);
  assert.equal(edit.confirm().ok, false);
  assert.equal(edit.closed, false);
  assert.equal(edit.canUndo, true);
  assert.equal(edit.undo().ok, true);
  assert.deepEqual(beginDeckEdit(run), before);
});
