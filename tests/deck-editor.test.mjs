// tests/deck-editor.test.mjs — SPEC §14.1 step 3, the deck editor UI
// (docs/FINISH.md §14 "Deck editor UI").
//
// The model half: the live counter and its refusal, the collection's owned
// counts, the cost curve, filters and sort, the session's add/remove/move and
// the Cancel that restores both piles, the attack-slot allocation, the guard
// instances and the mint counter; and which doors the settings open.
//
// The DOM half (the production screen over tests/helpers/reward-dom.mjs): a
// card added and removed by tap, by the ＋/－ buttons, and by a keyboard and a
// gamepad dispatch; Done disabled with the refusal as visible text; Cancel
// through the screen; the Quick Access door under `free` only; the shrine's
// Rest card under `restOnly` only, and never the camp's.
//   node --test tests/deck-editor.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { locationServices, locationTags } from '../src/model/locations.js';
import { deckEditorModel, deckEditorDoors, deckVariantKey, openDeckEdit, nextFilterPreset, deckEditorView } from '../src/ui/models/DeckEditorModel.js';
import { setKeyBindings } from '../src/ui/input.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const REG = createRegistries(contentBundle);
const freshRun = (seed = 0x5eed) => createRunState({ seed, classId: 'reaver', registries: REG });
const ordinary = (run) => run.deck.find((c) => !c.equipmentRole && !c.grantedBy);
const editState = (run) => structuredClone({
  deck: run.deck, sideboard: run.sideboard, equipmentAttackSlotCount: run.equipmentAttackSlotCount,
  removedAttackSlotIds: run.removedAttackSlotIds, editMintCounter: run.editMintCounter,
  guards: run.deck.filter((c) => c.equipmentRole === 'guard').length,
});
setKeyBindings(null);

// ---- the model -------------------------------------------------------------

test('the counter reads "N / min–max" and the refusal is the rules\' sentence', () => {
  const run = freshRun();
  const n = run.deck.length;
  const inside = deckEditorModel({ registries: REG, run, settings: { deckMinSize: 1 } });
  assert.equal(inside.counter.text, `${n} / 1–∞`);
  assert.equal(inside.counter.outOfBounds, false);
  assert.equal(inside.done.disabled, false);
  const out = deckEditorModel({ registries: REG, run, settings: { deckMinSize: n + 5 } });
  assert.equal(out.counter.outOfBounds, true);
  assert.equal(out.done.disabled, true);
  assert.match(out.done.refusal, new RegExp(`\\b${n}\\b`));
  assert.match(out.done.refusal, new RegExp(`\\b${n + 5}\\b`));
  const capped = deckEditorModel({ registries: REG, run, settings: { deckMinSize: 1, deckMaxUnlimited: false, deckMaxSize: n + 2 } });
  assert.equal(capped.counter.text, `${n} / 1–${n + 2}`);
});

