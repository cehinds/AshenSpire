// node --test workbench/tests/data-packs.test.mjs — the Data Studio model for the profile packs
// (games/ashenspire/packs) and the HUD layout (content/hud-layout).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../modules/data/model.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const docOf = (table) => ({ columns: table.columns, rows: table.rows.map((r) => ({ ...r })) });

test('listTables adds the profile packs and the HUD layout files, one table per file', () => {
  const out = D.listTables([
    'games/ashenspire/packs/core/classes.json',
    'games/ashenspire/packs/core/guide.md',
    'games/ashenspire/packs/base-cards/cards.json',
    'games/ashenspire/game.json',
    'content/hud-layout/desktop.json',
    'content/hud-layout/sub/x.json',
    'content/source/weapons.csv',
  ]);
  assert.deepEqual(out.map((t) => [t.group, t.name]), [
    ['Source', 'weapons'],
    ['Packs', 'base-cards/cards'],
    ['Packs', 'core/classes'],
    ['HUD layout', 'desktop'],
  ]);
});

test('a pack array of objects is a table and round-trips', () => {
  const rel = 'games/ashenspire/packs/core/classes.json';
  const text = read(rel);
  const table = D.parseTable(rel, text);
  assert.equal(table.format, 'json');
  assert.ok(table.rows.length >= 4);
  assert.equal(D.serializeTable(table), text);
  assert.equal(D.isDirty(table, docOf(table)), false);
});

test('a pack object of objects is a table keyed by id; edits write back under the key', () => {
  const rel = 'games/ashenspire/packs/core/resourceVariants.json';
  const text = read(rel);
  const table = D.parseTable(rel, text);
  assert.equal(table.format, 'json');
  assert.equal(table.columns[0].key, 'id');
  assert.equal(table.rows.length, Object.keys(JSON.parse(text)).length);
  assert.equal(D.serializeTable(table), text, 'unchanged text is written back as it was');
  const doc = docOf(table);
  const col = table.columns.find((c) => c.key !== 'id').key;
  doc.rows[0] = { ...doc.rows[0], [col]: 'edited' };
  const out = JSON.parse(D.serializeTable(table, doc));
  assert.equal(out[doc.rows[0].id][col], 'edited');
  assert.equal('id' in out[doc.rows[0].id], false, 'the key is the id, not a field');
  assert.equal(D.isDirty(table, doc), true);
});

test('a keyed pack whose values carry their own id keeps it', () => {
  const text = '{"a":{"id":"a","n":1},"b":{"id":"b","n":2}}\n';
  const table = D.parseTable('games/ashenspire/packs/x/y.json', text);
  assert.equal(table.format, 'json');
  assert.equal(D.isDirty(table, docOf(table)), false);
  const doc = docOf(table);
  doc.rows[1].n = 9;
  assert.deepEqual(JSON.parse(D.serializeTable(table, doc)).b, { id: 'b', n: 9 });
});

test('any other pack or HUD JSON opens as a read-only view that is never dirty', () => {
  for (const rel of ['games/ashenspire/packs/core/pack.json', 'games/ashenspire/packs/core/stats.json', 'content/hud-layout/desktop.json']) {
    const table = D.parseTable(rel, read(rel));
    assert.equal(table.format, 'view', rel);
    assert.match(table.meta.pretty, /^[{[]/);
    assert.equal(D.isDirty(table, { columns: [], rows: [] }), false);
  }
  assert.equal(D.parseTable('games/ashenspire/packs/x/y.json', '[1,2]').format, 'view');
  assert.equal(D.parseTable('games/ashenspire/packs/x/y.json', '{"a":{"id":"z"}}').format, 'view', 'an id that is not the key is not a table');
  assert.throws(() => D.parseTable('games/ashenspire/packs/x/y.json', '{nope'), /Invalid JSON/);
});

test('content/source JSON keeps its array-only rule', () => {
  assert.throws(() => D.parseTable('content/source/x.json', '{"a":{"n":1}}'), /Not a table/);
});
