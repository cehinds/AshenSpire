// node --test workbench/tests/tag-model-studio-csv.test.mjs — Data Studio reads a docs/tag-model
// table as RFC 4180: a multiline quoted cell is one cell, an unchanged table serializes to its
// own text, and an edit keeps the multiline cell. Content CSVs keep the line-oriented reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTable, serializeTable, isDirty } from '../modules/data/model.mjs';

const SETTINGS_TEXT = readFileSync(new URL('./fixtures/tag-model/settings-sample.csv', import.meta.url), 'utf8');
const SETTINGS_PATH = 'docs/tag-model/tables/presentation/settings.csv';
const WARMTH = 'Three hearths once kept the roads warm.\nWe lived beyond their walls.';

test('a multiline cell of a tag-model table is one cell, and an unchanged table serializes to its own text', () => {
  const table = parseTable(SETTINGS_PATH, SETTINGS_TEXT);
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].default, WARMTH);
  assert.equal(table.rows[1].key, 'gameConfig.prologue.scenes.warmth.seconds');
  assert.equal(serializeTable(table), SETTINGS_TEXT);
  assert.equal(isDirty(table, { columns: table.columns, rows: table.rows }), false);
});

test('an edit to a base cell keeps the multiline cell as a quoted cell', () => {
  const table = parseTable(SETTINGS_PATH, SETTINGS_TEXT);
  const rows = table.rows.map((row, i) => (i === 0 ? { ...row, label: 'Narration' } : row));
  const text = serializeTable(table, { columns: table.columns, rows });
  assert.match(text, /^gameConfig\.prologue\.scenes\.warmth\.text,Narration,Opening,textarea,"Three hearths once kept the roads warm\.\nWe lived beyond their walls\.",/m);
  const back = parseTable(SETTINGS_PATH, text);
  assert.equal(back.rows[0].default, WARMTH);
  assert.equal(back.rows[0].label, 'Narration');
});

test('a content CSV with a quoted line break still uses the line-oriented reader and refuses it', () => {
  const text = 'id,name\nsword,"Two\nlines"\n';
  assert.throws(() => parseTable('content/source/items.csv', text), /Unclosed CSV quote|cells|quote/i);
});
