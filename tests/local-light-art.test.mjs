import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const lightRoot = join(root, 'assets-mobile');
const manifest = JSON.parse(readFileSync(join(root, 'art-manifest.json'), 'utf8'));

test('tracked light art exactly matches the pinned manifest', () => {
  const expected = new Map(Object.values(manifest.assets)
    .filter(row => row.light)
    .map(row => [row.light.path, row.light]));
  const files = readdirSync(lightRoot, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name));
  assert.equal(files.length, expected.size, 'all and only manifest light files are present');
  for (const file of files) {
    const path = relative(root, file).replaceAll('\\', '/');
    const row = expected.get(path);
    assert.ok(row, `${path} is in the manifest`);
    const bytes = readFileSync(file);
    assert.equal(bytes.length, row.bytes, `${path} size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, `${path} hash`);
  }
});
