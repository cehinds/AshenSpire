// node --test workbench/tests/configuration-model.test.mjs — the Configuration studio's pure model.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../modules/configuration/model.mjs';

test('profileFiles offers game.json, presets and bundles, and nothing else', () => {
  const out = C.profileFiles([
    'games/ashenspire/presets/current.json',
    'games/ashenspire/game.lock.json',
    'games/ashenspire/bundles/core/bundle.json',
    'games/ashenspire/packs/core/pack.json',
    'games/ashenspire/game.json',
    'games/ashenspire/presets/core.json',
    'games/ashenspire/bundles/current/bundle.json',
    'games/ashenspire/bundles/current/other.json',
  ]);
  assert.deepEqual(out.map((f) => f.path), [
    'games/ashenspire/game.json',
    'games/ashenspire/presets/core.json',
    'games/ashenspire/presets/current.json',
    'games/ashenspire/bundles/core/bundle.json',
    'games/ashenspire/bundles/current/bundle.json',
  ]);
  assert.deepEqual(out.map((f) => f.resolves), [true, true, true, false, false]);
});

test('moduleFiles and moduleEntry list modules from module.json paths, tolerating odd manifests', () => {
  const out = C.moduleFiles(['engine/modules/b/module.json', 'engine/modules/a/module.json', 'engine/modules/a/guide.md', 'engine/kernel/module.json']);
  assert.deepEqual(out.map((m) => m.id), ['a', 'b']);
  assert.equal(out[0].guide, 'engine/modules/a/guide.md');
  assert.deepEqual(C.moduleEntry('a', { name: 'Alpha', description: 'D', version: '1.0.0' }), { id: 'a', name: 'Alpha', description: 'D', version: '1.0.0' });
  assert.deepEqual(C.moduleEntry('a', null), { id: 'a', name: 'a', description: '', version: '' });
  assert.equal(C.moduleEntry('a', {}, '# `a` module guide\n\nDoes A things.\n\nMore.').description, 'Does A things.');
  assert.equal(C.guideSummary(undefined), '');
});

test('authorState reads false, true, an object, or nothing', () => {
  const a = { modules: { off: false, on: true, set: { x: 1 } } };
  assert.equal(C.authorState(a, 'off').state, 'off');
  assert.equal(C.authorState(a, 'on').state, 'on');
  assert.deepEqual(C.authorState(a, 'set'), { state: 'on', settings: { x: 1 } });
  assert.equal(C.authorState(a, 'none').state, 'inherit');
  assert.equal(C.authorState(null, 'x').state, 'inherit');
});

test('schemaFields maps string, number, boolean and enum; anything else is read-only json', () => {
  const fields = C.schemaFields({
    properties: {
      mode: { enum: ['a', 'b'] }, n: { type: 'integer', minimum: 1, maximum: 5 }, f: { type: 'number' }, s: { type: 'string' }, b: { type: 'boolean' },
      list: { type: 'array' }, mixed: { enum: [{ x: 1 }] }, odd: 7, any: { anyOf: [{ type: 'string' }] },
    },
    required: ['mode'],
  }, { mode: 'a', n: 2 });
  assert.deepEqual(fields.map((f) => [f.key, f.kind]), [['mode', 'enum'], ['n', 'number'], ['f', 'number'], ['s', 'string'], ['b', 'boolean'], ['list', 'json'], ['mixed', 'json'], ['odd', 'json'], ['any', 'json']]);
  assert.equal(fields[0].required, true);
  assert.equal(fields[1].default, 2);
  assert.deepEqual(C.schemaFields(null, null), []);
  assert.deepEqual(C.schemaFields({ type: 'object' }), []);
});

test('parseFieldValue validates against the field', () => {
  const [mode, n] = C.schemaFields({ properties: { mode: { enum: ['a', 1] }, n: { type: 'integer', minimum: 1, maximum: 5 } } });
  assert.deepEqual(C.parseFieldValue(mode, '1'), { ok: true, value: 1 });
  assert.equal(C.parseFieldValue(mode, 'z').ok, false);
  assert.deepEqual(C.parseFieldValue(n, '3'), { ok: true, value: 3 });
  assert.deepEqual(C.parseFieldValue(n, ''), { ok: true, value: undefined });
  for (const bad of ['0', '6', '2.5', 'x']) assert.equal(C.parseFieldValue(n, bad).ok, false, bad);
  assert.equal(C.parseFieldValue({ kind: 'json' }, '1').ok, false);
  assert.deepEqual(C.parseFieldValue({ kind: 'boolean' }, 'false'), { ok: true, value: false });
  assert.deepEqual(C.parseFieldValue({ kind: 'boolean' }, ''), { ok: true, value: undefined });
});

