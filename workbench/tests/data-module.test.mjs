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
import * as M from '../ui/kit/grid-model.mjs';

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

test('CSV cells the content compiler keeps as strings (1e3, 1.) stay strings and round-trip unchanged', () => {
  const text = 'id,code,ratio\nalpha,1e3,-0.5\nbeta,2e4,.5\ngamma,1.,12\n';
  const t = D.parseTable('content/source/x.csv', text);
  assert.deepEqual(t.columns.map((c) => [c.key, c.type]), [['id', 'string'], ['code', 'string'], ['ratio', 'number']]);
  assert.equal(t.rows[0].code, '1e3');
  assert.equal(t.rows[1].code, '2e4');
  assert.equal(t.rows[2].code, '1.');
  assert.deepEqual(t.rows.map((r) => r.ratio), [-0.5, 0.5, 12]);
  // Edit another cell in the 1e3 row; the 1e3 cell must stay byte-for-byte.
  const doc = docOf(t);
  doc.rows[0] = { ...doc.rows[0], id: 'alphaEdited' };
  const out = D.serializeTable(t, doc);
  assert.equal(out, 'id,code,ratio\nalphaEdited,1e3,-0.5\nbeta,2e4,.5\ngamma,1.,12\n');
});

// Leading comments and blank lines belong to the row they sit above, so an
// edit or a delete never drops them (Data Studio save path).
test('an edited CSV row keeps the comment and blank lines above it', () => {
  const text = 'id,name\n# note for a\na,1\n\n# note for b\nb,2\n';
  const table = D.parseTable('content/source/x.csv', text);
  const doc = docOf(table);
  doc.rows[0] = { ...doc.rows[0], name: '9' };
  assert.equal(D.serializeTable(table, doc), 'id,name\n# note for a\na,9\n\n# note for b\nb,2\n');
});


test('a deleted CSV row keeps its leading comment, moved to the next surviving row', () => {
  const text = 'id,name\n# note for a\na,1\n# note for b\nb,2\n';
  const table = D.parseTable('content/source/x.csv', text);
  const doc = docOf(table);
  doc.rows = doc.rows.filter((r) => r.id !== 'a');
  assert.equal(D.serializeTable(table, doc), 'id,name\n# note for a\n# note for b\nb,2\n');
});

test('a deleted last CSV row keeps its leading comment at the end of the file', () => {
  const text = 'id,name\na,1\n# note for b\nb,2\n';
  const table = D.parseTable('content/source/x.csv', text);
  const doc = docOf(table);
  doc.rows = doc.rows.filter((r) => r.id !== 'b');
  assert.equal(D.serializeTable(table, doc), 'id,name\na,1\n# note for b\n');
});

