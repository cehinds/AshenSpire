// node --test workbench/tests/data-module.test.mjs — the Data Studio's pure model
// (workbench/modules/data/model.mjs): table listing, CSV and JSON parse and
// serialize (exact round trips on real repo files), type inference, validation
// rules, and the save payload for a changed table.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../modules/data/model.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const REAL = ['content/source/weapons.csv', 'content/source/speakers.csv', 'content/framework/entities.json'];

const docOf = (table) => ({ columns: table.columns, rows: table.rows.map((r) => ({ ...r })) });

test('listTables groups Source csv and json, Framework json only, and skips other paths', () => {
  const out = D.listTables([
    'content/framework/terms.json',
    'content/source/weapons.csv',
    'content/source/worldAtlas.json',
    'content/source/sub/nested.csv',
    'content/framework/notes.csv',
    'src/content/x.csv',
    'content/source/README.md',
  ]);
  assert.deepEqual(out.map((t) => [t.group, t.name, t.format]), [
    ['Source', 'weapons', 'csv'],
    ['Source', 'worldAtlas', 'json'],
    ['Framework', 'terms', 'json'],
  ]);
});

for (const rel of REAL) {
  test(`unchanged ${rel} is written back byte for byte`, () => {
    const text = read(rel);
    const table = D.parseTable(rel, text);
    assert.equal(D.serializeTable(table), text);
    assert.equal(D.isDirty(table, docOf(table)), false);
  });
}

test('a re-serialized CSV parses back to the same columns and rows', () => {
  const table = D.parseTable('content/source/weapons.csv', read('content/source/weapons.csv'));
  const again = D.parseTable('content/source/weapons.csv', D.serializeTable(table));
  assert.deepEqual(again.columns, table.columns);
  assert.deepEqual(again.rows, table.rows);
});

test('editing one CSV cell changes only that line and keeps comments and blank lines', () => {
  const rel = 'content/source/speakers.csv';
  const text = read(rel);
  const table = D.parseTable(rel, text, { hash: 'abc' });
  const doc = docOf(table);
  doc.rows[0] = { ...doc.rows[0], name: 'The Changed Name' };
  const out = D.serializeTable(table, doc);
  const before = text.split('\n'), after = out.split('\n');
  assert.equal(after.length, before.length);
  const diffs = after.map((l, i) => (l === before[i] ? null : i)).filter((i) => i !== null);
  assert.equal(diffs.length, 1);
  assert.equal(after[diffs[0]], 'theNameless,The Changed Name,graveWisp');
  assert.equal(after.filter((l) => l.startsWith('#')).length, before.filter((l) => l.startsWith('#')).length);
  assert.equal(D.isDirty(table, doc), true);
  assert.equal(D.changeFor(table, doc).baseHash, 'abc');
});

test('a CSV cell with a comma or quote is quoted and reads back intact', () => {
  const rel = 'content/source/speakers.csv';
  const table = D.parseTable(rel, read(rel));
  const doc = docOf(table);
  doc.rows[0] = { ...doc.rows[0], name: 'Say "hi", friend' };
  const out = D.serializeTable(table, doc);
  assert.ok(out.includes('theNameless,"Say ""hi"", friend",graveWisp'));
  assert.equal(D.parseTable(rel, out).rows[0].name, 'Say "hi", friend');
});

test('added and deleted CSV rows keep their neighbours and comments', () => {
  const rel = 'content/source/speakers.csv';
  const table = D.parseTable(rel, read(rel));
  const doc = docOf(table);
  doc.rows = doc.rows.filter((_, i) => i !== 1);
  doc.rows.push({ id: 'newSpeaker', name: 'New', portraitKey: null });
  const again = D.parseTable(rel, D.serializeTable(table, doc));
  assert.deepEqual(again.rows.map((r) => r.id), ['theNameless', 'roadWarden', 'swordSaint', 'starReader', 'newSpeaker']);
  assert.equal(again.rows[2].portraitKey, '');
  const comments = (s) => s.split('\n').filter((l) => l.startsWith('#')).length;
  assert.equal(comments(D.serializeTable(table, doc)), comments(read(rel)));
});

