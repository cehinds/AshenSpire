// node --test workbench/tests/motion-module.test.mjs — Motion Studio's wiring: the render page
// (game origin) is origin-checked and imports the game's real presentation model, and the module
// is a real module, not the placeholder.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the render page is a frame of the game server, with its module and CSS wired in', () => {
  const html = read('workbench/modules/motion/render.html');
  assert.match(html, /<base href="\/">/);
  assert.match(html, /src="\/workbench\/modules\/motion\/render\.mjs"/);
  assert.match(html, /href="\/workbench\/modules\/motion\/render\.css"/);
});

test('the render page obeys only its parent, at the origin given by ?po=', () => {
  const render = read('workbench/modules/motion/render.mjs');
  assert.match(render, /ev\.origin !== parentOrigin \|\| ev\.source !== window\.parent/);
  assert.match(render, /window\.parent\.postMessage\(\{ source: SOURCE, type, \.\.\.data \}, parentOrigin\)/);
  assert.match(render, /if \(window\.parent === window \|\| !parentOrigin\) return;/);
});

test('the render page draws with the game model and the painted art, not a copy', () => {
  const render = read('workbench/modules/motion/render.mjs');
  assert.match(render, /from '\.\.\/\.\.\/\.\.\/src\/model\/presentationSequence\.js'/);
  assert.match(render, /from '\.\.\/\.\.\/\.\.\/src\/model\/presentationPoseCatalog\.js'/);
  for (const rel of ['src/model/presentationSequence.js', 'src/model/presentationPoseCatalog.js', 'pose-studio/catalog.mjs']) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} exists`);
  }
});

test('edits go through the canvas kit and one history step per change, and save only from the review dialog', () => {
  const src = read('workbench/modules/motion/index.mjs');
  assert.match(src, /import \{ createCanvas \} from '\.\.\/\.\.\/ui\/kit\/canvas\.mjs'/);
  assert.match(src, /ctx\.history\.pushChange\(\{ label, undo, redo \}/);
  assert.match(src, /canvas = createCanvas\(editEl/);
  const saves = src.match(/ctx\.api\('files\/save'/g) || [];
  assert.equal(saves.length, 1, 'one save call, inside save()');
  assert.match(src, /async function save\(\) \{[\s\S]*?ctx\.api\('files\/save', \{ changes \}\)/);
  assert.match(src, /saveFailure\(err\)/, 'problems and conflicts go through the shared failure reader');
  assert.match(src, /locked: true, label: pose, data: \{ kind: 'figure', src \}/, 'the figure is a locked reference item');
});
