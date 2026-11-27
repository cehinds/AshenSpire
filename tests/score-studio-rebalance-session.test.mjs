import test from 'node:test';
import assert from 'node:assert/strict';
import { RebalanceSession, applyRebalanceSession } from '../tools/score-studio/rebalanceSession.js';

const card = (id, n = 3) => ({ id, name: id, rarity: 'common', effects: [{ op: 'damage', target: 'enemy', amount: n }] });
const tune = (entry, settings) => ({ card: { ...entry, effects: [{ ...entry.effects[0], amount: entry.effects[0].amount + settings.reroll }] }, metrics: { cp: settings.reroll, rank: 1, rarity: entry.rarity }, warnings: [], feasible: true });
const session = (entries, extra = {}) => new RebalanceSession({ entries, settings: { seed: 'test' }, tune, yieldToUi: () => Promise.resolve(), ...extra });

test('preview snapshots a frozen scope and does not mutate draft entries, decks, or opening originals', async () => {
  const source = [card('a'), card('b')], original = structuredClone(source), active = session(source);
  source.push(card('later'));
  assert.deepEqual(active.ids, ['a', 'b']); assert.ok(Object.isFrozen(active.ids));
  await active.run();
  assert.deepEqual(source.slice(0, 2), original); assert.deepEqual(active.view().original, original[0]);
  assert.equal(active.view().candidate.effects[0].amount, 4); assert.equal(active.canApply, true);
});

test('reroll affects only the current card, uses different seeds, and retains navigable variations', async () => {
  const calls = [], active = session([card('a'), card('b')], { tune: (entry, settings) => { calls.push([entry.id, settings.seed]); return tune(entry, settings); } });
  await active.run(); active.navigateCard(1); const firstB = active.view().candidate;
  await active.run({ currentOnly: true }); const secondB = active.view().candidate;
  assert.equal(secondB.effects[0].amount, 5); assert.notEqual(calls[1][1], calls[2][1]);
  assert.deepEqual(calls.map(row => row[0]), ['a', 'b', 'b']);
  active.navigateVariation(-1); assert.deepEqual(active.view().candidate, firstB);
  active.navigateVariation(1); assert.deepEqual(active.view().candidate, secondB);
  active.navigateCard(-1); assert.equal(active.view().candidate.effects[0].amount, 4);
});

test('Revert restores the opening candidate without destroying its variation history or changing the draft', async () => {
  const source = [card('a')], active = session(source); await active.run();
  active.revertCurrent(); assert.deepEqual(active.view().candidate, source[0]); assert.equal(active.canApply, false);
  assert.equal(active.view().variationTotal, 1); active.navigateVariation(1); assert.equal(active.canApply, true);
  assert.equal(source[0].effects[0].amount, 3);
});

test('settings changes invalidate Apply until regeneration; navigating an old-settings variation remains stale', async () => {
  const active = session([card('a')]); await active.run();
  active.setSettings({ seed: 'changed', targetRank: 2 }); assert.equal(active.stale, true); assert.equal(active.canApply, false);
  await active.run(); assert.equal(active.canApply, true);
  active.navigateVariation(-1); assert.equal(active.stale, true); assert.equal(active.canApply, false);
});

test('closing while a yield is pending discards late work instead of staging or applying it', async () => {
  let resume; const active = session([card('a')], { yieldToUi: () => new Promise(resolve => { resume = resolve; }) });
  const pending = active.run(); assert.equal(active.busy, true); active.close(); resume();
  assert.deepEqual(await pending, { cancelled: true }); assert.equal(active.view().variationTotal, 0); assert.equal(active.canApply, false);
});

test('a settings change while a tuner awaits prevents the stale result from entering history', async () => {
  let resolveTune, started;
  const tuning = new Promise(resolve => { started = resolve; });
  const active = session([card('a')], { tune: async (entry, settings) => { started(); return new Promise(resolve => { resolveTune = () => resolve(tune(entry, settings)); }); } });
  const pending = active.run(); await tuning;
  active.setSettings({ seed: 'new' }); resolveTune();
  assert.deepEqual(await pending, { cancelled: true }); assert.equal(active.view().variationTotal, 0); assert.equal(active.stale, true);
});

