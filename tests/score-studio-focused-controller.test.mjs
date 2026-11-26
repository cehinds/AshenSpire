import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom, installDom } from './helpers/dom.mjs';
import { initFocusedRebalanceUi, rebalanceMechanicalChanges } from '../tools/score-studio/focusedRebalanceUi.js';
import { focusedCardMetrics } from '../tools/score-studio/focusedRebalance.js';
import { CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { GenerateItem, ScoreGeneratedItem } from '../src/model/itemGenerator.js';
import { scoring } from '../src/content/generated/scoring.js';

const card = id => ({ id, name: `Hand named ${id}`, class: 'reaver', type: 'attack', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', icon: 'attack', tags: ['camp:physical', 'source:weapon', 'maneuver:attack'], keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 6 }], textTemplate: 'Deal {damage} damage.' });
function fixture({ ids = ['a'], target = 'cards' } = {}) {
  const dom = rewardDom(), doc = dom.document;
  doc.getElementById = id => doc.querySelector(`#${id}`);
  const restore = installDom(dom), node = (id, tag = 'div', value = '') => { const element = doc.createElement(tag); element.id = id; element.value = value; element.checked = false; element.focus = () => { doc.activeElement = element; }; doc.body.append(element); return element; };
  for (const id of ['rebal-status', 'rebal-card-before', 'rebal-card-after', 'rebal-diff', 'rebal-before-metrics', 'rebal-after-metrics', 'rebal-before-label', 'rebal-card-position', 'rebal-variation-position', 'rebal-spinner', 'rebal-costs-section', 'rebal-effects-section', 'rebal-stances-section', 'rebal-effect-options', 'rebal-stance-options', 'rebal-navigation', 'rebal-card-navigation', 'rebal-version-navigation']) node(id);
  for (const id of ['btn-rebal-preview', 'btn-rebal-reroll', 'btn-rebal-revert', 'btn-rebal-apply', 'btn-rebal-prev-card', 'btn-rebal-next-card', 'btn-rebal-prev-variation', 'btn-rebal-next-variation']) node(id, 'button');
  for (const [id, value] of Object.entries({ 'rebal-target-rank': 'keep', 'rebal-target-rarity': 'keep', 'rebal-target-cp': '', 'rebal-effect-count': '', 'rebal-sp': '', 'rebal-mp': '', 'rebal-seed': '42', 'rebal-scope': 'selected' })) node(id, 'input', value);
  for (const id of ['rebal-generate-names', 'rebal-pool-mode', 'rebal-gen-shortage', 'rebal-compare-original']) node(id, 'input');
  const form = node('rebalance-form', 'form'), dialog = node('rebalance-modal', 'dialog');
  dialog.showModal = () => { dialog.open = true; }; dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new dom.Event('close')); };
  const state = { cards: [card('a'), card('b'), card('unselected')], items: target === 'items' ? [GenerateItem({ seed: 'focused-controller-item', kind: 'weapon', rank: 1 }).entry] : [], scoring: structuredClone(scoring), selectedCardId: 'a' };
  const original = structuredClone(state); let undos = [], saves = 0, syncs = 0, pools = 0, previews = 0, hookSnapshots = [];
  const ui = initFocusedRebalanceUi({ state, getTarget: () => target, scopedEntries: () => state[target].filter(entry => target === 'items' || ids.includes(entry.id || entry.key)),
    pushHistory: () => undos.push(structuredClone(state)), normalizeStudioCard: entry => entry, saveDraft: () => saves++, syncAllViews: () => syncs++, toast() {},
    deriveFaceFromDef: def => CardDefinitionToScoreFace(def, { scoring: state.scoring }),
    renderRebalancePreview: ({ original, candidate, target }) => { previews++; return target === 'items' ? { before: ScoreGeneratedItem(original), after: ScoreGeneratedItem(candidate) } : { before: focusedCardMetrics(original), after: focusedCardMetrics(candidate) }; },
    prepareRebalanceCommit: entry => hookSnapshots.push({ id: entry.id, undos: undos.length }), refreshLegacy() {}, applyPool: () => pools++,
  });
  return { dom, doc, ui, state, original, node, form, dialog, restore, get calls() { return { undos, saves, syncs, pools, previews, hookSnapshots }; } };
}

test('controller previews and rerolls without draft writes; Apply commits exact scope after one undo', async () => {
  const f = fixture({ ids: ['a', 'b'] });
  try {
    await f.ui.open(); const openingPreviews = f.calls.previews; assert.ok(openingPreviews >= 2, 'previews render again after dialog becomes visible');
    f.doc.getElementById('rebal-target-rank').value = '2';
    const pending = f.ui.run(); assert.equal(f.dialog.getAttribute('aria-busy'), 'true'); assert.equal(f.doc.getElementById('btn-rebal-apply').disabled, true);
    await pending; assert.deepEqual(f.state, f.original); assert.equal(f.ui.getSession().canApply, true);
    await f.ui.run(true); assert.equal(f.ui.getSession().view().variationTotal, 2);
    f.ui.apply(); assert.equal(f.calls.undos.length, 1); assert.deepEqual(f.calls.undos[0], f.original);
    assert.deepEqual(f.calls.hookSnapshots, [{ id: 'a', undos: 1 }, { id: 'b', undos: 1 }]);
    assert.deepEqual(f.state.cards[2], f.original.cards[2]); assert.equal(f.state.cards.length, 3); assert.equal(f.calls.pools, 0);
    assert.equal(f.calls.saves, 1); assert.equal(f.calls.syncs, 1); assert.equal(f.dialog.open, false);
  } finally { f.restore(); }
});

test('close discards pending work; settings changes invalidate staged previews and Enter never implicitly cancels', async () => {
  const f = fixture();
  try {
    await f.ui.open(); f.doc.getElementById('rebal-target-rank').value = '2'; await f.ui.run();
    const input = f.doc.getElementById('rebal-target-cp'); input.value = '999'; input.dispatchEvent(new f.dom.Event('input'));
    assert.equal(f.ui.getSession().canApply, false); assert.match(f.doc.getElementById('rebal-status').textContent, /Settings changed/);
    const enter = new f.dom.Event('keydown', { key: 'Enter', target: input, cancelable: true }); f.form.dispatchEvent(enter);
    assert.equal(enter.defaultPrevented, true); assert.equal(f.dialog.open, true);
    f.dialog.close(); await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(f.ui.getSession(), null); assert.deepEqual(f.state, f.original); assert.equal(f.calls.undos.length, 0);
  } finally { f.restore(); }
});

test('selected scope rejects Advanced pool mode and Revert keeps original plus history without mutating draft', async () => {
  const f = fixture();
  try {
    await f.ui.open(); const pool = f.doc.getElementById('rebal-pool-mode'); pool.checked = true; pool.dispatchEvent(new f.dom.Event('change'));
    assert.equal(pool.disabled, true); assert.equal(pool.checked, false);
    f.doc.getElementById('rebal-target-rank').value = '2'; await f.ui.run();
    f.doc.getElementById('btn-rebal-revert').click(); assert.deepEqual(f.ui.getSession().view().candidate, f.original.cards[0]);
    assert.equal(f.ui.getSession().view().variationTotal, 1); assert.equal(f.ui.getSession().canApply, false);
    f.ui.apply(); assert.equal(f.calls.pools, 0); assert.equal(f.calls.undos.length, 0); assert.deepEqual(f.state, f.original);
  } finally { f.restore(); }
});


test('Current scope remains a focused edit and an editor-origin Cancel returns focus to its gallery Edit button', async () => {
  const f = fixture();
  try {
    f.doc.getElementById('rebal-scope').value = 'current';
    const tile = f.node('selected-tile'); tile.className = 'studio-card-tile'; tile.dataset.cardId = 'a';
    const edit = f.node('gallery-edit', 'button'); edit.className = 'card-editor-edit-button'; tile.append(edit);
    const editor = f.node('card-editor-modal', 'dialog'), launch = f.node('editor-launch', 'button'); editor.append(launch);
    editor.open = true; editor.contains = node => !!node?.closest('#card-editor-modal'); editor.close = () => { editor.open = false; };
    launch.focus(); await f.ui.open(); assert.equal(editor.open, false); assert.equal(f.dialog.open, true);
    const pool = f.doc.getElementById('rebal-pool-mode'); pool.checked = true; pool.dispatchEvent(new f.dom.Event('change'));
    assert.equal(pool.checked, false); assert.equal(pool.disabled, true);
    f.dialog.close(); assert.equal(f.doc.activeElement, edit); assert.deepEqual(f.state, f.original);
  } finally { f.restore(); }
});

test('Items workspace hides card-only settings and applies only the original item key', async () => {
  const f = fixture({ target: 'items' });
  try {
    await f.ui.open();
    for (const id of ['rebal-costs-section', 'rebal-effects-section', 'rebal-stances-section']) assert.equal(f.doc.getElementById(id).hidden, true);
    assert.equal(f.doc.getElementById('btn-rebal-next-card').getAttribute('aria-label'), 'Next item');
    f.doc.getElementById('rebal-target-rank').value = '2'; await f.ui.run(); assert.deepEqual(f.state, f.original);
    assert.equal(f.ui.getSession().canApply, true); const key = f.original.items[0].key; f.ui.apply();
    assert.equal(f.state.items.length, 1); assert.equal(f.state.items[0].key, key); assert.deepEqual(f.state.cards, f.original.cards); assert.equal(f.calls.undos.length, 1);
  } finally { f.restore(); }
});

test('a changed scope cancels a queued batch and gives the replacement session clean history', async () => {
  const f = fixture();
  try {
    await f.ui.open(); f.doc.getElementById('rebal-target-rank').value = '2'; const previous = f.ui.getSession(), pending = f.ui.run();
    f.doc.getElementById('rebal-scope').dispatchEvent(new f.dom.Event('change')); const current = f.ui.getSession();
    assert.notEqual(current, previous); assert.equal(previous.closed, true); await pending;
    assert.equal(current.view().variationTotal, 0); assert.equal(current.canApply, false); assert.deepEqual(f.state, f.original);
  } finally { f.restore(); }
});


test('newly inserted existing-status preferences invalidate staged previews through delegated events', async () => {
  const f = fixture();
  try {
    await f.ui.open(); f.doc.getElementById('rebal-target-rank').value = '2'; await f.ui.run(); assert.equal(f.ui.getSession().canApply, true);
    const input = f.node('dynamic-bleed-option', 'input', 'status:bleed'); input.setAttribute('data-rebal-effect', ''); input.checked = true;
    f.doc.getElementById('rebal-effect-options').append(input); input.dispatchEvent(new f.dom.Event('change', { bubbles: true }));
    assert.deepEqual(f.ui.getSession().settings.preferredEffects, ['status:bleed']); assert.equal(f.ui.getSession().canApply, false);
    assert.deepEqual(f.state, f.original);
  } finally { f.restore(); }
});


test('invalid numeric input is distinct from Automatic or Keep current and cannot apply an older preview', async () => {
  const f = fixture();
  try {
    await f.ui.open(); f.doc.getElementById('rebal-target-rank').value = '2'; await f.ui.run(); assert.equal(f.ui.getSession().canApply, true);
    for (const id of ['rebal-target-cp', 'rebal-sp']) {
      const input = f.doc.getElementById(id); input.value = ''; input.validity = { badInput: true }; input.dispatchEvent(new f.dom.Event('input'));
      assert.equal(f.ui.getSession().canApply, false); assert.equal(f.doc.getElementById('btn-rebal-apply').disabled, true);
      await f.ui.run(); assert.equal(f.ui.getSession().canApply, false); assert.ok(f.ui.getSession().view().report.constraintErrors.length);
      input.validity.badInput = false; input.dispatchEvent(new f.dom.Event('input')); assert.equal(f.ui.getSession().canApply, false);
      await f.ui.run(); assert.equal(f.ui.getSession().canApply, true);
    }
    assert.deepEqual(f.state, f.original); assert.equal(f.calls.undos.length, 0);
  } finally { f.restore(); }
});


test('short changes describe projected mechanical numbers, conditional payloads and next-card charges', () => {
  const before = [{ op: 'damage', amount: 3 }, { op: 'damage', amount: 1, if: { p: 'firstAttackThisCombat' } }, { op: 'grantCardCharge', damage: 2 }];
  const after = [{ op: 'damage', amount: 5 }, { op: 'damage', amount: 2, if: { p: 'firstAttackThisCombat' } }, { op: 'grantCardCharge', damage: 3 }];
  assert.deepEqual(rebalanceMechanicalChanges(before, after), ['Damage: 3 → 5', 'Damage (conditional): 1 → 2', 'Next card damage: 2 → 3']);
  assert.deepEqual(rebalanceMechanicalChanges(before, structuredClone(before)), []);
});

test('compact navigation omits empty groups and retains version history after reverting to Original', async () => {
  const f = fixture();
  try {
    await f.ui.open();
    for (const id of ['rebal-navigation', 'rebal-card-navigation', 'rebal-version-navigation']) assert.equal(f.doc.getElementById(id).hidden, true);
    f.doc.getElementById('rebal-target-rank').value = '2'; await f.ui.run();
    assert.equal(f.doc.getElementById('rebal-card-navigation').hidden, true);
    assert.equal(f.doc.getElementById('rebal-version-navigation').hidden, false);
    assert.equal(f.doc.getElementById('rebal-navigation').hidden, false);
    f.doc.getElementById('btn-rebal-revert').click();
    assert.equal(f.doc.getElementById('rebal-version-navigation').hidden, false);
    assert.equal(f.doc.getElementById('btn-rebal-next-variation').disabled, false);
    assert.match(f.doc.getElementById('rebal-variation-position').textContent, /Original/);
  } finally { f.restore(); }
  const multiple = fixture({ ids: ['a', 'b'] });
  try {
    await multiple.ui.open();
    assert.equal(multiple.doc.getElementById('rebal-card-navigation').hidden, false);
    assert.equal(multiple.doc.getElementById('rebal-version-navigation').hidden, true);
    assert.equal(multiple.doc.getElementById('btn-rebal-next-card').getAttribute('aria-label'), 'Next card');
    assert.equal(multiple.doc.getElementById('btn-rebal-next-card').title, 'Next card');
  } finally { multiple.restore(); }
});

test('only completed explicit mobile previews reveal results, respecting reduced motion and leaving focus intact', async () => {
  const f = fixture();
  try {
    let mobile = true, reduced = false;
    f.doc.defaultView = { matchMedia: query => ({ matches: query.includes('max-width') ? mobile : reduced }) };
    const body = f.node('preview-scroll-body'); body.className = 'rebalance-body'; f.dialog.append(body);
    const scrolls = []; body.scrollTo = options => scrolls.push(options);
    await f.ui.open(); assert.equal(scrolls.length, 0, 'opening does not force a result scroll');
    const rank = f.doc.getElementById('rebal-target-rank'); rank.value = '2'; rank.dispatchEvent(new f.dom.Event('change'));
    assert.equal(scrolls.length, 0, 'settings changes do not reset scrolling');
    const launch = f.doc.getElementById('btn-rebal-preview'); launch.focus(); const pending = f.ui.run(); f.doc.activeElement = f.doc.body; await pending;
    assert.deepEqual(scrolls, [{ top: 0, behavior: 'smooth' }]); assert.equal(f.doc.activeElement, launch);
    reduced = true; await f.ui.run(true); assert.deepEqual(scrolls[1], { top: 0, behavior: 'auto' });
    mobile = false; await f.ui.run(); assert.equal(scrolls.length, 2, 'desktop previews do not move');
    mobile = true; const cancelled = f.ui.run(); f.dialog.close(); await cancelled;
    assert.equal(scrolls.length, 2, 'cancelled results do not scroll');
  } finally { f.restore(); }
});
