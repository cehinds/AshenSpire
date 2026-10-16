import test from 'node:test';
import assert from 'node:assert/strict';
import { targetHudConfig, targetHudEnabled, targetHudSide, placeTargetHudPanels, targetHudOverlaps, createTargetHudDwell } from '../src/ui/models/TargetHudModel.js';

test('target details are limited to alternative desktop and widescreen formation', () => {
  for (const formFactor of ['desktop', 'widescreen']) assert.equal(targetHudEnabled({ formFactor, classic: false }), true);
  for (const formFactor of ['mobile', 'tablet']) assert.equal(targetHudEnabled({ formFactor, classic: false }), false);
  assert.equal(targetHudEnabled({ formFactor: 'desktop', classic: true }), false);
  assert.equal(targetHudEnabled({ formFactor: 'desktop', classic: false, layout: 'cards' }), false);
  assert.deepEqual([0, 1, 2].map(lane => targetHudSide('enemy', lane)), ['left', 'below', 'right']);
  assert.deepEqual([0, 1, 2].map(lane => targetHudSide('player', lane)), ['right', 'left', 'left']);
});
function clock() {
  let now = 0, serial = 0; const jobs = new Map();
  return { schedule(fn, delay) { const id = ++serial; jobs.set(id, { fn, at: now + delay }); return id; }, cancel(id) { jobs.delete(id); },
    advance(ms) { now += ms; for (const [id, job] of jobs) if (job.at <= now) { jobs.delete(id); job.fn(); } }, get pending() { return jobs.size; } };
}
test('enter, exit, and stable switch each use one 500ms clock, content updates do not restart it', () => {
  const time = clock(), changes = [], dwell = createTargetHudDwell({ onChange: ids => changes.push(ids), schedule: time.schedule, cancel: time.cancel });
  dwell.request(['left']); time.advance(499); assert.deepEqual(changes, []);
  dwell.request(['left']); time.advance(1); assert.deepEqual(changes, [['left']]);
  dwell.request(['middle']); time.advance(250); dwell.request(['right']); time.advance(499);
  assert.deepEqual(dwell.current, ['left']); time.advance(1); assert.deepEqual(dwell.current, ['right']);
  dwell.request([]); time.advance(499); assert.deepEqual(dwell.current, ['right']);
  dwell.request(['right']); time.advance(1); assert.deepEqual(dwell.current, ['right'], 'returning across the pointer corridor cancels leave');
  dwell.request([]); time.advance(500); assert.deepEqual(dwell.current, []);
  dwell.request(['enemy1', 'enemy2', 'enemy3']); time.advance(500); assert.deepEqual(dwell.current, ['enemy1', 'enemy2', 'enemy3']);
  dwell.request(['player']); assert.equal(time.pending, 1); dwell.dispose(); time.advance(500);
  assert.deepEqual(changes.at(-1), ['enemy1', 'enemy2', 'enemy3']); assert.equal(time.pending, 0);
});
test('six crowded enemy panels remain visible, distinct and above the hand at desktop sizes', () => {
  for (const width of [1366, 1440, 1920]) {
    const bounds = { left: 0, top: 80, width, height: width === 1366 ? 430 : 500 };
    const panels = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, role: 'enemy', lane: i % 3,
      anchor: { left: width * (.32 + i % 3 * .22), top: 125 + Math.floor(i / 3) * 130, width: 105, height: 135 },
      width: width < 1400 ? 198 : 224, height: 125 }));
    const result = placeTargetHudPanels({ bounds, panels });
    assert.equal(new Set(result.map(row => row.id)).size, 6);
    for (const panel of result) {
      assert.ok(panel.left >= bounds.left && panel.top >= bounds.top);
      assert.ok(panel.left + panel.width <= bounds.left + bounds.width);
      assert.ok(panel.top + panel.height <= bounds.top + bounds.height);
      for (const other of result) if (panel !== other) assert.equal(targetHudOverlaps(panel, other), false, `${width}: ${panel.id}/${other.id}`);
    }
  }
  assert.equal(targetHudConfig().motion.dwellMs, 500);
});
