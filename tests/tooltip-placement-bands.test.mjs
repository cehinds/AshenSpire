import test from 'node:test';
import assert from 'node:assert/strict';
import { tooltipPlacementModel, tooltipPlacementIntent } from '../src/ui/models/TooltipPlacementModel.js';
const viewport = { width: 1000, height: 800 };
test('authored top band changes narrow placement', () => {
  const anchor = { left: 480, top: 200, width: 40, height: 40 };
  assert.equal(tooltipPlacementIntent(anchor, viewport, tooltipPlacementModel({ topBandViewportPct: 10 }), { narrow: true }), 'above');
  assert.equal(tooltipPlacementIntent(anchor, viewport, tooltipPlacementModel({ topBandViewportPct: 40 }), { narrow: true }), 'under');
});
test('authored side bands retain inward placement', () => {
  const anchor = { left: 180, top: 400, width: 40, height: 40 };
  assert.equal(tooltipPlacementIntent(anchor, viewport, tooltipPlacementModel({ sideBandViewportPct: 30 })), 'right');
  assert.equal(tooltipPlacementIntent(anchor, viewport, tooltipPlacementModel({ sideBandViewportPct: 5 })), 'above');
  assert.equal(tooltipPlacementIntent({ ...anchor, left: 780 }, viewport, tooltipPlacementModel({ sideBandViewportPct: 30 })), 'left');
});
