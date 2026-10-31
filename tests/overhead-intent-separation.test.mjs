import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { separateOverheadIntents } from '../src/ui/components/overheadIntentSeparation.js';

// 844x390: the back-row enemy's intent (0-9 and its sword) stood over the
// player's hourglass. The player's glyph slides clear; nothing else moves.
const item = (id, left, width, extra = {}) => ({ id, left, right: left + width, top: 43, bottom: 80, ...extra });
const bounds = { left: 0, right: 844 };

test('overlapping player glyph slides to the nearest free side of the enemy intent', () => {
  const shifts = separateOverheadIntents([item('player', 189, 44, { movable: true }), item('e2', 203, 61)], bounds);
  assert.equal(shifts.get('e2'), 0);
  assert.ok(shifts.get('player') < 0, 'the glyph stays on its own side, to the left');
  const moved = 189 + shifts.get('player');
  assert.ok(moved + 44 <= 203 - 4 + 1e-9, 'a 4px gap from the enemy intent');
});

test('clear intents are left where they are', () => {
  const shifts = separateOverheadIntents([item('player', 100, 44, { movable: true }), item('e1', 610, 61), item('e2', 203, 61)], bounds);
  assert.deepEqual([...shifts.values()], [0, 0, 0]);
});

test('a slide never leaves the field or lands on a third intent', () => {
  const shifts = separateOverheadIntents([item('player', 10, 44, { movable: true }), item('e2', 20, 61), item('e3', 90, 61)], { left: 0, right: 300 });
  const at = 10 + shifts.get('player');
  assert.ok(at >= 0 && at + 44 <= 300);
  for (const [l, r] of [[20, 81], [90, 151]]) assert.ok(at + 44 <= l || at >= r, 'clear of every other intent');
});

test('the stage wires the separation and the stylesheet applies the offset', () => {
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/combat-target-responsive.css', import.meta.url), 'utf8');
  assert.match(stage, /separateRackedIntents\(racked, zoom, \{ fieldBox: readsFieldBox \}\)/);
  assert.match(css, /left:var\(--combat-intent-shift,auto\)!important/);
});

test('a pass whose inputs match the last one skips without reading a single box', async () => {
  const { runInNewContext } = await import('node:vm');
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const start = stage.indexOf('let racksKey');
  const end = stage.indexOf('function centerTargetOverheads');
  assert.ok(start > 0 && end > start, 'separateRackedIntents is still next to centerTargetOverheads');
  let liveReads = 0;
  const live = () => { liveReads += 1; return { left: 0, right: 100, top: 0, bottom: 10, width: 100, height: 10 }; };
  const row = (n) => {
    const props = new Map();
    const intent = { className: 'intent', textContent: String(n), classList: { contains: () => false },
      style: { getPropertyValue: (k) => props.get(k) || '', setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
      getBoundingClientRect: live, parentElement: { getBoundingClientRect: live } };
    const read = { frameBox: { left: n, top: 0, width: 50 }, intentBox: { width: 40, height: 20, top: 5 }, rackBox: { left: n, width: 50 } };
    return { frame: { style: { getPropertyValue: () => '' }, getBoundingClientRect: live }, intent, read };
  };
  const rows = [row(1), row(2)];
  const separate = runInNewContext(`${stage.slice(start, end)}\nseparateRackedIntents`, {
    field: { getBoundingClientRect: live }, separateOverheadIntents: () => new Map(),
  });
  const reads = { fieldBox: { left: 0, right: 390 } };
  separate(rows, 1, reads);
  const afterFirst = liveReads;
  separate(rows, 1, reads);
  assert.equal(liveReads, afterFirst, 'the second, identical pass read nothing after the writes');
  separate(rows.map((r, i) => i ? { ...r, read: { ...r.read, intentBox: { width: 70, height: 20, top: 5 } } } : r), 1, reads);
  assert.ok(liveReads > afterFirst, 'a changed intent size still takes the full measuring pass');
});

test('a change in one placement variable alone forces the full pass', async () => {
  const { runInNewContext } = await import('node:vm');
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const start = stage.indexOf('let racksKey');
  const end = stage.indexOf('function centerTargetOverheads');
  assert.ok(start > 0 && end > start, 'separateRackedIntents is still next to centerTargetOverheads');
  let liveReads = 0, separations = 0;
  const live = () => { liveReads += 1; return { left: 0, right: 100, top: 0, bottom: 10, width: 100, height: 10 }; };
  const row = (n) => {
    const props = new Map();
    const placement = new Map();
    const intent = { className: 'intent', textContent: String(n), classList: { contains: () => false },
      style: { getPropertyValue: (k) => props.get(k) || '', setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
      getBoundingClientRect: live, parentElement: { getBoundingClientRect: live } };
    const read = { frameBox: { left: n, top: 0, width: 50 }, intentBox: { width: 40, height: 20, top: 5 }, rackBox: { left: n, width: 50 } };
    const frame = { style: { getPropertyValue: (k) => placement.get(k) || '' }, getBoundingClientRect: live };
    return { frame, intent, read, placement };
  };
  const rows = [row(1), row(2)];
  const separate = runInNewContext(`${stage.slice(start, end)}\nseparateRackedIntents`, {
    field: { getBoundingClientRect: live }, separateOverheadIntents: () => { separations += 1; return new Map(); },
  });
  const reads = { fieldBox: { left: 0, right: 390 } };
  separate(rows, 1, reads);
  separate(rows, 1, reads);
  assert.equal(separations, 1, 'the identical second pass skipped');
  const afterSkip = liveReads;
  rows[1].placement.set('--combat-mini-hud-top', '12px');
  separate(rows, 1, reads);
  assert.equal(separations, 2, 'the shifts were recomputed');
  assert.ok(liveReads > afterSkip, 'the post-reset intent reads happened');
});
