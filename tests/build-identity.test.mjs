// tests/build-identity.test.mjs — every tools/ module the bundler imports is
// build identity. tools/bundle.mjs and the modules it reaches decide which bytes
// a build carries (since docs/EXTERNAL-ASSETS-PLAN.md step 12, which cache or
// tree the art is read from), so a change to any of them must move the source
// digest. This walks the static and dynamic relative imports from
// tools/bundle.mjs and requires each tools/ file to be in BUILD_IDENTITY_FILES.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_IDENTITY_FILES } from '../tools/buildversion.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Relative imports of a module, as repository paths. */
function importsOf(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const out = [];
  for (const re of [/^\s*import\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm, /^\s*export\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm, /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g]) {
    for (const m of src.matchAll(re)) out.push(posix.normalize(posix.join(posix.dirname(rel), m[1])));
  }
  return out;
}

function bundlerToolGraph(entry = 'tools/bundle.mjs') {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel) || !existsSync(join(ROOT, rel))) continue;
    seen.add(rel);
    queue.push(...importsOf(rel));
  }
  return [...seen].filter((rel) => rel.startsWith('tools/')).sort();
}

test('every tools/ module tools/bundle.mjs imports, directly or not, is in BUILD_IDENTITY_FILES', () => {
  const graph = bundlerToolGraph();
  assert.ok(graph.includes('tools/art-source.mjs') && graph.includes('tools/fetch-art.mjs'), `the walk reaches the art readers: ${graph.join(', ')}`);
  const missing = graph.filter((rel) => !BUILD_IDENTITY_FILES.includes(rel));
  assert.deepEqual(missing, [], `tools/bundle.mjs reaches these without them moving the build digest: ${missing.join(', ')}`);
});
