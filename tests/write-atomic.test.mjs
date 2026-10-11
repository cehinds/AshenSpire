// tests/write-atomic.test.mjs — a screenshot frame replaces its file whole or not at all.
// tools/lib/write-atomic.mjs writes through a temp file beside the target and renames it over
// the target, so a reader (Visual Review's accept, which copies the PNG) never sees half a frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { tempBeside, writeFileAtomic } from '../tools/lib/write-atomic.mjs';

const folder = () => mkdtempSync(path.join(tmpdir(), 'write-atomic-'));

test('a frame replaces the old file with its whole content, and no temp file is left beside it', (t) => {
  const dir = folder();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'desk-map.png');
  writeFileSync(out, 'OLD');
  writeFileAtomic(out, Buffer.from('NEW-FRAME'));
  assert.equal(readFileSync(out, 'utf8'), 'NEW-FRAME');
  assert.deepEqual(readdirSync(dir), ['desk-map.png']);
});

test('a write that fails leaves the old file exactly as it was and no temp file behind', (t) => {
  const dir = folder();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'desk-map.png');
  writeFileSync(out, 'OLD');
  assert.throws(() => writeFileAtomic(out, undefined));
  assert.equal(readFileSync(out, 'utf8'), 'OLD');
  assert.deepEqual(readdirSync(dir), ['desk-map.png']);
});

test('a new file is created when none was there', (t) => {
  const dir = folder();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const out = path.join(dir, 'phone-title.png');
  writeFileAtomic(out, Buffer.from('PNG'));
  assert.equal(existsSync(out), true);
  assert.equal(readFileSync(out, 'utf8'), 'PNG');
});

test('the temp file keeps the target extension, because Chrome refuses a --screenshot path that is not .png', () => {
  const temp = tempBeside(path.join('/shots', 'desk-map.png'));
  assert.equal(path.dirname(temp), path.dirname(path.join('/shots', 'desk-map.png')));
  assert.equal(path.extname(temp), '.png');
  assert.notEqual(temp, path.join('/shots', 'desk-map.png'));
});

test('screenshot.mjs writes each combat frame through writeFileAtomic and no longer deletes the old frame up front', () => {
  const src = readFileSync(new URL('../tools/screenshot.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*writeFileAtomic[^}]*\} from '\.\/lib\/write-atomic\.mjs'/);
  assert.match(src, /writeFileAtomic\(out, frame\)/);
  assert.doesNotMatch(src, /writeFileSync\(out, frame\)/);
  assert.doesNotMatch(src, /rmSync\(out, \{ force: true \}\);\n\s*const \[width, height\]/, 'captureReady no longer removes the old PNG before the new one is ready');
});

test('a one-shot capture has Chrome write a temp file beside the PNG, renamed over it only when Chrome reports it written', () => {
  const src = readFileSync(new URL('../tools/screenshot.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /--screenshot=\$\{out\}/, 'Chrome no longer writes the target directly');
  assert.match(src, /--screenshot=\$\{tmp\}/);
  assert.match(src, /renameSync\(tmp, out\)/);
});
