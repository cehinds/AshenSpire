import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const title = readFileSync(new URL('../src/ui/screens/title.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('Exit is the final primary entry and is unique', () => {
  const primary = title.match(/entries: \[([\s\S]*?)\n      \],/)[1];
  assert.match(primary, /entry\('Exit', 'quit', \{ id: 'quit-game' \}\),\s*$/);
  assert.equal((title.match(/id: 'quit-game'/g) || []).length, 1);
});
// Run the actual composition-root handler with dependency doubles: a failed
// save must preserve the live run and use saveNow's existing error/retry door.
const quitBody = main.match(/function quitGame\(\) \{([\s\S]*?)\n\}/)[1];
function invoke(saved) {
  const events = [];
  const run = { slot: 1 };
  const state = { run, document: { activeElement: {} }, saveNow: () => { events.push('save'); return saved; },
    closeOverlay: () => events.push('overlay'), dropLanLink: () => events.push('lan'),
    audio: { stopMusic: () => events.push('stop') }, app: {}, showCollapsedTitle() {},
    mountQuitScreen: (_, opts) => { events.push('exit'); assert.equal(opts.savedRun, true); } };
  vm.runInNewContext(`(function () { ${quitBody} })()`, state);
  return { events, state, run };
}
test('a failed exit save retains the run and does not stop music or close', () => {
  const h = invoke(false); assert.deepEqual(h.events, ['save']); assert.equal(h.state.run, h.run);
});
test('a successful exit saves before stopping and mounting the close route', () => {
  const h = invoke(1); assert.deepEqual(h.events, ['save', 'overlay', 'lan', 'stop', 'exit']); assert.equal(h.state.run, null);
});