test('CSV column types are inferred from the cells', () => {
  const t = D.parseTable('content/source/x.csv', 'id,count,on,data,note\na,1,true,"[1,2]",hello\nb,2.5,false,"{""k"":1}",\nc,,,,\n');
  assert.deepEqual(t.columns.map((c) => [c.key, c.type]), [['id', 'string'], ['count', 'number'], ['on', 'boolean'], ['data', 'json'], ['note', 'string']]);
  assert.deepEqual(t.rows[0], { id: 'a', count: 1, on: true, data: [1, 2], note: 'hello' });
  assert.equal(t.rows[2].count, null);
});

test('JSON columns infer number, boolean, string, or json for mixed and nested values', () => {
  const t = D.parseTable('content/framework/x.json', JSON.stringify([
    { id: 'a', n: 1, b: true, s: 'x', mixed: 1, nested: { k: 1 } },
    { id: 'b', n: 2.5, b: false, s: 'y', mixed: 'two', nested: null },
  ]));
  const type = Object.fromEntries(t.columns.map((c) => [c.key, c.type]));
  assert.deepEqual(type, { id: 'string', n: 'number', b: 'boolean', s: 'string', mixed: 'json', nested: 'json' });
});

test('JSON tables keep their wrapper, key order and trailing newline', () => {
  const rel = 'content/framework/entities.json';
  const table = D.parseTable(rel, read(rel));
  assert.equal(table.meta.arrayKey, 'entities');
  const doc = docOf(table);
  doc.rows[0] = { ...doc.rows[0], kind: 'WEAPON' };
  const out = D.serializeTable(table, doc);
  assert.ok(out.endsWith('}\n'));
  assert.equal(out, JSON.stringify({ ...table.meta.document, entities: doc.rows }, null, 2) + '\n');
  assert.deepEqual(Object.keys(JSON.parse(out)), Object.keys(table.meta.document));
});

test('a JSON array of objects serializes with 2-space indent and a trailing newline', () => {
  const t = D.parseTable('content/source/x.json', '[{"id":"a","n":1}]');
  const doc = docOf(t);
  doc.rows.push({ id: 'b', n: 2 });
  assert.equal(D.serializeTable(t, doc), '[\n  {\n    "id": "a",\n    "n": 1\n  },\n  {\n    "id": "b",\n    "n": 2\n  }\n]\n');
});

test('invalid tables are refused with a message', () => {
  assert.throws(() => D.parseTable('content/source/x.csv', 'a,a\n1,2\n'), /unique/);
  assert.throws(() => D.parseTable('content/source/x.csv', 'a,b\n"1,2\n'), /Unclosed CSV quote/);
  assert.throws(() => D.parseTable('content/source/x.csv', 'a,b\n1\n'), /cells/);
  assert.throws(() => D.parseTable('content/source/x.json', '{"a":1}'), /array of objects/);
  assert.throws(() => D.parseTable('content/source/x.json', '[1,2]'), /array of objects/);
  assert.throws(() => D.parseTable('content/source/x.json', '[{'), /Invalid JSON/);
});

test('keyColumnOf and tableRules put the key rules on the first id, key or name column', () => {
  const cols = [{ key: 'label', type: 'string' }, { key: 'id', type: 'string' }, { key: 'n', type: 'number' }];
  assert.equal(D.keyColumnOf(cols).key, 'id');
  assert.deepEqual(D.tableRules(cols).slice(0, 2), [{ kind: 'required', key: 'id' }, { kind: 'unique', key: 'id' }]);
  assert.equal(D.tableRules(cols).filter((r) => r.kind === 'type').length, 3);
  assert.deepEqual(D.tableRules([{ key: 'x', type: 'string' }]).map((r) => r.kind), ['type']);
});