test('the curve counts the whole deck; filters and sort shape only the lists', () => {
  const run = freshRun();
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  assert.equal(model.curve.reduce((sum, bar) => sum + bar.count, 0), run.deck.length);
  assert.ok(model.curve.some((bar) => bar.share === 1), 'the tallest bar is full height');
  const attacks = deckEditorModel({ registries: REG, run, settings: {}, view: { filters: { type: ['attack'] } } });
  assert.ok(attacks.deck.length > 0 && attacks.deck.every((row) => row.type === 'attack'));
  assert.equal(attacks.curve.reduce((sum, bar) => sum + bar.count, 0), run.deck.length, 'a filter never changes the curve');
  const byName = deckEditorModel({ registries: REG, run, settings: {}, view: { sort: 'name' } });
  const names = byName.deck.map((row) => row.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
  // Y cycles: no filter → first type → … → back to no filter.
  let view = deckEditorView({});
  const seen = [];
  for (let i = 0; i < 20; i++) {
    view = nextFilterPreset(model, view);
    seen.push(JSON.stringify(deckEditorView(view).filters));
    if (!deckEditorView(view).filters.type.length && !deckEditorView(view).filters.source.length) break;
  }
  assert.ok(seen.length > 2, 'the cycle visits presets and wraps to none');
});

test('the collection: basics are ∞, every other card says owned and in deck, and a spent one greys out', () => {
  const run = freshRun();
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  const basics = model.collection.filter((tile) => tile.unlimited);
  assert.deepEqual(basics.map((tile) => tile.key), ['basic:attack', 'basic:guard'], 'an equipped run offers its basics by role');
  assert.ok(basics.every((tile) => tile.countText.startsWith('∞') && tile.addable));
  const card = ordinary(run);
  const tile = model.collection.find((x) => x.key === `card:${deckVariantKey(card)}`);
  assert.equal(tile.addable, false, 'every owned copy is already in the deck');
  assert.match(tile.countText, /owned · \d+ in deck/);
  assert.match(tile.refusal, new RegExp(tile.name));
  const locked = model.deck.find((row) => row.locked);
  assert.ok(locked && !locked.removable && /Locked/.test(locked.lockText), 'an item-owned card is locked with its piece');
});

test('the session adds and removes through the rules, and Cancel restores everything it can change', () => {
  const run = freshRun();
  run.sideboard = [];
  const before = editState(run);
  const edit = openDeckEdit(REG, run, {});
  const card = ordinary(run);
  const strike = run.deck.find((c) => c.equipmentRole === 'attack' && !c.grantedBy);
  const guard = run.deck.find((c) => c.equipmentRole === 'guard' && !c.grantedBy);
  assert.equal(edit.remove(card.instanceId).ok, true);
  assert.equal(edit.remove(strike.instanceId).ok, true, 'a Strike retires its slot');
  assert.equal(edit.remove(guard.instanceId).ok, true);
  assert.equal(edit.add('basic:attack').ok, true, 'the retired slot comes back first');
  assert.equal(edit.add('basic:attack').ok, true, 'then the allocation grows');
  assert.equal(edit.add('basic:guard').ok, true);
  assert.equal(edit.add('basic:guard').ok, true, 'a fresh guard is minted');
  assert.ok(run.editMintCounter > (before.editMintCounter || 0), 'the edit spent mint numbers');
  assert.notEqual(run.equipmentAttackSlotCount, before.equipmentAttackSlotCount);
  const locked = run.deck.find((c) => c.grantedBy);
  const refused = edit.remove(locked.instanceId);
  assert.equal(refused.ok, false);
  assert.match(refused.refusal, /Armoury decides it/);
  edit.cancel();
  assert.deepEqual(editState(run), before, 'both piles, the slot allocation, the guards and the mint counter are back');
  assert.throws(() => edit.add('basic:attack'), /closed/);
});

test('a limited card comes back from the sideboard, and a class Power past its limit is refused by name', () => {
  const run = freshRun();
  const edit = openDeckEdit(REG, run, {});
  const card = ordinary(run);
  edit.remove(card.instanceId);
  assert.equal(run.sideboard.at(-1).instanceId, card.instanceId);
  assert.equal(edit.add(`card:${card.cardId}`).ok, true);
  assert.ok(run.deck.some((c) => c.instanceId === card.instanceId), 'the same instance returns');
  const powerId = REG.classes.get('reaver').cardPool.find((id) => REG.cards.get(id).type === 'power');
  run.deck.push({ instanceId: 'p1', cardId: powerId, upgraded: false });
  run.sideboard.push({ instanceId: 'p2', cardId: powerId, upgraded: false });
  const refused = edit.add(`card:${powerId}`);
  assert.equal(refused.ok, false);
  assert.match(refused.refusal, new RegExp(REG.cards.get(powerId).name));
  const tile = deckEditorModel({ registries: REG, run, settings: {} }).collection.find((x) => x.key === `card:${deckVariantKey({ cardId: powerId })}`);
  assert.equal(tile.addable, false);
  assert.equal(tile.countText, '2 owned · 1 in deck');
  edit.cancel();
});

test('each variant is its own tile, and its tap moves that variant (Codex review on #1372)', () => {
  const run = freshRun();
  const powerId = REG.classes.get('reaver').cardPool.find((id) => REG.cards.get(id).type === 'power');
  // Two loose copies that differ only in `upgraded`, the plain one first, under the one-copy limit.
  run.sideboard = [
    { instanceId: 'plain', cardId: powerId, upgraded: false },
    { instanceId: 'better', cardId: powerId, upgraded: true, mods: [] },
  ];
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  const tiles = model.collection.filter((tile) => tile.cardId === powerId);
  assert.equal(tiles.length, 2, 'the plain and the upgraded copy are two tiles');
  const upgradedTile = tiles.find((tile) => tile.upgraded);
  assert.equal(upgradedTile.name, REG.cards.get(powerId).name + '+', 'the upgraded tile shows the upgraded card');
  const edit = openDeckEdit(REG, run, {});
  assert.equal(edit.add(upgradedTile.key).ok, true);
  assert.ok(run.deck.some((c) => c.instanceId === 'better'), 'the tapped variant moved, not the first match');
  assert.ok(run.sideboard.some((c) => c.instanceId === 'plain'), 'the plain copy stays loose');
  const after = deckEditorModel({ registries: REG, run, settings: {} }).collection.filter((tile) => tile.cardId === powerId);
  assert.equal(after.find((tile) => !tile.upgraded).addable, false, 'the one-copy limit counts the card id across variants');
  // And it can come back out: the upgraded copy is never stranded.
  assert.equal(edit.remove('better').ok, true);
  assert.ok(run.sideboard.some((c) => c.instanceId === 'better'));
  edit.cancel();
});

test('a technique (a technique:* tag, not extractable) is its own source', () => {
  const run = freshRun();
  const def = REG.cards.get('quickCut');
  assert.ok(def.tags.some((tag) => tag.startsWith('technique:')) && !def.tags.includes('extractable'));
  run.sideboard = [{ instanceId: 'qc', cardId: 'quickCut', upgraded: false }];
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  assert.equal(model.collection.find((tile) => tile.cardId === 'quickCut').source, 'technique');
  assert.ok(model.filters.source.some((chip) => chip.id === 'technique' && chip.label === 'Technique'));
  const only = deckEditorModel({ registries: REG, run, settings: {}, view: { filters: { source: ['technique'] } } });
  assert.ok(only.collection.length > 0 && only.collection.every((tile) => tile.source === 'technique'));
});

test('under play-in-deck-order the rows keep run.deck order and move one place at a time', () => {
  const run = freshRun();
  const settings = { playInDeckOrder: true };
  const edit = openDeckEdit(REG, run, settings);
  const [first, second] = run.deck;
  const model = deckEditorModel({ registries: REG, run, settings });
  assert.deepEqual(model.deck.map((row) => row.instanceId), run.deck.map((c) => c.instanceId));
  assert.equal(model.deck[0].canUp, false);
  assert.equal(model.deck[0].canDown, true);
  assert.equal(edit.move(first.instanceId, 1).ok, true);
  assert.deepEqual(run.deck.slice(0, 2).map((c) => c.instanceId), [second.instanceId, first.instanceId]);
  assert.equal(openDeckEdit(REG, freshRun(), {}).move(first.instanceId, 1).ok, false, 'no reorder without the setting');
  edit.cancel();
});

test('confirm succeeds only inside the bounds', () => {
  const run = freshRun();
  const edit = openDeckEdit(REG, run, { deckMinSize: run.deck.length + 1 });
  const refused = edit.confirm();
  assert.equal(refused.ok, false);
  assert.match(refused.refusal, /needs at least/);
  edit.add('basic:attack');
  assert.equal(edit.confirm().ok, true);
});

test('the doors: free opens Quick Access and the Armoury, restOnly only a deckEdit place\'s Rest, off none', () => {
  const shrine = locationServices(REG, locationTags(REG, 'shrine'));
  const camp = locationServices(REG, locationTags(REG, 'camp'));
  for (const id of ['shrine', 'inn', 'chapel']) assert.ok(locationTags(REG, id).includes('deckEdit'), `${id} carries deckEdit`);
  assert.equal(locationTags(REG, 'camp').includes('deckEdit'), false, 'the camp does not');
  assert.deepEqual({ ...deckEditorDoors({ settings: {}, services: shrine }) }, { quickAccess: true, armoury: true, rest: false });
  assert.deepEqual({ ...deckEditorDoors({ settings: { deckEditingWhere: 'restOnly' }, services: shrine }) }, { quickAccess: false, armoury: false, rest: true });
  assert.deepEqual({ ...deckEditorDoors({ settings: { deckEditingWhere: 'restOnly' }, services: camp }) }, { quickAccess: false, armoury: false, rest: false });
  assert.deepEqual({ ...deckEditorDoors({ settings: { deckEditing: false }, services: shrine }) }, { quickAccess: false, armoury: false, rest: false });
  assert.deepEqual({ ...deckEditorDoors({ settings: {}, inCombat: true, services: shrine }) }, { quickAccess: false, armoury: false, rest: false });
});

// ---- the DOM ---------------------------------------------------------------

function withDom(fn) {
  const dom = rewardDom();
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.focus = function focus() { dom.document.activeElement = this; this.dispatchEvent(new dom.Event('focus')); };
  proto.replaceChildren = function replaceChildren(...nodes) { this.innerHTML = ''; this.append(...nodes); };
  // The fixture keeps `dataset` and the data-* attributes apart; the kit writes
  // `dataset`, so selectors read it back through the attribute methods.
  const dataKey = (key) => key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const { getAttribute, hasAttribute } = proto;
  proto.getAttribute = function get(key) {
    const own = getAttribute.call(this, key);
    return own === null && key.startsWith('data-') && this.dataset[dataKey(key)] !== undefined ? String(this.dataset[dataKey(key)]) : own;
  };
  proto.insertAdjacentHTML = function insert(_where, markup) {
    const holder = dom.document.createElement('div');
    holder.innerHTML = markup;
    for (const child of [...holder.children]) this.appendChild(child);
  };
  // Markup builders (the kit's html()) read outerHTML; a plain serializer.
  Object.defineProperty(proto, 'outerHTML', {
    configurable: true,
    get() {
      if (this.tagName === 'TEXT') return this.textContent;
      const attrs = new Map(this.attributes);
      for (const [k, v] of Object.entries(this.dataset)) attrs.set(`data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v);
      const open = [this.tagName.toLowerCase(), ...[...attrs].map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)].join(' ');
      return `<${open}>${this.textContent || ''}${this.children.map((c) => c.outerHTML).join('')}</${this.tagName.toLowerCase()}>`;
    },
  });
  proto.hasAttribute = function hasIt(key) {
    return hasAttribute.call(this, key) || (key.startsWith('data-') && this.dataset[dataKey(key)] !== undefined);
  };
  const listeners = new Map();
  const win = {
    ...dom,
    addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) || []), listener]),
    removeEventListener: (type, listener) => listeners.set(type, (listeners.get(type) || []).filter((l) => l !== listener)),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); return true; },
    KeyboardEvent: dom.Event,
    innerWidth: 390,
  };
  const saved = Object.fromEntries(Object.keys(win).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, win);
  try { return fn(dom, win, listeners); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('DOM: tap, ＋/－, a keyboard and a gamepad dispatch add and remove cards; Done and Cancel', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom((dom, win) => {
    const run = freshRun();
    run.sideboard = [];
    const before = editState(run);
    const n = run.deck.length;
    let done = 0;
    let cancelled = 0;
    const editor = mountDeckEditor(document.body, {
      registries: REG, run, settings: { deckMinSize: n }, onDone: () => { done += 1; }, onCancel: () => { cancelled += 1; },
    });
    const root = editor.root;
    assert.equal(root.dataset.uiComponent, 'deck-editor');
    assert.ok(root.classList.contains('modal-veil'), 'a veil, so the focus cursor and the map keys defer to it');
    const counter = () => root.querySelector('.deck-editor-counter');
    const refusal = () => root.querySelector('#deck-editor-refusal');
    const doneButton = () => root.querySelector('#deck-editor-done');
    assert.equal(counter().textContent, `${n} / ${n}–∞`);
    assert.equal(doneButton().disabled, false);

    // Tap a deck row: it leaves the deck, and Done is refused in visible text.
    const card = ordinary(run);
    root.querySelector(`.deck-editor-row[data-instance-id="${card.instanceId}"] .deck-editor-main`).click();
    assert.equal(run.deck.length, n - 1);
    assert.equal(counter().textContent, `${n - 1} / ${n}–∞`);
    assert.equal(counter().dataset.state, 'out');
    assert.equal(doneButton().disabled, true, 'Done is disabled out of bounds');
    assert.equal(doneButton().getAttribute('aria-disabled'), 'true');
    assert.equal(refusal().hasAttribute('hidden'), false, 'the refusal is shown');
    assert.match(refusal().textContent, new RegExp(`\\b${n - 1}\\b.*\\b${n}\\b`), 'and names the count and the bound');
    doneButton().click();
    assert.equal(done, 0, 'a disabled Done confirms nothing');

    // Tap its collection tile: the same instance comes back.
    root.querySelector(`.deck-editor-tile[data-key="card:${deckVariantKey(card)}"] .deck-editor-main`).click();
    assert.ok(run.deck.some((c) => c.instanceId === card.instanceId));
    assert.equal(refusal().hasAttribute('hidden'), true, 'back in bounds, no refusal');

    // ＋ on the Strike tile, － on a row.
    root.querySelector('.deck-editor-tile[data-key="basic:attack"] .deck-editor-step').click();
    assert.equal(run.deck.length, n + 1);
    const minus = root.querySelector(`.deck-editor-row[data-instance-id="${card.instanceId}"] .deck-editor-step[data-action="remove"]`);
    minus.click();
    assert.equal(run.deck.length, n);

    // The keyboard: focus the tile, press +; focus a row, press −.
    root.querySelector(`.deck-editor-tile[data-key="card:${deckVariantKey(card)}"] .deck-editor-main`).focus();
    win.dispatchEvent(new dom.Event('keydown', { key: '+' }));
    assert.equal(run.deck.length, n + 1, 'the window keydown listener adds the focused tile');
    root.querySelector(`.deck-editor-row[data-instance-id="${card.instanceId}"] .deck-editor-main`).focus();
    assert.equal(editor.dispatch({ family: 'keyboard', key: 'Delete' }), true);
    assert.equal(run.deck.length, n);

    // The gamepad: A on a focused tile adds it; RB/LB switch panes; A on a row removes it.
    root.querySelector('.deck-editor-tile[data-key="basic:guard"] .deck-editor-main').focus();
    assert.equal(editor.dispatch({ family: 'controller', button: 0 }), true);
    assert.equal(run.deck.length, n + 1);
    editor.dispatch({ family: 'controller', button: 5 });
    assert.equal(root.querySelector('.deck-editor-panes').dataset.active, 'deck', 'RB moves to the deck pane');
    const guardRow = run.deck.filter((c) => c.equipmentRole === 'guard').at(-1);
    root.querySelector(`.deck-editor-row[data-instance-id="${guardRow.instanceId}"] .deck-editor-main`).focus();
    editor.dispatch({ family: 'controller', button: 0 });
    assert.equal(run.deck.length, n);
    editor.dispatch({ family: 'controller', button: 4 });
    assert.equal(root.querySelector('.deck-editor-panes').dataset.active, 'collection', 'LB moves back');
    // Y cycles the filters: the first press turns a chip on.
    editor.dispatch({ family: 'controller', button: 3 });
    assert.ok(root.querySelectorAll('.deck-editor-chip.on').length >= 2, 'a filter chip and the sort chip are on');

    // B cancels: everything the session changed is back, and the veil is gone.
    editor.dispatch({ family: 'controller', button: 1 });
    assert.equal(cancelled, 1);
    assert.deepEqual(editState(run), before, 'Cancel restores both piles, the slots, the guards and the mint counter');
    assert.equal(root.isConnected, false);
    assert.equal(editor.dispatch({ family: 'keyboard', key: '+' }), false, 'a closed editor answers nothing');
  });
});

test('DOM: Start confirms inside the bounds, and the Escape key cancels', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom((dom, win) => {
    const run = freshRun();
    let done = 0;
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings: { deckMinSize: 1 }, onDone: () => { done += 1; } });
    editor.root.querySelector('.deck-editor-tile[data-key="basic:attack"] .deck-editor-main').click();
    const size = run.deck.length;
    editor.dispatch({ family: 'controller', button: 9 });
    assert.equal(done, 1, 'Start is Done');
    assert.equal(run.deck.length, size, 'a confirmed edit stays');

    const again = freshRun();
    const before = editState(again);
    let cancelled = 0;
    const second = mountDeckEditor(document.body, { registries: REG, run: again, settings: {}, onCancel: () => { cancelled += 1; } });
    second.root.querySelector('.deck-editor-tile[data-key="basic:guard"] .deck-editor-step').click();
    win.dispatchEvent(new dom.Event('keydown', { key: 'Escape' }));
    assert.equal(cancelled, 1);
    assert.deepEqual(editState(again), before);
  });
});

test('DOM: a held row moves with the arrows under play-in-deck-order', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom(() => {
    const run = freshRun();
    const [first, second] = run.deck;
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings: { playInDeckOrder: true } });
    editor.root.querySelector(`.deck-editor-row[data-instance-id="${first.instanceId}"] .deck-editor-main`).focus();
    assert.equal(editor.dispatch({ family: 'controller', button: 2 }), true, 'X picks the focused row up');
    assert.ok(editor.root.querySelector(`.deck-editor-row[data-instance-id="${first.instanceId}"]`).classList.contains('held'));
    editor.dispatch({ family: 'controller', button: 13 });
    assert.deepEqual(run.deck.slice(0, 2).map((c) => c.instanceId), [second.instanceId, first.instanceId], 'D-pad down moves it');
    editor.dispatch({ family: 'keyboard', key: 'ArrowUp' });
    assert.equal(run.deck[0].instanceId, first.instanceId, 'the arrow key moves it back');
    editor.dispatch({ family: 'controller', button: 0 });
    assert.equal(editor.root.querySelector('.deck-editor-row.held'), null, 'A drops it');
    editor.root.querySelector(`.deck-editor-row[data-instance-id="${second.instanceId}"] .deck-editor-order[data-action="up"]`).click();
    assert.equal(run.deck[0].instanceId, second.instanceId, 'the ▲ button reorders too');
    editor.close();
  });
});

test('DOM: a finger drag moves cards between panes and reorders rows (pointer events, Codex review on #1372)', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom((dom) => {
    const run = freshRun();
    const settings = { playInDeckOrder: true, deckMinSize: 1 };
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings, dragHoldMs: 0 });
    const root = editor.root;
    // Hit-testing: the release point names the element under it.
    let under = null;
    document.elementFromPoint = () => under;
    const fire = (node, type, x, y, pointerType = 'touch') => node.dispatchEvent(new dom.Event(type, {
      bubbles: true, pointerId: 7, pointerType, button: 0, clientX: x, clientY: y,
    }));
    const drag = (source, target, pointerType) => {
      fire(source, 'pointerdown', 10, 10, pointerType);
      under = target;
      fire(source, 'pointermove', 10, 60, pointerType);
      fire(source, 'pointerup', 10, 60, pointerType);
      under = null;
    };
    const card = ordinary(run);
    const rowMain = (id) => root.querySelector(`.deck-editor-row[data-instance-id="${id}"] .deck-editor-main`);
    const pane = (id) => root.querySelector(`[data-pane="${id}"]`);
    const size = run.deck.length;

    // A row dropped on the collection pane leaves the deck.
    drag(rowMain(card.instanceId), pane('collection').querySelector('.deck-editor-list'));
    assert.equal(run.deck.length, size - 1);
    assert.ok(run.sideboard.some((c) => c.instanceId === card.instanceId));
    // Its tile dropped on the deck pane comes back.
    const tileMain = root.querySelector(`.deck-editor-tile[data-key="card:${deckVariantKey(card)}"] .deck-editor-main`);
    drag(tileMain, pane('deck').querySelector('.deck-editor-pane-title'));
    assert.equal(run.deck.length, size);
    assert.ok(run.deck.some((c) => c.instanceId === card.instanceId), 'the same instance returns');
    // A row dropped on another row takes its place.
    const [first, second] = run.deck;
    drag(rowMain(second.instanceId), root.querySelector(`.deck-editor-row[data-instance-id="${first.instanceId}"]`));
    assert.equal(run.deck[0].instanceId, second.instanceId, 'reordered by the drop');
    // A press that never passes the slop is a tap, left to the click path.
    const before = run.deck.map((c) => c.instanceId);
    fire(rowMain(first.instanceId), 'pointerdown', 10, 10);
    under = pane('collection');
    fire(rowMain(first.instanceId), 'pointermove', 12, 13);
    fire(rowMain(first.instanceId), 'pointerup', 12, 13);
    assert.deepEqual(run.deck.map((c) => c.instanceId), before, 'a short press drags nothing');
    // A tile let go outside any target changes nothing.
    drag(root.querySelector('.deck-editor-tile[data-key="basic:attack"] .deck-editor-main'), null);
    assert.deepEqual(run.deck.map((c) => c.instanceId), before, 'no target, no move');
    editor.close();

    // With the real hold, a finger that moves at once is scrolling, not dragging.
    const again = freshRun();
    const held = mountDeckEditor(document.body, { registries: REG, run: again, settings: { deckMinSize: 1 } });
    const target = again.deck.find((c) => !c.equipmentRole && !c.grantedBy);
    const main = held.root.querySelector(`.deck-editor-row[data-instance-id="${target.instanceId}"] .deck-editor-main`);
    fire(main, 'pointerdown', 10, 10);
    under = held.root.querySelector('[data-pane="collection"]');
    fire(main, 'pointermove', 10, 80);
    fire(main, 'pointerup', 10, 80);
    assert.ok(again.deck.includes(target), 'a swipe before the hold scrolls instead');
    held.close();
    delete document.elementFromPoint;
  });
});

test('DOM: the Quick Access door shows under free only; the shrine Rest card under restOnly only', async () => {
  const { runHudHtml } = await import('../src/ui/components/runHud.js');
  const { mountRest } = await import('../src/ui/screens/rest.js');
  const { createLocationVisit } = await import('../src/engine/locations.js');
  withDom(() => {
    const run = freshRun();
    const meta = { settings: {} };
    for (const [settings, shown] of [[{}, true], [{ deckEditingWhere: 'restOnly' }, false], [{ deckEditing: false }, false]]) {
      const doors = deckEditorDoors({ settings });
      const markup = runHudHtml({ registries: REG, run, meta, place: 'map', deckDoor: doors.quickAccess });
      assert.equal(markup.includes('id="open-deck-editor"'), shown, `Quick Access door under ${JSON.stringify(settings)}`);
      assert.equal(markup.includes('data-ui-component="deck-editor-control"'), shown);
    }
    for (const [settings, locationId, shown] of [
      [{ deckEditingWhere: 'restOnly' }, 'shrine', true],
      [{ deckEditingWhere: 'restOnly' }, 'camp', false],
      [{}, 'shrine', false],
      [{ deckEditing: false, deckEditingWhere: 'restOnly' }, 'shrine', false],
    ]) {
      const app = document.createElement('main');
      document.body.append(app);
      const visit = createLocationVisit({ run, registries: REG, rng: null }, locationId, {});
      let opened = 0;
      const door = deckEditorDoors({ settings, services: visit.services }).rest ? { onOpen: () => { opened += 1; } } : null;
      mountRest(app, { registries: REG, run, meta, onDone() {}, visit, deckEditor: door });
      const card = app.querySelector('#deck-opt');
      assert.equal(!!card, shown, `the ${locationId} Rest card under ${JSON.stringify(settings)}`);
      if (card) {
        card.click();
        assert.equal(opened, 1, 'the Rest card opens the editor');
      }
      app.remove();
    }
  });
});
