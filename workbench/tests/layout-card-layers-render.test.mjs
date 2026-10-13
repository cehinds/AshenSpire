// node --test workbench/tests/layout-card-layers-render.test.mjs — the Card layers render page is served
// by the game server, so its imports and stylesheets must exist in the checkout, and the page must
// draw with the game's own card renderer rather than its own layer painter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = 'workbench/modules/layout';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the render page loads its stylesheets from the checkout', () => {
  const html = read(`${DIR}/card-layers-render.html`);
  for (const [, href] of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    const rel = href.startsWith('/') ? href.slice(1) : href;
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${href} exists`);
  }
  assert.match(html, /src="\/workbench\/modules\/layout\/card-layers-render\.mjs"/);
});

test('every relative import of the render module resolves to a file', () => {
  const src = read(`${DIR}/card-layers-render.mjs`);
  const specs = [...src.matchAll(/from '(\.[^']+)'/g)].map((m) => m[1]);
  assert.ok(specs.length >= 5);
  for (const spec of specs) {
    assert.ok(fs.existsSync(path.resolve(ROOT, DIR, spec)), `${spec} resolves`);
  }
});

test('the page draws with the game card renderer and the shared card template, not a layer painter', () => {
  const src = read(`${DIR}/card-layers-render.mjs`);
  assert.match(src, /renderCard\(registries, SAMPLE/);
  assert.match(src, /CARD_COMPONENTS\.template = layout/);
  assert.ok(!/createElement\('img'\)/.test(src), 'no layer painter of its own');
});
