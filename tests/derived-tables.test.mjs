// Derived tables (owner 2026-10-17) must match the resolved Core profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDerivedTables } from '../tools/derived-tables.mjs';

const tables = buildDerivedTables();
const read = file => readFileSync(new URL(`../games/ashenspire/derived/${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('derived tables are current (run node tools/derived-tables.mjs)', () => {
  for (const [file, value] of Object.entries(tables)) assert.equal(read(file), JSON.stringify(value, null, 2) + '\n', file);
});

test('every attribute total = own + listed bonus sources, and HP terms add up', () => {
  for (const c of tables['characters.json']) {
    for (const [k, a] of Object.entries(c.attributes)) assert.equal(a.total, Math.max(0, a.own + a.bonuses.reduce((s, b) => s + b.amount, 0)), `${c.id}.${k}`);
    assert.equal(Object.values(c.hp.terms).reduce((s, v) => s + v, 0), c.hp.total, c.id);
  }
});
