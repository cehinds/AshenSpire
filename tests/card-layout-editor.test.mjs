import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { validateCardAppearance } from '../src/model/cardAppearance.js';

const source = readFileSync(new URL('../docs/qa/card-layers/editor.js', import.meta.url), 'utf8');
function editorHarness() {
  const defaults = { components: { title: {}, panel: {} }, symbols: { actions: { attack: {} } } };
  const context = { validateCardAppearance, localStorage: { setItem() {} }, setTimeout() {}, location: { reload() {} } };
  const Editor = runInNewContext(source.replace(/^import .*;\n/gm, '').replace('export class', 'class') + '\nCardLayoutEditor;',
    { ...context, cardLayoutDocument: () => defaults });
  const editor = Object.create(Editor.prototype);
  const status = { textContent: '' }, json = { value: '{}' }, href = { value: '' };
  editor.appearance = { querySelector: selector => selector === '[data-visual-json]' ? json : selector === '[data-visual-href]' ? href : status };
  editor.data = {}; editor.checkpoint = () => {}; editor.save = () => {}; editor.mount = () => {};
  editor.originalReference = { cloneNode() {} };
  return { editor, status, json, context };
}

test('editor rejects content replacement under the selected text component before applying', () => {
  for (const id of ['title', 'rules', 'rank-text', 'action-text', 'hp-value', 'rank-group', 'tag-rail', 'footer-band']) {
    for (const value of [{ svg: { viewBox: '0 0 10 10', body: '<rect x="0" y="0" width="10" height="10"/>' } }, { decorations: [{ style: { color: 'red' } }] }]) {
      const { editor, status, json } = editorHarness();
      editor.appearanceTarget = () => ({ id }); json.value = JSON.stringify(value);
      editor.editAppearance();
      assert.match(status.textContent, /supplied by the card/);
      assert.equal(editor.data.components, undefined, 'rejected edits never enter the draft');
    }
  }
});

test('editor still applies allowed text styles and custom symbol SVG', () => {
  for (const [target, value] of [[{ id: 'title' }, { style: { color: 'red' } }],
    [{ catalog: 'actions', key: 'attack' }, { svg: { viewBox: '0 0 10 10', body: '<circle cx="5" cy="5" r="4"/>' } }]]) {
    const { editor, status, json } = editorHarness(); editor.appearanceTarget = () => target; json.value = JSON.stringify(value);
    editor.editAppearance(); assert.match(status.textContent, /Applied to draft/);
  }
});

async function exportHarness(ok) {
  const { editor } = editorHarness();
  editor.ready = Promise.resolve(); editor.revision = 'old'; editor.gameDocument = { stale: true };
  editor.status = {}; editor.key = 'shared'; editor.data = { layouts: { shared: {} } };
  editor.document = () => ({ draft: true });
  const exports = []; editor.downloadDocument = data => exports.push(data);
  // Fetch is resolved asynchronously, as the real endpoint is.
  const result = { revision: 'new', document: { accepted: true }, error: 'Stale revision' };
  const method = runInNewContext('(' + editor.saveGame.toString().replace('async saveGame', 'async function') + ')',
    { fetch: async () => ({ ok, json: async () => result }), localStorage: { setItem() {} }, setTimeout() {}, location: {} });
  editor.saveGame = method;
  const saving = editor.download();
  assert.equal(exports.length, 0, 'no download before save completes');
  await saving;
  return { editor, exports, result };
}

test('export downloads exactly the endpoint-accepted document after saving', async () => {
  const { editor, exports, result } = await exportHarness(true);
  assert.deepEqual(exports, [result.document]); assert.equal(editor.revision, 'new');
});
test('stale save failure produces no exported file', async () => {
  const { editor, exports } = await exportHarness(false);
  assert.deepEqual(exports, []); assert.match(editor.status.textContent, /Not saved.*Stale revision/);
  assert.equal(editor.revision, 'old');
});
