import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('a field resize without a new layout epoch clears the overhead key and re-places once', () => {
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const start = source.indexOf('  let fieldSizeKey = null;');
  const end = source.indexOf('  rackObserver.observe(field);', start);
  assert.ok(start >= 0 && end > start);
  let placed = 0;
  const holder = {};
  const frames = [];
  const field = { clientWidth: 100, clientHeight: 50, isConnected: true };
  const centerTargetOverheads = () => { placed++; };
  centerTargetOverheads.placedKey = 'kept';
  const api = runInNewContext(source.slice(start, end) + '\n({ fire: entries => holder.cb(entries) })', {
    holder, field, centerTargetOverheads, watchedRacks: new WeakSet(), rackRequest: 0,
    ResizeObserver: class { constructor(cb) { holder.cb = cb; } },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
  });
  api.fire([{ target: field }]); // first observation: nothing known yet
  assert.equal(frames.length, 0);
  api.fire([{ target: field }]); // same size
  assert.equal(frames.length, 0);
  field.clientWidth = 120;
  api.fire([{ target: field }]);
  assert.equal(frames.length, 1, 'a changed field size schedules a re-place');
  frames.pop()();
  assert.equal(centerTargetOverheads.placedKey, null);
  assert.equal(placed, 1);
});

test('a compact footer line is never cleared outside the measure job', async () => {
  globalThis.requestAnimationFrame = undefined;
  globalThis.getComputedStyle = () => ({ fontSize: '10px' });
  const { fitFooterCompactLabels } = await import('../src/ui/components/footerArt.js');
  const { flushMeasureJobs } = await import('../src/ui/frameMeasure.js');
  const log = [];
  const line = { style: { fontSize: '9px', removeProperty() { log.push('clear'); this.fontSize = ''; } },
    getBoundingClientRect: () => ({ width: 100 }), parentElement: { getBoundingClientRect: () => ({ width: 50 }) } };
  const row = { isConnected: true, dataset: { footerCompact: 'true' }, querySelectorAll: () => [line] };
  fitFooterCompactLabels(row);
  assert.deepEqual(log, [], 'queueing writes nothing, so no frame paints between clear and re-fit');
  flushMeasureJobs();
  assert.deepEqual(log, ['clear']);
  assert.equal(line.style.fontSize, '5px', 're-fitted in the same job');
});