test('a CSV number column accepts integers and ordinary decimals only', () => {
  const kind = (v) => D.parseTable('content/source/x.csv', `v\n${v}\n`).columns[0].type;
  assert.equal(kind('-0.5'), 'number');
  assert.equal(kind('.5'), 'number');
  assert.equal(kind('12'), 'number');
  assert.equal(kind('-7'), 'number');
  assert.equal(kind('1e3'), 'string');
  assert.equal(kind('1.'), 'string');
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

test('tableRules uses the compound unique key only for a table listed in KEY_SCOPES', () => {
  const cols = [{ key: 'classId', type: 'string' }, { key: 'id', type: 'string' }];
  // The real outfits.csv path gets the compound rule, whatever rows the table holds.
  assert.deepEqual(D.tableRules(cols, 'content/source/outfits.csv').slice(0, 2), [
    { kind: 'required', key: 'id' }, { kind: 'unique', keys: ['classId', 'id'] },
  ]);
  // Every other table keeps the single key rule, even when a *Id column could tell its rows apart.
  assert.deepEqual(D.tableRules(cols, 'content/source/startingKits.csv').slice(0, 2), [{ kind: 'required', key: 'id' }, { kind: 'unique', key: 'id' }]);
  assert.deepEqual(D.tableRules(cols).slice(0, 2), [{ kind: 'required', key: 'id' }, { kind: 'unique', key: 'id' }]);
  // The grid's Check panel finds no duplicate in the real outfits.csv, and still flags a true (classId, id) duplicate.
  const outfits = D.parseTable('content/source/outfits.csv', read('content/source/outfits.csv'));
  const rules = D.tableRules(outfits.columns, 'content/source/outfits.csv');
  assert.deepEqual(rules[1], { kind: 'unique', keys: ['classId', 'id'] });
  const doc = { columns: outfits.columns, rows: outfits.rows };
  assert.deepEqual(M.validate(doc, rules).filter((i) => /^Duplicate/.test(i.message)), []);
  const firstReaver = outfits.rows.find((r) => r.classId === 'reaver' && r.id === 'default');
  const dupeRows = [...outfits.rows, { ...firstReaver }];
  const dupe = M.validate({ columns: outfits.columns, rows: dupeRows }, rules);
  assert.deepEqual(dupe.filter((i) => /^Duplicate/.test(i.message)).map((i) => [i.row, i.key]), [[dupeRows.length - 1, 'id']]);
  // startingKits.csv gets the single key, so the grid rule is { kind: 'unique', key: 'id' } there.
  const kits = D.parseTable('content/source/startingKits.csv', read('content/source/startingKits.csv'));
  assert.deepEqual(D.tableRules(kits.columns, 'content/source/startingKits.csv').filter((r) => r.kind === 'unique'), [{ kind: 'unique', key: 'id' }]);
});

test('KEY_SCOPES lists only outfits, and keyScopeFor reads it by path', () => {
  assert.deepEqual(D.KEY_SCOPES, { 'content/source/outfits.csv': 'classId' });
  assert.equal(D.keyScopeFor('content/source/outfits.csv'), 'classId');
  // Every other table keeps the single key, even one with a *Id column that would tell its rows apart.
  assert.equal(D.keyScopeFor('content/source/startingKits.csv'), null);
  assert.equal(D.keyScopeFor('content/source/nodes.csv'), null);
  assert.equal(D.keyScopeFor('constructor'), null);
  assert.equal(D.keyScopeFor(undefined), null);
});

test('a changed table makes a save entry with its base hash and a one-line diff', async () => {
  const { lineDiff } = await import('../core/files.mjs');
  const rel = 'content/source/speakers.csv';
  const table = D.parseTable(rel, read(rel), { hash: 'h1' });
  assert.equal(D.isDirty(table, docOf(table)), false);
  const doc = docOf(table);
  doc.rows[1] = { ...doc.rows[1], name: 'Renamed Warden' };
  assert.equal(D.isDirty(table, doc), true);
  const change = D.changeFor(table, doc);
  assert.deepEqual(Object.keys(change).sort(), ['baseHash', 'path', 'text']);
  assert.equal(change.path, rel);
  assert.equal(change.baseHash, 'h1');
  const d = lineDiff(read(rel), change.text);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  const lines = d.hunks.flatMap((h) => h.lines).filter((l) => l.op !== ' ').map((l) => `${l.op}${l.text}`);
  assert.deepEqual(lines, ['-keeperOfTheNameless,The Keeper of the Nameless,emberStarvedPilgrim', '+keeperOfTheNameless,Renamed Warden,emberStarvedPilgrim']);
});

test('a row added to a JSON table is saved as the array with the new row last', () => {
  const rel = 'content/framework/entities.json';
  const table = D.parseTable(rel, read(rel), { hash: 'h2' });
  const doc = docOf(table);
  doc.rows.push({ id: 'framework.newEntity', kind: 'CARD' });
  const saved = JSON.parse(D.changeFor(table, doc).text);
  assert.equal(saved.entities.length, table.rows.length + 1);
  assert.equal(saved.entities.at(-1).id, 'framework.newEntity');
  assert.equal(saved.comment, table.meta.document.comment);
});

test('Overwrite after a 409 rebases on the disk hash, and a file deleted on disk is recreated with baseHash null', () => {
  const changes = [
    { path: 'content/source/cards.csv', text: 'id\n1\n', baseHash: 'old-a' },
    { path: 'content/source/gone.csv', text: 'id\n2\n', baseHash: 'old-b' },
    { path: 'content/source/other.csv', text: 'id\n3\n', baseHash: 'old-c' },
  ];
  const conflicts = [{ path: 'content/source/cards.csv', hash: 'disk-a' }, { path: 'content/source/gone.csv', hash: null }];
  const rebased = D.rebaseChanges(changes, conflicts);
  assert.equal(rebased[0].baseHash, 'disk-a');
  assert.equal(rebased[1].baseHash, null, 'deleted on disk: the stale hash is not kept');
  assert.equal(rebased[2].baseHash, 'old-c', 'a file that did not conflict keeps its base');
  assert.equal(rebased[1].text, 'id\n2\n', 'the drafts are kept');
  assert.equal(changes[1].baseHash, 'old-b', 'the input is not mutated');
});

test('parseMatch reads col:value pairs and drops blank or malformed pieces', () => {
  assert.deepEqual(D.parseMatch(''), []);
  assert.deepEqual(D.parseMatch(null), []);
  assert.deepEqual(D.parseMatch('classId:reaver'), [{ col: 'classId', value: 'reaver' }]);
  assert.deepEqual(D.parseMatch('classId:reaver,plate:3E6157'), [{ col: 'classId', value: 'reaver' }, { col: 'plate', value: '3E6157' }]);
  assert.deepEqual(D.parseMatch('nocolon,:orphan,classId:'), [{ col: 'classId', value: '' }]);
});

test('findRow picks the row whose key and match columns both equal the link, not the first key hit', () => {
  const rows = [
    { id: 'nightweave', classId: 'starseer' },
    { id: 'default', classId: 'reaver' },
    { id: 'nightweave', classId: 'reaver' },
  ];
  assert.equal(D.findRow(rows, 'id', 'nightweave', 'classId:reaver'), 2, 'the reaver row, though a starseer row comes first');
  assert.equal(D.findRow(rows, 'id', 'nightweave', 'classId:starseer'), 0);
  assert.equal(D.findRow(rows, 'id', 'nightweave'), 0, 'with no match, the key alone picks the first hit');
  assert.equal(D.findRow(rows, 'id', 'nightweave', 'classId:herald'), -1, 'no row matches the pair');
  assert.equal(D.findRow(rows, 'id', 'missing', 'classId:reaver'), -1);
  assert.equal(D.findRow(rows, null, 'nightweave', ''), -1, 'no key column finds nothing');
  assert.equal(D.findRow(rows, 'id', null, ''), -1);
});

test('findRow on the real outfits table tells apart the repeated armour ids by class', () => {
  const table = D.parseTable('content/source/outfits.csv', read('content/source/outfits.csv'));
  for (const id of ['default', 'nightweave', 'wayfarerPlate']) {
    for (const classId of ['reaver', 'starseer', 'herald', 'rogue']) {
      const r = D.findRow(table.rows, 'id', id, `classId:${classId}`);
      if (r < 0) continue;
      assert.equal(table.rows[r].id, id);
      assert.equal(table.rows[r].classId, classId, `${id} for ${classId} is that class's row`);
    }
  }
  assert.equal(table.rows[D.findRow(table.rows, 'id', 'nightweave', 'classId:reaver')].classId, 'reaver');
  assert.equal(table.rows[D.findRow(table.rows, 'id', 'nightweave', 'classId:starseer')].classId, 'starseer');
});

// Rows pair by identity, not position: an edited row that moves keeps its own comments.
test('two edited CSV rows that move keep their own leading comments (paired by key)', () => {
  const text = 'id,name\n# ca\na,1\n# cb\nb,2\n# cc\nc,3\n';
  const table = D.parseTable('content/source/x.csv', text);
  const doc = docOf(table);
  doc.rows = [{ ...table.rows[1], name: 20 }, table.rows[2], { ...table.rows[0], name: 10 }];
  assert.equal(D.serializeTable(table, doc), 'id,name\n# cb\nb,20\n# cc\nc,3\n# ca\na,10\n');
});

test('a table listed in KEY_SCOPES pairs edited rows by the (classId, id) key, not id alone', () => {
  const text = 'classId,id,name\n# r\nreaver,default,1\n# s\nstarseer,default,2\n';
  const table = D.parseTable('content/source/outfits.csv', text);
  const doc = docOf(table);
  doc.rows = [{ ...table.rows[1], name: 22 }, { ...table.rows[0], name: 11 }];
  assert.equal(D.serializeTable(table, doc), 'classId,id,name\n# s\nstarseer,default,22\n# r\nreaver,default,11\n');
});

// Reordering: each row is saved in the order given by `order` (indices into the read rows), with optional edits.
const COMMENTED = 'id,name\n# ca\na,1\n# cb\nb,2\n# cc\nc,3\n';
const reordered = (text, order, edits = {}) => {
  const table = D.parseTable('content/source/x.csv', text);
  const doc = docOf(table);
  doc.rows = order.map((i) => ({ ...table.rows[i], ...(edits[i] ?? {}) }));
  return D.serializeTable(table, doc);
};

test('a reverse sort keeps each comment above its own row', () => {
  assert.equal(reordered(COMMENTED, [2, 1, 0]), 'id,name\n# cc\nc,3\n# cb\nb,2\n# ca\na,1\n');
});

test('moving the last row to the top keeps each comment with its row', () => {
  assert.equal(reordered(COMMENTED, [2, 0, 1]), 'id,name\n# cc\nc,3\n# ca\na,1\n# cb\nb,2\n');
});

test('an edited row that moves keeps its own comment, and the others keep theirs', () => {
  assert.equal(reordered(COMMENTED, [1, 2, 0], { 0: { name: 10 } }), 'id,name\n# cb\nb,2\n# cc\nc,3\n# ca\na,10\n');
});

test('an untouched non-canonical row (a, 1) that moves keeps its bytes', () => {
  assert.equal(reordered('id,name\n# ca\na, 1\n# cb\nb,2\n', [1, 0]), 'id,name\n# cb\nb,2\n# ca\na, 1\n');
});

test('duplicate identical rows reordered keep every comment and no row is duplicated', () => {
  const text = 'id,name\n# first\nx,1\n# second\nx,1\n# third\ny,2\n';
  assert.equal(reordered(text, [1, 2, 0]), 'id,name\n# first\nx,1\n# third\ny,2\n# second\nx,1\n');
});

test('deleting the first, a middle or the last row moves its comment to the next kept row, or the end', () => {
  assert.equal(reordered(COMMENTED, [1, 2]), 'id,name\n# ca\n# cb\nb,2\n# cc\nc,3\n');
  assert.equal(reordered(COMMENTED, [0, 2]), 'id,name\n# ca\na,1\n# cb\n# cc\nc,3\n');
  assert.equal(reordered(COMMENTED, [0, 1]), 'id,name\n# ca\na,1\n# cb\nb,2\n# cc\n');
});

test('inserted rows sit where they are placed and carry no comments of their own', () => {
  const table = D.parseTable('content/source/x.csv', COMMENTED);
  const doc = docOf(table);
  doc.rows = [{ id: 'n0', name: 0 }, table.rows[0], { id: 'n1', name: 5 }, table.rows[1], table.rows[2], { id: 'n2', name: 7 }];
  assert.equal(D.serializeTable(table, doc), 'id,name\nn0,0\n# ca\na,1\nn1,5\n# cb\nb,2\n# cc\nc,3\nn2,7\n');
});

test('CRLF line endings survive a reorder', () => {
  const text = 'id,name\r\n# ca\r\na,1\r\n# cb\r\nb,2\r\n';
  assert.equal(reordered(text, [1, 0]), 'id,name\r\n# cb\r\nb,2\r\n# ca\r\na,1\r\n');
});

test('quoted cells with commas and quotes survive a reorder byte for byte', () => {
  const text = 'id,name\n# ca\na,"x, y"\n# cb\nb,"p""q"\n';
  assert.equal(reordered(text, [1, 0]), 'id,name\n# cb\nb,"p""q"\n# ca\na,"x, y"\n');
});

test('a file with no final newline keeps none after a reorder', () => {
  const text = 'id,name\n# ca\na,1\n# cb\nb,2';
  assert.equal(reordered(text, [1, 0]), 'id,name\n# cb\nb,2\n# ca\na,1');
});
