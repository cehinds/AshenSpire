import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { latestReactionNote } from '../src/ui/components/reactionNote.js';

// Late in a long fight the event log holds thousands of entries (about 1 KB each). The reaction note runs
// on every combat render; it must read only the entries after the last note, never copy the whole log
// (combat perf, 2026-11-19).
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function renderReactionNote() {');
const end = source.indexOf('\n  }\n', begin);
assert.ok(begin >= 0 && end > begin);
const body = source.slice(begin, end + 4);

function fixture(logSize) {
  const eventLog = Array.from({ length: logSize }, (_, i) => ({ type: 'damage', amount: i }));
  const read = [], shown = [];
  const context = {
    combat: { eventLog, enemies: [] }, combatEl: null, disp: null, run: { customization: {} }, registries: {},
    reactionNoteSeen: logSize - 1,
    reactionNote: { attach() {}, show: text => shown.push(text) },
    CharacterDisplayName: () => 'Hero', runClassIdentity: () => ({ name: 'Reaver' }),
    latestReactionNote: (events, options) => { read.push(events.length); return latestReactionNote(events, options); },
  };
  runInNewContext(body + '\nglobalThis.renderReactionNote = renderReactionNote;', context);
  return { context, eventLog, read, shown };
}

test('a render with no new log entries reads nothing, however long the log', () => {
  for (const size of [20, 2000]) {
    const probe = fixture(size);
    probe.context.renderReactionNote();
    assert.deepEqual(probe.read, [], `log of ${size}`);
  }
});

test('a render reads only the new tail of a 2,000-entry log and still finds the note', () => {
  const probe = fixture(2000);
  probe.eventLog.push({ type: 'damage' }, { type: 'combatReactionUnavailable', reason: 'stamina', cardId: 'counter' }, { type: 'damage' });
  probe.context.renderReactionNote();
  assert.deepEqual(probe.read, [3], 'three new entries read, not 2,003');
  assert.equal(probe.shown.length, 1);
  assert.equal(probe.context.reactionNoteSeen, 2001, 'the seen mark is the full-log index');
  probe.context.renderReactionNote();
  assert.deepEqual(probe.read, [3, 1], 'the next render reads only what follows the note');
  assert.equal(probe.shown.length, 1, 'the same note is not shown twice');
});

test('during playback only the shown part of the log is read', () => {
  const probe = fixture(2000);
  probe.eventLog.push({ type: 'combatReactionUnavailable', reason: 'stamina', cardId: 'counter' }, { type: 'damage' });
  probe.context.disp = { logLength: 2000 };
  probe.context.renderReactionNote();
  assert.deepEqual(probe.read, [], 'the note waits until its beat is shown');
  probe.context.disp = { logLength: 2001 };
  probe.context.renderReactionNote();
  assert.deepEqual(probe.read, [1]);
  assert.equal(probe.shown.length, 1);
});
