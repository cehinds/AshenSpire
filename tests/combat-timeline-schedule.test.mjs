import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBeatSchedule, swingScaleFor, flattenTimeline } from '../src/ui/combatTimeline.js';
import { defaultTimeline, sanitizeTimeline, moveTimelineEvent, setTimelineEvent } from '../src/model/combatTimelinePolicy.js';

// An enemy beat: no card is played, so the cardPlayed event takes no time.
const NO_CARD = { skip: new Set(['cardPlayed']) };
const at = (schedule, id, group = 0) => schedule.entries.find(row => row.id === id && row.group === group)?.at;
const order = schedule => schedule.entries.map(row => row.id).join(' ');

test('the defaults place every event where the owner put it', () => {
  const s = computeBeatSchedule(defaultTimeline(), { ...NO_CARD, impactMs: 275 });
  assert.deepEqual(s.starts, { cost: 0, actionWord: 100, stance: 100, swing: 200, contact: 475, result: 575, reaction: 675, numbers: 675, bars: 675, end: 775 });
  assert.equal(order(s), 'cost actionWord stance swing contact result reaction numbers bars end', 'same-time events fire in list order');
  assert.equal(s.swingScale, 1);
});
test('before the swing impact is known, only the events that do not depend on it have a start', () => {
  const s = computeBeatSchedule(defaultTimeline(), { ...NO_CARD, impactMs: null });
  assert.deepEqual([s.starts.cost, s.starts.actionWord, s.starts.stance, s.starts.swing], [0, 100, 100, 200]);
  assert.equal(s.starts.contact, null);
  assert.equal(s.starts.end, null);
  assert.equal(order(s), 'cost actionWord stance swing');
});
test('reordering moves the events and the previous chain follows the new order', () => {
  const moved = moveTimelineEvent(moveTimelineEvent(defaultTimeline(), 'numbers', -1), 'numbers', -1);
  const s = computeBeatSchedule(moved, { ...NO_CARD, impactMs: 275 });
  assert.equal(order(s), 'cost actionWord stance swing contact numbers result reaction bars end');
  assert.equal(at(s, 'numbers'), 475, 'numbers now follows contact with its own offset (0)');
  assert.equal(at(s, 'result'), 575);
});
test('a with anchor starts at that event plus the offset, in either direction', () => {
  const list = setTimelineEvent(setTimelineEvent(defaultTimeline(), 'numbers', { with: 'result', offsetMs: -50 }), 'bars', { with: 'numbers', offsetMs: 30 });
  const s = computeBeatSchedule(list, { ...NO_CARD, impactMs: 275 });
  assert.equal(at(s, 'numbers'), 525);
  assert.equal(at(s, 'bars'), 555);
});
test('start times never go below zero', () => {
  const list = setTimelineEvent(setTimelineEvent(defaultTimeline(), 'cost', { offsetMs: -300 }), 'actionWord', { offsetMs: -500 });
  const s = computeBeatSchedule(list, { ...NO_CARD, impactMs: 100 });
  assert.deepEqual([s.starts.cost, s.starts.actionWord, s.starts.stance], [0, 0, 0]);
});
test('forward references and cycles are repaired to previous before scheduling', () => {
  const raw = defaultTimeline().map(row => row.id === 'cost' ? { ...row, with: 'end' } : row.id === 'numbers' ? { ...row, with: 'bars' } : row);
  const s = computeBeatSchedule(sanitizeTimeline(raw), { ...NO_CARD, impactMs: 275 });
  assert.equal(s.starts.cost, 0);
  assert.equal(s.starts.numbers, 675, 'numbers fell back to previous (reaction, +0)');
  assert.ok(Object.values(s.starts).every(Number.isFinite));
});
test('moving contact later retimes the swing so its impact frame lands on contact', () => {
  const list = setTimelineEvent(defaultTimeline(), 'contact', { offsetMs: 275 });
  const s = computeBeatSchedule(list, { ...NO_CARD, impactMs: 275 });
  assert.equal(s.starts.contact, 750);
  assert.equal(s.swingScale, (750 - 200) / 275);
});
test('the retime factor is clamped: outside 0.25 to 4, or contact at or before the swing, the clip keeps its speed', () => {
  assert.equal(swingScaleFor({ swing: 200, contact: 200 + 275 * 4 }, 275), 4);
  assert.equal(swingScaleFor({ swing: 200, contact: 200 + 275 * 4 + 1 }, 275), 1, 'over 4x');
  assert.equal(swingScaleFor({ swing: 200, contact: 200 + 275 / 4 }, 275), 0.25);
  assert.equal(swingScaleFor({ swing: 200, contact: 200 + 10 }, 275), 1, 'under 0.25x');
  assert.equal(swingScaleFor({ swing: 200, contact: 200 }, 275), 1, 'contact at the swing start');
  assert.equal(swingScaleFor({ swing: 200, contact: 100 }, 275), 1, 'contact before the swing');
  const early = computeBeatSchedule(moveTimelineEvent(moveTimelineEvent(defaultTimeline(), 'contact', -1), 'contact', -1), { ...NO_CARD, impactMs: 275 });
  assert.equal(early.swingScale, 1);
  assert.ok(Number.isFinite(early.starts.contact));
});
test('several reaction groups repeat the result, reaction, numbers and bars, then end moves out', () => {
  const s = computeBeatSchedule(defaultTimeline(), { ...NO_CARD, impactMs: 275, groups: 3 });
  assert.deepEqual([0, 1, 2].map(group => at(s, 'result', group)), [575, 775, 975], 'a segment of 100 ms plus the 100 ms spacing');
  assert.deepEqual([0, 1, 2].map(group => at(s, 'numbers', group)), [675, 875, 1075]);
  assert.equal(at(s, 'end'), 775 + 400, 'end follows the last group');
  assert.equal(s.entries.filter(row => row.id === 'swing').length, 1);
});
test('Instant and Reduced motion flatten every offset and keep the order', () => {
  const s = computeBeatSchedule(flattenTimeline(defaultTimeline()), { ...NO_CARD, impactMs: 0 });
  assert.ok(Object.values(s.starts).every(value => value === 0));
  assert.equal(order(s), 'cost actionWord stance swing contact result reaction numbers bars end');
});

