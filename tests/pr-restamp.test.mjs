// The pure CHANGELOG core of tools/pr-restamp.mjs: the merge of a pull request's
// receipt lines into dev's text, and the re-stamp of one pull request's receipts.
// The git side (the merge, the checks, the abort) is exercised by --selftest's
// real-repo runs in the pull request, not here.

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
const headings = (t) => t.split('\n').filter((l) => l.startsWith('## '));

test('a PR line under an existing heading becomes its first bullet', () => {
  const out = mergeReceiptLines(DEV, `## 2026-10-12\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  const lines = out.split('\n');
  const h = lines.indexOf('## 2026-10-12');
  assert.equal(lines[h + 2], rc(1930, STAMP));
  assert.equal(lines[h + 3], rc(1907, '0.7.1.1457'));
});

test('a missing heading is created in date-descending order', () => {
  const newer = mergeReceiptLines(DEV, `## 2026-10-13\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  assert.deepEqual(headings(newer), ['## 2026-10-13', '## 2026-10-12', '## 2026-10-11']);
  assert.ok(newer.includes(`## 2026-10-13\n\n${rc(1930, STAMP)}\n\n## 2026-10-12`));

  const oldest = mergeReceiptLines(DEV, `## 2026-09-30\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  assert.deepEqual(headings(oldest), ['## 2026-10-12', '## 2026-10-11', '## 2026-09-30']);

  const middle = mergeReceiptLines(DEV.replace('## 2026-10-11', '## 2026-10-09'),
    `## 2026-10-10\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP);
  assert.deepEqual(headings(middle), ['## 2026-10-12', '## 2026-10-10', '## 2026-10-09']);
});

test('a PR line already in dev is replaced, never duplicated', () => {
  const out = mergeReceiptLines(DEV, `## 2026-10-12\n\n${rc(1928, '0.7.1.1450')}\n`, 1928, STAMP);
  assert.equal(out.split('\n').filter((l) => l.includes(`${PULL}1928)`)).length, 1);
  assert.ok(out.includes(rc(1928, STAMP)));
  assert.ok(!out.includes('0.7.1.1455'));
});

test("other pull requests' lines are untouched and keep their order", () => {
  const out = mergeReceiptLines(DEV, `## 2026-10-12\n\n${rc(1928, '0.7.1.1450')}\n`, 1928, STAMP);
  const others = (t) => t.split('\n').filter((l) => l.startsWith('- ') && !l.includes(`${PULL}1928)`));
  assert.deepEqual(others(out), others(DEV));
});

test('a PR text without a receipt for #N leaves dev unchanged', () => {
  assert.equal(mergeReceiptLines(DEV, '## 2026-10-13\n\nnothing\n', 1930, STAMP), DEV);
});

test('a receipt under a non-date heading is refused', () => {
  assert.throws(() => mergeReceiptLines(DEV, `## History\n\n${rc(1930, '0.7.1.1450')}\n`, 1930, STAMP));
});

test('restampReceipts changes only #N, and pull/19 does not match pull/1907', () => {
  const two = `${rc(1907, '0.7.1.1457')}\n${rc(1930, '0.7.1.1450')}`;
  assert.equal(restampReceipts(two, 1930, STAMP), `${rc(1907, '0.7.1.1457')}\n${rc(1930, STAMP)}`);
  assert.equal(restampReceipts(rc(1907, '0.7.1.1457'), 19, STAMP), rc(1907, '0.7.1.1457'));
});
