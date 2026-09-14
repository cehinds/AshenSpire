import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectControl, inspectControlCss, inspectControlRisePx } from '../src/ui/models/InspectControlModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

test('one uniform control: a 2.75 reference-rem target with a 16 px label', () => {
  assert.deepEqual({ ...inspectControl() }, { sizeRem: 2.75, labelPx: 16, gapPx: 10 });
  const css = inspectControlCss();
  assert.equal(css.size, 'calc(2.75 * max(16px / var(--ui-zoom, 1), 1rem))');
  assert.equal(css.label, 'calc(16px / var(--ui-zoom, 1))');
  assert.equal(css.gap, 'calc(10px / var(--ui-zoom, 1))');
});

test('the control hangs its size plus the gap above its owner', () => {
  assert.equal(inspectControlRisePx(), 54);
});

test('a target under 44 px or an unreadable label is refused', () => {
  const bad = (patch) => ({ ...wireframeUi.inspect, ...patch });
  assert.throws(() => inspectControl(bad({ sizeRem: 2.25 })), /44 px target/);
  assert.throws(() => inspectControl(bad({ labelPx: 10 })), /readable/);
  assert.throws(() => inspectControl(bad({ gapPx: -1 })), /gapPx/);
});
