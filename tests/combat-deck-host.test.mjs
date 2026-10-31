import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { commitDeckEditDraft } from '../src/model/deckRules.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const begin = source.indexOf('function showCombatDeckEditor('), end = source.indexOf('\nfunction showHistory()', begin);
const registries = createRegistries(contentBundle);
function fixture() {
  let editor, snapshots = 0, writes = 0;
  const owner = createRunState({ seed: 54, classId: 'reaver', registries });
  const combat = { result: null, piles: { hand: structuredClone(owner.deck.slice(0, 2)), draw: structuredClone(owner.deck.slice(2)), discard: [], exhaust: [] } };
  const context = { run: owner, registries, structuredClone, commitDeckEditDraft,
    saves: { loadMeta: () => ({ settings: { deckMinUnlimited: true } }) },
    document: { body: {} }, mountDeckEditor: (_host, args) => { editor = args; },
    commitCombatSnapshot: args => { assert.equal(args.combat, combat); assert.equal(args.nodeId, 'n'); snapshots++; },
    persist: () => { writes++; }, showSettingsNotice() {}, supersedePendingEntryCheckpoint() {},
  };
  const open = runInNewContext(source.slice(begin, end) + '\nshowCombatDeckEditor;', context);
  open(combat, 'n', 'enc');
  return { owner, combat, context, get editor() { return editor; }, get snapshots() { return snapshots; }, get writes() { return writes; } };
}
test('combat deck draft commits next-encounter composition without changing active pile instances', () => {
  const f = fixture(), livePiles = structuredClone(f.combat.piles), original = structuredClone(f.owner.deck);
  assert.notEqual(f.editor.run, f.owner);
  const card = f.editor.run.deck.pop(); f.editor.run.sideboard ||= []; f.editor.run.sideboard.push(card);
  assert.deepEqual(f.owner.deck, original, 'unconfirmed edits do not touch the run');
  f.editor.onDone();
  assert.equal(f.owner.deck.length, original.length - 1); assert.deepEqual(f.combat.piles, livePiles);
  assert.equal(f.snapshots, 1); assert.equal(f.writes, 1);
});
test('cancel and a replaced run never commit a stale draft', () => {
  const f = fixture(), original = structuredClone(f.owner);
  f.editor.run.deck.pop(); f.editor.onCancel(); assert.deepEqual(f.owner, original); assert.equal(f.writes, 0);
  f.context.run = structuredClone(f.owner); f.editor.onDone(); assert.equal(f.writes, 0);
});

test('failed persistence restores the deck and snapshot without touching active piles', () => {
  const f = fixture(), before = structuredClone(f.owner), piles = structuredClone(f.combat.piles);
  const moved = f.editor.run.deck.pop(); f.editor.run.sideboard.push(moved);
  f.context.commitCombatSnapshot = () => { f.owner.combatEntered = { nodeId: 'n' }; };
  f.context.persist = () => { throw new Error('QuotaExceededError'); };
  f.editor.onDone();
  assert.deepEqual(f.owner, before);
  assert.deepEqual(f.combat.piles, piles);
});
