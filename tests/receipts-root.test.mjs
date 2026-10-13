// `tools/receipts.mjs --root <dir>` reads CHANGELOG.md and buildordinal.json from
// <dir>, not from the tool's own checkout. pr-restamp runs dev's copy of this tool
// against a pull request's worktree, so the root override is what keeps the check
// on the pull request's tree.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'receipts.mjs');
const PULL = 'https://github.com/cehinds/AshenSpire/pull/';

function tree(stamp) {
  const dir = mkdtempSync(join(tmpdir(), 'receipts-root-'));
  writeFileSync(join(dir, 'CHANGELOG.md'),
    `# Changelog\n\n## 2026-10-13\n\n- **Fixture** ([#987654](${PULL}987654), \`${stamp}\`). Prose.\n`);
  writeFileSync(join(dir, 'buildordinal.json'), JSON.stringify({ release: '0.7.1', ordinal: 5 }));
  return dir;
}

const run = (dir) => spawnSync(process.execPath, [TOOL, '--check', '--pr', '987654', '--root', dir], { encoding: 'utf8' });

test('--root reads the receipt and the box from the given tree: a matching stamp passes', () => {
  const dir = tree('0.7.1.5');
  try {
    const r = run(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /PASS\s+#987654 has a receipt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--root reads the box from the given tree: a stamp for another release fails', () => {
  const dir = tree('0.7.2.5');
  try {
    const r = run(dir);
    assert.equal(r.status, 1, r.stdout + r.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--root does not look at the tool checkout: a number only the checkout names is not found', () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipts-root-empty-'));
  try {
    writeFileSync(join(dir, 'CHANGELOG.md'), `# Changelog\n\n## 2026-10-13\n\n- **Other** ([#1](${PULL}1), \`0.7.1.5\`).\n`);
    writeFileSync(join(dir, 'buildordinal.json'), JSON.stringify({ release: '0.7.1', ordinal: 5 }));
    const r = spawnSync(process.execPath, [TOOL, '--check', '--pr', '1930', '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /#1930 carries no receipt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
