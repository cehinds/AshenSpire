import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadKept } from '../tools/pages-site.mjs';

// The Pages artifact must stay well under 1 GB (run 42174299001 was 5.2 GB and
// timed out in deploy-pages). These rules are what keeps it there.
test('only a primary channel keeps the offline file, and only for its newest build', () => {
  for (const branch of ['dev', 'test', 'release', 'main']) {
    assert.equal(downloadKept(branch, true), true, `${branch} newest`);
    assert.equal(downloadKept(branch, false), false, `${branch} archived`);
  }
  for (const branch of ['alternative/dev', 'alternative/test', 'alternative/art/dev']) {
    assert.equal(downloadKept(branch, true), false, `${branch} newest`);
  }
});
