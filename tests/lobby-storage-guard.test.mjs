// The lobby's remembered name, tint and sprite style must never be read or
// written through a bare `localStorage`: a sandboxed frame (the branch preview
// runs with no allow-same-origin) throws SecurityError on that property access,
// and Forsaken Together then crashed on open. Every access goes through the
// guarded readLocal/writeLocal helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../src/ui/screens/lobby.js', import.meta.url), 'utf8');

test('lobby reads and writes browser storage only through the guarded helpers', () => {
  const bare = SRC.split('\n').map((line, i) => [i + 1, line]).filter(([, line]) => !line.trim().startsWith('//') && /\blocalStorage\b/.test(line) && !/globalThis\.localStorage/.test(line));
  assert.deepEqual(bare, [], `bare localStorage use in lobby.js: ${JSON.stringify(bare)}`);
});

test('the guarded helpers catch a refused storage access', () => {
  assert.match(SRC, /function readLocal\(key\) \{ try \{[^}]*getItem\(key\)[^}]*\} catch \{/);
  assert.match(SRC, /function writeLocal\(key, value\) \{ try \{[^}]*setItem\(key, value\)[^}]*\} catch \{/);
});
