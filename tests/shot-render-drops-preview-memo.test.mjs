// tests/shot-render-drops-preview-memo.test.mjs — a shot probe edits the fight
// directly and re-renders; the memoised previews must not outlive that edit.
//
// tools/tutorial-reach.mjs seeds an attack into combat.piles.hand without a
// dispatch, then calls window.__renderCombatForShot(). The preview memo keeps
// its knowledge view until a dispatch invalidates it, so a render that reused
// it asked the engine about a card the stale view had never seen and the hand
// render threw "Unknown card instance" (test promotion #2389). Two guards, both
// read from the source like the other combat-screen anchors: the shot hook
// drops the memo before rendering, and the availability sentence catches a
// card the engine cannot resolve instead of throwing out of renderHand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

test('the shot render hook drops the preview memo before it renders', () => {
  const hook = source.match(/window\.__renderCombatForShot = ([^\n]+)/);
  assert.ok(hook, 'the shot hook is still defined');
  assert.match(hook[1], /previewMemo\.invalidate\(\)/, 'a direct edit of the fight is seen by the next shot render');
  assert.match(hook[1], /render\(\)/, 'and it still renders');
});

test('a card the engine cannot resolve is unavailable, not a throw out of the hand render', () => {
  const begin = source.indexOf('function inspectionPlayAction(instanceId)');
  const end = source.indexOf('return { enabled: true, needsTarget: pv.needsTarget', begin);
  assert.ok(begin >= 0 && end > begin, 'inspectionPlayAction still resolves the preview before the resource check');
  const body = source.slice(begin, end);
  assert.match(body, /try \{ pv = previewCard\(combat, instanceId, undefined, upcastRanksByCard\.get\(instanceId\)\); \}/);
  assert.match(body, /catch \(e\) \{[^}]*return unavailable\(/, 'the catch answers with an unavailability sentence');
});
