// The combat action timeline as data: defaults, repair of a saved list, and the editing helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TIMELINE_EVENT_IDS, TIMELINE_OFFSET, defaultTimeline, sanitizeTimeline, resolveTimelineSetting, moveTimelineEvent, setTimelineEvent } from '../src/model/combatTimelinePolicy.js';
import { resolveCombatAutomation } from '../src/model/autoCombatPolicy.js';

const ids = list => list.map(row => row.id);
test('the default timeline lists every event once, in the owner order', () => {
  assert.deepEqual(TIMELINE_EVENT_IDS, ['cardPlayed', 'cost', 'actionWord', 'stance', 'swing', 'contact', 'result', 'reaction', 'numbers', 'bars', 'end']);
  assert.deepEqual(defaultTimeline().map(row => [row.id, row.with, row.offsetMs].join(':')), [
    'cardPlayed:previous:0', 'cost:previous:100', 'actionWord:previous:100', 'stance:actionWord:0', 'swing:previous:100', 'contact:previous:0',
    'result:previous:100', 'reaction:previous:100', 'numbers:reaction:0', 'bars:reaction:0', 'end:previous:100']);
  assert.deepEqual([TIMELINE_OFFSET.min, TIMELINE_OFFSET.max, TIMELINE_OFFSET.step], [-500, 1000, 10]);
});
test('an old save without the key uses the defaults, and no reaction override', () => {
  const resolved = resolveCombatAutomation({}).timeline;
  assert.deepEqual(resolved, { shared: defaultTimeline(), reaction: null });
  assert.deepEqual(resolveTimelineSetting('junk'), { shared: defaultTimeline(), reaction: null });
});
test('offsets are clamped and a non-number takes the default', () => {
  const list = sanitizeTimeline([{ id: 'cost', with: 'previous', offsetMs: -9000 }, { id: 'actionWord', with: 'previous', offsetMs: 9000 },
    { id: 'swing', with: 'previous', offsetMs: 'x' }, { id: 'result', with: 'previous', offsetMs: 12.4 }]);
  const by = id => list.find(row => row.id === id);
  assert.deepEqual([by('cost').offsetMs, by('actionWord').offsetMs, by('swing').offsetMs, by('result').offsetMs], [-500, 1000, 100, 12]);
});
test('unknown and repeated ids are dropped and missing ids come back from the defaults', () => {
  const list = sanitizeTimeline([{ id: 'bars' }, { id: 'nope' }, { id: 'bars' }, { id: 'cost' }]);
  assert.equal(list.length, 11);
  assert.deepEqual([...ids(list)].sort(), [...TIMELINE_EVENT_IDS].sort());
  assert.deepEqual(ids(sanitizeTimeline(null)), TIMELINE_EVENT_IDS);
});
test('a with that is not an earlier event becomes previous, so there are no cycles or forward references', () => {
  const list = sanitizeTimeline(defaultTimeline().map(row => row.id === 'cost' ? { ...row, with: 'end' } : row.id === 'numbers' ? { ...row, with: 'numbers' } : row.id === 'result' ? { ...row, with: 'bars' } : row.id === 'contact' ? { ...row, with: 'ghost' } : row));
  const by = id => list.find(row => row.id === id);
  assert.deepEqual(['cost', 'numbers', 'result', 'contact'].map(id => by(id).with), ['previous', 'previous', 'previous', 'previous']);
  assert.equal(by('stance').with, 'actionWord', 'a valid earlier anchor stands');
});
test('moving an event up or down reorders it and repairs anchors that now point forward', () => {
  const up = moveTimelineEvent(defaultTimeline(), 'numbers', -1);
  assert.deepEqual(ids(up).slice(7, 10), ['numbers', 'reaction', 'bars']);
  assert.equal(up.find(row => row.id === 'numbers').with, 'previous', 'numbers was with reaction, now before it');
  assert.deepEqual(ids(moveTimelineEvent(defaultTimeline(), 'cardPlayed', -1)), TIMELINE_EVENT_IDS, 'the first cannot move up');
  assert.deepEqual(ids(moveTimelineEvent(defaultTimeline(), 'end', 1)), TIMELINE_EVENT_IDS, 'the last cannot move down');
});
test('setTimelineEvent changes one row and repairs it', () => {
  const list = setTimelineEvent(defaultTimeline(), 'bars', { with: 'numbers', offsetMs: 40 });
  assert.deepEqual(list.find(row => row.id === 'bars'), { id: 'bars', with: 'numbers', offsetMs: 40 });
  assert.equal(setTimelineEvent(defaultTimeline(), 'bars', { with: 'end' }).find(row => row.id === 'bars').with, 'previous');
});
test('a saved reaction override is validated like the shared list', () => {
  const resolved = resolveTimelineSetting({ shared: [], reaction: [{ id: 'end', offsetMs: 5000 }] });
  assert.equal(resolved.reaction.find(row => row.id === 'end').offsetMs, 1000);
  assert.equal(resolved.reaction.length, 11);
});
