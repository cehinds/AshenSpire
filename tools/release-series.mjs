// Gate current CI/CD builds; archived downloads retain their original versions.
//
// THE SERIES THIS EXPECTS IS A DECISION, NOT A DERIVATION. `release()` reads
// what the tree says; this file says what the tree is ALLOWED to say, so a
// stray MINOR bump cannot ship as if it had been approved. Moving the number
// here is the owner's call (docs/versioning.md: MAJOR and MINOR are his) and
// belongs in the PR that moves the series — 0.6.x → 0.7.x on 2026-09-11, when
// he opened the 0.7 line for the seats work. The selftest's refused corpus
// moves with it: the series on either side of the live one is a FAILURE case,
// which is what makes this a gate rather than a regex that admits anything.
import assert from 'node:assert/strict';
import { release, readOrdinal } from './buildversion.mjs';

// The one place the series is written. tools/version-advance.mjs moves this line
// when `release` merges to `main` (owner, 2026-11-01); nobody hand-edits it.
const SERIES = '0.7';
const [S_MAJOR, S_MINOR] = SERIES.split('.').map(Number);

function checkSeries(sourceRelease, record) {
  if (!new RegExp(`^${S_MAJOR}\\.${S_MINOR}\\.(0|[1-9]\\d*)$`).test(sourceRelease)) {
    throw new Error(`Expected release ${SERIES}.x, received ${sourceRelease}`);
  }
  if (record.release !== sourceRelease || !Number.isSafeInteger(record.ordinal) || record.ordinal < 0) {
    throw new Error('Rebuild the artifacts: release metadata must match the source and use a nonnegative integer build number');
  }
  return `${sourceRelease}.${record.ordinal}`;
}

if (process.argv.includes('--selftest')) {
  for (const [candidate, ordinal] of [[`${SERIES}.0`, 0], [`${SERIES}.2`, 17]]) {
    assert.equal(checkSeries(candidate, { release: candidate, ordinal }), `${candidate}.${ordinal}`);
  }
  for (const candidate of [`${S_MAJOR}.${S_MINOR - 1}.5`, `${S_MAJOR}.${S_MINOR + 1}.0`, `${SERIES}.x`, `${SERIES}.0-rc.1`, `${SERIES}.0.0`]) {
    assert.throws(() => checkSeries(candidate, { release: candidate, ordinal: 0 }));
  }
  assert.throws(() => checkSeries(`${SERIES}.0`, { release: `${S_MAJOR}.${S_MINOR - 1}.5`, ordinal: 0 }));
  for (const ordinal of [-1, 1.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => checkSeries(`${SERIES}.0`, { release: `${SERIES}.0`, ordinal }));
  }
  console.log('release-series: PASS 12/12 valid, outdated, malformed, and mismatched build cases');
} else {
  try {
    console.log(`release-series: PASS 1/1 current build ${checkSeries(release(), readOrdinal())} uses ${SERIES}.x.x`);
  } catch (error) {
    console.error(`release-series: FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
