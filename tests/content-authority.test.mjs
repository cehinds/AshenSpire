// The content-authority flip (owner, 2026-10-17): relics, stances and flasks are
// authored as JSON under content/source; src/content/generated/<kind>.js is the
// compiled mirror; src/content/<kind>.js is a re-export shim for importers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { relics } from '../src/content/relics.js';
import { stances } from '../src/content/stances.js';
import { flasks } from '../src/content/flasks.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = { relics, stances, flasks };

for (const [kind, exported] of Object.entries(KINDS)) {
  test(`${kind}: the export deep-equals the authored JSON`, () => {
    const authored = JSON.parse(readFileSync(resolve(ROOT, `content/source/${kind}.json`), 'utf8'));
    assert.ok(Array.isArray(authored) && authored.length > 0, `${kind}.json is a non-empty array`);
    assert.deepStrictEqual(exported, authored);
  });

  test(`${kind}: src/content/${kind}.js is a shim with no object literal`, () => {
    const text = readFileSync(resolve(ROOT, `src/content/${kind}.js`), 'utf8');
    assert.ok(!/\{\s*id\s*:/.test(text), `${kind}.js authors a row (\`{ id:\`) — edit content/source/${kind}.json instead`);
    assert.ok(!/^\s*name\s*:/m.test(text), `${kind}.js authors a \`name:\` line — edit content/source/${kind}.json instead`);
    assert.match(text, new RegExp(`from './generated/${kind}\\.js'`));
  });
}

test('the generated modules are current (content-build --check exits 0)', () => {
  const r = spawnSync(process.execPath, ['tools/content-build.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `content-build --check:\n${r.stdout}\n${r.stderr}`);
});
