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

test('set-aside basics: each kept variant is its own tile, shown and chosen as itself (Codex review on #1372)', () => {
  const modded = { instanceId: 'm1', cardId: 'defend', upgraded: false, mods: [Object.keys(REG.equipment.modFields || {})[0] || 'mod'] };
  const run = {
    class: 'reaver', editMintCounter: 0,
    deck: [{ instanceId: 's1', cardId: 'strike', upgraded: false }],
    sideboard: [{ instanceId: 'u1', cardId: 'strike', upgraded: true }, { instanceId: 'u2', cardId: 'strike', upgraded: true }, modded],
  };
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  const strikePlus = model.collection.find((tile) => tile.key === `kept:${deckVariantKey(run.sideboard[0])}`);
  assert.ok(strikePlus, 'the kept Strike+ has its own tile');
  assert.equal(strikePlus.name, `${REG.cards.get('strike').name}+`, 'shown as the upgraded card');
  assert.equal(strikePlus.countText, '2 set aside · upgraded');
  assert.ok(model.collection.some((tile) => tile.key === `kept:${deckVariantKey(modded)}`), 'the modded Defend is another tile');
  assert.equal(model.collection.find((tile) => tile.key === 'basic:strike').upgraded, false, 'the ∞ tile is a fresh Strike');
  const upgradedOnly = deckEditorModel({ registries: REG, run, settings: {}, view: { filters: { upgraded: true } } });
  assert.deepEqual(upgradedOnly.collection.map((tile) => tile.key), [strikePlus.key], 'the Upgraded filter finds exactly the kept Strike+');
  const edit = openDeckEdit(REG, run, {});
  assert.equal(edit.add(`kept:${deckVariantKey(modded)}`).ok, true);
  assert.equal(run.deck.at(-1).instanceId, 'm1', 'the modded Defend tile restores exactly it');
  assert.equal(edit.add('basic:defend').ok, true);
  assert.equal(run.deck.at(-1).instanceId, 'edit:1', 'the ∞ Defend mints');
  edit.cancel();
});

test('an equipped run never splits a role basic: its upgrade comes from the source piece', () => {
  const run = freshRun();
  const strike = run.deck.find((c) => c.equipmentRole === 'attack' && !c.grantedBy);
  strike.upgraded = true;
  const edit = openDeckEdit(REG, run, {});
  edit.remove(strike.instanceId);
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  assert.deepEqual(model.collection.filter((tile) => tile.source === 'basic').map((tile) => tile.key), ['basic:attack', 'basic:guard'],
    'stampDeck restamps every attack copy from its weapon, so there is no kept variant to choose');
  assert.equal(edit.add('basic:attack').ok, true);
  const slots = [...run.deck, ...run.sideboard].map((c) => c.equipmentAttackSlotId).filter(Boolean);
  assert.equal(new Set(slots).size, slots.length, 'no two attack instances share a slot');
  edit.cancel();
});

test('a plain run: a kept Strike+ has its own tile, and the ∞ tile mints a new Strike', () => {
  const run = {
    class: 'reaver', editMintCounter: 0,
    deck: [{ instanceId: 's1', cardId: 'strike', upgraded: false }],
    sideboard: [{ instanceId: 's2', cardId: 'strike', upgraded: true }],
  };
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  assert.deepEqual(model.collection.filter((tile) => tile.source === 'basic').map((tile) => tile.key),
    ['basic:strike', 'basic:defend', `kept:${deckVariantKey(run.sideboard[0])}`]);
  const edit = openDeckEdit(REG, run, {});
  assert.equal(edit.add('basic:strike').ok, true);
  assert.equal(run.deck.at(-1).instanceId, 'edit:1', 'minted, not the kept Strike+');
  assert.equal(edit.add(`kept:${deckVariantKey({ cardId: 'strike', upgraded: true })}`).ok, true);
  assert.equal(run.deck.at(-1).instanceId, 's2');
  edit.cancel();
});

test('a locked card names its piece for a bare id and for both namespaced refs (Codex review on #1372)', () => {
  const armament = REG.equipment.armaments[0];
  const armour = REG.equipment.armour.find((a) => a.classId && a.name);
  for (const [grantedBy, name] of [
    [armament.id, armament.name],
    [`armament/${armament.id}`, armament.name],
    [`armor/${armour.classId}/${armour.id}`, armour.name],
  ]) {
    const run = freshRun();
    run.deck.push({ instanceId: `lock-${grantedBy}`, cardId: 'strike', upgraded: false, equipmentRole: 'granted', grantedBy });
    const row = deckEditorModel({ registries: REG, run, settings: {} }).deck.find((r) => r.instanceId === `lock-${grantedBy}`);
    assert.equal(row.lockText, `Locked · ${name}`, `grantedBy '${grantedBy}' names ${name}`);
  }
});

