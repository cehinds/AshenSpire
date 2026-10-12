// W5a: a map-node tap must not run its settled-board save or its extra layout
// work on the main thread. Source-level guards: the behaviour itself is driven
// by tools/map-tap-latency.mjs and tools/map-camera-persistence.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
const mapSrc = read('src/ui/screens/map.js');
const boardSrc = read('src/ui/components/mapboard.js');
const tooltipSrc = read('src/ui/components/tooltip.js');

test('map.js commit path queues the save through the idle scheduler, never onSave() inline', () => {
  const block = mapSrc.slice(mapSrc.indexOf('onViewStateChange: (viewState'), mapSrc.indexOf('onPick: (id, reading)'));
  assert.ok(block.length > 0, 'the onViewStateChange viewer block is present');
  assert.doesNotMatch(block, /onSave\(\)/, 'the commit path must not call onSave() synchronously');
  assert.match(block, /scheduleSave\(onSave/, 'the commit path queues through scheduleSave');
  const sched = mapSrc.slice(mapSrc.indexOf('function whenIdle'), mapSrc.indexOf('function scheduleSave'));
  assert.match(sched, /requestIdleCallback\(fn, \{ timeout: 500 \}\)/);
  assert.match(sched, /setTimeout\(fn, 0\)/, 'the fallback is setTimeout(fn, 0)');
});

test('map.js flushes a queued save before each path that hands control away', () => {
  assert.match(mapSrc, /function releaseMapScreen\(\) \{\s*flushPendingSave\(\);/);
  assert.match(mapSrc, /onQuit: leaving\(onQuit\)/);
  assert.match(mapSrc, /onQuitWithoutSave: leaving\(onQuitWithoutSave\)/);
  assert.match(mapSrc, /if \(next\.enter\) \{ leaving\(onPick\)\(id\); return; \}/);
  assert.match(mapSrc, /leaving\(onPick\)\(selection\.selectedId\)/);
  assert.match(mapSrc, /pagehide', flushPendingSave/);
});

test('mapboard.js sizeSvg is no longer an unconditional apply(); apply();', () => {
  const body = boardSrc.slice(boardSrc.indexOf('function sizeSvg() {'), boardSrc.indexOf('function apply() {'));
  assert.ok(body.length > 0, 'sizeSvg is present');
  assert.doesNotMatch(body, /apply\(\);\s*apply\(\);/);
  assert.match(body, /scroll\.clientWidth !== cw \|\| scroll\.clientHeight !== ch\) apply\(\);/, 'the second pass runs only when the viewport changed');
});

test('mapboard.js keeps second-tap explanations only for unreachable nodes', () => {
  assert.match(boardSrc, /attachTooltip\(el, \(\) => viewer\.tooltip\([^)]*\), \{ secondTap: !isReachable \}\)/);
  assert.match(tooltipSrc, /\bsecondTap = true,/);
  assert.match(tooltipSrc, /\} else if \(secondTap && !selectionFirst && !expand\) \{/);
});

test('an explicit Save drops the queued camera save instead of flushing it (one Save, one write)', () => {
  const map = readFileSync(new URL('../src/ui/screens/map.js', import.meta.url), 'utf8');
  assert.match(map, /onSave: saving\(onSave\)/);
  assert.doesNotMatch(map, /leaving\(onSave\)/);
  assert.match(map, /const saving = \(fn\) =>[^\n]*dropPendingSave\(\)/);
});

test('using a potion drops the queued camera save before saving and remounting', () => {
  const map = readFileSync(new URL('../src/ui/screens/map.js', import.meta.url), 'utf8');
  const potionMount = map.slice(map.indexOf('mountRunPotions('), map.indexOf('screen.append(tray)'));
  assert.match(potionMount, /onChange: \(\) => \{ dropPendingSave\(\); onSave\?\.\(\); remount\(\); \}/);
  assert.doesNotMatch(potionMount, /flushPendingSave\(\)/);
});
