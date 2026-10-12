// A REFUSED RUN START MUST SAY SO (owner, 2026-10-11: Begin on the sandboxed
// branch preview did nothing with no message). From character creation the
// Settings modal is closed, so showSettingsNotice has nowhere to speak and
// returns false. The profile-write failure then fell through silently. The
// newRun onFailure now falls back to the run-start banner in that case.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('a refused run start shows a banner when Settings did not speak', () => {
  assert.match(
    source,
    /if \(!showSettingsNotice\(message, 'profile'\)\) failureBanner\(`run:start:\$\{error\.message\}`, 'THIS RUN COULD NOT START'/,
  );
});

test('the refusal reaches the command log, which the banner overflow points to', () => {
  assert.match(source, /dlog\('ERROR', `run start refused: \$\{error\.message\}`\)/);
});

test('newRun no longer hands the failure to Settings alone as a bare one-liner', () => {
  assert.doesNotMatch(source, /onFailure: error => showSettingsNotice\(`/);
});
