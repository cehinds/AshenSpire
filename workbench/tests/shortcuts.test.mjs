// node --test workbench/tests/shortcuts.test.mjs — the shortcut registry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShortcutRegistry, normalizeCombo, comboFromEvent, comboLabel, TYPING_SELECTOR } from '../ui/kit/shortcuts.mjs';

// A key event as the browser would describe it.
const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods, preventDefault() { this.prevented = true; } });
const stub = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};

test('combos are normalized and shown with Ctrl', () => {
  assert.equal(normalizeCombo('ctrl+k'), 'Mod+K');
  assert.equal(normalizeCombo('Shift+Mod+z'), 'Mod+Shift+Z');
  assert.equal(normalizeCombo('?'), '?');
  assert.equal(normalizeCombo('Alt+1'), 'Alt+1');
  assert.equal(normalizeCombo(''), '');
  assert.equal(comboLabel('Mod+Shift+Z'), 'Ctrl+Shift+Z');
});

test('a key event becomes the same combo the registry uses', () => {
  assert.equal(comboFromEvent(key('k', { ctrlKey: true })), 'Mod+K');
  assert.equal(comboFromEvent(key('Z', { ctrlKey: true, shiftKey: true })), 'Mod+Shift+Z');
  assert.equal(comboFromEvent(key('?', { shiftKey: true })), '?', 'Shift is not part of a symbol');
  assert.equal(comboFromEvent(key('\\', { ctrlKey: true })), 'Mod+\\');
  assert.equal(comboFromEvent(key('1', { altKey: true })), 'Alt+1');
  assert.equal(comboFromEvent(key('Control', { ctrlKey: true })), '', 'a lone modifier is no combo');
});

test('the active module runs first, then the global action', () => {
  const r = new ShortcutRegistry();
  const seen = [];
  r.register('global', 'Mod+K', 'Palette', () => { seen.push('global'); });
  r.register('data', 'Mod+K', 'Data search', () => { seen.push('data'); });
  r.register('data', 'Mod+D', 'Duplicate', () => { seen.push('dup'); });
  assert.equal(r.run('Mod+K', 'data'), true);
  assert.equal(r.run('Mod+K', 'layout'), true);
  assert.equal(r.run('Mod+D', 'layout'), false, 'a module action is silent in other modules');
  assert.deepEqual(seen, ['data', 'global']);
});

test('a handler that returns false passes the key on', () => {
  const r = new ShortcutRegistry();
  const seen = [];
  r.register('data', 'Mod+Z', 'Undo', () => false);
  r.register('global', 'Mod+Z', 'Undo all', () => { seen.push('global'); });
  assert.equal(r.run('Mod+Z', 'data'), true);
  assert.deepEqual(seen, ['global']);
});

test('dispatch takes a key event, prevents the default only when handled, and respects inInput', () => {
  const r = new ShortcutRegistry();
  let hits = 0;
  r.register('global', '?', 'Help', () => { hits += 1; });
  r.register('global', 'Mod+Z', 'Undo', () => { hits += 10; return false; }, { inInput: false });
  const plain = key('?');
  assert.equal(r.dispatch(plain, 'global'), true);
  assert.equal(plain.prevented, true);
  const typing = key('?'); typing.target = { closest: (sel) => (sel.includes('input') ? {} : null) };
  assert.equal(r.dispatch(typing, 'global'), false, 'bare keys do not fire while typing');
  assert.equal(typing.prevented, undefined);
  const undo = key('z', { ctrlKey: true }); undo.target = { closest: () => ({}) };
  r.register('global', 'Mod+Y', 'Redo', () => { hits += 100; }, { inInput: true });
  assert.equal(r.dispatch(undo, 'global'), false, 'Ctrl+Z defers to the text field when inInput is false');
  assert.equal(hits, 1);
});

test('while typing, Ctrl combos do not fire unless registered with inInput: true', () => {
  const r = new ShortcutRegistry();
  let hits = [];
  r.register('data', 'Mod+D', 'Duplicate', () => { hits.push('dup'); });
  r.register('global', 'Mod+K', 'Palette', () => { hits.push('palette'); }, { inInput: true });
  for (const attrs of [{ closest: () => ({}) }]) {
    const ev = key('d', { ctrlKey: true }); ev.target = attrs;
    assert.equal(r.dispatch(ev, 'data'), false, 'Mod+D defaults to inInput false');
    assert.equal(ev.prevented, undefined);
  }
  const k = key('k', { ctrlKey: true }); k.target = { closest: () => ({}) };
  assert.equal(r.dispatch(k, 'data'), true, 'an explicit inInput: true still fires');
  assert.deepEqual(hits, ['palette']);
});