test('a played card opens the beat: cardPlayed, then cost +100, action word +100, swing +100', () => {
  const s = computeBeatSchedule(defaultTimeline(), { impactMs: 275 });
  assert.deepEqual([s.starts.cardPlayed, s.starts.cost, s.starts.actionWord, s.starts.stance, s.starts.swing, s.starts.contact], [0, 100, 200, 200, 300, 575]);
  assert.equal(order(s).split(' ')[0], 'cardPlayed');
});
test('an event that does not apply takes no time, and the wait that followed it goes with it', () => {
  const noStance = computeBeatSchedule(defaultTimeline(), { impactMs: 275, skip: new Set(['cardPlayed', 'stance']) });
  assert.equal(order(noStance), 'cost actionWord swing contact result reaction numbers bars end');
  assert.deepEqual([noStance.starts.cost, noStance.starts.actionWord, noStance.starts.swing], [0, 100, 100], 'the swing follows the action word directly');
  const change = computeBeatSchedule(defaultTimeline(), { impactMs: 275, skip: new Set(['cardPlayed']) });
  assert.deepEqual([change.starts.actionWord, change.starts.stance, change.starts.swing], [100, 100, 200], 'a stance change keeps its place');
  const stanceOnly = computeBeatSchedule(defaultTimeline(), { impactMs: 275, skip: new Set(['stance']) });
  assert.deepEqual([stanceOnly.starts.cardPlayed, stanceOnly.starts.cost, stanceOnly.starts.swing], [0, 100, 200]);
});
