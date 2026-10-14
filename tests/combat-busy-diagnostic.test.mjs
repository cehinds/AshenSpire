// An owner's report that "I can't select a target / can't end turn" on a phone
// needs to carry its own cause. An input the combat screen ignores because it
// is busy writes a debug-log line naming every lock and how long busy has
// held; past 3 s it writes a second `stuck` line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

test('the lock report names busy, its age, the playback, reaction and discard locks, and the phase', () => {
  const report = source.slice(source.indexOf('const lockReport = () => {'), source.indexOf('const logIgnored'));
  for (const field of ['busy', 'busyForMs', 'enemyPlayback', 'pendingReaction', 'reactionModalOpen', 'pendingDiscard', 'phase', 'result']) {
    assert.match(report, new RegExp(`\\b${field}\\b`), `${field} is reported`);
  }
});

test('an ignored input past 3 s of busy adds a stuck line, and every ignored site uses it', () => {
  assert.match(source, /if \(why\.busyForMs > 3000\) dlog\('stuck'/);
  for (const site of ["logIgnored(`useFlask slot=${slot}`, lockReport())", "logIgnored(`playCard ${instanceId}`, why)", "logIgnored('endTurn', why)"]) {
    assert.ok(source.includes(site), `${site} is wired`);
  }
  assert.equal((source.match(/const why = lockReport\(\);/g) || []).length, 2, 'playCard and endTurn build their report from lockReport');
  assert.doesNotMatch(source, /dlog\('ignored', (?:`(?:playCard|useFlask)|'endTurn')/, 'no ignored site bypasses logIgnored');
});

test('the busy age is sampled by a watchdog that stops when the screen leaves', () => {
  assert.match(source, /const busyWatch = setInterval\(\(\) => \{\s*if \(!combatEl\.isConnected\) \{ clearInterval\(busyWatch\); return; \}/);
});