test('every kind of text field counts as typing, including contenteditable variants', () => {
  // No DOM here, so check the selector text: it names the fields, and any
  // contenteditable except "false" (covers "", "true" and "plaintext-only").
  const parts = TYPING_SELECTOR.split(', ');
  for (const tag of ['input', 'textarea', 'select']) assert.ok(parts.includes(tag), `${tag} is typing`);
  assert.ok(parts.includes('[contenteditable]:not([contenteditable="false"])'), 'contenteditable other than "false" is typing');
});

test('an action without inInput does not run while typing in a contenteditable field', () => {
  const r = new ShortcutRegistry();
  let hits = 0;
  r.register('global', 'Mod+A', 'Select all', () => { hits += 1; });
  const editable = key('a', { ctrlKey: true }); editable.target = { closest: (sel) => (sel === TYPING_SELECTOR ? {} : null) };
  assert.equal(r.dispatch(editable, 'global'), false);
  const plain = key('a', { ctrlKey: true }); plain.target = { closest: () => null };
  assert.equal(r.dispatch(plain, 'global'), true);
  assert.equal(hits, 1);
});

test('remapping persists in storage and is read back by a new registry', () => {
  const storage = stub();
  const r = new ShortcutRegistry({ storage });
  r.register('data', 'Mod+D', 'Duplicate', () => {});
  r.register('data', 'Mod+G', 'Group', () => {});
  const id = 'data:Duplicate';
  assert.deepEqual(r.combos(id), ['Mod+D']);
  assert.deepEqual(r.setCombo(id, 'ctrl+shift+j'), { ok: true, combo: 'Mod+Shift+J' });
  assert.equal(r.labelOf(id), 'Ctrl+Shift+J');
  assert.equal(r.run('Mod+D', 'data'), false, 'the old combo no longer fires');
  assert.equal(JSON.parse(storage.data.get('wb.shortcuts'))[id], 'Mod+Shift+J');

  const again = new ShortcutRegistry({ storage });
  again.register('data', 'Mod+D', 'Duplicate', () => {});
  assert.deepEqual(again.combos(id), ['Mod+Shift+J'], 'the remap survives a reload');
  assert.equal(again.isOverridden(id), true);
  again.resetCombo(id);
  assert.deepEqual(again.combos(id), ['Mod+D']);
  assert.equal(new ShortcutRegistry({ storage }).isOverridden(id), false);
});

test('a remap that clashes in the same scope or with a global action is refused', () => {
  const r = new ShortcutRegistry({ storage: stub() });
  r.register('global', 'Mod+K', 'Palette', () => {});
  r.register('data', 'Mod+D', 'Duplicate', () => {});
  r.register('layout', 'Mod+D', 'Layout dup', () => {});
  assert.deepEqual(r.setCombo('data:Duplicate', 'Mod+K'), { ok: false, reason: 'conflict', label: 'Palette', scope: 'global' });
  assert.equal(r.setCombo('data:Duplicate', 'Mod+D').ok, true, 'keeping its own combo is fine');
  assert.equal(r.setCombo('layout:Layout dup', 'Mod+X').ok, true);
  assert.equal(r.setCombo('nope:Nothing', 'Mod+Q').reason, 'unknown');
});

test('a broken or hand-edited overrides value is ignored, not fatal', () => {
  const storage = stub();
  storage.setItem('wb.shortcuts', '{not json');
  assert.doesNotThrow(() => new ShortcutRegistry({ storage }));
  storage.setItem('wb.shortcuts', JSON.stringify({ 'data:Duplicate': 42, 'data:Group': 'Mod+G' }));
  const r = new ShortcutRegistry({ storage });
  r.register('data', 'Mod+D', 'Duplicate', () => {});
  assert.deepEqual(r.combos('data:Duplicate'), ['Mod+D']);
});

test('list() reports every action with its effective combos, and unregister removes it', () => {
  const r = new ShortcutRegistry({ storage: stub() });
  const off = r.register('global', ['Mod+1', 'Alt+1'], 'Go to Home', () => {});
  assert.equal(r.list()[0].combos[0], 'Mod+1');
  off();
  assert.equal(r.list().length, 0);
});
