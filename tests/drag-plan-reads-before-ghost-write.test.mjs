// tests/drag-plan-reads-before-ghost-write.test.mjs — the drag frame reads first, writes after.
//
// updateDropTarget measures (viewport, ghost box, pointer, drop plan) before it
// writes the ghost's left/top, so the plan's elementFromPoint and sprite-rect
// reads are not forced layouts behind a style write. Read from the source like
// the other combat-screen anchors, on literals rather than line numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const between = (from, to) => {
  const a = source.indexOf(from);
  assert.ok(a >= 0, `${from} is still in combat.js`);
  const b = source.indexOf(to, a + from.length);
  assert.ok(b > a, `${to} still follows ${from}`);
  return source.slice(a, b);
};

test('updateDropTarget reads the viewport, ghost, pointer and drop plan before the first ghost write', () => {
  const body = between('const updateDropTarget = event => {', 'const queueDropTarget');
  const firstWrite = body.indexOf('dragGhost.style');
  assert.ok(firstWrite > 0, 'the ghost is still positioned from updateDropTarget');
  for (const read of ['dropPlan(', 'viewportLocalBox()', 'anchorLocalBox(VIEWPORT_ORIGIN, { left: event.clientX']) {
    const at = body.indexOf(read);
    assert.ok(at >= 0, `${read} is still read in updateDropTarget`);
    assert.ok(at < firstWrite, `${read} comes before the first dragGhost.style write`);
  }
});

test('the drag frame job stops when the ghost is gone', () => {
  assert.match(between('const updateDropTarget = event => {', 'const view'), /if \(!dragGhost\) return;/);
  const queue = between('const queueDropTarget = event => {', 'const cancelDropTarget');
  assert.match(queue, /requestAnimationFrame\(\(\) => \{[\s\S]*updateDropTarget\(latest\)/, 'the frame callback runs updateDropTarget, which returns early without a ghost');
});

test('clearing the drag cancels the pending frame', () => {
  const clear = between('const clearDragTargeting = () => {', 'const beginDragTargeting');
  assert.match(clear, /cancelDropTarget\(\);/);
});
