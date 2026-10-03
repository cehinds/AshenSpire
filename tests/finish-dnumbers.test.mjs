// docs/FINISH.md's "## Owner decisions" section numbers every ruling D<n>, and
// other docs, tools and source comments cite rulings by that number. Two
// rulings both numbered D38 (CI wall time, #1458, and hit sound tiers, #1472)
// landed on `dev` on 2026-10-02 and a third nearly did, so a citation of "D38"
// could mean either. This fails if any D-number is defined twice there.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const finish = readFileSync(join(root, 'docs', 'FINISH.md'), 'utf8');

// The section runs from its heading to the next `## ` heading.
export function ownerDecisions(md) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^## Owner decisions\s*$/.test(l));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

// A definition is a list item that opens with a bold `D<n> — ` label.
export function definitions(lines) {
  const out = [];
  for (const line of lines) {
    const m = /^\s*-\s+\*\*D(\d+)\s+—/.exec(line);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

export function duplicates(nums) {
  const seen = new Set();
  const dup = new Set();
  for (const n of nums) (seen.has(n) ? dup : seen).add(n);
  return [...dup].sort((a, b) => a - b);
}

test('docs/FINISH.md has an Owner decisions section with D-numbered rulings', () => {
  const lines = ownerDecisions(finish);
  assert.ok(lines, 'docs/FINISH.md has no "## Owner decisions" section');
  assert.ok(definitions(lines).length >= 10, 'expected at least 10 D-numbered rulings');
});

test('no D-number is defined twice in Owner decisions', () => {
  const dup = duplicates(definitions(ownerDecisions(finish)));
  assert.deepEqual(dup, [], `D-number(s) defined more than once: ${dup.map((n) => `D${n}`).join(', ')}`);
});

test('the duplicate check catches a repeated number (self-test)', () => {
  const md = ['## Owner decisions', '- **D1 — a.** x', '- **D2 — b.** y', '- **D1 — c.** z', '## Waves', '- **D2 — not here.**'].join('\n');
  assert.deepEqual(duplicates(definitions(ownerDecisions(md))), [1]);
});
