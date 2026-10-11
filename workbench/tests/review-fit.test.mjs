// node --test workbench/tests/review-fit.test.mjs — a Visual Review detail opened in
// side-by-side mode fits both captures. paintStage() returns early for that mode, so
// the fit has to run before the return; this pins that order in the source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, '../modules/review/index.mjs'), 'utf8');

function paintStageBody() {
  const start = SRC.indexOf('function paintStage()');
  const end = SRC.indexOf('function fitAfterLoad(', start);
  assert.ok(start > 0 && end > start, 'paintStage and fitAfterLoad are defined in review/index.mjs');
  return SRC.slice(start, end);
}

test('side-by-side paints fit the pair before paintStage returns', () => {
  const body = paintStageBody();
  const sideStart = body.indexOf("if (mode === 'side')");
  const sideEnd = body.indexOf('return;', sideStart);
  assert.ok(sideStart > 0 && sideEnd > sideStart, 'the side-by-side branch returns');
  const sideBranch = body.slice(sideStart, sideEnd);
  assert.match(sideBranch, /fitAfterLoad\(s\);/, 'the side branch runs the image-load fit before its return');
  assert.match(sideBranch, /applyView\(\);/, 'the side branch applies the view before its return');
});

test('every mode, including side-by-side, runs the fit after its stage is painted', () => {
  const body = paintStageBody();
  const calls = body.match(/fitAfterLoad\(s\);/g) || [];
  assert.equal(calls.length, 2, 'one call in the side-by-side branch and one at the end of paintStage');
  assert.ok(body.lastIndexOf('fitAfterLoad(s);') > body.indexOf("if (mode === 'side')"), 'the final call comes after the mode branches');
});

test('fitAfterLoad waits for every stage image, not only the first', () => {
  const start = SRC.indexOf('function fitAfterLoad(');
  const fn = SRC.slice(start, SRC.indexOf('\n    }', start) + 6);
  assert.match(fn, /querySelectorAll\('img'\)/);
  assert.match(fn, /'load', done/);
  assert.match(fn, /'error', done/);
});
