// node --test workbench/tests/tag-model-csv.test.mjs — the RFC 4180 reader and writer for
// docs/tag-model tables: multiline cells, doubled quotes, the file's own line ending and
// trailing newline, and malformed text that throws. The fixture is three real lines of
// presentation/settings.csv (its header and the one multiline cell).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTagCSV, writeTagCSV, tagCell } from '../lib/tag-model-csv.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS = fs.readFileSync(path.join(here, 'fixtures/tag-model/settings-sample.csv'), 'utf8');

const shape = (text) => { const t = parseTagCSV(text); return { eol: t.eol, trailingNewline: t.trailingNewline, bom: t.bom }; };

test('a multiline quoted cell parses as one cell and round-trips to the same text', () => {
  const table = parseTagCSV(SETTINGS);
  assert.equal(table.columns.length, 16);
  assert.equal(table.rows.length, 2);
  const warmth = table.rows[0];
  assert.equal(warmth.key, 'gameConfig.prologue.scenes.warmth.text');
  assert.equal(warmth.default, 'Three hearths once kept the roads warm.\nWe lived beyond their walls.');
  assert.equal(warmth.label, 'Dialogue');
  assert.equal(table.rows[1].key, 'gameConfig.prologue.scenes.warmth.seconds');
  assert.equal(writeTagCSV(table, shape(SETTINGS)), SETTINGS, 'the multiline row is written back unchanged');
});

test('doubled quotes and commas inside quotes round-trip', () => {
  const text = 'id,note\nq1,"He said ""hi"", then left\nand came back"\nq2,plain\n';
  const table = parseTagCSV(text);
  assert.equal(table.rows[0].note, 'He said "hi", then left\nand came back');
  assert.equal(writeTagCSV(table, shape(text)), text);
});

test('the file keeps its CRLF line ending, and a missing trailing newline stays missing', () => {
  const text = 'id,value\r\nar,24\r\nhp,"10\r\n20"';
  const table = parseTagCSV(text);
  assert.equal(table.eol, '\r\n');
  assert.equal(table.trailingNewline, false);
  assert.equal(table.rows[1].value, '10\r\n20');
  assert.equal(writeTagCSV(table, shape(text)), text);
});

test('a byte-order mark and blank lines are kept or skipped, and never change a cell', () => {
  const text = '﻿id,value\n\nar,24\n\n';
  const table = parseTagCSV(text);
  assert.equal(table.bom, true);
  assert.deepEqual(table.rows, [{ id: 'ar', value: '24' }]);
  assert.equal(writeTagCSV(table, shape(text)), '﻿id,value\nar,24\n');
});

test('cells are quoted only when they need it: a comma, a quote, a line break, or a space at an end', () => {
  assert.equal(tagCell('plain'), 'plain');
  assert.equal(tagCell('a,b'), '"a,b"');
  assert.equal(tagCell('say "x"'), '"say ""x"""');
  assert.equal(tagCell('two\nlines'), '"two\nlines"');
  assert.equal(tagCell(' lead'), '" lead"');
  assert.equal(tagCell(undefined), '');
});

test('malformed text throws with a message the save can show', () => {
  assert.throws(() => parseTagCSV('id,value\nar,"24\n'), /Unclosed CSV quote/);
  assert.throws(() => parseTagCSV('id,value\nar,24,extra\n'), /CSV row at line 2 has 3 cells; expected 2/);
  assert.throws(() => parseTagCSV('id,id\nar,24\n'), /headers must be unique and nonempty/);
  assert.throws(() => parseTagCSV(''), /CSV needs a header/);
});