test('switching a module back on restores what switching it off replaced', () => {
  const sw = (d, id, v, scope = 'p') => C.setModuleEnabled(d, id, v, scope);
  const obj = '{"formatVersion":1,"modules":{"cards":{"mode":"legacy","n":2}}}';
  const off = sw(obj, 'cards', false);
  assert.equal(JSON.parse(off).modules.cards, false);
  assert.deepEqual(JSON.parse(sw(off, 'cards', true)).modules.cards, { mode: 'legacy', n: 2 }, 'the settings object comes back');
  const off2 = sw('{"formatVersion":1,"modules":{"rest":true}}', 'cards', false);
  assert.equal(JSON.parse(off2).modules.cards, false);
  const back = JSON.parse(sw(off2, 'cards', true));
  assert.equal('cards' in back.modules, false, 'an inheriting module goes back to inheriting: the key is removed');
  assert.equal(back.modules.rest, true);
  assert.equal(JSON.parse(sw('{"formatVersion":1,"modules":{"cards":false}}', 'cards', true)).modules.cards, true, 'an authored false becomes true');
  assert.equal(JSON.parse(sw(sw('{"formatVersion":1,"modules":{"cards":true}}', 'cards', false), 'cards', true)).modules.cards, true, 'true stays true');
  const offA = sw(obj, 'cards', false, 'a');
  assert.equal(JSON.parse(sw(offA, 'cards', true, 'b')).modules.cards, true, 'another draft path has no memory of it');
});

test('forgetSwitchedOff drops one scope\'s memory and leaves the others', () => {
  const obj = '{"formatVersion":1,"modules":{"cards":{"mode":"legacy"}}}';
  const offA = C.setModuleEnabled(obj, 'cards', false, 'a');
  const offB = C.setModuleEnabled(obj, 'cards', false, 'b');
  C.forgetSwitchedOff('a');
  assert.equal(JSON.parse(C.setModuleEnabled(offA, 'cards', true, 'a')).modules.cards, true, 'a replaced draft does not get the old object back');
  assert.deepEqual(JSON.parse(C.setModuleEnabled(offB, 'cards', true, 'b')).modules.cards, { mode: 'legacy' }, 'another scope keeps its memory');
  const offC = C.setModuleEnabled(obj, 'cards', false, 'c');
  C.forgetSwitchedOff();
  assert.equal(JSON.parse(C.setModuleEnabled(offC, 'cards', true, 'c')).modules.cards, true, 'no argument clears everything');
});

test('setModuleEnabled edits modules.<id> in the draft and keeps the rest', () => {
  const base = '{"formatVersion":1,"core":"c","$comment":"k","modules":{"cards":{"mode":"legacy"}}}';
  const off = JSON.parse(C.setModuleEnabled(base, 'cards', false));
  assert.equal(off.modules.cards, false);
  assert.equal(off.$comment, 'k');
  assert.deepEqual(JSON.parse(C.setModuleEnabled(JSON.stringify(off), 'cards', true)).modules.cards, { mode: 'legacy' }, 'on restores the settings object that off replaced');
  assert.deepEqual(JSON.parse(C.setModuleEnabled(base, 'cards', true)).modules.cards, { mode: 'legacy' }, 'on keeps an existing settings object');
  assert.equal(JSON.parse(C.setModuleEnabled('{"formatVersion":1}', 'x', false)).modules.x, false);
  assert.throws(() => C.setModuleEnabled('{nope', 'x', true));
  assert.throws(() => C.setModuleEnabled('[]', 'x', true));
});

test('setModuleSetting sets and clears one setting, refusing an off module', () => {
  const set = JSON.parse(C.setModuleSetting('{"modules":{}}', 'routes', 'prebossNodes', 8));
  assert.deepEqual(set.modules.routes, { prebossNodes: 8 });
  assert.deepEqual(JSON.parse(C.setModuleSetting('{"modules":{"r":true}}', 'r', 'k', 'v')).modules.r, { k: 'v' });
  assert.equal(JSON.parse(C.setModuleSetting(JSON.stringify(set), 'routes', 'prebossNodes', undefined)).modules.routes, true, 'an emptied override goes back to true');
  assert.equal('x' in JSON.parse(C.setModuleSetting('{"modules":{}}', 'x', 'k', undefined)).modules, false, 'clearing nothing adds nothing');
  assert.throws(() => C.setModuleSetting('{"modules":{"r":false}}', 'r', 'k', 1), /switch it on/);
});

test('every real engine module schema yields fields without throwing', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(import.meta.dirname, '../../engine/modules');
  const ids = fs.readdirSync(dir);
  assert.ok(ids.length > 20);
  for (const id of ids) {
    const schema = JSON.parse(fs.readFileSync(path.join(dir, id, 'settings.schema.json'), 'utf8'));
    const defaults = JSON.parse(fs.readFileSync(path.join(dir, id, 'defaults.json'), 'utf8'));
    const fields = C.schemaFields(schema, defaults);
    assert.ok(Array.isArray(fields), id);
  }
});