test('unordered, the deck list is one row per variant with a ×N count; ordered, one row per copy (SPEC §14.7, Codex review on #1372)', () => {
  // A fresh Starseer: its three attack-slot Strikes and two guard Defends are one row each.
  const fresh = createRunState({ seed: 0x5eed, classId: 'starseer', registries: REG });
  const freshModel = deckEditorModel({ registries: REG, run: fresh, settings: {} });
  const attacks = fresh.deck.filter((c) => c.equipmentRole === 'attack');
  const guards = fresh.deck.filter((c) => c.equipmentRole === 'guard');
  assert.ok(attacks.length > 1 && guards.length > 1);
  assert.equal(freshModel.deck.filter((row) => attacks.some((c) => row.instanceIds.includes(c.instanceId))).length, 1, 'one Strike row');
  assert.equal(freshModel.deck.find((row) => row.instanceIds.includes(attacks[0].instanceId)).countText, `×${attacks.length}`);
  assert.equal(freshModel.deck.find((row) => row.instanceIds.includes(guards[0].instanceId)).countText, `×${guards.length}`, 'one Defend row');
  assert.equal(deckEditorModel({ registries: REG, run: fresh, settings: { playInDeckOrder: true } }).deck.length, fresh.deck.length);
  const run = freshRun();
  run.deck.push({ instanceId: 'x1', cardId: 'strike', upgraded: false }, { instanceId: 'x2', cardId: 'strike', upgraded: false }, { instanceId: 'x3', cardId: 'strike', upgraded: true });
  const grouped = deckEditorModel({ registries: REG, run, settings: {} });
  const plain = grouped.deck.filter((row) => row.cardId === 'strike' && !row.upgraded && !row.locked && !row.instanceIds.some((id) => !['x1', 'x2'].includes(id)));
  assert.equal(plain.length, 1, 'two plain copies are one row');
  assert.equal(plain[0].count, 2);
  assert.equal(plain[0].countText, '×2');
  assert.equal(plain[0].instanceId, 'x2', 'the row removes its last copy');
  assert.equal(grouped.deck.find((row) => row.instanceIds.includes('x3')).count, 1, 'the upgraded copy is its own row');
  assert.equal(grouped.deck.reduce((sum, row) => sum + row.count, 0), run.deck.length, 'every copy is counted once');
  const ordered = deckEditorModel({ registries: REG, run, settings: { playInDeckOrder: true } });
  assert.equal(ordered.deck.length, run.deck.length, 'ordered: one row per copy');
  assert.ok(ordered.deck.every((row) => row.count === 1));
  // Removing from the grouped row takes one copy: the count drops.
  const edit = openDeckEdit(REG, run, {});
  assert.equal(edit.remove(plain[0].instanceId).ok, true);
  const after = deckEditorModel({ registries: REG, run, settings: {} }).deck.find((row) => row.instanceIds.includes('x1'));
  assert.equal(after.count, 1);
  edit.cancel();
});

