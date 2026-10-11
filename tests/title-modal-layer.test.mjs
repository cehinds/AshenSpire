// tests/title-modal-layer.test.mjs — the Title's New Game modal redraws only itself.
//
// The modal's handlers used to call render(), which rebuilt the whole Title
// (intro replay, embers, HUD re-wire) on every click inside the modal. They
// now call renderModal(), which writes only the [data-title-modal-layer] node.
// This is a source test: it reads title.js as text and pins that shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = readFileSync(
  fileURLToPath(new URL('../src/ui/screens/title.js', import.meta.url)),
  'utf8',
);

// The body of a `const name = (...) => { ... };` declaration at the file's
// two-space indent (the closing brace sits on its own `  };` line).
const arrowBody = (name) => {
  const match = SOURCE.match(new RegExp(`const ${name} = \\([^)]*\\) => \\{([\\s\\S]*?)\\n  \\};`));
  assert.ok(match, `${name} is declared in title.js`);
  return match[1];
};

// The body of `function render() { ... }` up to the HUD wiring that follows
// its template.
const renderBody = () => {
  const match = SOURCE.match(/function render\(\) \{([\s\S]*?)\n  \}\n/);
  assert.ok(match, 'render() is declared in title.js');
  return match[1];
};

for (const name of ['openModal', 'openNewReview', 'closeNewReview', 'closeModal', 'activateSlot']) {
  test(`${name} redraws the modal layer, not the whole Title`, () => {
    const body = arrowBody(name);
    assert.match(body, /renderModal\(\);/, `${name} calls renderModal()`);
    assert.doesNotMatch(body, /\brender\(\);/, `${name} does not call render()`);
  });
}

test("render()'s template holds the modal inside data-title-modal-layer", () => {
  const body = renderBody();
  assert.match(body, /<div class="title-modal-layer" data-title-modal-layer style="display:contents">\$\{modalHtml\(\)\}<\/div>/);
  assert.doesNotMatch(body, /\$\{modalHtml\(\)\}\s*<\/div>`;/, 'the bare modal is no longer a direct child of the screen');
});

test('renderModal() draws and wires only the modal layer', () => {
  const match = SOURCE.match(/function renderModal\(\) \{([\s\S]*?)\n  \}\n/);
  assert.ok(match, 'renderModal() is declared in title.js');
  const body = match[1];
  assert.match(body, /querySelector\('\[data-title-modal-layer\]'\)/);
  assert.match(body, /layer\.innerHTML = modalHtml\(\);/);
  assert.doesNotMatch(body, /app\.querySelector\('\.title-screen'\)|artNotice/, 'renderModal does not touch the whole screen or the art notice');
  assert.doesNotMatch(body, /\bapp\.innerHTML\b/);
});

// W6: the New Game door is a registered modal, and a delete from the Title
// updates it in place instead of remounting the whole Title.
const MAIN_SOURCE = readFileSync(
  fileURLToPath(new URL('../src/main.js', import.meta.url)),
  'utf8',
);

test('title.js registers the open New Game door with modalState.js', () => {
  assert.match(SOURCE, /import \{ registerModal \} from '\.\.\/modalState\.js';/);
  assert.match(SOURCE, /registerModal\('title-new', layer\)/);
  assert.match(SOURCE, /releaseTitleModal\?\.\(\);\n\s*releaseTitleModal = null;/, 'screen teardown releases the entry');
});

test('a delete from the Title redraws in place through deleteSlot, not showTitle', () => {
  assert.match(SOURCE, /const deleteSlot = \(slot, from\) => \{/);
  assert.match(SOURCE, /onConfirm: \(\) => deleteSlot\(slot, 'new'\)/);
  assert.match(SOURCE, /onDelete: \(slot\) => deleteSlot\(slot, 'load'\)/);
  assert.match(SOURCE, /if \(!Array\.isArray\(fresh\)\) return;\n\s*currentSlots = fresh;/);
});

test('the intro scene replays automatically only on the first render of a mount', () => {
  assert.match(SOURCE, /if \(!introPlayed\) \{\n\s*introPlayed = true;\n\s*replayScene\(\);\n\s*\}/);
  assert.doesNotMatch(SOURCE, /\n    replayScene\(\);\n/, 'render() no longer calls replayScene() unconditionally');
});

test('main.js onDelete no longer remounts the Title and returns the fresh slot records', () => {
  const match = MAIN_SOURCE.match(/onDelete: \(slot, from = null\) => \{([\s\S]*?)\n    \},/);
  assert.ok(match, 'onDelete handler is declared in showTitle');
  const body = match[1];
  assert.match(body, /saves\.clearRun\(slot\);/);
  assert.doesNotMatch(body, /showTitle\(/, 'onDelete does not call showTitle');
  assert.match(body, /const fresh = saveSlotRecords\(\);/);
  assert.match(body, /return fresh;/);
});
