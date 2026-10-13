import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'src/ui/screens/map.js'), 'utf8');

// W9: selecting a node on a phone must not move it out from under the finger
// unless the tray would cover it. The source is the contract here: openTray
// may only call centerOnNode behind the visibility check, and that check keeps
// a 24 px margin on every side.
const fnBody = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists in map.js`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`${name} body closes`);
};

test('map.js declares a 24 px comfortable-visibility margin for the selected node', () => {
  assert.match(src, /COMFORT_MARGIN_PX\s*=\s*24\b/);
});

test('openTray calls centerOnNode only when the node is not comfortably visible', () => {
  const body = fnBody('openTray');
  const calls = [...body.matchAll(/board\.centerOnNode\(/g)];
  assert.equal(calls.length, 2, 'both the open and the already-open paths centre through the check');
  for (const call of calls) {
    const before = body.slice(0, call.index);
    assert.match(before, /if \(!nodeComfortablyVisible\(/, 'every centerOnNode call sits behind the visibility check');
  }
});

test('nodeComfortablyVisible checks all four sides against the margin', () => {
  const body = fnBody('nodeComfortablyVisible');
  assert.match(body, /lastPickPointerType !== 'touch'/, 'visibility follows the pointer that activated the node');
  assert.doesNotMatch(body, /pointer: coarse/, 'hybrid devices do not use the primary-pointer media query');
  assert.match(body, /nodeBox\.left >= portBox\.left \+ margin/);
  assert.match(body, /nodeBox\.right <= portBox\.right - margin/);
  assert.match(body, /nodeBox\.top >= portBox\.top \+ margin/);
  assert.match(body, /nodeBox\.bottom <= visibleBottom - margin/);
  assert.match(body, /Math\.min\(portBox\.bottom, coveredTop\)/, 'the visible bottom is clipped to the tray');
});

test('the board passes the activating pointer type into map selection', () => {
  const board = readFileSync(resolve(root, 'src/ui/components/mapboard.js'), 'utf8');
  assert.match(board, /addEventListener\('pointerdown',[\s\S]*pickPointerType = ev\.pointerType \|\| 'mouse'/);
  assert.match(board, /viewer\.onPick\(n\.id, \{ shownType, revealed \}, \{ pointerType \}\)/);
  assert.match(src, /onPick: \(id, reading, \{ pointerType \} = \{\}\) => selectNode\(id, reading, pointerType\)/);
  assert.match(src, /lastPickPointerType = pointerType;/);
});

test('closeTray resets the framing only when the tray moved the camera', () => {
  const body = fnBody('closeTray');
  assert.match(body, /if \(trayCentred\)\s*\{[\s\S]*board\.resetFraming\(/);
});

test('a pick that is not centred still leaves its look for a re-fit (#1142)', () => {
  const map = readFileSync(new URL('../src/ui/screens/map.js', import.meta.url), 'utf8');
  const board = readFileSync(new URL('../src/ui/components/mapboard.js', import.meta.url), 'utf8');
  assert.match(board, /function holdLook\(id, \{ inset = 0 \} = \{\}\) \{[\s\S]*?look = \{ id, inset: insetBottom \};/);
  assert.match(board, /function releaseLook\(\) \{[\s\S]*?look = null;/);
  assert.equal((map.match(/else board\.holdLook\(selection\.selectedId/g) || []).length, 2, 'both open paths hold the look when they skip the move');
  assert.match(map, /else board\.releaseLook\(\);/, 'closing a tray that never moved the camera forgets the look without re-framing');
});
