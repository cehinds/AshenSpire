import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The queued entry checkpoint (main.js): sliced out and run against a fake run,
// so the save-before-first-action invariant (SPEC §3.12) is pinned headlessly.
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('let pendingEntryCheckpoint = null;');
const end = main.indexOf("document.addEventListener('visibilitychange'", start);
assert.ok(start > 0 && end > start, 'the queued checkpoint block is present');

function harness() {
  const notices = [];
  const env = { run: null, notices };
  const make = new Function('env', 'showSettingsNotice', 'clearTimeout', 'setTimeout', 'requestAnimationFrame', `
    let run; const setRun = r => { run = r; };
    ${main.slice(start, end)}
    return { setRun, queue: p => { pendingEntryCheckpoint = p; }, pending: () => pendingEntryCheckpoint,
      flush: flushPendingEntryCheckpoint, flushSafely: flushPendingEntryCheckpointSafely, supersede: supersedePendingEntryCheckpoint };`);
  return { api: make(env, msg => notices.push(msg), () => {}, () => 0, () => 0), notices };
}
function fixture(api, durable) {
  const run = { combatEntered: { nodeId: 'n1', encounterId: 'e1', snapshot: null } };
  const combat = { rng: 'live', result: null };
  api.setRun(run);
  api.queue({ run, combat, durable, checkpointRng: 'entry', nodeId: 'n1', encounterId: 'e1', timer: 0 });
  return { run, combat };
}

test('a flush saves the entry state with the frozen entry counters and restores the live rng', () => {
  const { api } = harness(); const seen = [];
  const { combat } = fixture(api, c => seen.push(c.rng));
  assert.equal(api.flush(), true);
  assert.deepEqual(seen, ['entry']); assert.equal(combat.rng, 'live'); assert.equal(api.pending(), null);
});

test('a failed flush stays queued, so the next commit retries it before saving its own state', () => {
  const { api, notices } = harness(); let fail = true; const seen = [];
  fixture(api, c => { if (fail) throw new Error('quota'); seen.push(c.rng); });
  api.flushSafely();
  assert.deepEqual(notices, ['quota']); assert.ok(api.pending(), 'still queued after a failure');
  assert.throws(() => api.flush(), /quota/); assert.ok(api.pending());
  fail = false; assert.equal(api.flush(), true); assert.deepEqual(seen, ['entry']);
});

test('a changed run, an existing snapshot or an explicit save drops the queued checkpoint', () => {
  const { api } = harness(); let writes = 0;
  fixture(api, () => writes++); api.setRun({ combatEntered: null });
  assert.equal(api.flush(), false);
  const { run } = fixture(api, () => writes++); run.combatEntered.snapshot = {};
  assert.equal(api.flush(), false);
  fixture(api, () => writes++); api.supersede();
  assert.equal(api.pending(), null); assert.equal(writes, 0);
});
