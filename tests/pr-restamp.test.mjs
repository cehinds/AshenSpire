// The pure CHANGELOG core of tools/pr-restamp.mjs: the move of a pull request's
// receipt lines into the newest date group, and the re-stamp of one pull request's
// receipts. The git side (the merge, the checks, the abort) is exercised by the
// real-repo runs recorded in the pull request, not here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReceiptLines, restampReceipts } from '../tools/pr-restamp.mjs';

const PULL = 'https://github.com/cehinds/AshenSpire/pull/';
const rc = (n, stamp) => `- **Title ${n}** ([#${n}](${PULL}${n}), \`${stamp}\`). Prose.`;
const DEV = [
  '# Changelog', '', 'intro', '',
  '## 2026-10-12', '', rc(1907, '0.7.1.1457'), rc(1928, '0.7.1.1455'), '',
  '## 2026-10-11', '', rc(1900, '0.7.1.1400'), '',
].join('\n');
const STAMP = '0.7.1.1460';
const prText = (date, ...lines) => `# Changelog\n\n## ${date}\n\n${lines.join('\n')}\n`;
const headings = (t) => t.split('\n').filter((l) => l.startsWith('## '));

test('an old-dated PR receipt lands in the newest group as its first bullet', () => {
  const out = mergeReceiptLines(DEV, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-12');
  const lines = out.split('\n');
  const h = lines.indexOf('## 2026-10-12');
  assert.equal(lines[h + 2], rc(1930, STAMP));
  assert.equal(lines[h + 3], rc(1907, '0.7.1.1457'));
  assert.ok(lines.indexOf(rc(1930, STAMP)) < lines.indexOf('## 2026-10-11'));
  assert.equal(lines.filter((l) => l.includes(`${PULL}1930)`)).length, 1);
});

test('a today group is created at the top when the newest group is older', () => {
  const out = mergeReceiptLines(DEV, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-13');
  assert.deepEqual(headings(out), ['## 2026-10-13', '## 2026-10-12', '## 2026-10-11']);
  assert.ok(out.includes(`## 2026-10-13\n\n${rc(1930, STAMP)}\n\n## 2026-10-12`));
});

test('a newest group dated after today is used as it is', () => {
  const out = mergeReceiptLines(DEV, prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-11');
  assert.deepEqual(headings(out), ['## 2026-10-12', '## 2026-10-11']);
  assert.ok(out.includes(`## 2026-10-12\n\n${rc(1930, STAMP)}`));
});

test('with no date group yet, the today group is appended', () => {
  const out = mergeReceiptLines('# Changelog\n\nintro\n', prText('2026-10-11', rc(1930, '0.7.1.1450')), 1930, STAMP, '2026-10-13');
  assert.ok(out.endsWith(`## 2026-10-13\n\n${rc(1930, STAMP)}\n`));
});

test('a PR line already in the base is moved to the newest group, never duplicated', () => {
  const out = mergeReceiptLines(DEV, prText('2026-10-12', rc(1928, '0.7.1.1450')), 1928, STAMP, '2026-10-12');
  const lines = out.split('\n');
  assert.equal(lines.filter((l) => l.includes(`${PULL}1928)`)).length, 1);
  assert.equal(lines[lines.indexOf('## 2026-10-12') + 2], rc(1928, STAMP));
  assert.ok(!out.includes('0.7.1.1455'));
});

test("other pull requests' lines are untouched and keep their order", () => {
  const out = mergeReceiptLines(DEV, prText('2026-10-12', rc(1928, '0.7.1.1450')), 1928, STAMP, '2026-10-12');
  const others = (t) => t.split('\n').filter((l) => l.startsWith('- ') && !l.includes(`${PULL}1928)`));
  assert.deepEqual(others(out), others(DEV));
});

test('a PR text without a receipt for #N returns the base unchanged', () => {
  assert.equal(mergeReceiptLines(DEV, '## 2026-10-13\n\nnothing\n', 1930, STAMP, '2026-10-13'), DEV);
});

test('restampReceipts changes only #N, and pull/19 does not match pull/1907', () => {
  const two = `${rc(1907, '0.7.1.1457')}\n${rc(1930, '0.7.1.1450')}`;
  assert.equal(restampReceipts(two, 1930, STAMP), `${rc(1907, '0.7.1.1457')}\n${rc(1930, STAMP)}`);
  assert.equal(restampReceipts(rc(1907, '0.7.1.1457'), 19, STAMP), rc(1907, '0.7.1.1457'));
});
