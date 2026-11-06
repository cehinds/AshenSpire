import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const workflow = readFileSync(new URL('../.github/workflows/pages-builds.yml', import.meta.url), 'utf8');
test('assemble fails an oversized site before it is uploaded', () => {
  const guard = workflow.indexOf('Fail if the assembled site is too big for Pages');
  const upload = workflow.indexOf('actions/upload-pages-artifact');
  assert.ok(guard > 0 && guard < upload, 'the size guard runs before the artifact upload');
  assert.match(workflow, /SITE_MAX_MB: 2500/);
});
