// tests/shot-match.test.mjs — tools/screenshot.mjs --only keeps the shots a list names.
// By default an id is a prefix (the old behaviour, kept for other callers); with
// --exact an id must be the whole shot name, so class-rogue no longer takes class-rogue-ember.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keepShot } from '../tools/lib/shot-match.mjs';

test('by default an --only id keeps every shot whose name starts with it', () => {
  assert.equal(keepShot('class-rogue', ['class-rogue']), true);
  assert.equal(keepShot('class-rogue-ember', ['class-rogue']), true);
  assert.equal(keepShot('prologue', ['map', 'pro']), true);
  assert.equal(keepShot('map', ['title']), false);
});

test('with exact, an --only id keeps only the shot with that whole name', () => {
  assert.equal(keepShot('class-rogue', ['class-rogue'], { exact: true }), true);
  assert.equal(keepShot('class-rogue-ember', ['class-rogue'], { exact: true }), false);
  assert.equal(keepShot('class-rogue-ember', ['class-rogue', 'class-rogue-ember'], { exact: true }), true);
  assert.equal(keepShot('pro', ['prologue'], { exact: true }), false);
});

test('screenshot.mjs documents --exact in its usage and passes it through the shot filter', () => {
  const src = readFileSync(new URL('../tools/screenshot.mjs', import.meta.url), 'utf8');
  assert.match(src, /--only a,b[^\n]*\n\/\/[^\n]*--exact/);
  assert.match(src, /keepShot\(s\.name, ONLY, \{ exact: EXACT \}\)/);
});
