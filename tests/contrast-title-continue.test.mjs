// The contrast audit's "Continue (highlighted, gold)" row must measure the
// HIGHLIGHTED Continue (Codex P2 on #1282). title.js adds `is-highlighted` only
// when a slot is occupied, and leaves Continue `disabled` when none is, so a
// selector that matched `.slot-continue` alone could measure the disabled entry
// and report its ink as the gold one. The row now names the highlighted,
// enabled entry, so a fixture without a save reads BLIND (a gate failure), not
// a quiet wrong number; and ?shot=title must seed that save through the real
// doors before it shows the title.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the Continue row targets the highlighted, enabled entry (source contract S8)', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'contrast-audit.mjs'), '--source-selftest'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /RED {2}Continue row measures an unhighlighted Continue — S8 /);
});

test('?shot=title seeds an occupied slot before it shows the title', () => {
  const main = readFileSync(join(ROOT, 'src', 'main.js'), 'utf8');
  const branch = /\} else if \(shotState === 'title'\) \{([\s\S]*?)\n\} else if/.exec(main)?.[1] || '';
  const seed = branch.indexOf('newRun(');
  const show = branch.indexOf('showTitle()');
  assert.ok(seed >= 0 && show > seed, 'the ?shot=title branch must call newRun(...) before showTitle()');
});
