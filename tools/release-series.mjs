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

function checkSeries(sourceRelease, record) {
  if (!/^0\.7\.(0|[1-9]\d*)$/.test(sourceRelease)) {
    throw new Error(`Expected release 0.7.x, received ${sourceRelease}`);
  }
  if (record.release !== sourceRelease || !Number.isSafeInteger(record.ordinal) || record.ordinal < 0) {
    throw new Error('Rebuild the artifacts: release metadata must match the source and use a nonnegative integer build number');
  }
  return `${sourceRelease}.${record.ordinal}`;
}

if (process.argv.includes('--selftest')) {
  for (const [candidate, ordinal] of [['0.7.0', 0], ['0.7.2', 17]]) {
    assert.equal(checkSeries(candidate, { release: candidate, ordinal }), `${candidate}.${ordinal}`);
  }
  for (const candidate of ['0.6.5', '0.8.0', '0.7.x', '0.7.0-rc.1', '0.7.0.0']) {
    assert.throws(() => checkSeries(candidate, { release: candidate, ordinal: 0 }));
  }
  assert.throws(() => checkSeries('0.7.0', { release: '0.6.5', ordinal: 0 }));
  for (const ordinal of [-1, 1.5, '0', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => checkSeries('0.7.0', { release: '0.7.0', ordinal }));
  }
  console.log('release-series: PASS 12/12 valid, outdated, malformed, and mismatched build cases');
} else {
  try {
    console.log(`release-series: PASS 1/1 current build ${checkSeries(release(), readOrdinal())} uses 0.7.x.x`);
  } catch (error) {
    console.error(`release-series: FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
