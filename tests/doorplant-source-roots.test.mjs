import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doorSelftest } from '../tools/doorplant.mjs';

test('copied source doors retain engine imports and authored game data', async () => {
  const root = mkdtempSync(join(tmpdir(), 'doorplant-source-roots-'));
  try {
    for (const dir of ['tools', 'engine', 'games']) mkdirSync(join(root, dir));
    writeFileSync(join(root, 'engine/runtime.mjs'), 'export const ready = true;\n');
    writeFileSync(join(root, 'games/config.json'), '{"enabled":true}\n');
    writeFileSync(join(root, 'tools/probe.mjs'), `
import { ready } from '../engine/runtime.mjs';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../games/config.json', import.meta.url)));
if (!ready || !config.enabled) { console.error('source roots: disabled'); process.exit(1); }
console.log('source roots: OK');
`);
    assert.equal(await doorSelftest({
      tool: 'probe.mjs', realRoot: root,
      plants: [{ name: 'authored configuration disables runtime', file: 'games/config.json',
        find: '"enabled":true', replace: '"enabled":false', expectRed: /source roots: disabled/ }],
    }), 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
