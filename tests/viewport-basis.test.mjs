import test from 'node:test';
import assert from 'node:assert/strict';
import { stableViewportHeight } from '../src/ui/viewportBasis.js';

function windowAt(width, height, dataset)
{
  const root = { dataset, append() {} };
  const doc = { documentElement: root,
    createElement: () => ({ style: {}, setAttribute() {}, isConnected: true, getBoundingClientRect: () => ({ height }) }) };
  return { document: doc, innerWidth: width, innerHeight: height };
}

test('under a canvas the basis is canvas height times fit, never the window height', () =>
{
  const sizes = [[1280, 800], [1440, 900], [1920, 1200]].map(([w, h] ) =>
  {
    const fit = Math.min(w / 1440, h / 900);
    const win = windowAt(w, h, { viewPreset: 'desktop', viewWidth: '1440', viewHeight: '900', viewScale: String(fit) });
    return stableViewportHeight(win) / fit;
  });
  for (const layoutHeight of sizes) assert.ok(Math.abs(layoutHeight - 900) < 1e-9);
});

test('without a preset the basis is the large viewport height', () =>
{
  assert.equal(stableViewportHeight(windowAt(1280, 800, { viewPreset: 'auto' })), 800);
});