test('every card type the content uses has its own filter label', async () => {
  const { has } = await import('../src/ui/strings.js');
  const types = [...new Set(REG.cards.all().map((def) => def.type))];
  for (const type of types) assert.ok(has(`deckEditor.type.${type}`), `uiStrings has deckEditor.type.${type}`);
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
  // What the Tab wrap (modalShell.bindModalDismiss) reads off a control.
  proto.contains = function contains(node) { for (let at = node; at; at = at.parentNode) if (at === this) return true; return false; };
  proto.getClientRects = function rects() { return this.isConnected ? [{}] : []; };
  Object.defineProperty(proto, 'tabIndex', { configurable: true, get() { return ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : Number(this.getAttribute('tabindex') ?? -1); } });
  const { matches } = proto;
  proto.matches = function match(selector) {
    if (selector === ':disabled') return !!this.disabled;
    if (selector === '[inert]') return this.hasAttribute('inert');
    return matches.call(this, selector);
  };
  const listeners = new Map();
  const docListeners = new Map();
  const add = (map) => (type, listener) => map.set(type, [...(map.get(type) || []), listener]);
  const drop = (map) => (type, listener) => map.set(type, (map.get(type) || []).filter((l) => l !== listener));
  dom.document.addEventListener = add(docListeners);
  dom.document.removeEventListener = drop(docListeners);
  dom.document.getElementById = (id) => dom.document.body.querySelector(`#${id}`);
  dom.document.activeElement = dom.document.body;
  const win = {
    ...dom,
    addEventListener: add(listeners),
    removeEventListener: drop(listeners),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); return true; },
    KeyboardEvent: dom.Event,
    MouseEvent: dom.Event,
    PointerEvent: dom.Event,
    innerWidth: 390,
    // A key press as a browser delivers it: window capture (input.js), then
    // document capture (the modal shell), then window bubble, unless stopped.
    press(key, extra = {}) {
      const event = new dom.Event('keydown', { key, bubbles: true, target: dom.document.activeElement, ...extra });
      const [first, ...rest] = listeners.get('keydown') || [];
      const run = (fnList) => { for (const l of fnList) { if (event.immediatePropagationStopped) return; l(event); } };
      if (first) run([first]);
      if (!event.immediatePropagationStopped) run(docListeners.get('keydown') || []);
      if (!event.immediatePropagationStopped && !event.propagationStopped) run(rest);
      return event;
    },
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

test('DOM: the editor is a real modal — Tab wraps inside it, and the page under it is inert', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom((dom, win) => {
    // The page the editor opens over: the atlas header's Save & quit and a Deck door.
    const app = document.createElement('div');
    app.id = 'app';
    const saveQuit = document.createElement('button');
    saveQuit.setAttribute('data-atlas-quit', '');
    const door = document.createElement('button');
    door.setAttribute('data-atlas-deck', '');
    app.append(saveQuit, door);
    document.body.append(app);
    const run = freshRun();
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings: {} });
    assert.equal(app.hasAttribute('inert'), true, 'everything beside the veil is inert');
    const panel = editor.root.querySelector('.deck-editor');
    assert.equal(panel.getAttribute('aria-modal'), 'true');
    const controls = [...panel.querySelectorAll('button')].filter((b) => !b.disabled);
    const [first, last] = [controls[0], controls.at(-1)];
    last.focus();
    win.press('Tab');
    assert.equal(document.activeElement, first, 'Tab from the last control wraps to the first');
    win.press('Tab', { shiftKey: true });
    assert.equal(document.activeElement, last, 'Shift+Tab from the first wraps to the last');
    // Focus that has escaped the panel is pulled back in, never onto the page.
    saveQuit.focus();
    win.press('Tab');
    assert.ok(panel.contains(document.activeElement), 'Tab from outside lands inside the editor');
    assert.notEqual(document.activeElement, saveQuit);
    assert.notEqual(document.activeElement, door);
    // Escape reaches the modal shell and cancels (topmost modal only).
    win.press('Escape');
    assert.equal(editor.root.isConnected, false);
    assert.equal(app.hasAttribute('inert'), false, 'closing gives the page back');
  });
});

test('DOM: [ and ] switch panes once, through input.js\'s real listener', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  const { initInput } = await import('../src/ui/input.js');
  withDom((dom, win) => {
    initInput({ getSettings: () => ({}) });
    const editor = mountDeckEditor(document.body, { registries: REG, run: freshRun(), settings: {} });
    const active = () => editor.root.querySelector('.deck-editor-panes').dataset.active;
    assert.equal(active(), 'collection');
    win.press(']');
    assert.equal(active(), 'deck', '] moves to the deck pane (once)');
    win.press(']');
    assert.equal(active(), 'collection', 'and again wraps back');
    win.press('[');
    assert.equal(active(), 'deck', '[ moves the other way');
    editor.close();
  });
});

test('DOM: under Play in deck order no sort chip is offered', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom(() => {
    const ordered = mountDeckEditor(document.body, { registries: REG, run: freshRun(), settings: { playInDeckOrder: true } });
    const sortChips = (editor) => editor.root.querySelectorAll('.deck-editor-chip').filter((c) => String(c.dataset.focusKey).startsWith('sort:'));
    assert.equal(sortChips(ordered).length, 0);
    ordered.close();
    const sorted = mountDeckEditor(document.body, { registries: REG, run: freshRun(), settings: {} });
    assert.equal(sortChips(sorted).length, 4);
    sorted.close();
  });
});

