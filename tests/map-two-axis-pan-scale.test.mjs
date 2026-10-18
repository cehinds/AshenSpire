import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const tool = readFileSync(new URL('../tools/map-two-axis-pan.mjs', import.meta.url), 'utf8');
const start = tool.indexOf('    const moves =');
const end = tool.indexOf('    const checks =', start);
const movesAt = scale => runInNewContext(tool.slice(start, end) + '\nmoves', {
  evidence: { viewportScale: { x: scale, y: scale } },
});
const sample = (x, y) => ({ before: { left: 70, top: 750 },
  moved: { left: 70 + x, top: 750 + y, grabbed: true }, cleaned: true });

test('pan movement follows the physical pointer distance at desktop and phone UI scales', () => {
  for (const scale of [.75, .9, 1, 1.2, 1.5]) assert.equal(movesAt(scale)(sample(60 / scale, 60 / scale)), true);
  assert.equal(movesAt(1.2)(sample(60, 60)), false, 'uncompensated local movement must still fail');
});

test('both axes, grab ownership and release cleanup remain required', () => {
  const moves = movesAt(1.2), correct = sample(50, 50);
  assert.equal(moves(sample(50, 0)), false);
  assert.equal(moves(sample(0, 50)), false);
  assert.equal(moves({ ...correct, cleaned: false }), false);
  assert.equal(moves({ ...correct, moved: { ...correct.moved, grabbed: false } }), false);
});
