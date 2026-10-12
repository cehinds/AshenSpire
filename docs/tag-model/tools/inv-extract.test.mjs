// A re-extraction (build.mjs --inv) keeps the authored combat-symbols columns
// artBrief and priority: the raw inventory does not carry them, so the build
// must put back the values the existing CSV holds, matched by tagKey.
// The test runs the build on a temporary copy of the repo, never the real tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readTable, toCsv } from './csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// The presentation inventory is generated and not on every branch: skip when absent.
const HAS_PRES = existsSync(join(ROOT, 'docs', 'tag-model', 'tables', 'presentation'));

test('--inv keeps authored artBrief and priority on placeholder rows', { skip: !HAS_PRES }, () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tag-inv-'));
  try {
    for (const d of ['src', 'content', 'styles', join('docs', 'tag-model')]) {
      cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
    }
    const pres = join(tmp, 'docs', 'tag-model', 'tables', 'presentation');
    const before = readTable(join(pres, 'combat-symbols.csv'));
    const H = c => before.header.indexOf(c);
    const want = new Map(before.rows.map(r => [r[H('tagKey')], [r[H('artBrief')], r[H('priority')]]]));
    const placeholders = before.rows.filter(r => r[H('status')] === 'placeholder').length;
    assert.equal(placeholders, 56);

    // Raw inventory: every presentation CSV as the extraction writes it, with the
    // authored columns removed from combat-symbols.
    const raw = join(tmp, 'raw');
    mkdirSync(raw);
    for (const f of readdirSync(pres)) {
      if (f === 'combat-symbols.csv') {
        const t = readTable(join(pres, f));
        const keep = t.header.map((h, i) => [h, i]).filter(([h]) => h !== 'artBrief' && h !== 'priority');
        writeFileSync(join(raw, f), toCsv(keep.map(([h]) => h), t.rows.map(r => keep.map(([, i]) => r[i]))));
      } else {
        writeFileSync(join(raw, f), readFileSync(join(pres, f)));
      }
    }

    execFileSync(process.execPath, [join(tmp, 'docs', 'tag-model', 'tools', 'build.mjs'), '--inv', raw], { cwd: tmp, stdio: 'pipe' });

    const after = readTable(join(pres, 'combat-symbols.csv'));
    const A = c => after.header.indexOf(c);
    let kept = 0;
    for (const r of after.rows) {
      const key = r[A('tagKey')];
      const exp = want.get(key);
      assert.deepEqual([r[A('artBrief')], r[A('priority')]], exp, `${key} lost its authored values`);
      if (r[A('status')] === 'placeholder') { assert.ok(r[A('artBrief')], key); kept++; }
    }
    assert.equal(kept, 56);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
