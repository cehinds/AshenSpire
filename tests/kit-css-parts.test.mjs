// The kit stylesheet is several files, linked in cascade order at the place
// styles/kit.css used to hold. index.html is the one record of that order
// (tools/kit-css.mjs reads it); this test keeps every other page, every part
// on disk and the cascade from drifting apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitCssPaths, readKitCss, stylesheetHrefs } from '../tools/kit-css.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');
const PAGES = ['index.html', 'tooltip-review-scene.html', 'tools/card-layers/index.html', 'tools/card-rank-layers/preview.html',
  'tools/card-solid-bb/preview.html', 'docs/card-art-review.html', 'docs/tray-gallery.html'];

test('styles/kit.css is gone: the kit is only its parts', () => {
  assert.equal(existsSync(resolve(ROOT, 'styles/kit.css')), false, 'a leftover styles/kit.css would be a second copy of the kit');
});

test('index.html links every styles/kit-*.css part exactly once, in one unbroken run', () => {
  const hrefs = stylesheetHrefs(read('index.html'));
  const parts = kitCssPaths(ROOT);
  assert.ok(parts.length > 1, 'the kit is split into parts');
  assert.equal(new Set(parts).size, parts.length, 'no part is linked twice');
  const at = hrefs.indexOf(parts[0]);
  assert.deepEqual(hrefs.slice(at, at + parts.length), parts, 'the parts are adjacent, so they hold kit.css\'s place in the cascade');
  const onDisk = readdirSync(resolve(ROOT, 'styles')).filter((n) => /^kit-.+\.css$/.test(n)).map((n) => `styles/${n}`).sort();
  assert.deepEqual([...parts].sort(), onDisk, 'every part on disk is linked and every linked part exists');
});

test('readKitCss() is the parts joined in index.html order', () => {
  const joined = kitCssPaths(ROOT).map(read).join('');
  assert.equal(readKitCss(ROOT), joined);
  assert.ok(joined.length > 300000, 'the kit is not empty');
});

test('every part is a whole stylesheet: braces balance and no comment is left open', () => {
  for (const part of kitCssPaths(ROOT)) {
    const text = read(part);
    assert.ok(text.endsWith('\n'), `${part} ends at a line boundary`);
    const noComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(noComments.includes('/*') || noComments.includes('*/'), false, `${part} has an unterminated or stray comment`);
    const noStrings = noComments.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
    assert.equal((noStrings.match(/\{/g) || []).length, (noStrings.match(/\}/g) || []).length, `${part} balances its braces`);
  }
});

test('the other pages that link the kit link the same parts in the same order', () => {
  const want = kitCssPaths(ROOT);
  for (const page of PAGES) {
    if (!existsSync(resolve(ROOT, page))) continue;
    const got = stylesheetHrefs(read(page)).map((h) => h.replace(/^(\.\.\/)+/, '')).filter((h) => /^styles\/kit(-.+)?\.css$/.test(h));
    assert.deepEqual(got, want, `${page} must link the kit parts exactly as index.html does`);
  }
});
