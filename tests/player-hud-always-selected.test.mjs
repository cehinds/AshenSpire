import test from 'node:test';
import assert from 'node:assert/strict';
import { targetHudDesiredIds, targetHudTintIds, targetHudPinnedIds } from '../src/ui/models/TargetHudModel.js';

// Owner 2026-11-05: "The selected HUD should be active at all times" for the player (no mini overhead bar).
const entries = [{ id: 'player', role: 'player' }, { id: 'e1', role: 'enemy' }, { id: 'e2', role: 'enemy' }];

test('with no selection at all the player frame is in its selected (panel) state and enemies stay mini', () => {
  assert.deepEqual(targetHudPinnedIds(entries), ['player']);
  assert.deepEqual(targetHudDesiredIds({ entries }), ['player']);
});

test('enemies show a panel only when eligible, focused, hovered or focused-within', () => {
  assert.deepEqual(targetHudDesiredIds({ entries, eligible: ['e1'] }), ['player', 'e1']);
  assert.deepEqual(targetHudDesiredIds({ entries, focused: 'e2' }), ['player', 'e2']);
  assert.deepEqual(targetHudDesiredIds({ entries, hover: 'e1', focusWithin: 'e2' }), ['player', 'e1', 'e2']);
  assert.deepEqual(targetHudDesiredIds({ entries, eligible: ['gone'] }), ['player']);
});

test('the pinned player adds no floor tint or selection, but a real player target still does', () => {
  assert.deepEqual(targetHudTintIds({ entries, shown: ['player'] }), []);
  assert.deepEqual(targetHudTintIds({ entries, shown: ['player', 'e1'], eligible: ['e1'] }), ['e1']);
  assert.deepEqual(targetHudTintIds({ entries, shown: ['player'], eligible: ['player'] }), ['player']);
  assert.deepEqual(targetHudTintIds({ entries, shown: ['player'], hover: 'player' }), ['player']);
});

test('the rules accept a one-shot iterator (Map.values) as the mount passes it', () => {
  const map = new Map(entries.map(entry => [entry.id, entry]));
  assert.deepEqual(targetHudDesiredIds({ entries: map.values(), eligible: ['e1'] }), ['player', 'e1']);
  assert.deepEqual(targetHudTintIds({ entries: map.values(), shown: ['player', 'e2'], focused: 'e2' }), ['e2']);
});