test('DOM: Enter on the Rest card through input.js\'s real listener opens exactly one editor (Codex review on #1372)', async () => {
  const { mountRest } = await import('../src/ui/screens/rest.js');
  const { createLocationVisit } = await import('../src/engine/locations.js');
  const { initInput, focusElement } = await import('../src/ui/input.js');
  withDom((dom, win) => {
    initInput({ getSettings: () => ({}) });
    const run = freshRun();
    const app = document.createElement('main');
    app.id = 'app';
    document.body.append(app);
    const visit = createLocationVisit({ run, registries: REG, rng: null }, 'shrine', {});
    let opened = 0;
    mountRest(app, { registries: REG, run, meta: { settings: {} }, onDone() {}, visit, deckEditor: { onOpen: () => { opened += 1; } } });
    const card = app.querySelector('#deck-opt');
    card.focus();
    focusElement(card);
    win.press('Enter');
    assert.ok(opened <= 1, `Enter opened the editor ${opened} times`);
    // With no focus cursor on it (a plain browser Enter on the focused card), the card's own handler opens it once.
    opened = 0;
    const plain = new dom.Event('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    card.dispatchEvent(plain);
    assert.equal(opened, 1, 'the card\'s own Enter opens it once');
    const consumed = new dom.Event('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    consumed.preventDefault();
    card.dispatchEvent(consumed);
    assert.equal(opened, 1, 'a keydown already consumed opens nothing more');
    app.remove();
  });
});

test('DOM: a grouped deck row shows ×N and its － takes one copy', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom(() => {
    const run = freshRun();
    run.deck.push({ instanceId: 'x1', cardId: 'strike', upgraded: false }, { instanceId: 'x2', cardId: 'strike', upgraded: false });
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings: {} });
    const row = () => editor.root.querySelector('.deck-editor-row[data-instance-id="x2"]') || editor.root.querySelector('.deck-editor-row[data-instance-id="x1"]');
    assert.equal(row().querySelector('.deck-editor-count').textContent, '×2');
    row().querySelector('.deck-editor-step[data-action="remove"]').click();
    assert.ok(!run.deck.some((c) => c.instanceId === 'x2') && run.deck.some((c) => c.instanceId === 'x1'), 'one copy left');
    assert.equal(row().querySelector('.deck-editor-count'), null, 'a single copy shows no count');
    editor.close();
  });
});

test('DOM: a collection tile carries no ×N badge (Codex review on #1372)', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom(() => {
    const editor = mountDeckEditor(document.body, { registries: REG, run: freshRun(), settings: {} });
    const tiles = editor.root.querySelectorAll('.deck-editor-tile');
    assert.ok(tiles.length > 0);
    for (const tile of tiles) assert.equal(tile.querySelector('.deck-editor-count'), null, `tile ${tile.dataset.key} has no badge`);
    editor.close();
  });
});

test('DOM: with a row held, Escape and pad B cancel the whole edit; Enter, A and X only drop (Codex review on #1372)', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  const { initInput } = await import('../src/ui/input.js');
  withDom((dom, win) => {
    initInput({ getSettings: () => ({}) });
    const settings = { playInDeckOrder: true };
    const pickUp = (editor, run) => {
      editor.root.querySelector(`.deck-editor-row[data-instance-id="${run.deck[0].instanceId}"] .deck-editor-main`).focus();
      editor.dispatch({ family: 'controller', button: 2 });
      assert.ok(editor.root.querySelector('.deck-editor-row.held'), 'a row is held');
    };
    for (const [how, fire] of [
      ['Escape through the real input listener', (editor) => win.press('Escape')],
      ['pad B', (editor) => editor.dispatch({ family: 'controller', button: 1 })],
    ]) {
      const run = freshRun();
      const before = editState(run);
      let cancelled = 0;
      const editor = mountDeckEditor(document.body, { registries: REG, run, settings, onCancel: () => { cancelled += 1; } });
      pickUp(editor, run);
      editor.dispatch({ family: 'controller', button: 13 }); // move it, so there is something to restore
      fire(editor);
      assert.equal(cancelled, 1, `${how} cancels the edit`);
      assert.equal(editor.root.isConnected, false, `${how} closes the editor`);
      assert.deepEqual(editState(run), before, `${how} restores the deck order`);
    }
    for (const [how, fire] of [
      ['Enter', (editor) => editor.dispatch({ family: 'keyboard', key: 'Enter' })],
      ['pad A', (editor) => editor.dispatch({ family: 'controller', button: 0 })],
      ['pad X', (editor) => editor.dispatch({ family: 'controller', button: 2 })],
    ]) {
      const run = freshRun();
      const editor = mountDeckEditor(document.body, { registries: REG, run, settings });
      pickUp(editor, run);
      fire(editor);
      assert.equal(editor.root.isConnected, true, `${how} keeps the editor open`);
      assert.equal(editor.root.querySelector('.deck-editor-row.held'), null, `${how} drops the row`);
      editor.close();
    }
  });
});

test('DOM: a second editor cannot open while one is live', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom(() => {
    const run = freshRun();
    const first = mountDeckEditor(document.body, { registries: REG, run, settings: {} });
    const second = mountDeckEditor(document.body, { registries: REG, run, settings: {} });
    assert.equal(second, first, 'the live editor is returned, no second session');
    assert.equal(document.body.querySelectorAll('.deck-editor-veil').length, 1);
    first.close();
    const third = mountDeckEditor(document.body, { registries: REG, run, settings: {} });
    assert.notEqual(third, first, 'after closing, a new editor opens');
    third.close();
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