test('a late previous job cannot overwrite a newer completed job', async () => {
  let releaseOld, started, calls = 0;
  const oldStarted = new Promise(resolve => { started = resolve; });
  const active = session([card('a')], { tune: (entry, settings) => {
    calls++;
    if (calls === 1) { started(); return new Promise(resolve => { releaseOld = () => resolve({ ...tune(entry, settings), card: card(entry.id, 10) }); }); }
    return { ...tune(entry, settings), card: card(entry.id, 20) };
  } });
  const old = active.run(); await oldStarted; await active.run(); releaseOld(); assert.deepEqual(await old, { cancelled: true });
  assert.equal(active.view().candidate.effects[0].amount, 20); assert.equal(active.view().variationTotal, 1);
});

test('a failed batch is atomic and cannot substitute a different card identity', async () => {
  const active = session([card('a'), card('b')], { tune: (entry, settings) => entry.id === 'b' ? { card: card('invented') } : tune(entry, settings) });
  await assert.rejects(active.run(), /identity/); assert.equal(active.view().variationTotal, 0); assert.equal(active.canApply, false);
});

test('Apply takes one undo point and changes only staged changed IDs; reverted and unrelated entries remain equal', async () => {
  const state = { cards: [card('a'), card('b'), card('c')], customDecks: [{ id: 'deck', cardIds: ['a', 'b', 'c'] }] };
  const before = structuredClone(state), b = state.cards[1], c = state.cards[2];
  const active = session([state.cards[0], state.cards[2]]); await active.run(); active.navigateCard(1); active.revertCurrent();
  let undo = 0; const result = applyRebalanceSession(active, state, { pushHistory: () => { undo++; assert.deepEqual(state, before); } });
  assert.equal(undo, 1); assert.deepEqual(result.ids, ['a']); assert.equal(state.cards[0].effects[0].amount, 4);
  assert.equal(state.cards[1], b); assert.equal(state.cards[2], c); assert.deepEqual(state.customDecks, before.customDecks); assert.equal(state.cards.length, 3);
});

test('Apply rejects external edits and missing scope IDs before creating an undo point', async () => {
  for (const missing of [false, true]) {
    const state = { cards: [card('a'), card('b')] }, active = session([state.cards[0]]); await active.run();
    if (missing) state.cards.shift(); else state.cards[0].name = 'User changed outside preview';
    let undo = 0; assert.throws(() => applyRebalanceSession(active, state, { pushHistory: () => undo++ }), /Reopen/); assert.equal(undo, 0);
  }
});

test('item previews apply by stable item key without changing cards or generating/trimming items', async () => {
  const state = { cards: [card('a')], items: [{ key: 'weapon:a', name: 'A', base: 1 }, { key: 'relic:b', name: 'B', base: 2 }] };
  const originalCards = state.cards, untouched = state.items[1];
  const active = session([state.items[0]], { target: 'items', tune: item => ({ item: { ...item, base: 3 }, metrics: { cp: 3, rank: 1, rarity: 'common' } }) });
  await active.run(); applyRebalanceSession(active, state);
  assert.equal(state.items[0].base, 3); assert.equal(state.items[1], untouched); assert.equal(state.items.length, 2); assert.equal(state.cards, originalCards);
});


test('an infeasible active preview blocks the entire Apply before undo or state writes', async () => {
  for (const failure of [{ feasible: false }, { constraintErrors: ['Unreachable CP'] }, { errors: ['Unsupported effect'] }]) {
    const source = [card('a'), card('b')], state = { cards: source }, before = structuredClone(state); let undos = 0;
    const active = session(source, { tune: (entry, settings) => ({ ...tune(entry, settings), ...(entry.id === 'b' ? failure : {}) }) });
    await active.run(); assert.equal(active.canApply, false); assert.deepEqual(active.invalidCandidates, ['b']);
    assert.throws(() => applyRebalanceSession(active, state, { pushHistory: () => undos++ }), /preview/);
    assert.equal(undos, 0); assert.deepEqual(state, before); assert.equal(state.cards, source);
    active.navigateCard(1); active.revertCurrent(); assert.equal(active.canApply, true);
  }
});


test('async tuner receives a cancellation predicate and stale aborts stop quietly without adding history', async () => {
  let started, release; const began = new Promise(resolve => { started = resolve; }); let observed;
  const active = session([card('a')], { tune: async (_entry, _settings, job) => {
    observed = job; started(); await new Promise(resolve => { release = resolve; });
    if (!job.isCurrent()) throw new Error('Aborted old search');
    throw new Error('Expected cancellation');
  } });
  const pending = active.run(); await began; assert.equal(observed.isCurrent(), true); assert.equal(typeof observed.yieldToUi, 'function');
  active.close(); assert.equal(observed.isCurrent(), false); release();
  assert.deepEqual(await pending, { cancelled: true }); assert.equal(active.error, null); assert.equal(active.view().variationTotal, 0);
});
