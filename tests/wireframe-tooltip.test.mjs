import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TOOLTIP_ARROW_EDGES, TOOLTIP_RUNGS, TOOLTIP_WIREFRAMES,
  tooltipArrow, tooltipArrowSize, tooltipWireframe, tooltipWireframeConfig,
} from '../src/ui/models/TooltipPlacementModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('every presenter rung draws one of WT1, WT2 and WT3, smallest first', () => {
  assert.deepEqual([...TOOLTIP_RUNGS], ['small', 'medium', 'large', 'expanded']);
  assert.deepEqual(TOOLTIP_RUNGS.map(rung => tooltipWireframe(rung)), ['WT1', 'WT2', 'WT3', 'WT3']);
  assert.deepEqual([...TOOLTIP_WIREFRAMES], ['WT1', 'WT2', 'WT3']);
  assert.throws(() => tooltipWireframe('huge'), /unknown rung/);
});

test('a mapping that drops a rung, names another wireframe, skips one, or runs backwards is refused', () => {
  const withMap = (wireframeByRung) => ({ ...wireframeUi.tooltip, wireframeByRung });
  assert.throws(() => tooltipWireframeConfig(withMap({ small: 'WT1', medium: 'WT2', large: 'WT3' })), /exactly/);
  assert.throws(() => tooltipWireframeConfig(withMap({ small: 'WT1', medium: 'WT2', large: 'WT3', expanded: 'W1' })), /not one of/);
  assert.throws(() => tooltipWireframeConfig(withMap({ small: 'WT1', medium: 'WT3', large: 'WT3', expanded: 'WT3' })), /no rung draws WT2/);
  assert.throws(() => tooltipWireframeConfig(withMap({ small: 'WT2', medium: 'WT1', large: 'WT3', expanded: 'WT3' })), /smaller wireframe/);
  assert.throws(() => tooltipWireframeConfig({ ...wireframeUi.tooltip, arrowHeightRem: 0 }), /arrowHeightRem/);
});

test('the arrow is WT0.arrow: 0.75 × 0.375 reference rems of at least 16 physical px', () => {
  assert.deepEqual({ ...tooltipArrowSize({ zoom: 1, rootFontPx: 10 }) }, { widthPx: 12, heightPx: 6, insetPx: 8 });
  // At half zoom a reference rem is 32 local px, which renders as 16.
  assert.deepEqual({ ...tooltipArrowSize({ zoom: 0.5, rootFontPx: 10 }) }, { widthPx: 24, heightPx: 12, insetPx: 16 });
});

const size = { widthPx: 12, heightPx: 6, insetPx: 8 };

test('above its trigger the arrow hangs from the bottom edge and points at the trigger centre', () => {
  const arrow = tooltipArrow({ left: 100, top: 50, width: 200, height: 80 }, { left: 150, top: 144, width: 40, height: 40 }, size);
  assert.deepEqual({ ...arrow }, { edge: 'bottom', left: 164, top: 130, width: 12, height: 6 });
});

test('flipped below, the arrow rises from the top edge', () => {
  const arrow = tooltipArrow({ left: 0, top: 60, width: 200, height: 80 }, { left: 20, top: 10, width: 40, height: 40 }, size);
  assert.deepEqual({ ...arrow }, { edge: 'top', left: 34, top: 54, width: 12, height: 6 });
});

test('after a shift the arrow still follows the trigger, held clear of the corner', () => {
  // The trigger sits past the panel's right end: the arrow stops at the inset.
  const arrow = tooltipArrow({ left: 100, top: 50, width: 200, height: 80 }, { left: 320, top: 144, width: 40, height: 40 }, size);
  assert.equal(arrow.edge, 'bottom');
  assert.equal(arrow.left + arrow.width / 2, 300 - 8 - 6);
});

test('beside the trigger the arrow turns onto the facing side', () => {
  const right = tooltipArrow({ left: 200, top: 0, width: 150, height: 100 }, { left: 140, top: 30, width: 40, height: 40 }, size);
  assert.deepEqual({ ...right }, { edge: 'left', left: 194, top: 44, width: 6, height: 12 });
  const left = tooltipArrow({ left: 0, top: 0, width: 100, height: 100 }, { left: 140, top: 30, width: 40, height: 40 }, size);
  assert.equal(left.edge, 'right');
  assert.equal(left.left, 100);
});

test('no arrow when the panel sits on its trigger or the edge is too short to carry one', () => {
  assert.equal(tooltipArrow({ left: 0, top: 0, width: 100, height: 100 }, { left: 40, top: 40, width: 20, height: 20 }, size).edge, 'none');
  assert.equal(tooltipArrow({ left: 0, top: 0, width: 20, height: 10 }, { left: 0, top: 30, width: 20, height: 20 }, size).edge, 'none');
  assert.equal(tooltipArrow(null, { left: 0, top: 0, width: 1, height: 1 }, size).edge, 'none');
});

test('the presenter stamps the wireframe from the one rung list, and the stylesheet draws every edge', () => {
  const presenter = source('src/ui/components/tooltip.js');
  assert.match(presenter, /TOOLTIP_RUNGS/);
  assert.doesNotMatch(presenter, /\[\s*'small',\s*'medium',\s*'large',\s*'expanded'\s*\]/);
  assert.match(presenter, /dataset\.wireframe\s*=/);
  const kit = source('styles/kit.css');
  for (const edge of TOOLTIP_ARROW_EDGES) assert.match(kit, new RegExp(`#tooltip\\[data-arrow="${edge}"\\]::after`));
});
