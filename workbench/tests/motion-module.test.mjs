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

test('the module gates every edit and every save on isGenerated, so build-written stance files stay read-only', () => {
  const src = read('workbench/modules/motion/index.mjs');
  assert.match(src, /isGenerated,/, 'the module imports the generated-file rule from the model');
  assert.match(src, /function commitProject\(next, label\) \{[\s\S]*?isGenerated\(st\.file\.path\)[\s\S]*?return;/, 'commitProject refuses a generated file');
  assert.match(src, /function dirtyChanges\(\) \{[\s\S]*?isGenerated\(f\.path\)[\s\S]*?return \[\];/, 'no change reaches the save call for a generated file');
});

test('the inspector shows the generated note and disables every control for a generated file', () => {
  const src = read('workbench/modules/motion/index.mjs');
  assert.match(src, /esc\(GENERATED_NOTE\)\}/, 'the note text comes from the model, not a copy');
  assert.match(src, /const lockAttr = \(\) => \(isGenerated\(st\.file\?\.path\) \? ' disabled' : ''\);/);
  const controls = src.match(/\$\{lockAttr\(\)\}/g) || [];
  assert.equal(controls.length, 9, `inspector inputs, selects, toggles, anchors and remove take lockAttr (${controls.length})`);
});

test('Keep my version saves on the hashes the 409 reported, and never reads the file (a deleted pose would 404)', () => {
  const src = read('workbench/modules/motion/index.mjs');
  const keep = src.match(/if \(act === 'keep'\) \{[\s\S]*?\n      \}/);
  assert.ok(keep, 'the keep branch exists');
  assert.doesNotMatch(keep[0], /files\/read/, 'keep does not re-read the file');
  assert.match(src, /rebaseOnConflicts\(/, 'the save changes are rebased on the reported hashes');
});

test('the drawing code reads the display view of a project, so a null collection cannot throw before the problems show', () => {
  const src = read('workbench/modules/motion/index.mjs');
  assert.match(src, /function viewProject\(\) \{[\s\S]*?viewOf\(st\.file\.project\)/);
  for (const fn of ['renderTransport', 'renderTimeline', 'renderInspector']) {
    const body = src.match(new RegExp(`function ${fn}\\(\\) \\{\\s*const p = viewProject\\(\\)`));
    assert.ok(body, `${fn} draws from viewProject()`);
  }
  assert.match(src, /<div class="mo-problems mo-banner" role="alert" hidden><\/div>/, 'the stage has a problems banner');
  assert.match(src, /function renderBanner\(\) \{[\s\S]*?st\.file\?\.problems[\s\S]*?banner\.hidden/, 'the banner shows the parsePoseFile problems');
  assert.match(src, /renderAll\(\) \{[\s\S]*?renderBanner\(\);/);
});

test('the position editor locks every handle of a generated file', () => {
  const src = read('workbench/modules/motion/index.mjs');
  assert.match(src, /if \(isGenerated\(st\.file\.path\)\) for \(const item of doc\.items\) item\.locked = true;/);
});
